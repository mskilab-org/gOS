import { normalizeNumericFilterValue } from "./numericRangeFilter";

/**
 * compareNullable
 * Order values with missing entries pinned as -Infinity: they come first when
 * sorting ascending and last when sorting descending (Ant Design negates the
 * comparator for descending order).
 */
export function compareNullable(a, b, compare) {
  const aMissing = a === undefined || a === null;
  const bMissing = b === undefined || b === null;
  if (aMissing && bMissing) return 0;
  if (aMissing) return -1;
  if (bMissing) return 1;
  return compare(a, b);
}

/**
 * compareNumericNullable
 * Same policy for numeric columns, using the range filter's definition of an
 * unavailable number (blank, "NA", NaN, Infinity) so sorting and the
 * "Exclude NA values" toggle agree on which rows are missing.
 */
export function compareNumericNullable(a, b, compare) {
  return compareNullable(
    normalizeNumericFilterValue(a),
    normalizeNumericFilterValue(b),
    compare
  );
}
