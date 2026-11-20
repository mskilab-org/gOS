/** @jest-environment node */

import { compareNullable, compareNumericNullable } from "./nullableOrder";

const ascending = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

describe("nullable ordering", () => {
  test.each([undefined, null])(
    "ranks missing value %p below every present value",
    (missing) => {
      expect(compareNullable(missing, 5, ascending)).toBe(-1);
      expect(compareNullable(5, missing, ascending)).toBe(1);
      expect(compareNullable(missing, missing, ascending)).toBe(0);
      expect(compareNullable(missing, "B", ascending)).toBe(-1);
    }
  );

  test.each([undefined, null, "", "  ", "NA", "N/A", "na", "-", "invalid", NaN, Infinity, -Infinity, true, false, [], {}])(
    "ranks number %p as missing, matching the range filter's NA policy",
    (value) => {
      expect(compareNumericNullable(value, 0.05, ascending)).toBe(-1);
      expect(compareNumericNullable(0.05, value, ascending)).toBe(1);
      expect(compareNumericNullable(value, 0, ascending)).toBe(-1);
    }
  );

  test.each([
    [0, "0"],
    [-1, -2],
    [0.05, 0.4992],
    ["0.4992", "0.9"],
    [0.2, 0.2],
  ])("keeps present numbers %p and %p in numeric order", (a, b) => {
    const expected = Number(a) < Number(b) ? -1 : Number(a) > Number(b) ? 1 : 0;
    expect(compareNumericNullable(a, b, ascending)).toBe(expected);
    // Reversing equal values must still compare as 0, not -0.
    expect(compareNumericNullable(b, a, ascending)).toBe(expected === 0 ? 0 : -expected);
  });

  test("leaves the supplied comparator alone when both values are present", () => {
    const compare = jest.fn(() => 7);
    expect(compareNullable("A", "B", compare)).toBe(7);
    expect(compare).toHaveBeenLastCalledWith("A", "B");
    expect(compareNumericNullable("0.3", 0.3, compare)).toBe(7);
    expect(compare).toHaveBeenLastCalledWith(0.3, 0.3);
    expect(compareNullable("A", null, compare)).toBe(1);
    expect(compareNumericNullable("NA", 0.3, compare)).toBe(-1);
    expect(compare).toHaveBeenCalledTimes(2);
  });
});
