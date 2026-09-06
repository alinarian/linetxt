---
name: linetxt
description: Apply one of three text reveals to an element — typewriter typing, line-by-line upward reveal with a 100ms stagger, or a gentle per-character rise. Invoked as "$linetxt typewriter", "$linetxt line-reveal", or "$linetxt gentle". Ask the user which mode to use when the request does not name one; never pick a mode silently.
---

# linetxt

Apply a one-shot text reveal. Preserve the product's copy, typography, color,
spacing, and layout unless the user asks to change them.

## Choose the mode

The mode is a required input. Do not pick one silently.

1. Read the request. If it names a mode — `$linetxt typewriter`, or a phrasing
   that is unambiguous on its own (“make it type out”, “reveal these lines one
   by one”, “use the gentle rise”) — use that mode.
2. Otherwise ask the user before touching any code:

   ```text
   animation type:
     1. typewriter   — types the text out character by character
     2. line-reveal  — lines rise from below, 100ms apart
     3. gentle       — a soft per-character rise
   ```

The runtime enforces this too: `linetxt()` throws when `options.type` is
missing or unknown, so a forgotten mode fails loudly instead of defaulting.

| Mode | When to use it |
| --- | --- |
| `typewriter` | Typing text character by character |
| `line-reveal` | Headings and paragraphs made of multiple lines |
| `gentle` | A polished, ready-made per-character reveal |

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

The contract is frozen in the module as `GENTLE_CONTRACT` and is the source of
the defaults above. Leave it alone unless the user asks to retune the motion;
changing it silently is a regression.

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

## Host and accessibility

- Keep the host application responsible for typography and presentation.
- The host becomes an inline-block element containing non-breaking inline-block
  word wrappers and inline-block character units with `white-space: pre`.
- The complete text is set as the host's `aria-label` and every split span is
  hidden from assistive technology.
- `prefers-reduced-motion: reduce` renders static text. Pass
  `respectReducedMotion: false` only when the user asks for it.
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
