const HOST_CLASS = "linetxt"
const UNIT_CLASS = "linetxt__unit"
const WORD_CLASS = "linetxt__word"
const CARET_CLASS = "linetxt__caret"
const PIXELS_CLASS = "linetxt__pixels"

export const TYPES = Object.freeze(["typewriter", "line-reveal", "gentle", "pixel"])

const TYPEWRITER_DEFAULTS = Object.freeze({
    charInterval: 45,
    charDuration: 0,
    easing: "linear",
    initialDelay: 0,
    caret: true,
    caretPersist: false,
})

const LINE_REVEAL_DEFAULTS = Object.freeze({
    stagger: 100,
    duration: 600,
    y: 16,
    easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
    initialDelay: 0,
    lineSource: "auto",
})

// The frozen gentle motion contract.
// Enter only. This mode never animates blur and never adds an exit to a
// one-shot reveal.
export const GENTLE_CONTRACT = Object.freeze({
    duration: 500,
    stagger: 15,
    easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
    y: 15,
})

const GENTLE_DEFAULTS = Object.freeze({
    ...GENTLE_CONTRACT,
    initialDelay: 0,
})

const PIXEL_DEFAULTS = Object.freeze({
    stagger: "auto",
    stepDuration: 90,
    pixelSize: "auto",
    revealDelay: 0,
    easing: "linear",
    initialDelay: 0,
    sweep: "none",
    lineSource: "auto",
})

const PIXEL_SWEEPS = Object.freeze(["none", "line", "text"])

/**
 * Look-and-feel constants of the pixel mode. They shape the pixel blocks rather
 * than its timing, so they are tuning values rather than per-call options.
 * Adjust them here when the whole effect should change.
 */
export const PIXEL_TUNING = Object.freeze({
    /** The coarsest pixel cell, in em: one block per glyph. */
    coarsestCell: 1.1,
    /** Automatic finest cell is the font size divided by this. */
    autoSizeDivisor: 16,
    minPixelSize: 2,
    /** Raster alpha (0–255) that counts as ink when measuring glyph bounds. */
    inkAlpha: 40,
    /** Automatic stagger spreads the sweep over this many milliseconds… */
    autoSweep: 900,
    /** …but never faster or slower per character than these bounds. */
    autoStaggerMin: 12,
    autoStaggerMax: 140,
    /** A cell is drawn when this share of it is glyph ink. Weak cells drop
        out, which is what makes coarse levels read as digital fragments. */
    inkThreshold: 0.45,
    /** The single-block level uses this lower bar so every glyph is at least
        hinted at before its pixel steps start. */
    coarseThreshold: 0.3,
    /** Raster oversampling, capped by the device pixel ratio. */
    sampleScale: 2,
})

/**
 * Normalizes CR and CRLF to LF so line handling has a single line terminator.
 *
 * @param {string} value
 */
export function normalizeNewlines(value) {
    return String(value).replace(/\r\n?/gu, "\n")
}

/**
 * Splits text into grapheme clusters so emoji, combining marks, and non-Latin
 * scripts stay intact.
 *
 * @param {string} value
 */
export function splitGraphemes(value) {
    if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
        const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" })
        return Array.from(segmenter.segment(value), ({ segment }) => segment)
    }

    return Array.from(value)
}

/**
 * Groups a DOM-ordered list of vertical offsets into visual line indexes.
 * Offsets arrive in document order, so a new line starts whenever the offset
 * moves further down than the current line's reference by more than tolerance.
 *
 * @param {number[]} tops
 * @param {number} tolerance
 */
export function groupByOffsetTop(tops, tolerance = 1) {
    const lines = []
    let current = -1
    let reference = Number.NEGATIVE_INFINITY

    for (const top of tops) {
        if (current === -1 || top > reference + tolerance) {
            current += 1
            reference = top
        }

        lines.push(current)
    }

    return lines
}

const NAMED_EASINGS = Object.freeze({
    linear: null,
    ease: [0.25, 0.1, 0.25, 1],
    "ease-in": [0.42, 0, 1, 1],
    "ease-out": [0, 0, 0.58, 1],
    "ease-in-out": [0.42, 0, 0.58, 1],
})

/**
 * Builds a CSS cubic-bezier timing function as a plain `(x) => y` so the
 * canvas-driven pixel preview can share the easing strings the other modes
 * hand to the Web Animations API.
 */
