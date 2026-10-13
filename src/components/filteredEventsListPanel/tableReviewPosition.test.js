/** @jest-environment node */
import { captureTableReviewPosition, restoreTableReviewPosition } from "./tableReviewPosition";

function fixture(rowTop = 400, rowBottom = 440) {
  const row = { getAttribute: () => "target", getBoundingClientRect: () => ({ top: rowTop, bottom: rowBottom }) };
  const body = {
    scrollTop: 310, scrollLeft: 175, clientTop: 0, clientHeight: 500,
    getBoundingClientRect: () => ({ top: 100, bottom: 600 }),
    querySelectorAll: () => [row],
  };
  const container = { querySelector: () => body, getBoundingClientRect: () => ({ height: 620 }) };
  return { body, container };
}

describe("table review position", () => {
  test("captures and restores exact two-axis offsets", () => {
    const { container, body } = fixture();
    const position = captureTableReviewPosition(container);
    expect(position).toEqual({ top: 310, left: 175, height: 620, targetKey: null });
    body.scrollTop = 0; body.scrollLeft = 0;
    expect(restoreTableReviewPosition(container, position)).toBe(true);
    expect(body.scrollTop).toBe(310);
    expect(body.scrollLeft).toBe(175);
  });
  test.each([[400, 440, 310], [50, 90, 260], [580, 640, 350]])(
    "reveals a destination only when outside the viewport (%s..%s)", (top, bottom, expected) => {
      const { container, body } = fixture(top, bottom);
      restoreTableReviewPosition(container, { top: 310, left: 175, targetKey: "target" });
      expect(body.scrollTop).toBe(expected);
      expect(body.scrollLeft).toBe(175);
    }
  );
  test("missing elements/targets are safe and zero is preserved", () => {
    expect(captureTableReviewPosition(null)).toBeNull();
    expect(restoreTableReviewPosition(null, {})).toBe(false);
    expect(restoreTableReviewPosition({ querySelector: () => null }, {})).toBe(false);
    const { container, body } = fixture();
    restoreTableReviewPosition(container, { top: 0, left: 0, targetKey: "absent" });
    expect(body.scrollTop).toBe(0);
    expect(body.scrollLeft).toBe(0);
  });
});
