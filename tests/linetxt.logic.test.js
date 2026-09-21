import assert from "node:assert/strict"
import { test } from "node:test"

import {
    GENTLE_CONTRACT,
    PIXEL_TUNING,
    TYPES,
    cubicBezier,
    groupByOffsetTop,
    mosaicLevels,
    normalizeNewlines,
    parseEasing,
    resolvePixelSize,
    resolveStagger,
    sampleCoverage,
    splitGraphemes,
} from "../assets/waapi/linetxt.js"

test("exposes exactly the four documented modes", () => {
    assert.deepEqual(TYPES, ["typewriter", "line-reveal", "gentle", "pixel"])
})

test("normalizeNewlines collapses CRLF and CR to LF", () => {
    assert.equal(normalizeNewlines("a\r\nb\rc\nd"), "a\nb\nc\nd")
    assert.equal(normalizeNewlines("no breaks"), "no breaks")
})

test("splitGraphemes keeps emoji, combining marks, and Cyrillic intact", () => {
    assert.deepEqual(splitGraphemes("ab"), ["a", "b"])
    assert.deepEqual(splitGraphemes("👋🏽"), ["👋🏽"])
    assert.deepEqual(splitGraphemes("é"), ["é"]) // e + combining acute
    assert.deepEqual(splitGraphemes("Привет"), ["П", "р", "и", "в", "е", "т"])
})

test("splitGraphemes preserves spaces and punctuation as their own units", () => {
    assert.deepEqual(splitGraphemes("hi, x"), ["h", "i", ",", " ", "x"])
})

test("groupByOffsetTop puts a single rendered line in one group", () => {
    assert.deepEqual(groupByOffsetTop([0, 0, 0]), [0, 0, 0])
})

test("groupByOffsetTop opens a new group per rendered line", () => {
    assert.deepEqual(groupByOffsetTop([0, 0, 24, 24, 48]), [0, 0, 1, 1, 2])
})

test("groupByOffsetTop tolerates sub-pixel jitter within one line", () => {
    assert.deepEqual(groupByOffsetTop([0, 0.4, 0.9, 24]), [0, 0, 0, 1])
})

test("groupByOffsetTop handles an empty input", () => {
    assert.deepEqual(groupByOffsetTop([]), [])
})

test("groupByOffsetTop never regresses to a previous group", () => {
    // Superscripts and inline images can push a word slightly above its line.
    assert.deepEqual(groupByOffsetTop([0, 24, 23.5, 48]), [0, 1, 1, 2])
})

test("gentle keeps its frozen enter contract", () => {
    assert.deepEqual({ ...GENTLE_CONTRACT }, {
        duration: 500,
        stagger: 15,
        easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
        y: 15,
    })
})

test("gentle contract is frozen against accidental retuning", () => {
    assert.ok(Object.isFrozen(GENTLE_CONTRACT))
})

test("cubicBezier passes through its end points and stays monotonic", () => {
    const ease = cubicBezier(0.2, 0.8, 0.2, 1)
    assert.equal(ease(0), 0)
    assert.equal(ease(1), 1)

    let previous = 0
    for (let step = 1; step <= 100; step += 1) {
        const value = ease(step / 100)
        assert.ok(value >= previous - 1e-9, `not monotonic at ${step / 100}`)
        previous = value
    }
})

test("cubicBezier reproduces the identity for a linear curve", () => {
    const ease = cubicBezier(0, 0, 1, 1)
    for (const x of [0.1, 0.25, 0.5, 0.75, 0.9]) {
        assert.ok(Math.abs(ease(x) - x) < 1e-4, `${x} → ${ease(x)}`)
    }
})

test("parseEasing understands keywords and cubic-bezier()", () => {
    assert.equal(parseEasing("linear")(0.3), 0.3)
    assert.ok(parseEasing("ease-out")(0.5) > 0.5)
    assert.ok(parseEasing("ease-in")(0.5) < 0.5)

    const custom = parseEasing("cubic-bezier(0.2, 0.8, 0.2, 1)")
    assert.ok(custom(0.5) > 0.85, String(custom(0.5)))
    assert.equal(custom(1), 1)
})

test("parseEasing degrades unknown easings to linear", () => {
    assert.equal(parseEasing("steps(4, end)")(0.42), 0.42)
    assert.equal(parseEasing(undefined)(0.42), 0.42)
    assert.equal(parseEasing("cubic-bezier(a, b, c, d)")(0.42), 0.42)
})

