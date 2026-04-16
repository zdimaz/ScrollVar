/**
 * ScrollVar — maps scroll position to a CSS custom property on each element.
 *
 * Instead of applying transforms directly, this class writes a single unitless
 * number to a CSS variable. All visual effects live in CSS, so you get full
 * control: media-query overrides, per-component tuning, and any CSS function
 * (calc, clamp, hue-rotate, opacity…) without touching JS.
 *
 * Variable value: (elementCenter − viewportCenter) in pixels, unitless.
 *   negative → element is below the viewport centre
 *   zero     → element centre is exactly at viewport centre
 *   positive → element is above the viewport centre
 *
 * Usage:
 *   new ScrollVar('.hero');
 *   new ScrollVar('[data-scroll-var]', { varName: '--offset' });
 *
 * Per-element variable name via data attribute:
 *   <section data-scroll-var="--my-offset"></section>
 *
 * CSS examples:
 *   // Parallax (speed controlled entirely in CSS)
 *   .hero {
 *     --speed: 0.15;
 *     transform: translateY(calc(var(--scroll-offset) * var(--speed) * 1px));
 *   }
 *   @media (max-width: 768px) {
 *     .hero { --speed: 0.05; }
 *   }
 *
 *   // Fade on scroll
 *   .card {
 *     opacity: clamp(0, calc(1 - abs(var(--scroll-offset)) / 400), 1);
 *   }
 *
 *   // Hue shift
 *   .bg {
 *     filter: hue-rotate(calc(var(--scroll-offset) / 10 * 1deg));
 *   }
 */
export default class ScrollVar {
  static #instances = new Set();
  static #boundScroll = null;
  static #boundResize = null;
  static #boundLoad = null;
  static #boundPageShow = null;
  static #fontsReadyAttached = false;

  /**
   * @param {string|Element|NodeList|HTMLCollection} selector
   * @param {object}  [options]
   * @param {string}  [options.varName='--scroll-offset']  CSS variable name to write.
   * @param {boolean} [options.onlyVisible=true]           Skip fully off-screen elements.
   */
  constructor(selector, options = {}) {
    this.defaults = {
      varName: options.varName ?? "--scroll-offset",
      onlyVisible: options.onlyVisible ?? true,
    };
    this.instances = [];
    this.winHeight = window.innerHeight;
    this.destroyed = false;

    this.#collect(selector);
    ScrollVar.#register(this);
    this.#update();
  }

  // ─── private ────────────────────────────────────────────────────────────────