export function cubicBezier(x1, y1, x2, y2) {
    const sampleX = (t) => ((1 - 3 * x2 + 3 * x1) * t + (3 * x2 - 6 * x1)) * t * t + 3 * x1 * t
    const sampleY = (t) => ((1 - 3 * y2 + 3 * y1) * t + (3 * y2 - 6 * y1)) * t * t + 3 * y1 * t
    const slopeX = (t) => 3 * (1 - 3 * x2 + 3 * x1) * t * t + 2 * (3 * x2 - 6 * x1) * t + 3 * x1

    return (x) => {
        if (x <= 0) return 0
        if (x >= 1) return 1

        // Newton–Raphson first, bisection when the slope is too flat for it.
        let t = x
        for (let step = 0; step < 8; step += 1) {
            const error = sampleX(t) - x
            if (Math.abs(error) < 1e-6) return sampleY(t)
            const slope = slopeX(t)
            if (Math.abs(slope) < 1e-6) break
            t -= error / slope
        }

        let low = 0
        let high = 1
        while (high - low > 1e-6) {
            t = (low + high) / 2
            if (sampleX(t) < x) low = t
            else high = t
        }

        return sampleY(t)
    }
}

/**
 * Parses a CSS easing keyword or `cubic-bezier(...)` into a function.
 * Anything else (for example `steps()`) degrades to linear.
 *
 * @param {string} value
 */
export function parseEasing(value) {
    const name = String(value ?? "linear").trim().toLowerCase()
    if (Object.hasOwn(NAMED_EASINGS, name)) {
        const points = NAMED_EASINGS[name]
        return points ? cubicBezier(...points) : (x) => x
    }

    const match = /^cubic-bezier\(\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*([^)]+)\)$/u.exec(name)
    if (match) {
        const [x1, y1, x2, y2] = match.slice(1).map(Number)
        if ([x1, y1, x2, y2].every(Number.isFinite)) {
            return cubicBezier(Math.min(1, Math.max(0, x1)), y1, Math.min(1, Math.max(0, x2)), y2)
        }
    }

    return (x) => x
}

/**
 * Resolves the pixel mode's finest pixel cell in CSS pixels. `"auto"`
 * derives it from the font size so the same call looks right on a caption
 * and a hero.
 *
 * @param {"auto"|number} pixelSize
 * @param {number} fontSize
 */
export function resolvePixelSize(pixelSize, fontSize) {
    if (pixelSize === "auto" || pixelSize == null) {
        const auto = Math.round((Number(fontSize) || 0) / PIXEL_TUNING.autoSizeDivisor)
        return Math.max(PIXEL_TUNING.minPixelSize, auto)
    }

    const size = Number(pixelSize)
    return Number.isFinite(size) && size >= 1 ? size : PIXEL_TUNING.minPixelSize
}

/**
 * The pixel cell sizes a glyph passes through, coarsest first: one block
 * per glyph, halving each step, never finer than `finest`.
 *
 * @param {number} fontSize
 * @param {number} finest
 */
export function pixelLevels(fontSize, finest) {
    const levels = []
    let cell = Math.max(finest, (Number(fontSize) || 0) * PIXEL_TUNING.coarsestCell)
    do {
        levels.push(cell)
        cell /= 2
    } while (cell >= finest)
    return levels
}

/**
 * Milliseconds between adjacent characters starting to resolve. `"auto"`
 * spreads the sweep over a fixed budget so a word and a paragraph both read
 * as one left-to-right wave.
 *
 * @param {"auto"|number} stagger
 * @param {number} count Characters taking part in the sweep
 */
export function resolveStagger(stagger, count) {
    if (stagger === "auto" || stagger == null) {
        if (count <= 1) return 0
        const spread = PIXEL_TUNING.autoSweep / (count - 1)
        return Math.min(PIXEL_TUNING.autoStaggerMax, Math.max(PIXEL_TUNING.autoStaggerMin, spread))
    }

    return Math.max(0, Number(stagger) || 0)
}

/**
 * Averages the alpha channel of an RGBA raster over a grid of square cells,
 * giving each cell's glyph coverage in 0–1. `cell` is the cell edge in raster
 * pixels and may be fractional; boundaries are rounded so every raster pixel
 * belongs to exactly one cell.
 *
 * @param {Uint8ClampedArray|number[]} data
 * @param {number} width
 * @param {number} height
 * @param {number} cell Cell width, and height unless `cellHeight` is given
 * @param {number} [cellHeight]
 */
