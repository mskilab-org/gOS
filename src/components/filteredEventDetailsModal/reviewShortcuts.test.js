/** @jest-environment node */
import { JSDOM } from "jsdom";
import { getReviewShortcutAction, getReviewShortcutDirection } from "./reviewShortcuts";

let dom;
let doc;
let root;
let dialog;
const visible = element => { element.getClientRects = () => [{ width: 100, height: 100 }]; return element; };
const key = (target, overrides = {}) => ({ key: "ArrowRight", target, ...overrides });

beforeEach(() => {
  dom = new JSDOM('<!doctype html><body><main id="outside"></main><div id="root"><div role="dialog"><button role="tab">Plots</button><button id="next">Next</button><p id="content">Review text</p></div></div></body>');
  doc = dom.window.document;
  root = doc.querySelector("#root");
  dialog = visible(root.querySelector('[role="dialog"]'));
});
afterEach(() => dom.window.close());

it.each(["[role=tab]", "#next", "#content", "body"])("accepts both arrows on %s, including tabs", selector => {
  const target = doc.querySelector(selector);
  expect(getReviewShortcutDirection(key(target), root)).toBe("next");
  expect(getReviewShortcutDirection(key(target, { key: "ArrowLeft" }), root)).toBe("previous");
});

it.each([
  '<input />', '<textarea></textarea>', '<select></select>',
  '<div contenteditable=""><span>edit</span></div>', '<div role="textbox"><span>edit</span></div>',
  '<div role="combobox"><span>choose</span></div>', '<div role="listbox"><span>choose</span></div>',
  '<div role="menu"><span>choose</span></div>', '<div role="slider"></div>',
  '<div role="spinbutton"></div>', '<div role="radiogroup"><span>choice</span></div>',
  '<div role="tree"><span>item</span></div>', '<div role="grid"><span>cell</span></div>',
  '<div data-variant-review-shortcuts="off"><button>Genome control</button></div>',
])("preserves protected control arrows: %s", html => {
  const holder = doc.createElement("div");
  holder.innerHTML = html; dialog.appendChild(holder);
  expect(getReviewShortcutDirection(key(holder.firstChild.firstChild || holder.firstChild), root)).toBeNull();
});

it.each([
  { key: "ArrowUp" }, { key: "Escape" }, { ctrlKey: true }, { altKey: true },
  { metaKey: true }, { shiftKey: true }, { isComposing: true }, { keyCode: 229 },
  { defaultPrevented: true },
])("ignores reserved keys/modifiers/composition: %o", flags => {
  expect(getReviewShortcutDirection(key(dialog, flags), root)).toBeNull();
});

it("requires a visible owning modal and no foreign focus", () => {
  expect(getReviewShortcutDirection(key(doc.querySelector("#outside")), root)).toBeNull();
  expect(getReviewShortcutDirection(key(dialog), null)).toBeNull();
  dialog.getClientRects = () => [];
  expect(getReviewShortcutDirection(key(doc.body), root)).toBeNull();
});

it.each(['role="dialog"', 'role="alertdialog"', 'class="ant-drawer-open"', 'class="ant-select-dropdown"', 'class="ant-dropdown"', 'class="ant-popover"'])("pauses while another overlay is visible: %s", attributes => {
  const holder = doc.createElement("div");
  holder.innerHTML = `<div ${attributes}><button>Other control</button></div>`;
  doc.body.appendChild(holder);
  const overlay = visible(holder.firstChild);
  expect(getReviewShortcutDirection(key(dialog), root)).toBeNull();
  expect(getReviewShortcutDirection(key(overlay.firstChild), root)).toBeNull();
  overlay.style.visibility = "hidden";
  expect(getReviewShortcutDirection(key(dialog), root)).toBe("next");
  overlay.style.visibility = "visible";
  overlay.getClientRects = () => [];
  expect(getReviewShortcutDirection(key(dialog), root)).toBe("next");
});

it.each([
  ["j", "next"], ["k", "previous"], ["h", "previousTab"], ["l", "nextTab"],
  ["u", "toggleReport"], ["i", "toggleReviewed"],
])("maps %s to %s and protects editors/genome controls", (letter, action) => {
  expect(getReviewShortcutAction(key(dialog, { key: letter }), root)).toBe(action);
  const editor = doc.createElement("textarea"); dialog.appendChild(editor);
  expect(getReviewShortcutAction(key(editor, { key: letter }), root)).toBeNull();
  const genome = doc.createElement("div"); genome.setAttribute("data-variant-review-shortcuts", "off");
  dialog.appendChild(genome);
  expect(getReviewShortcutAction(key(genome, { key: letter }), root)).toBeNull();
  expect(getReviewShortcutAction(key(dialog, { key: letter, ctrlKey: true }), root)).toBeNull();
  expect(getReviewShortcutAction(key(dialog, { key: letter, isComposing: true }), root)).toBeNull();
  expect(getReviewShortcutAction(key(doc.querySelector("#outside"), { key: letter }), root)).toBeNull();
  const overlay = visible(doc.createElement("div")); overlay.setAttribute("role", "dialog"); doc.body.appendChild(overlay);
  expect(getReviewShortcutAction(key(dialog, { key: letter }), root)).toBeNull();
});

it("allows review shortcuts on a checkbox without intercepting text inputs", () => {
  const checkbox = doc.createElement("input"); checkbox.type = "checkbox"; dialog.appendChild(checkbox);
  expect(getReviewShortcutAction(key(checkbox, { key: "i" }), root)).toBe("toggleReviewed");
  expect(getReviewShortcutAction(key(checkbox, { key: "u" }), root)).toBe("toggleReport");
});

it.each(["I", "J", "H", "x", "Escape", "Tab"])("ignores non-shortcut key %s", letter => {
  expect(getReviewShortcutAction(key(dialog, { key: letter }), root)).toBeNull();
});

it("also excludes protected controls and nested dialogs inside the modal", () => {
  const nested = visible(doc.createElement("div"));
  nested.setAttribute("role", "dialog"); dialog.appendChild(nested);
  expect(getReviewShortcutDirection(key(dialog), root)).toBeNull();
  expect(getReviewShortcutDirection(key(nested), root)).toBeNull();
});
