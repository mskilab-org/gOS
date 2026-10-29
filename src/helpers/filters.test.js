/** @jest-environment node */
/* eslint-disable import/first */

// Use D3's CommonJS bundle so Jest exercises real extent and sorting behavior.
jest.mock("d3", () => {
  const path = require("path");
  return jest.requireActual(
    path.join(path.dirname(require.resolve("d3")), "../dist/d3.js"),
  );
});

jest.mock("./utility", () => ({
  getValueByPath: (record, path) =>
    `${path}`.split(".").reduce((value, key) => value?.[key], record),
  plotTypes: () => ({}),
  reportAttributesMap: () => ({}),
  defaultSearchFilters: () => ({ page: 1, per_page: 10, orderId: 1 }),
  orderListViewFilters: [{ id: 1, attribute: "pair", sort: "ascending" }],
}));

import { getReportsFilters } from "./filters";
import {
  filterCaseReportRecords,
  searchCaseReportRecords,
} from "./caseReportsSearch";

describe("mixed-schema slider defaults", () => {
  const datasetField = {
    id: "sourceDatasetTitle",
    name: "sourceDatasetTitle",
    type: "string",
    renderer: "select",
  };
  const diseaseField = {
    id: "disease", name: "disease", type: "string", renderer: "select",
  };
  const snvField = {
    id: "snv_count", name: "snv_count", type: "numeric", renderer: "slider",
  };
  const readsField = {
    id: "coverage_qc.total_reads",
    name: "coverage_qc.total_reads",
    type: "numeric",
    renderer: "slider",
  };
  const emptyField = {
    id: "empty_metric",
    name: "empty_metric",
    type: "numeric",
    renderer: "slider",
  };
  const fields = [datasetField, diseaseField, snvField, readsField, emptyField];
  const datasets = [
    { id: "pillar", fields: [datasetField, diseaseField, snvField, emptyField] },
    { id: "pact", fields: [datasetField, diseaseField, readsField] },
  ];
  const fieldContext = {
    datasets,
    dataset: { isAllDatasets: true, fields },
  };
  const reports = [
    {
      datasetId: "pillar", caseReportId: "pillar-1", pair: "Pillar 1",
      sourceDatasetTitle: "Pillar", disease: "AML", snv_count: 3,
    },
    {
      datasetId: "pillar", caseReportId: "pillar-2", pair: "Pillar 2",
      sourceDatasetTitle: "Pillar", disease: "Other", snv_count: 9,
    },
    ...Array.from({ length: 16 }, (_, index) => ({
      datasetId: "pact", caseReportId: `pact-${index}`, pair: `PACT ${index}`,
      sourceDatasetTitle: "PACT", disease: "AML",
      // Raw values omitted from the source schema must not affect the extent.
      snv_count: 999,
      coverage_qc: { total_reads: 100 + index },
    })),
  ];
  const filters = getReportsFilters(fields, reports, fieldContext);
  const sliderDefaults = Object.fromEntries(
    filters
      .filter(({ filter }) => filter.renderer === "slider")
      .map(({ filter, extent }) => [filter.name, extent]),
  );
  const search = (query, sourceRecords = reports) =>
    filterCaseReportRecords(sourceRecords, query, fields, fieldContext);

  it("keeps dataset matches when untouched sliders are submitted", () => {
    const datasetFilter = filters.find(
      ({ filter }) => filter.name === "sourceDatasetTitle",
    );
    expect(datasetFilter.frequencies.PACT).toBe(16);
    expect(sliderDefaults.snv_count).toEqual([3, 9]);
    expect(search({ sourceDatasetTitle: ["PACT"] })).toHaveLength(16);
    expect(search({
      sourceDatasetTitle: ["PACT"],
      snv_count: sliderDefaults.snv_count,
    })).toHaveLength(16);
    expect(search({
      ...sliderDefaults,
      sourceDatasetTitle: ["PACT"],
    })).toHaveLength(16);
  });

  it("uses the same numeric extent for mixed numbers and numeric strings", () => {
    const sourceRecords = [
      ...["10", 3, "2", "2"].map((snv_count, index) => ({
        datasetId: "pillar",
        caseReportId: `mixed-${index}`,
        pair: `Mixed ${index}`,
        sourceDatasetTitle: "Pillar",
        snv_count,
      })),
      ...reports.filter(({ datasetId }) => datasetId === "pact"),
    ];
    const snvExtent = getReportsFilters(fields, sourceRecords, fieldContext)
      .find(({ filter }) => filter.name === "snv_count").extent;
    expect(snvExtent).toEqual([2, 10]);
    expect(search({
      sourceDatasetTitle: ["PACT"], snv_count: snvExtent,
    }, sourceRecords)).toHaveLength(16);
    expect(search({ snv_count: [2, 3] }, sourceRecords)).toHaveLength(3);
  });

  it("restores every case when Reset submits all slider extents", () => {
    expect(sliderDefaults.empty_metric).toEqual([undefined, undefined]);
    expect(search(sliderDefaults)).toHaveLength(reports.length);
    expect(search({
      ...sliderDefaults,
      snv_count: sliderDefaults.snv_count.map(String),
    })).toHaveLength(reports.length);
  });

  it("replays saved full-range filters and paginates the matched cases", () => {
    const savedFilters = JSON.parse(JSON.stringify({
      ...sliderDefaults,
      sourceDatasetTitle: ["PACT"],
      page: 2,
      per_page: 5,
    }));
    expect(savedFilters.empty_metric).toEqual([null, null]);
    const { matchedRecords, pageRecords } = searchCaseReportRecords(
      reports, savedFilters, fields, fieldContext,
    );
    expect(matchedRecords).toHaveLength(16);
    expect(pageRecords).toEqual(matchedRecords.slice(5, 10));
  });

  it("keeps narrowed ranges active and excludes source-omitted values", () => {
    const sourceRecords = reports.map((record) => ({ ...record, snv_count: 3 }));
    sourceRecords[1].snv_count = 9;
    expect(search({ snv_count: [3, 5] }, sourceRecords).map(
      ({ caseReportId }) => caseReportId,
    )).toEqual(["pillar-1"]);
    expect(search({
      sourceDatasetTitle: ["PACT"], snv_count: [3, 5],
    }, sourceRecords)).toEqual([]);
    expect(search({ "coverage_qc.total_reads": [100, 105] })).toHaveLength(6);
  });

  it("uses the full source extent, not the results of earlier filters", () => {
    const query = { disease: ["AML"], snv_count: [3, 3] };
    expect(search(query).map(({ caseReportId }) => caseReportId)).toEqual([
      "pillar-1",
    ]);
    expect(search({ snv_count: [3, 3], disease: ["AML"] })).toEqual(search(query));
  });

  it("treats a single-value full extent as inactive", () => {
    const sourceRecords = reports.map((record) => (
      record.datasetId === "pillar" ? { ...record, snv_count: 3 } : record
    ));
    expect(search({
      sourceDatasetTitle: ["PACT"], snv_count: [3, 3],
    }, sourceRecords)).toHaveLength(16);
  });

  it("includes hidden rows in extents but never returns hidden cases", () => {
    const sourceRecords = reports.map((record) => (
      record.caseReportId === "pillar-2" ? { ...record, visible: false } : record
    ));
    expect(search({ snv_count: [3, 3] }, sourceRecords).map(
      ({ caseReportId }) => caseReportId,
    )).toEqual(["pillar-1"]);
    expect(search({ snv_count: [3, 9] }, sourceRecords)).toHaveLength(17);
  });
});

describe("schema-aware report filters", () => {
  it("retains the global field union without exposing omitted source values", () => {
    const fields = [
      { id: "disease", name: "disease", type: "string", renderer: "select" },
      { id: "tmb", name: "tmb", type: "numeric", renderer: "slider" },
    ];
    const datasets = [
      { id: "a", fields: [] },
      { id: "b", fields },
    ];
    const reports = [
      { datasetId: "a", disease: "SCHEMA SECRET", tmb: 999 },
      { datasetId: "b", disease: "Visible", tmb: 4 },
    ];

    const filters = getReportsFilters(fields, reports, {
      datasets,
      dataset: { isAllDatasets: true, fields },
    });

    expect(filters.map(({ filter }) => filter.name)).toEqual([
      "disease",
      "tmb",
    ]);
    expect(filters.find(({ filter }) => filter.name === "disease").records).toEqual([
      "Visible",
    ]);
    expect(filters.find(({ filter }) => filter.name === "tmb").records).toEqual([
      4,
    ]);
  });
});
