function getTableBody(container) {
  return container?.querySelector(".ant-table-body") ||
    container?.querySelector(".ant-table-content");
}

/** Capture only at modal opening; scrolling itself does not update React state. */
export function captureTableReviewPosition(container) {
  const body = getTableBody(container);
  if (!body) return null;
  return {
    top: body.scrollTop,
    left: body.scrollLeft,
    height: container.getBoundingClientRect().height,
    targetKey: null,
  };
}

/** Restore exact offsets, or minimally reveal the destination after navigation. */
export function restoreTableReviewPosition(container, position) {
  const body = getTableBody(container);
  if (!body || !position) return false;
  body.scrollTop = position.top;
  body.scrollLeft = position.left;
  if (position.targetKey != null) {
    const row = Array.from(body.querySelectorAll("[data-review-key]"))
      .find(element => element.getAttribute("data-review-key") === position.targetKey);
    if (row) {
      const viewport = body.getBoundingClientRect();
      const bounds = row.getBoundingClientRect();
      const top = viewport.top + body.clientTop;
      const bottom = top + body.clientHeight;
      if (bounds.top < top) body.scrollTop += bounds.top - top;
      else if (bounds.bottom > bottom) body.scrollTop += bounds.bottom - bottom;
    }
  }
  return true;
}
