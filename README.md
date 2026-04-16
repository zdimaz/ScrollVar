# ScrollVar

![license](https://img.shields.io/badge/license-MIT-blue)
**Tiny scroll library (~700 bytes gzipped) that maps scroll position to a CSS custom property. All effects live in CSS.**

Instead of applying `transform` directly in JS, ScrollVar writes a single unitless number to a CSS variable. Every visual effect — parallax, fade, hue shift, scale, clip-path — is expressed in CSS. JS stays out of the way.

**[Live Demo →](https://zdimaz.github.io/scrollvar/demo/)**

---

## Why CSS-driven?

|                               | Classic parallax             | ScrollVar                   |
| ----------------------------- | ---------------------------- | --------------------------- |
| Where effects live            | JS                           | CSS                         |
| Speed control                 | JS option                    | CSS `--speed` variable      |
| Media queries                 | JS resize handler            | Native `@media`             |
| Effect types                  | Usually only `translateY`    | Any CSS property            |
| Multiple effects, one element | Multiple classes / instances | One variable, many `calc()` |

**One `new ScrollVar('.section')` → unlimited CSS effects, zero JS changes.**

---

## Install

Copy [`scrollvar.js`](./scrollvar.js) directly into your project — zero dependencies, single file.

---

## Usage

**JS — one line:**

```js
import ScrollVar from "./scrollvar.js";
new ScrollVar(".hero");
```

**CSS — all the logic:**

```css
/* Parallax — speed controlled entirely in CSS */
.hero {
  --speed: 0.15;
  transform: translateY(calc(var(--scroll-offset) * var(--speed) * 1px));
}

/* On mobile — just change the variable */
@media (max-width: 768px) {
  .hero {
    --speed: 0.05;
  }
}

/* Fade on scroll */
.card {
  opacity: clamp(0, calc(1 - abs(var(--scroll-offset)) / 400), 1);
}

/* Hue shift */
.bg {
  filter: hue-rotate(calc(var(--scroll-offset) / 10 * 1deg));
}

/* Scale */
.badge {
  scale: clamp(0.5, calc(1 - abs(var(--scroll-offset)) / 600), 1.2);
}
```

---

## Variable value

`--scroll-offset` is a **unitless pixel number**:

```
elementCenter − viewportCenter
```

| Value      | Meaning                              |
| ---------- | ------------------------------------ |
| `0`        | Element center is at viewport center |
| `negative` | Element is below viewport center     |
| `positive` | Element is above viewport center     |

This makes it natural for symmetrical effects like fade and scale: `abs(var(--scroll-offset))` is the distance from the sweet spot.

---

## Per-element variable name

Use `data-scroll-var` when different sections need different variable names:

```html
<section class="hero" data-scroll-var="--hero-offset"></section>
<section class="about" data-scroll-var="--about-offset"></section>
```

```js
new ScrollVar("[data-scroll-var]");
```

```css
.hero {
  transform: translateY(calc(var(--hero-offset) * 0.15px));
}
.about {
  opacity: clamp(0, calc(1 - abs(var(--about-offset)) / 300), 1);
}
```

---

## API

### `new ScrollVar(selector, options?)`

| Parameter             | Type                            | Default             | Description                    |
| --------------------- | ------------------------------- | ------------------- | ------------------------------ |
| `selector`            | `string \| Element \| NodeList` | —                   | Elements to track              |
| `options.varName`     | `string`                        | `'--scroll-offset'` | CSS variable name to write     |
| `options.onlyVisible` | `boolean`                       | `true`              | Skip fully off-screen elements |

### `.refresh()`

Recalculate element positions. Call after layout changes (images loaded, accordion opened, etc.):

```js
const sv = new ScrollVar(".card");
document.fonts.ready.then(() => sv.refresh());
```

ScrollVar also refreshes tracked positions automatically on page `load`, `pageshow`, and after `document.fonts.ready` when supported.

### `.add(selector, options?)`

Add more elements to an existing instance:

```js
const sv = new ScrollVar(".hero");
sv.add(".card", { varName: "--card-offset" });
```

### `.destroy()`

Remove CSS variables from all elements and stop updates:

```js
sv.destroy();
```

---

## Browser support

All modern browsers. Requires `CSS.supports('--a', '0')` — no IE.

---

## License

[MIT](./LICENSE)
