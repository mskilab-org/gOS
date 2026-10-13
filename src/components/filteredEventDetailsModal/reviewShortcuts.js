const protectedControls = [
  "input", "textarea", "select", '[contenteditable]:not([contenteditable="false"])',
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

/** Return a review direction only when the modal owns this unmodified arrow.
 * DOM inspection is kept here; dispatch and event cancellation belong to the modal.
 * Tabs are intentionally eligible: arrows review variants rather than moving tab focus.
 */
export function getReviewShortcutDirection(event, root) {
  const direction = event.key === "ArrowLeft" ? "previous" : event.key === "ArrowRight" ? "next" : null;
  if (!direction || event.defaultPrevented || event.altKey || event.ctrlKey ||
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
  return direction;
}
