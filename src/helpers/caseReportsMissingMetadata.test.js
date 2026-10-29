/** @jest-environment node */
/* eslint-disable import/first */

jest.mock("d3", () => {
  const path = require("path");
  return jest.requireActual(
    path.join(path.dirname(require.resolve("d3")), "../dist/d3.js"),
  );
});

jest.mock("./utility", () => ({
  defaultSearchFilters: () => ({ page: 1, per_page: 10, orderId: 1 }),
  getValueByPath: (record, path) =>
    `${path}`.split(".").reduce((value, key) => value?.[key], record),
  orderListViewFilters: [{ id: 1, attribute: "pair", sort: "ascending" }],
}));

import { filterCaseReportRecords } from "./caseReportsSearch";
import { getNumericFilterExtent } from "./numericFilterExtent";

const metadataField = (name, renderer) => ({ id: name, name, renderer });
const record = (id, metadata = {}, datasetId = "enabled") => ({
  datasetId, caseReportId: id, pair: id, ...metadata,
});
const contextFor = (fields) => ({
  dataset: { isAllDatasets: true, fields },
  datasets: [{ id: "enabled", fields }, { id: "omitted", fields: [] }],
});
const matches = (records, filters, fields) =>
  filterCaseReportRecords(records, filters, fields, contextFor(fields))
    .map(({ caseReportId }) => caseReportId);

const renderers = [
  { renderer: "select", selection: ["AML"], matching: "AML", other: "Other" },
  { renderer: "slider", selection: [2, 5], matching: 3, other: 9 },
  {
    renderer: "date-range",
    selection: { from: "2024-02-01", to: "2024-02-29" },
    matching: "2024-02-10",
    other: "2024-01-10",
  },
  {
    renderer: "cascader",
    selection: [["Response", "Response: Complete"]],
    matching: ["Response: Complete"],
    other: ["Response: Partial"],
  },
];

describe.each(renderers)("absent $renderer cohort metadata", ({
  renderer, selection, matching, other,
}) => {
  const fields = [metadataField("metric", renderer)];
  const query = { metric: selection };

  test.each([undefined, null, "", "  ", "NA", "N/A", " n/a ", "na", NaN, []])(
    "does not bypass an assigned unavailable value (%p)",
    (value) => {
      expect(matches([
        record("match", { metric: matching }),
        record("non-match", { metric: other }),
        record("assigned-unavailable", { metric: value }),
        record("absent"),
        record("schema-omitted", {}, "omitted"),
        record("schema-omitted-present", { metric: value }, "omitted"),
        record("schema-omitted-raw", { metric: other }, "omitted"),
      ], query, fields)).toEqual(["absent", "match", "schema-omitted"]);
    },
  );

  it("passes absent properties and still applies the other filters", () => {
    const allFields = [...fields, metadataField("disease", "select")];
    expect(matches([
      record("keep", { disease: "AML" }),
      record("reject", { disease: "Other" }),
      record("hidden", { disease: "AML", visible: false }),
    ], { ...query, disease: ["AML"] }, allFields)).toEqual(["keep"]);
  });
});

