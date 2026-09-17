---
name: linetxt
description: Apply one of four text reveals to an element — typewriter typing, line-by-line upward reveal with a 100ms stagger, a gentle per-character rise, or a pixel reveal that assembles the glyphs from animated pixels before the crisp text appears. Invoked as "$linetxt typewriter", "$linetxt line-reveal", "$linetxt gentle", or "$linetxt pixel". Ask the user which mode to use when the request does not name one; never pick a mode silently.
---

# linetxt

Apply a one-shot text reveal. Preserve the product's copy, typography, color,
spacing, and layout unless the user asks to change them.

## Choose the mode

The mode is a required input. Do not pick one silently.

1. Read the request. If it names a mode — `$linetxt typewriter`, or a phrasing
   that is unambiguous on its own (“make it type out”, “reveal these lines one
   by one”, “use the gentle rise”, “assemble it from pixels”) — use that mode.
2. Otherwise ask the user before touching any code:

   ```text
   animation type:
     1. typewriter   — types the text out character by character
     2. line-reveal  — lines rise from below, 100ms apart
     3. gentle       — a soft per-character rise
     4. pixel        — the text is assembled from animated pixels, then resolves
   ```

The runtime enforces this too: `linetxt()` throws when `options.type` is
missing or unknown, so a forgotten mode fails loudly instead of defaulting.

| Mode | When to use it |
| --- | --- |
| `typewriter` | Typing text character by character |
| `line-reveal` | Headings and paragraphs made of multiple lines |
| `gentle` | A polished, ready-made per-character reveal |
| `pixel` | A digital entrance: pixels converge into the glyphs before the crisp text appears |

## Workflow

1. Resolve the mode as described above.
2. Treat a named animation library as binding; do not substitute another one.
   The bundled implementation uses the Web Animations API and has no
   dependencies — do not add an animation library to satisfy this skill.
3. Copy [assets/waapi/linetxt.js](assets/waapi/linetxt.js) and
   [assets/waapi/linetxt.css](assets/waapi/linetxt.css) into the host project.
4. Call `linetxt(element, { type, ...parameters })`. Pass only the parameters
   the user asked for; the defaults below are already correct.
5. Read [references/effects.json](references/effects.json) when porting a mode
   to Motion, GSAP, or another renderer.

```js
import { linetxt } from "./linetxt.js"

const reveal = linetxt(document.querySelector("#headline"), {
    type: "line-reveal",
    stagger: 100,
})
```

Every mode returns the same controls: `play()`, `stop()`, `destroy()`,
`finished`, and a read-only `type`.

## Mode 1 — typewriter

Characters appear one after another, as if typed. Every character occupies its
final layout box from the first frame and is revealed with opacity, so the text
never reflows while typing and wrapping matches the finished text.

| Parameter | Default | Meaning |
| --- | --- | --- |
| `charInterval` | `45` | Milliseconds between two adjacent characters |
| `charDuration` | `0` | Fade length per character; `0` is a hard cut |
| `easing` | `"linear"` | Easing of that fade; only observable when `charDuration > 0` |
| `initialDelay` | `0` | Milliseconds to wait before the first character |
| `caret` | `true` | Show a blinking caret that follows the typing position |
| `caretPersist` | `false` | Keep the caret after the last character |

The caret is a zero-width element whose bar is painted by a pseudo-element, so
moving it between characters never shifts the text. Its position is derived
from the same clock as the character reveal, so the two cannot drift apart.

```js
linetxt(element, { type: "typewriter", charInterval: 45 })
```

## Mode 2 — line-reveal

Lines rise from below and fade in, one after another. Line `n` starts
`stagger` milliseconds after line `n − 1`.