test("resolvePixelSize derives the finest cell from the font size", () => {
    assert.equal(resolvePixelSize("auto", 64), 4)
    assert.equal(resolvePixelSize("auto", 150), 9)
    assert.equal(resolvePixelSize(undefined, 20), PIXEL_TUNING.minPixelSize)
})

test("resolvePixelSize never goes below the tuned minimum", () => {
    assert.equal(resolvePixelSize("auto", 8), PIXEL_TUNING.minPixelSize)
    assert.equal(resolvePixelSize(0, 64), PIXEL_TUNING.minPixelSize)
    assert.equal(resolvePixelSize("big", 64), PIXEL_TUNING.minPixelSize)
})

test("resolvePixelSize honours an explicit size", () => {
    assert.equal(resolvePixelSize(5, 64), 5)
    assert.equal(resolvePixelSize("6", 64), 6)
})

test("mosaicLevels halves from one block per glyph down to the finest cell", () => {
    const levels = mosaicLevels(150, 9)
    assert.equal(levels[0], 150 * PIXEL_TUNING.coarsestCell)
    for (let index = 1; index < levels.length; index += 1) {
        assert.equal(levels[index], levels[index - 1] / 2)
    }
    assert.ok(levels.at(-1) >= 9, String(levels))
    assert.ok(levels.at(-1) / 2 < 9, String(levels))
})

test("mosaicLevels always yields at least the single-block level", () => {
    assert.deepEqual(mosaicLevels(10, 40), [40])
    assert.equal(mosaicLevels(0, 2).length, 1)
})

test("resolveStagger spreads the automatic sweep over a fixed budget", () => {
    assert.equal(resolveStagger("auto", 1), 0)
    assert.equal(resolveStagger("auto", 10), PIXEL_TUNING.autoSweep / 9)
})

test("resolveStagger clamps the automatic pace per character", () => {
    assert.equal(resolveStagger("auto", 2), PIXEL_TUNING.autoStaggerMax)
    assert.equal(resolveStagger("auto", 500), PIXEL_TUNING.autoStaggerMin)
})

test("resolveStagger honours an explicit value and rejects nonsense", () => {
    assert.equal(resolveStagger(130, 8), 130)
    assert.equal(resolveStagger(-5, 8), 0)
    assert.equal(resolveStagger("fast", 8), 0)
})

/** Builds an RGBA raster whose alpha is 255 wherever `ink(x, y)` is true. */
function raster(width, height, ink) {
    const data = new Uint8ClampedArray(width * height * 4)
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            if (ink(x, y)) data[(y * width + x) * 4 + 3] = 255
        }
    }
    return data
}

test("sampleCoverage averages glyph alpha per cell", () => {
    // Ink fills the top-left 2×2 quadrant and half of the top-right one.
    const data = raster(4, 4, (x, y) => y < 2 && (x < 2 || x === 2))
    const grid = sampleCoverage(data, 4, 4, 2)

    assert.equal(grid.columns, 2)
    assert.equal(grid.rows, 2)
    assert.deepEqual(Array.from(grid.coverage), [1, 0.5, 0, 0])
})

test("sampleCoverage assigns every raster pixel to exactly one fractional cell", () => {
    const data = raster(5, 3, () => true)
    const grid = sampleCoverage(data, 5, 3, 1.5)

    assert.equal(grid.columns, 3)
    assert.equal(grid.rows, 2)
    assert.ok(Array.from(grid.coverage).every((value) => value === 1), String(grid.coverage))
})

test("sampleCoverage accepts a separate cell height", () => {
    // Ink fills the top half of a 4×4 raster; 2-wide × 1-tall cells.
    const data = raster(4, 4, (x, y) => y < 2)
    const grid = sampleCoverage(data, 4, 4, 2, 1)

    assert.equal(grid.columns, 2)
    assert.equal(grid.rows, 4)
    assert.deepEqual(Array.from(grid.coverage), [1, 1, 1, 1, 0, 0, 0, 0])
})

test("sampleCoverage handles an empty raster", () => {
    const grid = sampleCoverage(new Uint8ClampedArray(0), 0, 0, 4)
    assert.equal(grid.columns, 0)
    assert.equal(grid.rows, 0)
    assert.equal(grid.coverage.length, 0)
})

test("pixel tuning is frozen against accidental retuning", () => {
    assert.ok(Object.isFrozen(PIXEL_TUNING))
    assert.ok(PIXEL_TUNING.coarsestCell > 0)
    assert.ok(PIXEL_TUNING.inkThreshold > 0 && PIXEL_TUNING.inkThreshold < 1)
    assert.ok(PIXEL_TUNING.coarseThreshold <= PIXEL_TUNING.inkThreshold)
})