  static #register(instance) {
    ScrollVar.#instances.add(instance);
    ScrollVar.#ensureGlobalEvents();
  }

  static #unregister(instance) {
    ScrollVar.#instances.delete(instance);
    if (ScrollVar.#instances.size === 0) {
      ScrollVar.#teardownGlobalEvents();
    }
  }

  static #ensureGlobalEvents() {
    if (!ScrollVar.#boundScroll) {
      ScrollVar.#boundScroll = () => ScrollVar.#updateAll();
      window.addEventListener("scroll", ScrollVar.#boundScroll, { passive: true });
    }

    if (!ScrollVar.#boundResize) {
      ScrollVar.#boundResize = () => {
        for (const instance of ScrollVar.#instances) {
          instance.winHeight = window.innerHeight;
          instance.refresh();
        }
      };
      window.addEventListener("resize", ScrollVar.#boundResize);
    }

    if (!ScrollVar.#boundLoad) {
      ScrollVar.#boundLoad = () => ScrollVar.#refreshAll();
      window.addEventListener("load", ScrollVar.#boundLoad, { once: true });
    }

    if (!ScrollVar.#boundPageShow) {
      ScrollVar.#boundPageShow = () => ScrollVar.#refreshAll();
      window.addEventListener("pageshow", ScrollVar.#boundPageShow);
    }

    if (!ScrollVar.#fontsReadyAttached && document.fonts?.ready) {
      ScrollVar.#fontsReadyAttached = true;
      document.fonts.ready.then(() => ScrollVar.#refreshAll()).catch(() => {});
    }
  }

  static #teardownGlobalEvents() {
    if (ScrollVar.#boundScroll) {
      window.removeEventListener("scroll", ScrollVar.#boundScroll);
      ScrollVar.#boundScroll = null;
    }

    if (ScrollVar.#boundResize) {
      window.removeEventListener("resize", ScrollVar.#boundResize);
      ScrollVar.#boundResize = null;
    }

    if (ScrollVar.#boundLoad) {
      window.removeEventListener("load", ScrollVar.#boundLoad);
      ScrollVar.#boundLoad = null;
    }

    if (ScrollVar.#boundPageShow) {
      window.removeEventListener("pageshow", ScrollVar.#boundPageShow);
      ScrollVar.#boundPageShow = null;
    }
  }

  static #refreshAll() {
    for (const instance of ScrollVar.#instances) {
      instance.winHeight = window.innerHeight;
      instance.refresh();
    }
  }

  static #updateAll() {
    for (const instance of ScrollVar.#instances) {
      instance.#update();
    }
  }

  #collect(selector) {
    const elements =
      typeof selector === "string"
        ? document.querySelectorAll(selector)
        : selector instanceof Element
          ? [selector]
          : Array.from(selector);

    for (const el of elements) {
      // data-scroll-var="--custom-name" overrides the default variable name
      const varName = el.dataset.scrollVar || this.defaults.varName;
      const metrics = this.#measure(el);
      this.instances.push({ el, varName, top: metrics.top, height: metrics.height });
    }
  }

  #update() {
    if (this.destroyed || this.instances.length === 0) {
      return;
    }

    const scrollTop = window.scrollY;
    const viewportCenter = scrollTop + this.winHeight / 2;

    for (const { el, varName, top, height } of this.instances) {
      if (this.defaults.onlyVisible && (top + height < scrollTop || top > scrollTop + this.winHeight)) {
        continue;
      }

      const elementCenter = top + height / 2;
      el.style.setProperty(varName, Math.round(elementCenter - viewportCenter));
    }
  }

  #measure(el) {
    const rect = typeof el.getBoundingClientRect === "function" ? el.getBoundingClientRect() : null;

    let top = rect ? rect.top + window.scrollY : 0;
    let height = rect ? rect.height : 0;

    if (!Number.isFinite(height) || height <= 0) {
      height = el.offsetHeight ?? 0;
    }

    if ((!Number.isFinite(height) || height <= 0) && typeof el.getBBox === "function") {
      try {
        height = el.getBBox().height;
      } catch {
        height = 0;
      }
    }

    if (!Number.isFinite(top)) {
      top = 0;
    }

    if (!Number.isFinite(height)) {
      height = 0;
    }

    return { top, height };
  }

  // ─── public ─────────────────────────────────────────────────────────────────

  /** Recalculate element positions after layout changes (e.g. fonts loaded, images resized). */
  refresh() {
    if (this.destroyed) {
      return;
    }

    for (const inst of this.instances) {
      const metrics = this.#measure(inst.el);
      inst.top = metrics.top;
      inst.height = metrics.height;
    }
    this.#update();
  }

  /**
   * Add more elements to an existing instance.
   * @param {string|Element|NodeList|HTMLCollection} selector
   * @param {object} [options]
   */
  add(selector, options = {}) {
    if (this.destroyed) {
      return;
    }

    const saved = { ...this.defaults };
    Object.assign(this.defaults, options);
    this.#collect(selector);
    this.defaults = saved;
    this.#update();
  }

  /** Remove CSS variables from all tracked elements and stop updates. */
  destroy() {
    if (this.destroyed) {
      return;
    }

    for (const { el, varName } of this.instances) {
      el.style.removeProperty(varName);
    }
    this.instances = [];
    this.destroyed = true;
    ScrollVar.#unregister(this);
  }
}