| Parameter | Default | Meaning |
| --- | --- | --- |
| `stagger` | `100` | Milliseconds between the start of adjacent lines |
| `duration` | `600` | Length of one line's reveal |
| `y` | `16` | Pixels below the final position that a line starts from |
| `easing` | `"cubic-bezier(0.2, 0.8, 0.2, 1)"` | Easing of the reveal |
| `initialDelay` | `0` | Milliseconds to wait before the first line |
| `lineSource` | `"auto"` | How lines are detected: `"auto"`, `"text"`, `"visual"` |

Lines are detected at run time and the count is never hardcoded:

- `"text"` — split on newlines in the source text.
- `"visual"` — measure the rendered position of every word and group words that
  share a line box. This follows the real wrapping of the element, so a
  responsive heading re-groups correctly at any width.
- `"auto"` — use `"text"` when the text contains newlines, otherwise
  `"visual"`.

Single-line text resolves to exactly one group and animates as one element.

Motion is `opacity: 0 → 1` and `translateY: y → 0`. Lines are not wrapped in
new block elements: every word of a line receives the same delay, which is
visually identical to moving the line as a unit while leaving the host's
formatting and wrapping untouched.

```js
linetxt(element, { type: "line-reveal", stagger: 100 })
```

## Mode 3 — gentle

A per-character rise on a fixed motion contract: opacity `0 → 1`,
translate Y `15px → 0`, duration `500ms`,
stagger `15ms`, easing `cubic-bezier(0.2, 0.8, 0.2, 1)`, applied per character
in normal left-to-right DOM order.

| Parameter | Default | Meaning |
| --- | --- | --- |
| `stagger` | `15` | Milliseconds between two adjacent characters |
| `duration` | `500` | Length of one character's rise |
| `y` | `15` | Pixels below the final position that a character starts from |
| `easing` | `"cubic-bezier(0.2, 0.8, 0.2, 1)"` | Easing of the rise |
| `initialDelay` | `0` | Milliseconds to wait before the first character |

Rules this mode keeps:

- **Never animate blur.** Crisp glyphs are the defining property of the effect.
- **No exit.** This is a one-shot reveal; do not invent an exit animation.
- Safe for long and multiline copy, because it animates only transform and
  opacity.

`gentle` and `line-reveal` are the same rise driven by the same code path; they
differ only in what the delay is keyed to — the character index for `gentle`,
the line index for `line-reveal`.

This mode is enter-only. Looping phrase swaps and exit phases are out of scope;
if a swap is needed, drive it outside this skill.

```js
linetxt(element, { type: "gentle" })
```

## Mode 4 — pixel

The text is assembled from pixels before it is shown. The sequence is
`empty → scattered pixels → pixels form letter shapes → recognizable pixelated
text → pixels resolve → clean final text`. The real glyphs are never visible
until the pixel phase has completed.

| Parameter | Default | Meaning |
| --- | --- | --- |
| `previewDuration` | `900` | Milliseconds from the first scattered pixel to fully formed pixelated text |
| `pixelSize` | `"auto"` | Cell size in CSS pixels; `"auto"` is the font size ÷ 8, clamped to 2–16 |
| `scatter` | `0.75` | Radius, in em, that pixels start scattered from their final cell |
| `revealDelay` | `0` | Milliseconds to hold the pixelated text before it resolves |
| `revealDuration` | `450` | Length of the resolve: finer pixels, then the crossfade to clean text |
| `easing` | `"cubic-bezier(0.2, 0.8, 0.2, 1)"` | Easing of each pixel's convergence and of the crossfade |
| `initialDelay` | `0` | Milliseconds to wait before the first pixel |

How the preview is built:

- The text is split and laid out exactly as in the other modes, with every
  unit transparent. The final position, size, wrapping, and alignment are
  therefore fixed from the first frame, and nothing shifts when the text
  appears.
- Each glyph is rasterized into an offscreen canvas at its own DOM box, using
  the host's computed font, weight, style, size, colour, and `text-transform`.
  The raster is averaged into a grid of `pixelSize` cells; cells that contain
  glyph ink become pixels. The preview is built from the real letter shapes,
  not from noise over a rectangle.
