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
  static #listening = false;

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
    if (!ScrollVar.#listening) {
      window.addEventListener("scroll", ScrollVar.#handleScroll, { passive: true });
      window.addEventListener("resize", ScrollVar.#handleResize);
      ScrollVar.#listening = true;
    }
  }

  static #unregister(instance) {
    ScrollVar.#instances.delete(instance);
    if (ScrollVar.#instances.size === 0) {
      window.removeEventListener("scroll", ScrollVar.#handleScroll);
      window.removeEventListener("resize", ScrollVar.#handleResize);
      ScrollVar.#listening = false;
    }
  }

  static #handleScroll() {
    for (const instance of ScrollVar.#instances) {
      instance.#update();
    }
  }

  static #handleResize() {
    for (const instance of ScrollVar.#instances) {
      instance.winHeight = window.innerHeight;
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
      this.instances.push({ el, varName });
    }
  }

  #update() {
    if (this.destroyed || this.instances.length === 0) {
      return;
    }

    const viewportCenter = this.winHeight / 2;

    for (const { el, varName } of this.instances) {
      const rect = el.getBoundingClientRect();

      if (!Number.isFinite(rect.top) || !Number.isFinite(rect.height)) {
        continue;
      }

      if (this.defaults.onlyVisible && (rect.bottom < 0 || rect.top > this.winHeight)) {
        continue;
      }

      const elementCenter = rect.top + rect.height / 2;
      el.style.setProperty(varName, Math.round(elementCenter - viewportCenter));
    }
  }

  // ─── public ─────────────────────────────────────────────────────────────────

  /** Force a recalculation outside scroll/resize if you need it. */
  refresh() {
    if (this.destroyed) {
      return;
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
    this.refresh();
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
