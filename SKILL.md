---
name: linetxt
description: Apply one of four text reveals to an element — typewriter typing, line-by-line upward reveal with a 100ms stagger, a gentle per-character rise, or a pixel reveal where each glyph resolves from a coarse block pixel to crisp text in a left-to-right sweep. Invoked as "$linetxt typewriter", "$linetxt line-reveal", "$linetxt gentle", or "$linetxt pixel". Ask the user which mode to use when the request does not name one; never pick a mode silently.
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
     4. pixel        — glyphs resolve from coarse blocks to crisp text, left to right
   ```

The runtime enforces this too: `linetxt()` throws when `options.type` is
missing or unknown, so a forgotten mode fails loudly instead of defaulting.

| Mode | When to use it |
| --- | --- |
| `typewriter` | Typing text character by character |
| `line-reveal` | Headings and paragraphs made of multiple lines |
| `gentle` | A polished, ready-made per-character reveal |
| `pixel` | A digital entrance: each glyph sharpens from pixel blocks in hard steps, sweeping left to right |

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

Every glyph is visible from the first frame as a coarse pixel block of its
own shape. Sweeping from left to right, each glyph's pixel cell halves its
size in hard steps until it is swapped for the crisp glyph. The sequence per
glyph is `one block → 2×2 blocks → 4×4 → … → finest pixel level → clean glyph`,
and because glyphs start a stagger apart, the leading letters are crisp while
the trailing ones are still large blocks. No real glyph is visible before its
pixel steps have finished.

| Parameter | Default | Meaning |
| --- | --- | --- |
| `stagger` | `"auto"` | Milliseconds between adjacent glyphs starting to resolve; `"auto"` spreads the sweep over 900ms, clamped to 12–140ms per glyph |
| `stepDuration` | `90` | Milliseconds each pixel level is held |
| `pixelSize` | `"auto"` | Finest pixel cell in CSS pixels; `"auto"` is the font size ÷ 16, at least 2 |
| `revealDelay` | `0` | Milliseconds to hold the finest pixel level before the cut to the clean glyph |
| `easing` | `"linear"` | Easing of a glyph's progress through its levels; `linear` holds every level equally |
| `initialDelay` | `0` | Milliseconds to wait before the first frame |
| `sweep` | `"line"` | What the stagger is keyed to: `"line"`, `"text"`, or `"none"` |
| `lineSource` | `"auto"` | How lines are detected for `sweep: "line"`: `"auto"`, `"text"`, `"visual"`, as in line-reveal |

The sweep decides how a paragraph behaves:

- `"line"` — every line sweeps at the same time. Glyph `n` of each line starts
  at `n × stagger`, so a whole paragraph is animating from the first frame
  and no line waits for the one above it. The automatic stagger spreads the
  longest line over the budget.
- `"text"` — one wave in reading order across the whole text; the last line
  is still blocks while the first is crisp.
- `"none"` — every glyph resolves together, with no stagger at all.

A single word at 130ms stagger and 90ms steps reads as the classic
letter-by-letter resolve; the automatic stagger keeps a whole paragraph to a
wave of about a second.

How the pixel levels are built:

- The text is split and laid out exactly as in the other modes, with every
  unit transparent. The final position, size, wrapping, and alignment are
  therefore fixed from the first frame, and nothing shifts when a glyph cuts
  to text.
- Each glyph is rasterized into an offscreen canvas at its own DOM box, using
  the host's computed font, weight, style, size, colour, and `text-transform`.
  Its ink bounds are measured, and a grid anchored to those bounds is
  stretched to tile them exactly at every level: the coarsest level is one
  block the size of the glyph, the next 2×2, and so on, halving until the
  cell would drop below `pixelSize`.
- A cell is drawn when 45% of it is ink (30% for the single-block level).
  Cells that fall short are dropped, so coarse levels read as digital
  fragments of the letter rather than as a filled rectangle.
- A transparent canvas overlay sits over the host's padding box, absolutely
  positioned and `pointer-events: none`, so it never takes part in layout.
  Each frame fills every unresolved glyph's pixel blocks at its current level in
  the host's text colour; blocks are solid, with no fading or motion.
- Glyph `n` (whitespace excluded) of its line, or of the text for
  `sweep: "text"`, starts resolving at `n × stagger`, holds each level for
  `stepDuration`, holds the finest level for `revealDelay`, then cuts to the
  real glyph with a zero-duration opacity animation. The overlay is removed
  when the last glyph is crisp, leaving plain DOM text.
- The overlay's animation is the clock for the whole preview; the canvas is
  repainted from its `currentTime` every frame. Pausing, finishing, or
  cancelling that animation drives the canvas exactly like the unit
  animations, so `stop()`, `destroy()`, `finished`, and hidden-tab throttling
  behave as in the other modes.
- The look (coarsest cell, automatic sizes, thresholds, sweep budget) lives in
  the frozen `PIXEL_TUNING` object in `linetxt.js`. The effect is fully
  deterministic: the same text renders the same frames every time.

Edge cases: a single character resolves through its own levels; a long line
uses a faster automatic stagger so its sweep still completes in about a
second; multiline and wrapped text animate all lines at once, each line
sweeping left to right. When the document has no 2D canvas, or the host has no size, the text
is simply shown. Reduced motion renders static text as in every mode.

The host receives `position: relative` only when it was `static`, so the
overlay has a containing block; `destroy()` restores the inline value.

```js
linetxt(element, { type: "pixel", stagger: 130, stepDuration: 90 })
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
- Confirm `pixel` shows every glyph as blocks from the first frame, that
  glyphs sharpen in hard steps from left to right, that every line of a
  paragraph animates at the same time, that no real glyph is visible before
  its pixel steps have finished, and that the finished text is crisp with the
  overlay removed.
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