export function sampleCoverage(data, width, height, cell, cellHeight = cell) {
    // ceil() can open a trailing cell whose rounded start lies past the
    // raster edge; trim it so every cell holds at least one raster pixel.
    const count = (extent, size) => {
        let cells = extent > 0 && size > 0 ? Math.ceil(extent / size) : 0
        while (cells > 0 && Math.round((cells - 1) * size) >= extent) cells -= 1
        return cells
    }
    const columns = count(width, cell)
    const rows = count(height, cellHeight)
    const coverage = new Float32Array(columns * rows)

    for (let row = 0; row < rows; row += 1) {
        const y0 = Math.round(row * cellHeight)
        const y1 = Math.min(height, Math.round((row + 1) * cellHeight))

        for (let column = 0; column < columns; column += 1) {
            const x0 = Math.round(column * cell)
            const x1 = Math.min(width, Math.round((column + 1) * cell))
            let sum = 0

            for (let y = y0; y < y1; y += 1) {
                let offset = (y * width + x0) * 4 + 3
                for (let x = x0; x < x1; x += 1, offset += 4) sum += data[offset]
            }

            const area = (x1 - x0) * (y1 - y0)
            coverage[row * columns + column] = area > 0 ? sum / (area * 255) : 0
        }
    }

    return { columns, rows, coverage }
}

function clamp01(value) {
    return Math.min(1, Math.max(0, value))
}

/** Builds a canvas font shorthand from a computed style. */
function canvasFont(style) {
    const parts = []
    if (/^(italic|oblique)/u.test(style.fontStyle)) parts.push("italic")
    if (style.fontVariantCaps === "small-caps") parts.push("small-caps")
    if (style.fontWeight && style.fontWeight !== "normal") parts.push(style.fontWeight)
    parts.push(style.fontSize, style.fontFamily)
    return parts.join(" ")
}

/** Mirrors CSS text-transform, which the DOM applies but textContent lacks. */
function transformGrapheme(grapheme, transform, wordStart) {
    if (transform === "uppercase") return grapheme.toUpperCase()
    if (transform === "lowercase") return grapheme.toLowerCase()
    if (transform === "capitalize" && wordStart) return grapheme.toUpperCase()
    return grapheme
}

function translate(y) {
    return `translate3d(0, ${y}px, 0)`
}

/**
 * Builds word-grouped character units. Trailing whitespace stays with the
 * preceding word so lines only ever wrap between words.
 */
function buildUnits(fragment, value, createUnit) {
    const units = []
    const words = []
    let word = null
    let lineIndex = 0
    let followsWhitespace = false

    const startWord = () => {
        const node = fragment.ownerDocument.createElement("span")
        node.className = WORD_CLASS
        fragment.append(node)
        word = { node, lineIndex, units: [] }
        words.push(word)
    }

    for (const grapheme of splitGraphemes(value)) {
        if (grapheme === "\n") {
            const lineBreak = fragment.ownerDocument.createElement("br")
            lineBreak.setAttribute("aria-hidden", "true")
            fragment.append(lineBreak)
            lineIndex += 1
            word = null
            followsWhitespace = false
            continue
        }

        const isWhitespace = /^\s+$/u.test(grapheme)
        if (!word || (!isWhitespace && followsWhitespace)) startWord()

        const node = createUnit(grapheme)
        const unit = { node, grapheme, lineIndex, wordIndex: words.length - 1 }
        units.push(unit)
        word.units.push(unit)
        word.node.append(node)
        followsWhitespace = isWhitespace
    }

    return { units, words }
}

function prefersReducedMotion(element) {
    return element.ownerDocument.defaultView
        ?.matchMedia?.("(prefers-reduced-motion: reduce)")
        .matches === true
}

/**
 * Applies one of three text reveals to a DOM element.
 *
 * `options.type` is required. The skill never picks a reveal silently: an
 * unset or unknown type is a programming error, not a default.
 *
 * @param {Element} element
 * @param {{
 *   type: "typewriter"|"line-reveal"|"gentle"|"pixel",
 *   text?: string,
 *   autoplay?: boolean,
 *   respectReducedMotion?: boolean,
 *   initialDelay?: number,
 *   charInterval?: number,
 *   charDuration?: number,
 *   easing?: string,
 *   caret?: boolean,
 *   caretPersist?: boolean,
 *   stagger?: number,
 *   duration?: number,
 *   y?: number,
 *   lineSource?: "auto"|"text"|"visual",
 *   stepDuration?: number,
 *   pixelSize?: "auto"|number,
 *   revealDelay?: number,
 *   sweep?: "line"|"text"|"none"
 * }} options
 */