describe("cohort metadata filter boundaries", () => {
  it("retains missing metadata in a single dataset and without schema context", () => {
    const fields = [metadataField("disease", "select")];
    const dataset = { id: "enabled", fields };
    const sourceRecords = [
      record("match", { disease: "AML" }),
      record("missing"),
      record("other", { disease: "Other" }),
    ];
    const query = JSON.parse(JSON.stringify({ disease: ["AML"] }));
    const expected = sourceRecords.slice(0, 2);
    expect(filterCaseReportRecords(sourceRecords, query, fields, {
      dataset, datasets: [dataset],
    })).toEqual(expected);
    expect(filterCaseReportRecords(sourceRecords, query, fields)).toEqual(expected);
  });

  it("rejects an assigned unusable date and an invalid filter range", () => {
    const fields = [metadataField("date", "date-range")];
    const sourceRecords = [
      record("bad-date", { date: "2024-02-30" }),
      record("missing"),
      record("outside", { date: "2024-01-01" }),
    ];
    expect(matches(sourceRecords, {
      date: { from: "2024-02-01", to: "2024-02-29" },
    }, fields)).toEqual(["missing"]);
    expect(matches(sourceRecords, {
      date: { from: "2024-02-29", to: "2024-02-01" },
    }, fields)).toEqual([]);
  });

  it("does not treat zero or false as missing categorical values", () => {
    const fields = [metadataField("metric", "select")];
    expect(matches([
      record("match", { metric: 1 }),
      record("zero", { metric: 0 }),
      record("false", { metric: false }),
      record("missing"),
    ], { metric: [1] }, fields)).toEqual(["match", "missing"]);
  });

  it("applies numeric ranges to zero and numeric strings, but rejects unusable numbers", () => {
    const fields = [metadataField("metric", "slider")];
    expect(matches([
      record("match", { metric: "3" }),
      record("zero", { metric: 0 }),
      record("out-of-range", { metric: 8 }),
      record("invalid", { metric: "invalid" }),
      record("infinite", { metric: Infinity }),
    ], { metric: [2, 5] }, fields)).toEqual(["match"]);
    expect(getNumericFilterExtent([0, "3", 8, "", " ", null, "NA", Infinity]))
      .toEqual([0, 8]);
    expect(getNumericFilterExtent(["3", "", " ", null, "NA"]))
      .toEqual([3, 3]);
  });

  it("keeps zero distinct from assigned blank or N/A numeric values", () => {
    const fields = [metadataField("metric", "slider")];
    expect(matches([
      record("zero", { metric: 0 }),
      record("outside", { metric: 9 }),
      record("blank", { metric: "" }),
      record("false", { metric: false }),
      record("null", { metric: null }),
      record("na", { metric: "N/A" }),
      record("absent"),
    ], { metric: [0, 5] }, fields)).toEqual(["absent", "zero"]);
  });

  it("preserves inactive full-range sliders but filters N/A with a saved narrowed range", () => {
    const fields = [metadataField("metric", "slider")];
    const sourceRecords = [
      record("absent"),
      record("match", { metric: 3 }),
      record("na", { metric: "N/A" }),
      record("null", { metric: null }),
      record("other", { metric: 9 }),
    ];
    expect(matches(sourceRecords, { metric: [3, 9] }, fields)).toHaveLength(5);
    const savedQuery = JSON.parse(JSON.stringify({ metric: [3, 5] }));
    expect(matches(sourceRecords, savedQuery, fields)).toEqual(["absent", "match"]);
  });

  it("ignores absent nested numeric metadata", () => {
    const fields = [metadataField("qc.depth", "slider")];
    expect(matches([
      record("match", { qc: { depth: 3 } }),
      record("non-match", { qc: { depth: 9 } }),
      record("missing-parent"),
      record("missing-leaf", { qc: {} }),
      record("null-leaf", { qc: { depth: null } }),
      record("na-leaf", { qc: { depth: "N/A" } }),
      record("undefined-leaf", { qc: { depth: undefined } }),
      record("null-parent", { qc: null }),
      record("na-parent", { qc: "N/A" }),
      record("empty-parent", { qc: [] }),
      record("literal-na-key", { "qc.depth": "N/A" }),
      record("literal-null-key", { "qc.depth": null }),
    ], { "qc.depth": [2, 5] }, fields)).toEqual([
      "match", "missing-leaf", "missing-parent",
    ]);
  });

  it("does not ignore known array values just because an array also contains N/A", () => {
    const fields = [metadataField("metric", "select")];
    expect(matches([
      record("match", { metric: ["N/A", "AML"] }),
      record("non-match", { metric: [null, "Other"] }),
      record("assigned-unavailable", { metric: [null, "N/A", ""] }),
      record("missing"),
    ], { metric: ["AML"] }, fields)).toEqual(["match", "missing"]);
  });

  test.each(["OR", "AND", "NOT"])(
    "ignores missing cascader metadata for the %s operator",
    (operator) => {
      const fields = [metadataField("treatment", "cascader")];
      const result = matches([
        record("missing"),
        record("empty", { treatment: [] }),
        record("na", { treatment: "N/A" }),
        record("match", { treatment: ["Drug: A"] }),
        record("other", { treatment: ["Drug: B"] }),
      ], { treatment: [["Drug", "Drug: A"]], operator }, fields);
      expect(result).toEqual(operator === "NOT"
        ? ["empty", "missing", "na", "other"]
        : ["match", "missing"]);
    },
  );

  it("matches explicit null and N/A selections without treating N/A as absent", () => {
    const fields = [metadataField("disease", "select")];
    const sourceRecords = [
      record("known", { disease: "AML" }),
      record("null", { disease: null }),
      record("na", { disease: "N/A" }),
      record("absent"),
    ];
    expect(matches(sourceRecords, { disease: ["null"] }, fields))
      .toEqual(["absent", "null"]);
    expect(matches(sourceRecords, { disease: ["N/A"] }, fields))
      .toEqual(["absent", "na"]);
  });

  test.each(["sourceDatasetTitle", "datasetId", "pair", "patient_id", "caseReportId", "id"])(
    "keeps explicit identity selection strict for %s",
    (name) => {
      const fields = [metadataField(name, "select")];
      const sourceRecords = [
        { ...record("known"), [name]: "selected" },
        { ...record("missing"), [name]: null },
        { ...record("other"), [name]: "other" },
      ];
      // Without schema context, the identity filter must still reject missing IDs.
      expect(filterCaseReportRecords(sourceRecords, { [name]: ["selected"] }, fields))
        .toEqual([sourceRecords[0]]);
    },
  );

  it("does not bypass tag, text, or interpretation filters for missing metadata", () => {
    const fields = [
      metadataField("disease", "select"), metadataField("tags", "cascader"),
    ];
    const sourceRecords = [record("missing", { tags: [] })];
    expect(matches(sourceRecords, { tags: [["Gene", "Gene: TP53"]] }, fields))
      .toEqual([]);
    expect(matches(sourceRecords, { texts: "AML" }, fields)).toEqual([]);
    expect(matches(sourceRecords, { has_interpretations: [["tier_change"]] }, fields))
      .toEqual([]);
  });
});
