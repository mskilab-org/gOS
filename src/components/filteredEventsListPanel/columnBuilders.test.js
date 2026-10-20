/** @jest-environment node */
/* eslint-disable import/first */

jest.mock("d3", () => ({
  ascending: (a, b) => (a < b ? -1 : a > b ? 1 : 0),
}));

const mockGetColumnRenderer = jest.fn(() => "span");

jest.mock("./columnRegistry", () => ({
  getColumnRenderer: (...args) => mockGetColumnRenderer(...args),
}));

jest.mock("./SliderFilterDropdown", () => "SliderFilterDropdown");

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Table } from "antd";
import { buildColumnConfig, buildColumnsFromSettings } from "./columnBuilders";
import { getTableReviewRecords } from "./eventNavigation";

describe("buildColumnConfig", () => {
  beforeEach(() => {
    mockGetColumnRenderer.mockReturnValue("span");
  });
  const getWidthForTitle = (title, width = 1) =>
    buildColumnConfig(
      { id: "value", title, dataIndex: "value", width },
      []
    ).width;

  test("estimates narrow, ordinary, wide Latin, CJK, and emoji glyphs conservatively", () => {
    expect(getWidthForTitle("iiii")).toBe(68);
    expect(getWidthForTitle("eeee")).toBe(80);
    expect(getWidthForTitle("WW@%")).toBe(96);
    expect(getWidthForTitle("漢字漢字")).toBe(108);
    expect(getWidthForTitle("🧬🧪😀🚀")).toBe(108);
  });

  test("fits long plain-text and recursively extracted simple JSX titles", () => {
    const plainTitleWidth = getWidthForTitle("AlphaMissense", 80);
    const jsxTitleWidth = getWidthForTitle(
      <span>
        Alpha<strong>Missense</strong>
      </span>,
      80
    );

    expect(plainTitleWidth).toBe(163);
    expect(jsxTitleWidth).toBe(plainTitleWidth);
  });

  test("uses a conservative baseline for unmeasurable titles", () => {
    expect(
      getWidthForTitle(
        <span>
          <input aria-label="Header supplied by a component" />
        </span>
      )
    ).toBe(120);
  });

  test("normalizes pixel widths and preserves larger configured widths", () => {
    expect(getWidthForTitle("Header", "80px")).toBe(99);
    expect(getWidthForTitle("Header", "240px")).toBe(240);
    expect(getWidthForTitle("AlphaMissense", 240)).toBe(240);
  });

  test("falls back from invalid widths to a numeric baseline before fitting", () => {
    [
      0,
      -1,
      NaN,
      Infinity,
      null,
      "0px",
      "-1px",
      "80",
      "80%",
      "auto",
    ].forEach((width) => {
      expect(getWidthForTitle("Longer header", width)).toBe(156);
    });
  });

  test("keeps the existing 120 default when width is omitted", () => {
    const column = buildColumnConfig(
      { id: "tiny", title: "Tiny", dataIndex: "tiny" },
      []
    );

    expect(column.width).toBe(120);
  });

  test("fits the translated title instead of its translation key", () => {
    const t = jest.fn(() => "Translated AlphaMissense Label");
    const column = buildColumnConfig(
      {
        id: "alphaMissense",
        title: "components.filtered-events-panel.alphaMissense",
        dataIndex: "alphaMissense",
        width: 80,
      },
      [],
      { t }
    );

    expect(t).toHaveBeenCalledWith(
      "components.filtered-events-panel.alphaMissense"
    );
    expect(column.title).toBe("Translated AlphaMissense Label");
    expect(column.width).toBe(306);
  });

  test("labels the existing location column Location (IGV) without changing its data or renderer", () => {
    const settings = require("../../../public/settings.json");
    const translations = require("../../translations/en/common.json");
    const definition = settings.filteredEventsColumns.find((column) => column.id === "location");
    const record = Object.freeze({ location: "17:7577568 C>A" });
    const column = buildColumnConfig(definition, [record], {
      t: (key) => key.split(".").reduce((value, part) => value[part], translations),
    });

    expect(column.title).toBe("Location (IGV)");
    expect(column.key).toBe("location");
    expect(column.render(null, record).props.value).toBe(record.location);
    expect(mockGetColumnRenderer).toHaveBeenLastCalledWith("location-link", "location");
  });

  test("selects a renderer by view type and semantic column ID", () => {
    buildColumnConfig(
      {
        id: "gnomad_af",
        title: "gnomAD AF",
        dataIndex: "gnomad_af",
        viewType: "formatted-number",
      },
      [],
    );

    expect(mockGetColumnRenderer).toHaveBeenLastCalledWith(
      "formatted-number",
      "gnomad_af",
    );
  });

  test("reserves space for automatic filters as well as optional sorter controls", () => {
    const definition = {
      id: "status", title: "Header", dataIndex: "status", width: 1,
    };
    const records = [{ status: "A" }];
    const emptyColumn = buildColumnConfig(definition, []);
    const filteredColumn = buildColumnConfig(definition, records);
    const filteredAndSortedColumn = buildColumnConfig(
      { ...definition, sortable: true }, records,
    );

    expect(emptyColumn.width).toBe(99);
    expect(filteredColumn.width).toBe(115);
    expect(filteredAndSortedColumn.width).toBe(131);
    expect(filteredAndSortedColumn.filters).toEqual([
      { text: "A", value: "A" },
    ]);
    expect(filteredAndSortedColumn.onFilter("A", { status: "A" })).toBe(true);
    expect(filteredAndSortedColumn.sorter.compare(
      { status: "A" },
      { status: "B" }
    )).toBe(-1);
    expect(
      filteredAndSortedColumn.render(undefined, { status: "A" }).props.value
    ).toBe("A");
  });
  test.each([undefined, false, true])(
    "enables searchable, inactive filters regardless of legacy filterable=%s",
    (filterable) => {
      const column = buildColumnConfig(
        { id: "location", dataIndex: "location", filterable },
        [{ location: "1:100 A>G" }, { location: "2:200 C>T" }],
      );
      expect(column.filters).toEqual([
        { text: "1:100 A>G", value: "1:100 A>G" },
        { text: "2:200 C>T", value: "2:200 C>T" },
      ]);
      expect(column.filterSearch).toBe(true);
      expect(column.filteredValue).toBeNull();
      expect(column.onFilter("1:100 A>G", { location: "1:100 A>G" })).toBe(true);
      expect(column.onFilter("1:100 A>G", { location: "2:200 C>T" })).toBe(false);
    },
  );

  test("enables every built-in data column without changing its configured filter kind", () => {
    const { filteredEventsColumns } = require("../../../public/settings.json");
    const records = [{ location: "1:100 A>G", gene: "GENE", tier: 3, vaf: 0.4 }];
    const columns = buildColumnsFromSettings(filteredEventsColumns, [], records);
    expect(columns).toHaveLength(filteredEventsColumns.length);
    columns.forEach((column, index) => {
      expect(typeof column.onFilter).toBe("function");
      expect(column.filteredValue).toBeNull();
      if (filteredEventsColumns[index].filterType === "range") {
        expect(typeof column.filterDropdown).toBe("function");
      } else {
        expect(Array.isArray(column.filters)).toBe(true);
        expect(column.filterSearch).toBe(true);
      }
    });
    expect(columns.find((column) => column.key === "tier").filters).toEqual([
      { text: 3, value: 3 },
    ]);
  });

  test("supports dataset overrides and additions, nested fields, ranges and annotation classes", () => {
    const records = [
      { gene: "A", annotations: { pillar: "unsettled", score: 0.2 }, impact: { class: "benign" } },
      { gene: "B", annotations: { pillar: "other", score: 0.9 }, impact: { class: "pathogenic" } },
    ];
    const columns = buildColumnsFromSettings(
      [{ id: "gene", dataIndex: "gene", filterable: false }],
      [
        { id: "gene", title: "Gene", filterable: false },
        { id: "pillar", dataIndex: "annotations.pillar" },
        { id: "score", dataIndex: ["annotations", "score"], type: "numeric", filterType: "range" },
        { id: "impact", dataIndex: "impact", viewType: "class-icon" },
      ],
      records, {}, { pillar: ["unsettled"], score: ["0.1,0.5"] },
    );
    expect(columns.map((column) => column.key)).toEqual(["gene", "pillar", "score", "impact"]);
    expect(columns[0].title).toBe("Gene");
    expect(columns[0].onFilter("A", records[0])).toBe(true);
    expect(columns[1].filteredValue).toEqual(["unsettled"]);
    expect(columns[1].onFilter("unsettled", records[1])).toBe(false);
    expect(columns[2].filterDropdown({}).props).toMatchObject({ min: 0.2, max: 0.9 });
    expect(columns[2].onFilter("0.1,0.5", records[0])).toBe(true);
    expect(columns[3].filters).toEqual([
      { text: "benign", value: "benign" },
      { text: "pathogenic", value: "pathogenic" },
    ]);
    expect(columns[3].onFilter("pathogenic", records[1])).toBe(true);
    expect(getTableReviewRecords(records, columns)).toEqual([records[0]]);
  });

  test.each([
    { id: "annotation", viewType: "clinvar-icon" },
    { id: "clinvar", viewType: "formatted-number" },
  ])("filters ClinVar badges by source class for %p", (definition) => {
    const record = { annotation: { class: "pathogenic", score: 1 } };
    const column = buildColumnConfig({ ...definition, dataIndex: "annotation" }, [record]);
    expect(column.filters).toEqual([{ text: "pathogenic", value: "pathogenic" }]);
    expect(column.onFilter("pathogenic", record)).toBe(true);
    expect(column.onFilter("benign", record)).toBe(false);
  });

  test("real AntD leaves source classifications unrestricted until the user filters and restores all rows on reset", () => {
    class ValueRenderer extends React.Component {
      render() {
        return <span>{String(this.props.value ?? "NA")}</span>;
      }
    }
    mockGetColumnRenderer.mockReturnValue(ValueRenderer);
    const records = Object.freeze([
      { uid: "germline", origin: "germline", pillar: "unsettled", location: "1:100" },
      { uid: "somatic", origin: "non-germline", pillar: "unsettled", location: "1:200" },
      { uid: "uncertain", origin: "uncertain", pillar: "other", location: "1:300" },
      { uid: "missing", origin: null, pillar: null, location: "1:400" },
    ].map(Object.freeze));
    const definitions = ["origin", "pillar", "location"].map((id) => ({ id, dataIndex: id }));
    const renderedKeys = (filters = {}) => {
      const columns = buildColumnsFromSettings(definitions, [], records, {}, filters);
      const markup = renderToStaticMarkup(
        <Table rowKey="uid" pagination={false} dataSource={records} columns={columns} />,
      );
      const keys = [...markup.matchAll(/data-row-key="([^"]+)"/g)].map((match) => match[1]);
      expect(getTableReviewRecords(records, columns).map((record) => record.uid)).toEqual(keys);
      return keys;
    };
    expect(renderedKeys()).toEqual(["germline", "somatic", "uncertain", "missing"]);
    expect(renderedKeys({ origin: ["germline", "non-germline"] })).toEqual(["germline", "somatic"]);
    expect(renderedKeys({ pillar: ["unsettled"], location: ["1:200"] })).toEqual(["somatic"]);
    expect(renderedKeys({ origin: ["uncertain"] })).toEqual(["uncertain"]);
    expect(renderedKeys()).toEqual(["germline", "somatic", "uncertain", "missing"]);
    expect(records[0]).toMatchObject({ origin: "germline", pillar: "unsettled" });
  });

  test("normalizes and deduplicates finite numeric filter values", () => {
    const column = buildColumnConfig(
      {
        id: "tier",
        title: "Tier",
        dataIndex: "tier",
        type: "numeric",
        filterable: true,
      },
      [
        { tier: 10 },
        { tier: "2" },
        { tier: 2 },
        { tier: 1 },
        { tier: 0 },
        { tier: "0" },
        { tier: null },
        { tier: "" },
        { tier: "  " },
        { tier: true },
        { tier: false },
        { tier: NaN },
        { tier: Infinity },
        { tier: -Infinity },
        { tier: "invalid" },
      ]
    );

    expect(column.filters).toEqual([
      { text: 0, value: 0 },
      { text: 1, value: 1 },
      { text: 2, value: 2 },
      { text: 10, value: 10 },
    ]);
    expect(column.onFilter(2, { tier: "2" })).toBe(true);
    expect(column.onFilter("2", { tier: 2 })).toBe(true);
    expect(column.onFilter(0, { tier: null })).toBe(false);
    expect(column.onFilter(0, { tier: "" })).toBe(false);
    expect(column.onFilter(0, { tier: "0" })).toBe(true);
  });

  test("leaves Tier filtering inactive, including for missing or additional tiers", () => {
    const records = [{ tier: 1 }, { tier: 2 }, { tier: 3 }, { tier: 4 }, { tier: null }];
    const column = buildColumnConfig(
      { id: "tier", title: "Tier", dataIndex: "tier", type: "numeric", filterable: true },
      records,
    );
    expect(column.filteredValue).toBeNull();
    expect(column.filters.map((filter) => filter.value)).toEqual([1, 2, 3, 4]);
  });

  test("labels VAF as percentage while retaining raw data for numeric sorting and filters", () => {
    const settings = require("../../../public/settings.json");
    const translations = require("../../translations/en/common.json");
    const definition = settings.filteredEventsColumns.find((column) => column.id === "vaf");
    const records = Object.freeze([Object.freeze({ vaf: 0.371 }), Object.freeze({ vaf: 0.9 })]);
    const column = buildColumnConfig(definition, records, {
      t: (key) => key.split(".").reduce((value, part) => value[part], translations),
    });
    expect(column.title).toBe("Variant Allele Frequency (%)");
    expect(column.render(null, records[0]).props.value).toBe(0.371);
    expect(column.sorter.compare(records[0], records[1])).toBe(-1);
    expect(column.onFilter("0.3,0.4", records[0])).toBe(true);
    expect(column.onFilter("0.3,0.4", records[1])).toBe(false);
    expect(column.filteredValue).toBeNull();
  });

  describe("numeric range NA policy", () => {
    const rangeColumn = (records, filteredValue = ["0.1,0.5"], dataIndex = "vaf") =>
      buildColumnConfig({
        id: "vaf", title: "VAF", dataIndex,
        type: "numeric", filterType: "range", filterable: true, sortable: true,
      }, records, {}, filteredValue);

    test.each([undefined, null, "", "  ", "NA", "N/A", "na", "-", "invalid", NaN, Infinity, -Infinity, true, false, [], {}])(
      "includes %p by default and excludes it only on request",
      (vaf) => {
        const record = Object.freeze({ vaf });
        const column = rangeColumn([record]);
        expect(column.onFilter("0.1,0.5", record)).toBe(true);
        expect(column.onFilter("0.1,0.5,exclude-na", record)).toBe(false);
        expect(column.onFilter("0,0,exclude-na", record)).toBe(false);
      }
    );

    test.each([0, "0", 0.05, 0.1, "0.1", 0.3, 0.5, "0.5", 0.9])(
      "retains inclusive numeric boundaries for %p in both policies",
      (vaf) => {
        const record = { vaf };
        const column = rangeColumn([record]);
        const matches = Number(vaf) >= 0.1 && Number(vaf) <= 0.5;
        expect(column.onFilter("0.1,0.5", record)).toBe(matches);
        expect(column.onFilter("0.1,0.5,exclude-na", record)).toBe(matches);
        expect(column.onFilter("0,0,exclude-na", record)).toBe(Number(vaf) === 0);
      }
    );

    test("supports nested fields and absent paths", () => {
      for (const path of ["metrics.vaf", ["metrics", "vaf"]]) {
        const column = rangeColumn([{ metrics: { vaf: 0.3 } }, {}], null, path);
        expect(column.onFilter("0.1,0.5", { metrics: { vaf: 0.3 } })).toBe(true);
        expect(column.onFilter("0.1,0.5", {})).toBe(true);
        expect(column.onFilter("0.1,0.5,exclude-na", {})).toBe(false);
      }
    });

    test("does not let malformed range keys pass NA rows", () => {
      const column = rangeColumn([{}]);
      for (const key of [null, "", "1,0", ",1", "NA,1", "0,1,unknown"]) {
        expect(column.onFilter(key, {})).toBe(false);
      }
    });

    test("ignores missing, blank and invalid values when computing slider bounds", () => {
      const column = rangeColumn(["", " ", false, true, null, "NA", Infinity, "Infinity", [], {}, 0.2, "0.8"].map((vaf) => ({ vaf })));
      expect(column.filterDropdown({}).props).toMatchObject({ min: 0.2, max: 0.8, step: 0.01 });
      expect(rangeColumn([{ vaf: "NA" }, {}]).filterDropdown({}).props).toMatchObject({ min: 0, max: 1, step: 0.1 });
      expect(rangeColumn([{ vaf: 0 }, { vaf: "0" }]).filterDropdown({}).props).toMatchObject({ min: 0, max: 0 });
    });

    test("passes the translated NA toggle label to the dropdown", () => {
      const translations = require("../../translations/en/common.json");
      const column = buildColumnConfig({ id: "depth", title: "Depth", dataIndex: "depth", filterType: "range", filterable: true }, [{ depth: 200 }], {
        t: (key) => key.split(".").reduce((value, part) => value[part], translations),
      });
      expect(column.filterDropdown({}).props.excludeNALabel).toBe("Exclude NA values");
    });

    test("real AntD filtering preserves interleaved row order, other filters and explicit sorting", () => {
      class ValueRenderer extends React.Component {
        render() {
          return <span>{String(this.props.value ?? "NA")}</span>;
        }
      }
      mockGetColumnRenderer.mockReturnValue(ValueRenderer);
      const records = Object.freeze([
        { uid: "fusion", vaf: "NA", tier: 1, gene: "B" },
        { uid: "low", vaf: 0.02, tier: 1, gene: "E" },
        { uid: "high", vaf: 0.3, tier: 1, gene: "A" },
        { uid: "cna", vaf: null, tier: 1, gene: "C" },
        { uid: "other-tier", vaf: null, tier: 3, gene: "D" },
      ].map(Object.freeze));
      const before = [...records];
      const tierColumn = buildColumnConfig({ id: "tier", title: "Tier", dataIndex: "tier", type: "numeric", filterable: true }, records, {}, [1]);
      const geneColumn = buildColumnConfig({ id: "gene", title: "Gene", dataIndex: "gene", sortable: true }, records);
      const renderedKeys = (key, sorted = false) => {
        const view = renderToStaticMarkup(<Table
          rowKey="uid" pagination={false} dataSource={records}
          columns={[rangeColumn(records, key ? [key] : null), tierColumn, { ...geneColumn, sortOrder: sorted ? "ascend" : null }]}
        />);
        return [...view.matchAll(/data-row-key="([^"]+)"/g)].map((match) => match[1]);
      };
      expect(renderedKeys("0.1,0.5")).toEqual(["fusion", "high", "cna"]);
      expect(renderedKeys("0.1,0.5,exclude-na")).toEqual(["high"]);
      expect(renderedKeys("0.1,0.5")).toEqual(["fusion", "high", "cna"]);
      expect(renderedKeys("0.1,0.5", true)).toEqual(["high", "fusion", "cna"]);
      expect(renderedKeys(null)).toEqual(["fusion", "low", "high", "cna"]);
      expect(records).toEqual(before);
    });
  });

  test("keeps nonnumeric filter values distinct", () => {
    const column = buildColumnConfig(
      {
        id: "status",
        title: "Status",
        dataIndex: "status",
        type: "string",
        filterable: true,
      },
      [{ status: 1 }, { status: "1" }]
    );

    expect(column.filters).toEqual([
      { text: 1, value: 1 },
      { text: "1", value: "1" },
    ]);
  });
});