export function linetxt(element, options = {}) {
    if (!element || typeof element.replaceChildren !== "function") {
        throw new TypeError("linetxt requires a DOM element")
    }

    const type = options.type
    if (!TYPES.includes(type)) {
        throw new TypeError(
            `linetxt requires options.type to be one of: ${TYPES.join(", ")}`,
        )
    }

    const text = normalizeNewlines(options.text ?? element.textContent ?? "")
    const typeDefaults = {
        typewriter: TYPEWRITER_DEFAULTS,
        "line-reveal": LINE_REVEAL_DEFAULTS,
        gentle: GENTLE_DEFAULTS,
        pixel: PIXEL_DEFAULTS,
    }[type]
    const nonNegative = (key) => Math.max(0, Number(options[key] ?? typeDefaults[key]) || 0)
    const settings = {
        ...typeDefaults,
        ...options,
        autoplay: options.autoplay ?? true,
        respectReducedMotion: options.respectReducedMotion ?? true,
        initialDelay: nonNegative("initialDelay"),
    }
    if (type === "pixel") {
        settings.stepDuration = nonNegative("stepDuration")
        settings.revealDelay = nonNegative("revealDelay")
        if (!PIXEL_SWEEPS.includes(settings.sweep)) {
            throw new TypeError(`linetxt pixel requires options.sweep to be one of: ${PIXEL_SWEEPS.join(", ")}`)
        }
    }

    const originalNodes = Array.from(element.childNodes)
    const originalAriaLabel = element.getAttribute("aria-label")
    const originallyHadHostClass = element.classList.contains(HOST_CLASS)
    const activeAnimations = new Set()
    let playbackController = null
    let playbackTask = Promise.resolve()
    let destroyed = false
    // The inline `position` the host had before the pixel overlay needed a
    // positioned containing block; null while untouched.
    let patchedPosition = null

    element.classList.add(HOST_CLASS)
    element.dataset.linetxt = type

    function renderUnits() {
        const fragment = element.ownerDocument.createDocumentFragment()
        const built = buildUnits(fragment, text, (grapheme) => {
            const node = element.ownerDocument.createElement("span")
            node.className = UNIT_CLASS
            node.setAttribute("aria-hidden", "true")
            node.textContent = grapheme
            return node
        })

        element.setAttribute("aria-label", text)
        element.replaceChildren(fragment)
        return built
    }

    function renderStatic() {
        element.setAttribute("aria-label", text)
        element.textContent = text
    }

    function wait(milliseconds, signal) {
        if (milliseconds <= 0) return Promise.resolve(!signal.aborted)

        return new Promise((resolve) => {
            let timer

            const finish = (completed) => {
                clearTimeout(timer)
                signal.removeEventListener("abort", abort)
                resolve(completed)
            }
            const abort = () => finish(false)

            timer = setTimeout(() => finish(true), milliseconds)
            signal.addEventListener("abort", abort, { once: true })
        })
    }

    async function runAnimations(animations, signal, settle) {
        for (const animation of animations) activeAnimations.add(animation)

        await Promise.all(
            animations.map((animation) => animation.finished.catch(() => undefined)),
        )
        if (signal.aborted) return false

        settle()
        for (const animation of animations) {
            animation.cancel()
            activeAnimations.delete(animation)
        }

        return true
    }

    /** Resolves a line index for every unit. */
    function resolveLineIndexes(built) {
        const source = settings.lineSource === "auto"
            ? (text.includes("\n") ? "text" : "visual")
            : settings.lineSource

        if (source === "text") {
            return built.units.map((unit) => unit.lineIndex)
        }

        const wordLines = groupByOffsetTop(built.words.map((word) => word.node.offsetTop))
        return built.units.map((unit) => wordLines[unit.wordIndex] ?? 0)
    }

    function createCaret() {
        const node = element.ownerDocument.createElement("span")
        node.className = CARET_CLASS
        node.setAttribute("aria-hidden", "true")
        return node
    }

    /**
     * Advances the caret from the reveal's own animations rather than from a
     * wall clock. Each character's animation finishes exactly when that
     * character lands, so the caret cannot drift from the text — including
     * when the browser throttles a hidden tab and pauses both at once.
     */
    function attachCaret(caret, units, animations, signal) {
        for (const [index, animation] of animations.entries()) {
            // The finished promise, not the finish event: a zero-duration
            // character can reach its end before this runs, and the event for
            // an already-finished animation never fires again. The promise
            // still resolves, so the caret can never be stranded.
            animation.finished.then(
                () => {
                    if (signal.aborted || !caret.isConnected) return
                    units[index].node.after(caret)
                },
                () => undefined,
            )
        }
    }

    async function runTypewriter(built, signal) {
        const { units } = built
        for (const unit of units) unit.node.style.opacity = "0"

        const animations = units.map((unit, index) => unit.node.animate(
            [{ opacity: 0 }, { opacity: 1 }],
            {
                delay: index * settings.charInterval,
                duration: Math.max(0, settings.charDuration),
                easing: settings.easing,
                fill: "both",
            },
        ))

        let caret = null
        if (settings.caret && units.length > 0) {
            caret = createCaret()
            units[0].node.before(caret)
            attachCaret(caret, units, animations, signal)
        }

        const completed = await runAnimations(animations, signal, () => {
            for (const unit of units) unit.node.style.opacity = "1"
        })

        if (completed && caret && !settings.caretPersist) caret.remove()
        return completed
    }

    /**
     * Shared rise-and-fade reveal. line-reveal keys the delay to the unit's
     * line; gentle keys it to the unit's index, which is the per-character
     * stagger.
     */
    async function runRise(built, signal, delayFor, motion) {
        const { units } = built
        const from = { opacity: 0, transform: translate(motion.y) }
        const to = { opacity: 1, transform: translate(0) }

        for (const unit of units) Object.assign(unit.node.style, from)

        const animations = units.map((unit, index) => unit.node.animate([from, to], {
            delay: delayFor(unit, index),
            duration: motion.duration,
            easing: motion.easing,
            fill: "both",
        }))

        return runAnimations(animations, signal, () => {
            for (const unit of units) Object.assign(unit.node.style, to)
        })
    }

    /**
     * Resolves once web fonts have settled, so the pixel raster samples the
     * same glyphs the DOM will show. Resolves false when aborted meanwhile.
     */
    function fontsReady(signal) {
        const fonts = element.ownerDocument.fonts
        if (!fonts?.ready) return Promise.resolve(!signal.aborted)

        return new Promise((resolve) => {
            const abort = () => resolve(false)
            signal.addEventListener("abort", abort, { once: true })
            fonts.ready.then(
                () => {
                    signal.removeEventListener("abort", abort)
                    resolve(!signal.aborted)
                },
                () => resolve(!signal.aborted),
            )
        })
    }

    /**
     * Gives the host a positioned box for the overlay without touching hosts
     * that are already positioned. Restored by destroy().
     */
    function ensurePositioned() {
        if (patchedPosition !== null) return
        const view = element.ownerDocument.defaultView
        if (!view || view.getComputedStyle(element).position !== "static") return

        patchedPosition = element.style.position
        element.style.position = "relative"
    }

    /**
     * Rasterizes every glyph at its own DOM box into an offscreen canvas and
     * returns that raster with each glyph's box. Positions come from layout
     * and shapes from the host's computed font, so the pixel blocks line up with
     * the final text at any width, alignment, or line count.
     */
    function rasterizeGlyphs(built, geometry, style, color, scale) {
        const doc = element.ownerDocument
        const raster = doc.createElement("canvas")
        raster.width = Math.max(1, Math.ceil(geometry.width * scale))
        raster.height = Math.max(1, Math.ceil(geometry.height * scale))

        const ctx = raster.getContext("2d")
        if (!ctx) return null

        ctx.scale(scale, scale)
        ctx.fillStyle = color
        ctx.textAlign = "left"
        ctx.textBaseline = "alphabetic"
        ctx.font = canvasFont(style)

        const fontSize = parseFloat(style.fontSize) || 16
        const metrics = ctx.measureText("Hg")
        const ascent = metrics.fontBoundingBoxAscent ?? fontSize * 0.8
        const descent = metrics.fontBoundingBoxDescent ?? fontSize * 0.2
        const boxes = []

        for (const word of built.words) {
            for (const [index, unit] of word.units.entries()) {
                if (/^\s+$/u.test(unit.grapheme)) continue

                const rect = unit.node.getBoundingClientRect()
                if (rect.width === 0 && rect.height === 0) continue

                // An inline-block glyph box centres its content area within
                // its line-height, which puts the baseline at half-leading
                // plus the font ascent below the box top.
                const x = (rect.left - geometry.left) * geometry.zoom
                const top = (rect.top - geometry.top) * geometry.zoom
                const height = rect.height * geometry.zoom
                const baseline = top + (height - ascent - descent) / 2 + ascent
                ctx.fillText(transformGrapheme(unit.grapheme, style.textTransform, index === 0), x, baseline)
                boxes.push({ unit, x, y: top, width: rect.width * geometry.zoom, height })
            }
        }

        return { raster, boxes }
    }

    /**
     * Builds one filled shape per glyph and pixel level. The grid is
     * anchored to the glyph's ink bounds and stretched to tile them exactly,
     * so the coarsest level is one block the size of the glyph and finer
     * levels subdivide it; cells whose coverage falls short are dropped.
     */
    function buildPixelShapes(data, raster, box, levels, scale) {
        const view = element.ownerDocument.defaultView
        const bx0 = Math.max(0, Math.floor(box.x * scale))
        const by0 = Math.max(0, Math.floor(box.y * scale))
        const bx1 = Math.min(raster.width, Math.ceil((box.x + box.width) * scale))
        const by1 = Math.min(raster.height, Math.ceil((box.y + box.height) * scale))

        // Ink bounds within the glyph box.
        let x0 = bx1
        let y0 = by1
        let x1 = bx0
        let y1 = by0
        for (let y = by0; y < by1; y += 1) {
            for (let x = bx0; x < bx1; x += 1) {
                if (data[(y * raster.width + x) * 4 + 3] < PIXEL_TUNING.inkAlpha) continue
                if (x < x0) x0 = x
                if (x >= x1) x1 = x + 1
                if (y < y0) y0 = y
                if (y >= y1) y1 = y + 1
            }
        }
        const width = x1 - x0
        const height = y1 - y0
        if (width <= 0 || height <= 0) return null

        // Crop the ink bounds out of the raster once so every level samples
        // a small, contiguous buffer.
        const crop = new Uint8ClampedArray(width * height * 4)
        for (let y = 0; y < height; y += 1) {
            const from = ((y0 + y) * raster.width + x0) * 4
            crop.set(data.subarray(from, from + width * 4), y * width * 4)
        }

        const shapes = []
        for (const [index, cell] of levels.entries()) {
            const threshold = index === 0 ? PIXEL_TUNING.coarseThreshold : PIXEL_TUNING.inkThreshold
            const columns = Math.max(1, Math.ceil(width / (cell * scale)))
            const rows = Math.max(1, Math.ceil(height / (cell * scale)))
            const cellWidth = width / columns
            const cellHeight = height / rows
            const grid = sampleCoverage(crop, width, height, cellWidth, cellHeight)

            const rects = []
            for (let row = 0; row < grid.rows; row += 1) {
                for (let column = 0; column < grid.columns; column += 1) {
                    if (grid.coverage[row * grid.columns + column] < threshold) continue
                    rects.push([
                        (x0 + column * cellWidth) / scale,
                        (y0 + row * cellHeight) / scale,
                        cellWidth / scale,
                        cellHeight / scale,
                    ])
                }
            }

            let path = null
            if (typeof view.Path2D === "function") {
                path = new view.Path2D()
                for (const [left, top, w, h] of rects) path.rect(left, top, w, h)
            }
            shapes.push({ rects, path })
        }

        return shapes
    }

    /**
     * Assigns each glyph box its position in the sweep, per `settings.sweep`.
     * Whitespace never has a box, so positions count glyphs only.
     */
    function sweepOrders(built, boxes) {
        if (settings.sweep === "none") return boxes.map(() => 0)
        if (settings.sweep === "text") return boxes.map((box, index) => index)

        const unitIndex = new Map(built.units.map((unit, index) => [unit, index]))
        const lineIndexes = resolveLineIndexes(built)
        const nextOnLine = new Map()
        return boxes.map((box) => {
            const line = lineIndexes[unitIndex.get(box.unit)] ?? 0
            const order = nextOnLine.get(line) ?? 0
            nextOnLine.set(line, order + 1)
            return order
        })
    }

    /**
     * Builds everything the pixel preview draws from: the overlay canvas and,
     * for every glyph, its pixel shapes per level plus the moment it is
     * swapped for the real glyph.
     */
    function createPixelField(built) {
        const doc = element.ownerDocument
        const view = doc.defaultView
        if (!view || typeof doc.createElement("canvas").getContext !== "function") return null

        const style = view.getComputedStyle(element)
        const hostRect = element.getBoundingClientRect()
        // Client rects are in viewport space; a CSS-scaled ancestor shrinks
        // or grows them relative to the host's own layout pixels.
        const zoom = hostRect.width > 0 ? element.offsetWidth / hostRect.width : 1
        const geometry = {
            left: hostRect.left + element.clientLeft / zoom,
            top: hostRect.top + element.clientTop / zoom,
            width: element.clientWidth,
            height: element.clientHeight,
            zoom,
        }
        if (geometry.width <= 0 || geometry.height <= 0) return null

        const fontSize = parseFloat(style.fontSize) || 16
        const color = style.color
        const scale = Math.min(PIXEL_TUNING.sampleScale, Math.max(1, view.devicePixelRatio || 1))
        const rasterized = rasterizeGlyphs(built, geometry, style, color, scale)
        if (!rasterized) return null

        const { raster, boxes } = rasterized
        const data = raster.getContext("2d").getImageData(0, 0, raster.width, raster.height).data
        const levels = pixelLevels(fontSize, resolvePixelSize(settings.pixelSize, fontSize))
        const stepTotal = levels.length * settings.stepDuration

        // Where each glyph sits in the sweep: nowhere by default (the whole
        // text resolves together), within its line (every line sweeps at
        // once), or within the whole text (one reading-order wave).
        const orders = sweepOrders(built, boxes)
        const stagger = resolveStagger(settings.stagger, Math.max(...orders, 0) + 1)

        const glyphs = []
        for (const [index, box] of boxes.entries()) {
            const shapes = buildPixelShapes(data, raster, box, levels, scale)
            if (!shapes) continue
            const start = orders[index] * stagger
            glyphs.push({
                unit: box.unit,
                shapes,
                start,
                crispAt: start + stepTotal + settings.revealDelay,
            })
        }

        const canvas = doc.createElement("canvas")
        canvas.className = PIXELS_CLASS
        canvas.setAttribute("aria-hidden", "true")
        canvas.width = Math.ceil(geometry.width * scale)
        canvas.height = Math.ceil(geometry.height * scale)
        Object.assign(canvas.style, {
            left: "0px",
            top: "0px",
            width: `${geometry.width}px`,
            height: `${geometry.height}px`,
        })

        const ctx = canvas.getContext("2d")
        ctx.setTransform(scale, 0, 0, scale, 0, 0)

        return {
            canvas,
            ctx,
            width: geometry.width,
            height: geometry.height,
            color,
            levels,
            stepTotal,
            glyphs,
            ease: parseEasing(settings.easing),
            duration: glyphs.length > 0 ? Math.max(...glyphs.map((glyph) => glyph.crispAt)) : 0,
        }
    }

    /** The pixel level a glyph shows at the clock time, or -1 once crisp. */
    function pixelLevelAt(field, glyph, time) {
        if (time >= glyph.crispAt) return -1
        if (time < glyph.start || field.stepTotal <= 0) return time < glyph.start ? 0 : field.levels.length - 1

        const progress = field.ease(clamp01((time - glyph.start) / field.stepTotal))
        return Math.min(field.levels.length - 1, Math.floor(progress * field.levels.length))
    }

    /** Draws one frame of the pixel preview for the clock time in ms. */
    function drawPixelFrame(field, time) {
        const { ctx, width, height, glyphs } = field
        ctx.clearRect(0, 0, width, height)
        ctx.fillStyle = field.color

        for (const glyph of glyphs) {
            const level = pixelLevelAt(field, glyph, time)
            if (level < 0) continue

            const shape = glyph.shapes[level]
            if (shape.path) {
                ctx.fill(shape.path)
            } else {
                for (const [left, top, w, h] of shape.rects) ctx.fillRect(left, top, w, h)
            }
        }
    }

    /**
     * Repaints the overlay every frame from the clock animation's own
     * currentTime, so pausing, finishing, or cancelling the clock drives the
     * canvas exactly like the unit animations it runs alongside.
     */
    async function renderPixelFrames(field, clock, signal) {
        const view = element.ownerDocument.defaultView
        const nextFrame = () => new Promise((resolve) => view.requestAnimationFrame(resolve))

        while (!signal.aborted && field.canvas.isConnected && clock.playState !== "finished" && clock.playState !== "idle") {
            drawPixelFrame(field, Number(clock.currentTime) || 0)
            await nextFrame()
        }
    }

    /**
     * Pixel reveal: every glyph is visible from the first frame as a coarse
     * pixel block of its own shape. The whole text then halves its pixel
     * cell in hard steps until every glyph is swapped for its crisp form;
     * `sweep` can stagger that per line or across the text instead. The
     * units occupy their final boxes throughout, so nothing shifts.
     */
    async function runPixel(built, signal) {
        const { units } = built
        for (const unit of units) unit.node.style.opacity = "0"
        const showText = () => {
            for (const unit of units) unit.node.style.opacity = "1"
        }

        if (!await fontsReady(signal)) return false

        const field = createPixelField(built)
        if (!field || field.duration === 0) {
            showText()
            return true
        }

        ensurePositioned()
        element.append(field.canvas)

        // The overlay's animation is the preview's clock. It carries no
        // visible change of its own; every frame is painted from it.
        const clock = field.canvas.animate(
            [{ opacity: 1 }, { opacity: 1 }],
            { duration: field.duration, easing: "linear", fill: "both" },
        )

        // Each glyph cuts hard from its finest pixel level to the real character;
        // whitespace, which draws nothing, appears with the first glyph.
        const crispAt = new Map(field.glyphs.map((glyph) => [glyph.unit, glyph.crispAt]))
        const reveals = units.map((unit) => unit.node.animate(
            [{ opacity: 0 }, { opacity: 1 }],
            { delay: crispAt.get(unit) ?? 0, duration: 0, fill: "both" },
        ))

        renderPixelFrames(field, clock, signal).catch(() => undefined)

        return runAnimations([clock, ...reveals], signal, () => {
            showText()
            field.canvas.remove()
        })
    }

    async function run(signal) {
        const reducedMotion = settings.respectReducedMotion && prefersReducedMotion(element)
        const supportsWaapi = typeof element.animate === "function"

        if (reducedMotion || !supportsWaapi || text.length === 0) {
            renderStatic()
            return
        }

        if (!await wait(settings.initialDelay, signal)) return

        const built = renderUnits()
        if (built.units.length === 0) return

        if (type === "typewriter") {
            await runTypewriter(built, signal)
            return
        }

        if (type === "pixel") {
            await runPixel(built, signal)
            return
        }

        if (type === "line-reveal") {
            const lineIndexes = resolveLineIndexes(built)
            await runRise(built, signal, (unit, index) => lineIndexes[index] * settings.stagger, settings)
            return
        }

        await runRise(built, signal, (unit, index) => index * settings.stagger, settings)
    }

    function cancelPlayback(renderStaticText) {
        playbackController?.abort()
        playbackController = null

        for (const animation of activeAnimations) animation.cancel()
        activeAnimations.clear()

        if (renderStaticText && !destroyed) renderStatic()
    }

    const controls = {
        get type() {
            return type
        },

        play() {
            if (destroyed) {
                throw new Error("Cannot play a destroyed linetxt instance")
            }

            cancelPlayback(false)
            playbackController = new AbortController()
            playbackTask = run(playbackController.signal)
            playbackTask.catch(() => undefined)
            return controls
        },

        stop() {
            cancelPlayback(true)
            return controls
        },

        destroy() {
            if (destroyed) return
            cancelPlayback(false)
            destroyed = true

            if (!originallyHadHostClass) element.classList.remove(HOST_CLASS)
            if (originalAriaLabel === null) element.removeAttribute("aria-label")
            else element.setAttribute("aria-label", originalAriaLabel)
            delete element.dataset.linetxt
            if (patchedPosition !== null) element.style.position = patchedPosition
            element.replaceChildren(...originalNodes)
        },

        get finished() {
            return playbackTask
        },
    }

    if (settings.autoplay) controls.play()
    return controls
}

export default linetxt
