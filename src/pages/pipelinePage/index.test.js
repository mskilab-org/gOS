/* eslint-disable import/first */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import axios from "axios";

jest.mock("axios", () => ({ get: jest.fn() }));

jest.mock("react-redux", () => ({
  useSelector: (select) => select(mockState),
}));
jest.mock("../../hooks/usePipelineInventory", () => () => mockInventory);

import PipelinePage from "./index";

const mockState = {
  Datasets: {
    records: [{ id: "batch", pipeline: { inventoryPath: "/inventory.json" } }],
  },
  Settings: { dataset: {}, data: {} },
};
let mockInventory;

beforeEach(() => {
  window.matchMedia = jest.fn(() => ({
    matches: false,
    addListener: jest.fn(),
    removeListener: jest.fn(),
  }));
  window.getComputedStyle = jest.fn(() => ({
    getPropertyValue: () => "",
    width: "0px",
  }));
});

beforeEach(() => {
  mockInventory = {
    loading: false,
    error: null,
    data: {
      schemaVersion: 1,
      datasets: [
        {
          id: "batch",
          title: "Batch",
          cases: [
            {
              caseId: "missing-manifest-case",
              datasetId: "batch",
              batchId: "B",
              study: "paired",
              expected: true,
              published: false,
              missingRequired: 4,
              artifacts: [],
            },
            {
              caseId: "published-case",
              datasetId: "batch",
              batchId: "B",
              study: "paired",
              expected: true,
              published: true,
              metadataPresent: true,
              missingRequired: 0,
              artifacts: [],
            },
          ],
        },
      ],
      errors: [],
    },
  };
});

it("shows wholly missing cases and builds a provenance link only for published cases", () => {
  render(<PipelinePage />);
  expect(screen.getByText("missing-manifest-case").closest("a")).toBeNull();
  const url = new URL(
    screen.getByRole("link", { name: "published-case" }).href,
  );
  expect(url.searchParams.get("dataset")).toBe("batch");
  expect(url.searchParams.get("tab")).toBe("7");
  expect(url.searchParams.has("view")).toBe(false);
  fireEvent.change(screen.getByPlaceholderText("Find batch or sample"), {
    target: { value: "missing-manifest" },
  });
  expect(screen.queryByText("published-case")).toBeNull();
  expect(screen.getByText("missing-manifest-case")).toBeTruthy();
});

it("exposes scanner errors rather than treating failed datasets as complete", () => {
  mockInventory.data.errors = [
    { datasetId: "failed-batch", message: "Permission denied" },
  ];
  render(<PipelinePage />);
  expect(screen.getByText("failed-batch: Permission denied")).toBeTruthy();
});

it("only fetches alternative paths after the inference button is clicked", async () => {
  const record = mockInventory.data.datasets[0].cases[1];
  record.configuredInputs = { row: { allelic_jabba_gg: "/used" } };
  record.remapping = { catalogPath: "/candidates.json" };
  record.artifacts = [
    {
      id: "allelic",
      path: "allelic.json",
      evidence: "captured",
      sources: [{ path: "/used" }],
    },
  ];
  axios.get.mockResolvedValue({
    data: {
      schemaVersion: 1,
      datasetId: "batch",
      cases: {
        "published-case": {
          sources: {
            allelic_jabba_gg: [{ path: "/used" }, { path: "/other-run" }],
          },
        },
      },
    },
  });
  render(<PipelinePage />);
  const row = screen
    .getByRole("link", { name: "published-case" })
    .closest("tr");
  fireEvent.click(row.querySelector("button"));
  expect(axios.get).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole("button", { name: "Infer replacement paths" }),
  );
  expect(await screen.findByText("allelic_jabba_gg")).toBeTruthy();
  expect(axios.get).toHaveBeenCalledTimes(1);
  expect(
    screen.getByRole("button", { name: "Export selected remapping" }).disabled,
  ).toBe(true);
});
