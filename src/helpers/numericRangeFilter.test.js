/** @jest-environment node */

import {
  normalizeNumericFilterValue,
  parseNumericRangeFilter,
  getNumericRangeFilterKeys,
} from "./numericRangeFilter";

describe("numeric range filter values", () => {
  test.each([0, "0", " 0 ", 0.15, "0.15", -2, "1e-3"])(
    "retains finite numeric value %p",
    (value) => expect(normalizeNumericFilterValue(value)).toBe(Number(value))
  );

  test.each([undefined, null, "", "  ", "NA", "N/A", "na", "-", "invalid", NaN, Infinity, -Infinity, "Infinity", true, false, [], {}])(
    "does not coerce unavailable value %p to zero",
    (value) => expect(normalizeNumericFilterValue(value)).toBeUndefined()
  );

  test("reads legacy and exclusion keys without conflating their policy", () => {
    expect(parseNumericRangeFilter("0.1,0.5")).toEqual({ range: [0.1, 0.5], excludeNA: false });
    expect(parseNumericRangeFilter("0.1,0.5,exclude-na")).toEqual({ range: [0.1, 0.5], excludeNA: true });
    expect(parseNumericRangeFilter("0,0")).toEqual({ range: [0, 0], excludeNA: false });
  });

  test.each([undefined, null, 1, [], "", "0", ",1", "0,", "NA,1", "0,Infinity", "1,0", "0,1,unknown", "0,1,exclude-na,extra"])(
    "rejects malformed key %p",
    (value) => expect(parseNumericRangeFilter(value)).toBeNull()
  );

  test("clears only full-range inclusion, never full-range exclusion", () => {
    expect(getNumericRangeFilterKeys([0, 1], false, 0, 1)).toEqual([]);
    expect(getNumericRangeFilterKeys([0, 1], true, 0, 1)).toEqual(["0,1,exclude-na"]);
    expect(getNumericRangeFilterKeys([0.1, 0.5], false, 0, 1)).toEqual(["0.1,0.5"]);
    expect(getNumericRangeFilterKeys([0.1, 0.5], true, 0, 1)).toEqual(["0.1,0.5,exclude-na"]);
    expect(getNumericRangeFilterKeys([0, 0], true, 0, 0)).toEqual(["0,0,exclude-na"]);
  });
});
