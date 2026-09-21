# linetxt

A skill for text reveal animations. One entry point, four modes.
Try every mode with live controls at <https://linetxt.vercel.app/>.

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
