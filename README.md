# linetxt

A skill for text reveal animations. One entry point, three modes.

| Mode | When to use it |
| --- | --- |
| `typewriter` | Typing text character by character |
| `line-reveal` | Headings and paragraphs made of multiple lines |
| `gentle` | A polished, ready-made per-character reveal |

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

## The gentle contract

The `gentle` mode is built on a fixed motion contract: opacity `0 → 1`,
translate Y `15px → 0`, `500ms`, `15ms` stagger,
`cubic-bezier(0.2, 0.8, 0.2, 1)`, no blur, no exit. Those values live in
`GENTLE_CONTRACT` and are covered by a test so they cannot drift.

The mode is enter-only. Looping phrase swaps and exit phases are out of scope
for this skill.

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

Pure logic — grapheme splitting, line grouping, the gentle contract — runs in
Node with no dependencies:

```bash
npm test
```

DOM and timing behaviour needs a real browser, because jsdom does not implement
the Web Animations API. Start the server above and open
<http://localhost:4173/tests/browser/>. The page reports
`RESULT ALL PASS — n/n passed` and sets the document title to `linetxt PASS`.
