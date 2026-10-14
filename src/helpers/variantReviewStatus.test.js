/** @jest-environment node */
import {
  getVariantReviewStorageKey,
  readVariantReviewStatus,
  saveVariantReviewStatus,
} from "./variantReviewStatus";

const scope = { userId: "alice", datasetId: "dataset", caseId: "case" };
let storage;
beforeEach(() => {
  const items = new Map();
  storage = {
    getItem: jest.fn(key => items.get(key) ?? null),
    setItem: jest.fn((key, value) => items.set(key, value)),
  };
});

it("separates users, signed-out visitors, datasets and cases, including delimiter-like IDs", () => {
  const keys = [scope, { ...scope, userId: "bob" }, { ...scope, userId: null },
    { ...scope, datasetId: "other" }, { ...scope, caseId: "other" },
    { userId: "alice/dataset", datasetId: "case", caseId: "other" }].map(getVariantReviewStorageKey);
  expect(new Set(keys).size).toBe(keys.length);
  expect(getVariantReviewStorageKey({ ...scope, caseId: null })).toBeNull();
  expect(getVariantReviewStorageKey({ ...scope, datasetId: "" })).toBeNull();
});

it("starts absent and preserves both reviewed and manually cleared decisions on reload", () => {
  const key = getVariantReviewStorageKey(scope);
  expect(readVariantReviewStatus(key, storage)).toEqual({});
  expect(saveVariantReviewStatus(key, "variant-1", true, storage)).toBe(true);
  expect(saveVariantReviewStatus(key, "variant-2", false, storage)).toBe(true);
  expect(readVariantReviewStatus(key, storage)).toEqual({ "variant-1": true, "variant-2": false });
  expect(readVariantReviewStatus(getVariantReviewStorageKey({ ...scope, userId: "bob" }), storage)).toEqual({});
});

it("merges individual changes with other variants already saved by another tab", () => {
  const key = getVariantReviewStorageKey(scope);
  saveVariantReviewStatus(key, "other-tab", false, storage);
  saveVariantReviewStatus(key, "this-tab", true, storage);
  saveVariantReviewStatus(key, "this-tab", false, storage);
  expect(readVariantReviewStatus(key, storage)).toEqual({ "other-tab": false, "this-tab": false });
});

it.each(["invalid json", "null", "[]", '"text"', '{"bad":"true","good":false,"__proto__":true}'])
  ("validates cached decisions without prototype keys: %s", value => {
    storage.getItem.mockReturnValue(value);
    expect(readVariantReviewStatus("key", storage)).toEqual(value.includes('"good"') ? { good: false } : {});
  });

it("handles denied/full/missing storage and rejects invalid writes without throwing", () => {
  const denied = { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("full"); } };
  expect(readVariantReviewStatus("key", denied)).toEqual({});
  expect(saveVariantReviewStatus("key", "variant", true, denied)).toBe(false);
  expect(readVariantReviewStatus(null, storage)).toEqual({});
  expect(saveVariantReviewStatus(null, "variant", true, storage)).toBe(false);
  expect(saveVariantReviewStatus("key", null, true, storage)).toBe(false);
  expect(saveVariantReviewStatus("key", "__proto__", true, storage)).toBe(false);
  expect(saveVariantReviewStatus("key", "variant", "true", storage)).toBe(false);
  expect(storage.setItem).not.toHaveBeenCalled();
  expect(readVariantReviewStatus("key")).toEqual({});
});
