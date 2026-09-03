import assert from "node:assert/strict"
import { test } from "node:test"

import {
    GENTLE_CONTRACT,
    TYPES,
    groupByOffsetTop,
    normalizeNewlines,
    splitGraphemes,
} from "../assets/waapi/linetxt.js"

test("exposes exactly the three documented modes", () => {
    assert.deepEqual(TYPES, ["typewriter", "line-reveal", "gentle"])
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

test("gentle reuses the published serega-gentle enter contract", () => {
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
