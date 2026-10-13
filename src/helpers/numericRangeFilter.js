/** Normalize usable numeric values without turning missing/blank values into zero. */
export function normalizeNumericFilterValue(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value !== "string" || value.trim() === "") {
    return undefined;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

/** Read the existing min,max key with an optional NA-exclusion policy. */
export function parseNumericRangeFilter(value) {
  if (typeof value !== "string") return null;
  const parts = value.split(",");
  if (parts.length !== 2 && parts.length !== 3) return null;
  if (parts.length === 3 && parts[2] !== "exclude-na") return null;

  const min = normalizeNumericFilterValue(parts[0]);
  const max = normalizeNumericFilterValue(parts[1]);
  if (min === undefined || max === undefined || min > max) return null;

  return { range: [min, max], excludeNA: parts[2] === "exclude-na" };
}

/** Keep range and NA policy in one key: Ant Design ORs separate selected keys. */
export function getNumericRangeFilterKeys(range, excludeNA, min, max) {
  if (!excludeNA && range[0] === min && range[1] === max) return [];
  return [`${range[0]},${range[1]}${excludeNA ? ",exclude-na" : ""}`];
}
