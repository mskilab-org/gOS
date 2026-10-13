/** @jest-environment node */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Table } from "antd";
import {
  getTableReviewRecords, getEventNavigation, getEventNavigationKey,
  getEventNavigationLabel,
} from "./eventNavigation";

const records = Object.freeze([
  { uid: "fusion", gene: "B", vaf: null, tier: 1 },
  { uid: "low", gene: "A", vaf: 0.01, tier: 1 },
  { uid: "high", gene: "D", vaf: 0.4, tier: 1 },
  { uid: "cna", gene: "C", vaf: undefined, tier: 1 },
  { uid: "other", gene: "E", vaf: 0.6, tier: 3 },
].map(Object.freeze));
const columns = [
  { key: "vaf", filteredValue: [0.1], onFilter: (min, row) => row.vaf == null || row.vaf >= min },
  { key: "tier", filters: [{ text: "1", value: 1 }], filteredValue: [1], onFilter: (tier, row) => row.tier === tier },
  { key: "gene", sorter: { compare: (a, b) => a.gene.localeCompare(b.gene) }, sortOrder: "descend" },
];

describe("variant review navigation", () => {
  test("matches real AntD filtered/sorted order without mutating inputs", () => {
    const ordered = getTableReviewRecords(records, columns);
    expect(ordered.map(r => r.uid)).toEqual(["high", "cna", "fusion"]);
    const view = renderToStaticMarkup(<Table columns={columns} dataSource={records} rowKey="uid" pagination={false} />);
    expect([...view.matchAll(/data-row-key="([^"]+)"/g)].map(m => m[1])).toEqual(ordered.map(r => r.uid));
    expect(records.map(r => r.uid)).toEqual(["fusion", "low", "high", "cna", "other"]);
  });

  test("preserves initial order, stable ties, empty filters and OR within a column", () => {
    expect(getTableReviewRecords(records, []).map(r => r.uid)).toEqual(records.map(r => r.uid));
    expect(getTableReviewRecords(records, [{ sorter: () => 0, sortOrder: "ascend", filteredValue: [] }])).toEqual(records);
    expect(getTableReviewRecords(records, [{ filters: [{ value: 1 }, { value: 3 }], filteredValue: ["1", "3"], onFilter: (v, r) => r.tier === v }])).toEqual(records);
    expect(getTableReviewRecords([], columns)).toEqual([]);
  });

  test("supports function comparators, third order argument and multiple priorities", () => {
    const compare = jest.fn((a, b, order) => a.tier - b.tier);
    const multiple = [
      { sorter: { compare: (a, b) => a.gene.localeCompare(b.gene), multiple: 1 }, sortOrder: "descend" },
      { sorter: { compare, multiple: 2 }, sortOrder: "ascend" },
    ];
    expect(getTableReviewRecords(records, multiple).map(r => r.uid)).toEqual(["high", "cna", "fusion", "low", "other"]);
    expect(compare).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), "ascend");
    expect(getTableReviewRecords(records, [{ sorter: true, sortOrder: "ascend" }])).toEqual(records);
    const defaultSorted = { sorter: (a, b) => a.gene.localeCompare(b.gene), defaultSortOrder: "descend" };
    expect(getTableReviewRecords(records, [defaultSorted]).map(r => r.uid)).toEqual(["other", "high", "cna", "fusion", "low"]);
    expect(getTableReviewRecords(records, [{ ...defaultSorted, sortOrder: null }])).toEqual(records);
  });

  test("finds neighbors across the whole result, does not wrap or include excluded records", () => {
    const ordered = getTableReviewRecords(records, columns);
    expect(getEventNavigation(ordered, { ...records[3] })).toEqual({ index: 1, total: 3, previous: records[2], next: records[0] });
    expect(getEventNavigation(ordered, ordered[0]).previous).toBeNull();
    expect(getEventNavigation(ordered, ordered[2]).next).toBeNull();
    expect(getEventNavigation(ordered, records[1])).toEqual({ index: -1, total: 3, previous: null, next: null });
    expect(getEventNavigation([], null)).toEqual({ index: -1, total: 0, previous: null, next: null });
    expect(getEventNavigation([records[0]], records[0])).toEqual({ index: 0, total: 1, previous: null, next: null });
  });

  test("distinguishes same-gene variants and does not match unrelated anonymous records", () => {
    const a = { uid: "same-coordinate", gene: "TP53", variant: "p.R248Q" };
    const b = { ...a, variant: "p.R248W" };
    expect(getEventNavigation([a, b], { ...b }).index).toBe(1);
    expect(getEventNavigationKey(null)).toBeNull();
    expect(getEventNavigationKey({})).toBeNull();
    expect(getEventNavigation([{}], {}).index).toBe(-1);
    const anonymous = {};
    expect(getEventNavigation([anonymous], anonymous).index).toBe(0);
  });

  test.each([
    [{ gene: "FLT3", variant: "p.D835Y" }, "FLT3 — p.D835Y"],
    [{ gene: "PML::RARA", name: "Fusion" }, "PML::RARA — Fusion"],
    [{ gene: "MYC", variant: "  ", location: "8:1-100" }, "MYC — 8:1-100"],
    [{ gene: "MYC", type: "CNA" }, "MYC — CNA"],
    [{ gene: "TP53", Variant: "p.R248Q" }, "TP53 — p.R248Q"],
    [{ uid: "event-1" }, "event-1"],
    [null, ""],
  ])("names destinations with source data and useful fallbacks", (record, label) => {
    expect(getEventNavigationLabel(record)).toBe(label);
  });
});
