// Local convenience state only: never write review decisions to interpretations.
const STORAGE_PREFIX = "gos.variantReviewStatus.v1:";
const safeKey = key => typeof key === "string" && key.length > 0 &&
  !["__proto__", "constructor", "prototype"].includes(key);

export function getVariantReviewStorageKey({ userId = null, datasetId, caseId }) {
  if (typeof datasetId !== "string" || !datasetId.trim() ||
    typeof caseId !== "string" || !caseId.trim()) return null;
  return STORAGE_PREFIX + JSON.stringify([userId, datasetId, caseId]);
}

function browserStorage(storage) {
  return storage ?? (typeof window !== "undefined" ? window.localStorage : null);
}

export function readVariantReviewStatus(key, storage) {
  if (!key) return {};
  try {
    const value = JSON.parse(browserStorage(storage)?.getItem(key) ?? "null");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value)
      .filter(([variant, reviewed]) => safeKey(variant) && typeof reviewed === "boolean"));
  } catch (_) {
    return {};
  }
}

export function saveVariantReviewStatus(key, variant, reviewed, storage) {
  if (!key || !safeKey(variant) || typeof reviewed !== "boolean") return false;
  try {
    const target = browserStorage(storage);
    if (!target) return false;
    const decisions = readVariantReviewStatus(key, target);
    target.setItem(key, JSON.stringify({ ...decisions, [variant]: reviewed }));
    return true;
  } catch (_) {
    return false;
  }
}
