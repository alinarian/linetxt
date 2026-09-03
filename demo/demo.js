import { linetxt } from "../assets/waapi/linetxt.js";

// Shakespeare, public domain. Each sample is chosen for the case it exercises,
// not only for the line: one line, exactly three lines, a short accent phrase,
// and copy long enough to wrap.
const SAMPLES = {
  single: {
    label: "Single line",
    text: "To be, or not to be.",
    tag: "h3",
    source: "Hamlet, Act III, Scene 1",
  },
  heading: {
    label: "Three lines",
    text:
      "Tomorrow, and tomorrow, and tomorrow,\n" +
      "Creeps in this petty pace from day to day,\n" +
      "To the last syllable of recorded time",
    tag: "h3",
    source: "Macbeth, Act V, Scene 5",
  },
  short: {
    label: "Short phrase",
    text: "The rest is silence.",
    tag: "h3",
    source: "Hamlet, Act V, Scene 2",
  },
  long: {
    label: "Wrapping paragraph",
    text:
      "All the world's a stage, and all the men and women merely players. " +
      "They have their exits and their entrances, and one man in his time " +
      "plays many parts, his acts being seven ages. At first, the infant, " +
      "mewling and puking in the nurse's arms.",
    tag: "p",
    source: "As You Like It, Act II, Scene 7",
  },
};

const MODES = [
  {
    id: "typewriter",
    blurb:
      "Characters appear one after another, as if typed. Every character holds its final layout box from the first frame and is revealed with opacity, so the text never reflows while typing and the wrapping matches the finished text.",
    sample: "single",
    controls: [
      { name: "charInterval", min: 10, max: 200, step: 5, unit: "ms" },
      { name: "charDuration", min: 0, max: 400, step: 10, unit: "ms" },
      { name: "initialDelay", min: 0, max: 1000, step: 50, unit: "ms" },
    ],
    toggles: [{ name: "caret" }, { name: "caretPersist" }],
  },
  {
    id: "line-reveal",
    blurb:
      "Lines rise from below and fade in, one after another, 100ms apart. Lines are detected at run time — from newlines when the text has them, otherwise by grouping words that share a rendered line box — so the count is never hardcoded and the grouping follows real wrapping at any width.",
    sample: "heading",
    controls: [
      { name: "stagger", min: 0, max: 400, step: 10, unit: "ms" },
      { name: "duration", min: 100, max: 1400, step: 50, unit: "ms" },
      { name: "y", min: 0, max: 64, step: 2, unit: "px" },
      { name: "initialDelay", min: 0, max: 1000, step: 50, unit: "ms" },
    ],
    selects: [{ name: "lineSource", options: ["auto", "text", "visual"] }],
  },
  {
    id: "gentle",
    blurb:
      "The per-character rise published by serega-gentle, reused as-is: 500ms, 15ms stagger, 15px, cubic-bezier(0.2, 0.8, 0.2, 1). It animates only transform and opacity — never blur — and has no exit, which is what makes it safe for long and multiline copy.",
    sample: "short",
    controls: [
      { name: "stagger", min: 0, max: 80, step: 1, unit: "ms" },
      { name: "duration", min: 100, max: 1400, step: 50, unit: "ms" },
      { name: "y", min: 0, max: 64, step: 1, unit: "px" },
      { name: "initialDelay", min: 0, max: 1000, step: 50, unit: "ms" },
    ],
  },
];

// Mirrors the defaults documented in SKILL.md. The snippet only prints a
// parameter once it differs from these, so it always shows the shortest call
// that reproduces what is on screen.
const DEFAULTS = {
  typewriter: {
    charInterval: 45,
    charDuration: 0,
    initialDelay: 0,
    caret: true,
    caretPersist: false,
  },
  "line-reveal": {
    stagger: 100,
    duration: 600,
    y: 16,
    initialDelay: 0,
    lineSource: "auto",
  },
  gentle: { stagger: 15, duration: 500, y: 15, initialDelay: 0 },
};

const state = {
  modeId: MODES[0].id,
  sampleId: MODES[0].sample,
  options: new Map(MODES.map((mode) => [mode.id, { ...DEFAULTS[mode.id] }])),
};

const dom = {
  tabs: document.querySelector("#tabs"),
  blurb: document.querySelector("#blurb"),
  chips: document.querySelector("#chips"),
  stage: document.querySelector("#stage"),
  badge: document.querySelector("#badge"),
  panel: document.querySelector("#panel"),
  snippet: document.querySelector("#snippet"),
};

let controls = null;

const activeMode = () => MODES.find((mode) => mode.id === state.modeId);
const activeOptions = () => state.options.get(state.modeId);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * Puts the specimen in the DOM as plain text. Called before every reveal so the
 * copy is readable first: the animation enhances text that is already there
 * rather than being the only thing that renders it.
 */
