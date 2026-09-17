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
    previewDuration: 900,
    pixelSize: "auto",
    scatter: 0.75,
    revealDuration: 450,
    revealDelay: 0,
    easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
    initialDelay: 0,
})

/**
 * Look-and-feel constants of the pixel mode. They shape the preview rather
 * than its timing, so they are tuning values rather than per-call options.
 * Adjust them here when the whole effect should change.
 */
export const PIXEL_TUNING = Object.freeze({
    /** Automatic pixel size is the font size divided by this. */
    autoSizeDivisor: 8,
    minPixelSize: 2,
    maxPixelSize: 16,
    /** The pixel size grows until the glyph cell count fits this budget. */
    maxPixels: 6000,
    /** Minimum glyph coverage (0–1) for a grid cell to become a pixel. */
    inkThreshold: 0.14,
    /** Fraction of previewDuration each pixel spends converging on its cell. */
    travel: 0.5,
    /** 0 = pixels arrive in random order, 1 = strictly in reading order. */
    orderBias: 0.5,
    /** Distance, in em, a scattered pixel wanders before it converges. */
    drift: 0.35,
    /** Short-lived noise pixels per glyph pixel during the scattered phase. */
    decoyRatio: 0.35,
    /** Milliseconds per flicker step while a pixel is still unsettled. */
    flickerInterval: 45,
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
 * Resolves the pixel mode's cell size in CSS pixels. `"auto"` derives it
 * from the font size so the same call looks right on a caption and a hero.
 *
 * @param {"auto"|number} pixelSize
 * @param {number} fontSize
 */
export function resolvePixelSize(pixelSize, fontSize) {
    if (pixelSize === "auto" || pixelSize == null) {
        const auto = Math.round((Number(fontSize) || 0) / PIXEL_TUNING.autoSizeDivisor)
        return Math.min(PIXEL_TUNING.maxPixelSize, Math.max(PIXEL_TUNING.minPixelSize, auto))
    }

    const size = Number(pixelSize)
    return Number.isFinite(size) && size >= 1 ? size : PIXEL_TUNING.minPixelSize
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
 * @param {number} cell
 */
export function sampleCoverage(data, width, height, cell) {
    // ceil() can open a trailing cell whose rounded start lies past the
    // raster edge; trim it so every cell holds at least one raster pixel.
    const count = (extent) => {
        let cells = extent > 0 && cell > 0 ? Math.ceil(extent / cell) : 0
        while (cells > 0 && Math.round((cells - 1) * cell) >= extent) cells -= 1
        return cells
    }
    const columns = count(width)
    const rows = count(height)
    const coverage = new Float32Array(columns * rows)

    for (let row = 0; row < rows; row += 1) {
        const y0 = Math.round(row * cell)
        const y1 = Math.min(height, Math.round((row + 1) * cell))

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

/** FNV-1a, so the same text always seeds the same scatter pattern. */
function hashString(value) {
    let hash = 0x811c9dc5
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index)
        hash = Math.imul(hash, 0x01000193)
    }
    return hash >>> 0
}

/** mulberry32: a tiny seeded generator, deterministic per text. */
function createRandom(seed) {
    let state = seed >>> 0
    return () => {
        state = (state + 0x6d2b79f5) >>> 0
        let t = state
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

/** Stateless hash of two integers to 0–1, used for per-frame flicker. */
function hashNoise(a, b) {
    let hash = Math.imul(a, 0x27d4eb2d) ^ Math.imul(b + 0x9e3779b9, 0x85ebca6b)
    hash ^= hash >>> 13
    hash = Math.imul(hash, 0xc2b2ae35)
    hash ^= hash >>> 16
    return (hash >>> 0) / 4294967296
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
 *   previewDuration?: number,
 *   pixelSize?: "auto"|number,
 *   scatter?: number,
 *   revealDuration?: number,
 *   revealDelay?: number
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
        settings.previewDuration = nonNegative("previewDuration")
        settings.revealDuration = nonNegative("revealDuration")
        settings.revealDelay = nonNegative("revealDelay")
        settings.scatter = nonNegative("scatter")
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
     * Rasterizes every glyph at its own DOM box into an offscreen canvas.
     * Positions come from layout and shapes from the host's computed font,
     * so the raster lines up with the final text at any width, alignment,
     * or line count.
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
            }
        }

        return raster
    }

    /**
     * Builds everything the pixel preview draws from: the overlay canvas,
     * the converging pixel particles, the decoy noise, and the progressively
     * finer rasters used while the pixels resolve into text.
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
        const raster = rasterizeGlyphs(built, geometry, style, color, scale)
        if (!raster) return null

        const data = raster.getContext("2d").getImageData(0, 0, raster.width, raster.height).data
        const sampleAt = (size) => sampleCoverage(data, raster.width, raster.height, size * scale)
        const inkCells = (grid) => {
            let count = 0
            for (const value of grid.coverage) if (value > PIXEL_TUNING.inkThreshold) count += 1
            return count
        }

        // Grow the cell until the particle count fits the budget, so a long
        // paragraph stays smooth rather than drawing tens of thousands of
        // rectangles per frame.
        let cell = resolvePixelSize(settings.pixelSize, fontSize)
        let grid = sampleAt(cell)
        while (inkCells(grid) > PIXEL_TUNING.maxPixels && cell < PIXEL_TUNING.maxPixelSize * 4) {
            cell += 1
            grid = sampleAt(cell)
        }

        const random = createRandom(hashString(text))
        const inkAlpha = (coverage) => 0.4 + 0.6 * Math.min(1, coverage / 0.7)
        const scatterRadius = settings.scatter * fontSize
        const driftRadius = PIXEL_TUNING.drift * fontSize
        const travel = PIXEL_TUNING.travel
        const appearWindow = 0.2
        const startWindow = Math.max(0, 1 - travel - 0.08)
        const pixels = []

        for (let row = 0; row < grid.rows; row += 1) {
            for (let column = 0; column < grid.columns; column += 1) {
                const coverage = grid.coverage[row * grid.columns + column]
                if (coverage <= PIXEL_TUNING.inkThreshold) continue

                const tx = column * cell
                const ty = row * cell
                const angle = random() * Math.PI * 2
                const distance = Math.sqrt(random()) * scatterRadius
                const driftAngle = random() * Math.PI * 2
                const driftDistance = random() * driftRadius
                const reading = 0.7 * (tx / geometry.width) + 0.3 * (ty / geometry.height)
                const order = PIXEL_TUNING.orderBias * reading + (1 - PIXEL_TUNING.orderBias) * random()
                const start = 0.08 + startWindow * order

                pixels.push({
                    index: pixels.length,
                    tx,
                    ty,
                    alpha: inkAlpha(coverage),
                    sx: tx + Math.cos(angle) * distance,
                    sy: ty + Math.sin(angle) * distance,
                    dx: Math.cos(driftAngle) * driftDistance,
                    dy: Math.sin(driftAngle) * driftDistance,
                    appear: Math.min(start, random() * appearWindow),
                    start,
                })
            }
        }

        const bleed = Math.ceil(scatterRadius + driftRadius + cell)
        const decoys = []
        const decoyCount = Math.max(4, Math.round(pixels.length * PIXEL_TUNING.decoyRatio))
        for (let index = 0; index < decoyCount; index += 1) {
            const from = random() * 0.5
            const driftAngle = random() * Math.PI * 2
            const driftDistance = random() * driftRadius * 2
            decoys.push({
                x: -bleed + random() * (geometry.width + 2 * bleed),
                y: -bleed + random() * (geometry.height + 2 * bleed),
                dx: Math.cos(driftAngle) * driftDistance,
                dy: Math.sin(driftAngle) * driftDistance,
                from,
                to: Math.min(0.8, from + 0.1 + random() * 0.3),
                alpha: 0.2 + random() * 0.25,
            })
        }

        // Resolve levels: the same glyphs at halving cell sizes, ending on the
        // anti-aliased raster itself so the hand-off to DOM text is seamless.
        const gapFor = (size) => (size >= 5 ? 1 : 0)
        const levelSizes = [...new Set([cell, Math.round(cell / 2), Math.round(cell / 4)])]
            .filter((size) => size > 1)
            .sort((a, b) => b - a)
        const levels = levelSizes.map((size) => {
            const layer = doc.createElement("canvas")
            layer.width = raster.width
            layer.height = raster.height
            const ctx = layer.getContext("2d")
            ctx.scale(scale, scale)
            ctx.fillStyle = color

            const levelGrid = sampleAt(size)
            const gap = gapFor(size)
            for (let row = 0; row < levelGrid.rows; row += 1) {
                for (let column = 0; column < levelGrid.columns; column += 1) {
                    const coverage = levelGrid.coverage[row * levelGrid.columns + column]
                    if (coverage <= PIXEL_TUNING.inkThreshold) continue
                    ctx.globalAlpha = inkAlpha(coverage)
                    ctx.fillRect(column * size, row * size, size - gap, size - gap)
                }
            }
            return layer
        })
        levels.push(raster)

        const canvas = doc.createElement("canvas")
        canvas.className = PIXELS_CLASS
        canvas.setAttribute("aria-hidden", "true")
        canvas.width = Math.ceil((geometry.width + 2 * bleed) * scale)
        canvas.height = Math.ceil((geometry.height + 2 * bleed) * scale)
        Object.assign(canvas.style, {
            left: `${-bleed}px`,
            top: `${-bleed}px`,
            width: `${geometry.width + 2 * bleed}px`,
            height: `${geometry.height + 2 * bleed}px`,
        })

        const ctx = canvas.getContext("2d")
        ctx.setTransform(scale, 0, 0, scale, bleed * scale, bleed * scale)
        ctx.imageSmoothingEnabled = false

        return {
            canvas,
            ctx,
            bleed,
            cell,
            gap: gapFor(cell),
            width: geometry.width,
            height: geometry.height,
            color,
            pixels,
            decoys,
            levels,
            ease: parseEasing(settings.easing),
        }
    }

    /** Draws the scattered-to-converged phase at preview progress u (0–1). */
    function drawConverge(field, u, time) {
        const { ctx, cell, gap, pixels, decoys, ease } = field
        const size = cell - gap
        const snap = (value) => Math.round(value / cell) * cell
        const flickerStep = Math.floor(time / PIXEL_TUNING.flickerInterval)
        ctx.fillStyle = field.color

        for (const decoy of decoys) {
            if (u < decoy.from || u >= decoy.to) continue
            const life = (u - decoy.from) / (decoy.to - decoy.from)
            ctx.globalAlpha = decoy.alpha * Math.sin(life * Math.PI)
            ctx.fillRect(snap(decoy.x + decoy.dx * u), snap(decoy.y + decoy.dy * u), size, size)
        }

        for (const pixel of pixels) {
            if (u < pixel.appear) continue

            const progress = clamp01((u - pixel.start) / PIXEL_TUNING.travel)
            const eased = ease(progress)
            const settledAt = Math.min(u, pixel.start)
            const fromX = pixel.sx + pixel.dx * settledAt
            const fromY = pixel.sy + pixel.dy * settledAt
            const x = snap(fromX + (pixel.tx - fromX) * eased)
            const y = snap(fromY + (pixel.ty - fromY) * eased)

            let alpha = pixel.alpha * clamp01((u - pixel.appear) / 0.08) * (0.55 + 0.45 * eased)
            if (progress < 0.9 && hashNoise(pixel.index, flickerStep) < 0.2) alpha *= 0.25

            ctx.globalAlpha = alpha
            ctx.fillRect(x, y, size, size)
        }

        ctx.globalAlpha = 1
    }

    /** Draws one frame of the pixel preview for the clock time in ms. */
    function drawPixelFrame(field, time) {
        const { ctx, bleed, width, height, levels } = field
        const previewEnd = settings.previewDuration + settings.revealDelay
        ctx.clearRect(-bleed, -bleed, width + 2 * bleed, height + 2 * bleed)

        if (time < settings.previewDuration) {
            drawConverge(field, time / settings.previewDuration, time)
            return
        }

        // Refinement steps are linear in time so every level gets an equal,
        // visible share of the reveal; the easing shapes the crossfade instead.
        let level = 0
        if (time >= previewEnd && settings.revealDuration > 0) {
            const progress = clamp01((time - previewEnd) / settings.revealDuration)
            level = Math.min(levels.length - 1, Math.floor(progress * levels.length))
        }

        ctx.globalAlpha = 1
        ctx.drawImage(levels[level], 0, 0, width, height)
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
     * Pixel reveal: the glyphs are sampled into a cell grid, drawn as
     * scattered pixels that converge on their cells, held as pixelated text,
     * then resolved through finer rasters while the real units fade in on
     * top. The units occupy their final boxes throughout, so nothing shifts.
     */
    async function runPixel(built, signal) {
        const { units } = built
        for (const unit of units) unit.node.style.opacity = "0"
        const showText = () => {
            for (const unit of units) unit.node.style.opacity = "1"
        }

        if (!await fontsReady(signal)) return false

        const field = createPixelField(built)
        const previewEnd = settings.previewDuration + settings.revealDelay
        const total = previewEnd + settings.revealDuration
        if (!field || total === 0) {
            showText()
            return true
        }

        ensurePositioned()
        element.append(field.canvas)

        // The overlay's opacity keyframes double as the preview's clock: it
        // stays fully visible until the resolve phase, then fades out under
        // the arriving text.
        const fadeFrom = (previewEnd + settings.revealDuration * 0.55) / total
        const clock = field.canvas.animate(
            [
                { opacity: 1, offset: 0 },
                { opacity: 1, offset: fadeFrom, easing: settings.easing },
                { opacity: 0, offset: 1 },
            ],
            { duration: total, easing: "linear", fill: "both" },
        )
        const reveals = units.map((unit) => unit.node.animate(
            [{ opacity: 0 }, { opacity: 1 }],
            {
                delay: previewEnd,
                duration: settings.revealDuration,
                easing: settings.easing,
                fill: "both",
            },
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