- A transparent canvas overlay sits inside the host, absolutely positioned and
  `pointer-events: none`, so it never takes part in layout. It bleeds past the
  text box by the scatter radius so pixels can start outside the glyphs.
- Pixels appear scattered around their cells, drift, flicker, and converge on
  their cells in a mostly reading-order sweep. Short-lived decoy pixels give
  the opening an abstract, digital feel. Movement snaps to the grid.
- After `previewDuration` (plus `revealDelay`), the raster is redrawn at
  halving cell sizes down to the anti-aliased glyphs while the real text fades
  in on top and the overlay fades out. The overlay is removed when finished,
  leaving plain DOM text with no pixelation.
- The overlay's opacity animation is the clock for the whole preview; the
  canvas is repainted from its `currentTime` every frame. Pausing, finishing,
  or cancelling that animation drives the canvas exactly like the unit
  animations, so `stop()`, `destroy()`, `finished`, and hidden-tab throttling
  behave as in the other modes.
- The look (ink threshold, travel fraction, order bias, drift, decoy ratio,
  flicker step, particle budget) lives in the frozen `PIXEL_TUNING` object in
  `linetxt.js`; the same text always produces the same scatter pattern.

Edge cases: a single character gets its own small preview; long copy grows the
cell size automatically so the particle count stays within budget; multiline
and wrapped text are sampled per glyph box, so every line is covered. When the
document has no 2D canvas, or the host has no size, the text is simply shown.
Reduced motion renders static text as in every mode.

The host receives `position: relative` only when it was `static`, so the
overlay has a containing block; `destroy()` restores the inline value.

```js
linetxt(element, { type: "pixel", previewDuration: 900, pixelSize: "auto" })
```

## Host and accessibility

- Keep the host application responsible for typography and presentation.
- The host becomes an inline-block element containing non-breaking inline-block
  word wrappers and inline-block character units with `white-space: pre`.
- The complete text is set as the host's `aria-label` and every split span is
  hidden from assistive technology.
- `prefers-reduced-motion: reduce` renders static text. Pass
  `respectReducedMotion: false` only when the user asks for it.
- The pixel preview layer is a `canvas.linetxt__pixels` child of the host,
  `aria-hidden`, absolutely positioned, and removed when the reveal finishes.
- Start a reveal when it enters the viewport if a page runs several of them.
- `destroy()` restores the original child nodes, `aria-label`, and classes.

## Adding a mode

Modes are separated by data, not by branching logic. To add one: add its name
to `TYPES`, add a frozen defaults object, dispatch to a `run…` function in
`run`, and document it here and in `references/effects.json`. Grapheme
splitting, word grouping, line detection, the shared rise, accessibility
handling, and the playback lifecycle are already shared.

## Verification

- Confirm the mode came from the user, not from a guess.
- Confirm the existing copy, typography, and layout are unchanged.
- Confirm text does not reflow while a typewriter reveal is running.
- Confirm line-reveal groups match the rendered lines at the current width, and
  that adjacent lines start `stagger` milliseconds apart.
- Confirm single-line text animates as one group.
- Confirm `gentle` still matches its contract: `500ms`, `15ms`, `15px`,
  `cubic-bezier(0.2, 0.8, 0.2, 1)`, and no blur at any frame.
- Confirm spaces, punctuation, emoji, and non-Latin graphemes remain intact.
- Confirm multiline text wraps only between words, never inside a word.
- Confirm `pixel` shows no real glyph before the pixel preview has completed,
  that the pixels trace the letter shapes rather than a rectangle of noise,
  and that the finished text is crisp with the overlay removed.
- Confirm no exit animation runs unless explicitly requested.

## Examples

```text
Apply $linetxt typewriter to this heading.
```

```text
Apply $linetxt line-reveal to this heading.
```

```text
Apply $linetxt gentle to this heading.
```

```text
Apply $linetxt pixel to this heading.
```
