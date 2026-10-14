const protectedControls = [
  'input:not([type="checkbox"])', "textarea", "select", '[contenteditable]:not([contenteditable="false"])',
  '[role="textbox"]', '[role="combobox"]', '[role="listbox"]', '[role="menu"]',
  '[role="slider"]', '[role="spinbutton"]', '[role="radiogroup"]',
  '[role="tree"]', '[role="grid"]', '[data-variant-review-shortcuts="off"]',
].join(",");

const overlaySelector = [
  '[role="dialog"]', '[role="alertdialog"]', ".ant-drawer-open",
  ".ant-select-dropdown", ".ant-dropdown", ".ant-popover",
].join(",");

const isVisible = element => element.getClientRects().length > 0 &&
  !["hidden", "collapse"].includes(element.ownerDocument.defaultView.getComputedStyle(element).visibility);

const shortcutActions = new Map([
  ["ArrowLeft", "previous"], ["ArrowRight", "next"],
  ["k", "previous"], ["j", "next"],
  ["h", "previousTab"], ["l", "nextTab"],
  ["u", "toggleReport"], ["i", "toggleReviewed"],
]);

/** DOM eligibility stays here; dispatch and event cancellation belong to the modal.
 * Tabs and checkboxes are eligible, but editors and genome controls retain keys.
 */
export function getReviewShortcutAction(event, root) {
  const action = shortcutActions.get(event.key);
  if (!action || event.defaultPrevented || event.altKey || event.ctrlKey ||
    event.metaKey || event.shiftKey || event.isComposing || event.keyCode === 229) return null;

  const dialog = root?.querySelector('[role="dialog"]');
  if (!dialog || !isVisible(dialog)) return null;
  const doc = dialog.ownerDocument;
  const target = event.target?.nodeType === 3 ? event.target.parentElement : event.target;
  if (!target || (!dialog.contains(target) && target !== doc.body && target !== doc.documentElement)) return null;
  if (target.closest?.(protectedControls)) return null;

  // A portal may sit outside our DOM subtree while still belonging to this review.
  // Pause even if focus hasn't moved into a newly opened overlay yet.
  if (Array.from(doc.querySelectorAll(overlaySelector)).some(element =>
    element !== dialog && !element.contains(dialog) && isVisible(element))) return null;
  return action;
}

// Preserve the navigation-only interface for existing callers.
export function getReviewShortcutDirection(event, root) {
  const action = getReviewShortcutAction(event, root);
  return action === "previous" || action === "next" ? action : null;
}
