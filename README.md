# linetxt

A skill for text reveal animations. One entry point, three modes.

| Mode | When to use it |
| --- | --- |
| `typewriter` | Typing text character by character |
| `line-reveal` | Headings and paragraphs made of multiple lines |
| `gentle` | A polished, ready-made per-character reveal from serega |

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

## Relationship to serega

The `gentle` mode reuses the motion contract published by
[serega-gentle](https://github.com/mishanaer/deslop/tree/main/serega/serega-gentle):
opacity `0 → 1`, translate Y `15px → 0`, `500ms`, `15ms` stagger,
`cubic-bezier(0.2, 0.8, 0.2, 1)`, no blur, no exit. Those values live in
`GENTLE_CONTRACT` and are covered by a test so they cannot drift.

serega itself is not vendored here. If your project installs the serega skill,
import `seregaGentle` from it and use that directly — it also supports looping
phrase swaps, which this skill does not reimplement.

## Demo

The landing page at [index.html](./index.html) is a single interactive
playground: switch between the three modes, switch the sample text, and drive
every documented parameter from live controls. The code block under the stage
rewrites itself as you go and prints only what differs from the defaults, so it
is always the shortest call that reproduces what is on screen.

Sample texts are Shakespeare, public domain, each attributed under the stage
and each picked for the case it exercises: a single line, exactly three lines,
a short accent phrase, and copy long enough to wrap. Every sample works in
every mode, so you can compare them directly.

The specimen is put in the DOM as plain text before each reveal, so the page
reads correctly before — and without — any animation.

```bash
python3 -m http.server 4173
```

| Path | What it is |
| --- | --- |
| `/` | The demo and playground |
| `/tests/browser/` | The browser test suite |
| `/assets/waapi/example.html` | Minimal standalone page |

### Deploy to Vercel

The repo is a static site with no build step; `vercel.json` already disables
the build and install commands and serves the root directory.

```bash
npx vercel deploy --prod
```

The first run prompts you to log in and link the project. To deploy from Git
instead, import the repository at <https://vercel.com/new> and accept the
detected settings — `vercel.json` supplies everything needed.

## Tests

Pure logic — grapheme splitting, line grouping, the serega contract — runs in
Node with no dependencies:

```bash
npm test
```

DOM and timing behaviour needs a real browser, because jsdom does not implement
the Web Animations API. Start the server above and open
<http://localhost:4173/tests/browser/>. The page reports
`RESULT ALL PASS — n/n passed` and sets the document title to `linetxt PASS`.