function mount() {
  controls?.destroy();

  const sample = SAMPLES[state.sampleId];
  const target = el(sample.tag, "specimen", sample.text);
  // The attribution sits outside the animated element: linetxt rewrites its
  // host's children, so anything it must not touch stays a sibling.
  dom.stage.replaceChildren(target, el("p", "source", sample.source));
  return target;
}

function play() {
  controls = linetxt(mount(), { type: state.modeId, ...activeOptions() });
  dom.badge.textContent = `type: ${controls.type}`;
  renderSnippet();
}

function renderSnippet() {
  const options = activeOptions();
  const defaults = DEFAULTS[state.modeId];
  const changed = Object.keys(defaults)
    .filter((key) => options[key] !== defaults[key])
    .map((key) => `    ${key}: ${JSON.stringify(options[key])},`);

  dom.snippet.textContent = [
    "linetxt(element, {",
    `    type: ${JSON.stringify(state.modeId)},`,
    ...changed,
    "})",
  ].join("\n");
}

function renderTabs() {
  dom.tabs.replaceChildren();

  for (const mode of MODES) {
    const tab = el("button", "tab", mode.id);
    tab.type = "button";
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", String(mode.id === state.modeId));
    tab.addEventListener("click", () => {
      if (mode.id === state.modeId) return play();
      state.modeId = mode.id;
      state.sampleId = mode.sample;
      render();
    });
    dom.tabs.append(tab);
  }
}

function renderChips() {
  dom.chips.replaceChildren();

  for (const [id, sample] of Object.entries(SAMPLES)) {
    const chip = el("button", "chip", sample.label);
    chip.type = "button";
    chip.setAttribute("aria-pressed", String(id === state.sampleId));
    chip.addEventListener("click", () => {
      state.sampleId = id;
      for (const other of dom.chips.children) {
        other.setAttribute("aria-pressed", String(other === chip));
      }
      play();
    });
    dom.chips.append(chip);
  }
}

function renderPanel() {
  const mode = activeMode();
  const options = activeOptions();
  dom.panel.replaceChildren();

  for (const control of mode.controls ?? []) {
    const row = el("label", "control");
    const value = el("span", "control__value", `${options[control.name]}${control.unit}`);
    const input = el("input");
    Object.assign(input, {
      type: "range",
      min: control.min,
      max: control.max,
      step: control.step,
      value: options[control.name],
    });

    input.addEventListener("input", () => {
      options[control.name] = Number(input.value);
      value.textContent = `${input.value}${control.unit}`;
      renderSnippet();
    });
    input.addEventListener("change", play);

    row.append(el("span", "control__label", control.name), input, value);
    dom.panel.append(row);
  }

  for (const select of mode.selects ?? []) {
    const row = el("label", "control");
    const field = el("select");

    for (const option of select.options) {
      const node = el("option", null, option);
      node.value = option;
      if (option === options[select.name]) node.selected = true;
      field.append(node);
    }

    field.addEventListener("change", () => {
      options[select.name] = field.value;
      play();
    });

    row.append(el("span", "control__label", select.name), field);
    dom.panel.append(row);
  }

  for (const toggle of mode.toggles ?? []) {
    const row = el("label", "control control--toggle");
    const input = el("input");
    input.type = "checkbox";
    input.checked = options[toggle.name];
    input.addEventListener("change", () => {
      options[toggle.name] = input.checked;
      play();
    });

    row.append(input, el("span", "control__label", toggle.name));
    dom.panel.append(row);
  }

  const actions = el("div", "panel__actions");

  const replay = el("button", "button button--primary", "Replay");
  replay.type = "button";
  replay.addEventListener("click", play);
  actions.append(replay);

  const reset = el("button", "button", "Reset");
  reset.type = "button";
  reset.addEventListener("click", () => {
    state.options.set(state.modeId, { ...DEFAULTS[state.modeId] });
    renderPanel();
    play();
  });
  actions.append(reset);

  dom.panel.append(actions);
}

function render() {
  renderTabs();
  dom.blurb.textContent = activeMode().blurb;
  renderChips();
  renderPanel();
  play();
}

render();

// Hero: the wordmark uses gentle, the tagline is typed underneath it.
const wordmark = document.querySelector("#wordmark");
const tagline = document.querySelector("#tagline");
const taglineText = tagline.textContent;
let heroWordmark = null;
let heroTagline = null;

function playHero() {
  heroWordmark?.destroy();
  heroTagline?.destroy();

  heroWordmark = linetxt(wordmark, { type: "gentle" });
  tagline.textContent = taglineText;
  heroTagline = linetxt(tagline, {
    type: "typewriter",
    charInterval: 28,
    initialDelay: 420,
  });
}

document.querySelector("#replay-hero").addEventListener("click", playHero);
playHero();
