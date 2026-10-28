/** @jest-environment node */
import { visualElementUrl } from "./visualElementLinks";

const context = {
  datasetId: "pipeline-test",
  caseId: "T___vs___N",
  dataPath: "/data/",
};
const current =
  "https://gos.test/preview/?view=pipeline&scope=all&location=chr1&tab=7";

it("opens the owning case and plot rather than the artifact JSON", () => {
  const url = new URL(
    visualElementUrl({ path: "allelic.json" }, context, current),
  );
  expect(url.pathname).toBe("/preview/");
  expect(Object.fromEntries(url.searchParams)).toEqual({
    dataset: "pipeline-test",
    report: "T___vs___N",
    tab: "2",
  });
  expect(url.hash).toBe("#visual-allelic");
});

it("selects indel decomposition and expands the requested metadata field", () => {
  const url = new URL(
    visualElementUrl({ path: "id_decomposed_prob.json" }, context, current),
  );
  expect(url.searchParams.get("signatureType")).toBe("indel");
  expect(url.searchParams.get("tab")).toBe("6");
  expect(url.hash).toBe("#visual-decomposed");
  const metadata = new URL(
    visualElementUrl(
      { path: "metadata.json", pointer: "/0/purity" },
      context,
      current,
    ),
  );
  expect(metadata.searchParams.get("tab")).toBe("0");
  expect(metadata.hash).toBe("#visual-metadata-purity");
});

it("opens supplementary outputs directly when no report panel renders them", () => {
  expect(
    visualElementUrl({ path: "somatic_total_hist.json" }, context, current),
  ).toBe("/data/T___vs___N/somatic_total_hist.json");
});
