const HOST_CLASS = "linetxt"
const UNIT_CLASS = "linetxt__unit"
const WORD_CLASS = "linetxt__word"
const CARET_CLASS = "linetxt__caret"

export const TYPES = Object.freeze(["typewriter", "line-reveal", "gentle"])

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
 *   type: "typewriter"|"line-reveal"|"gentle",
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
 *   lineSource?: "auto"|"text"|"visual"
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
    const typeDefaults = type === "typewriter"
        ? TYPEWRITER_DEFAULTS
        : type === "line-reveal"
            ? LINE_REVEAL_DEFAULTS
            : GENTLE_DEFAULTS
    const settings = {
        ...typeDefaults,
        ...options,
        autoplay: options.autoplay ?? true,
        respectReducedMotion: options.respectReducedMotion ?? true,
        initialDelay: Math.max(0, Number(options.initialDelay ?? typeDefaults.initialDelay) || 0),
    }

    const originalNodes = Array.from(element.childNodes)
    const originalAriaLabel = element.getAttribute("aria-label")
    const originallyHadHostClass = element.classList.contains(HOST_CLASS)
    const activeAnimations = new Set()
    let playbackController = null
    let playbackTask = Promise.resolve()
    let destroyed = false

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
