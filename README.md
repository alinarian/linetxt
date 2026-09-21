# linetxt

A skill for text reveal animations. One entry point, four modes.

| Mode | When to use it |
| --- | --- |
| `typewriter` | Typing text character by character |
| `line-reveal` | Headings and paragraphs made of multiple lines |
| `gentle` | A polished, ready-made per-character reveal |
| `pixel` | The whole text sharpens from pixel blocks to crisp glyphs in hard steps |

Read [SKILL.md](./SKILL.md) for the full parameter reference.

## Add it to an agent

Copy this directory into your project's `.agents/skills/` directory:

```text
.agents/skills/
└── linetxt/
```

Then name the mode in your request to the agent:

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

If you do not name a mode, the agent asks which one you want rather than
picking for you.

## Use it directly

The implementation is plain Web Animations API with no dependencies. Copy
[assets/waapi/linetxt.js](./assets/waapi/linetxt.js) and
[assets/waapi/linetxt.css](./assets/waapi/linetxt.css) into your project:

```js
import { linetxt } from "./linetxt.js"

linetxt(document.querySelector("#headline"), { type: "line-reveal" })
```

`options.type` is required — `linetxt()` throws rather than choosing a reveal
on your behalf.

## Pixel mode

`pixel` is a digital entrance. Every glyph is visible from the first frame as
a single coarse block of its own shape. The whole text then sharpens together
in hard steps, each step halving the pixel cell of every glyph at once, until
the text cuts to the crisp glyphs:

```text
one block per glyph → 2×2 blocks → 4×4 → … → finest pixel level → clean text
```

Nothing scatters, fades, or moves, and the entire text resolves as one piece:
a word, a heading, and a wrapped paragraph all finish at the same moment. No
real glyph is shown before the pixel steps have finished, and the finished
text is plain DOM text with no pixelation left.

```js
linetxt(document.querySelector("#headline"), { type: "pixel" })
```

| Parameter | Default | Meaning |
| --- | --- | --- |
| `stepDuration` | `90` | Milliseconds each pixel level is held |
| `pixelSize` | `"auto"` | Finest pixel cell in CSS pixels; `"auto"` is the font size ÷ 16, at least 2 |
| `revealDelay` | `0` | Milliseconds to hold the finest level before the cut to clean text |
| `easing` | `"linear"` | Easing of the progress through the levels |
| `initialDelay` | `0` | Milliseconds to wait before the first frame |
| `sweep` | `"none"` | `"none"` resolves the whole text together; `"line"` sweeps every line left to right at once; `"text"` runs one wave across the text |
| `stagger` | `"auto"` | Only with a sweep: milliseconds between adjacent glyphs |

How it works: each glyph is drawn into an offscreen canvas at its own layout
box with the element's computed font, colour, and `text-transform`, so the
blocks trace the real letter shapes. A transparent canvas overlay paints the
blocks in the text's colour; it never takes part in layout, so the text box
never shifts, and it is removed when the reveal finishes. Reduced-motion
settings render the text statically, as in every mode.

## Example page

[assets/waapi/example.html](./assets/waapi/example.html) is a minimal
standalone page that calls each mode directly, with no build step and nothing
but the two runtime files.

```bash
npm run serve
```

Then open <http://localhost:4173/assets/waapi/example.html>.

An interactive playground with live controls for every parameter lives in a
separate project, `linetxt-demo`, so this repository stays limited to the
skill itself.

## Tests

Pure logic — grapheme splitting, line grouping, the gentle contract, easing
parsing, pixel levels, and pixel coverage sampling — runs in Node with no dependencies:

```bash
npm test
```

DOM and timing behaviour needs a real browser, because jsdom does not implement
the Web Animations API. Start the server above and open
<http://localhost:4173/tests/browser/>. The page reports
`RESULT ALL PASS — n/n passed` and sets the document title to `linetxt PASS`.
