// Map published artifacts to the report panels that render them.
const targets = {
  "complex.json": [2, "genome"],
  "allelic.json": [2, "allelic"],
  "coverage.arrow": [2, "coverage"],
  "hetsnps.arrow": [2, "hetsnps"],
  "mutations.json": [2, "mutations"],
  "tumor.bam": [2, "igv"],
  "tumor.bam.bai": [2, "igv"],
  "normal.bam": [2, "igv"],
  "normal.bam.bai": [2, "igv"],
  "filtered.events.json": [1, "events"],
  "highlights.json": [0, "highlights"],
  "metadata.json": [0, "metadata"],
  "sage.qc.json": [4, "variant-qc"],
  "coverage_cn_boxplot_original.png": [4, "coverage-original"],
  "coverage_cn_boxplot_denoised.png": [4, "coverage-denoised"],
  "ppfit.json": [5, "ppfit"],
  "multiplicity.png": [5, "multiplicity-fit"],
  "purple_sunrise_pp.png": [5, "purple-image"],
  "hetsnps_major_minor.png": [5, "allelic-fit"],
  "mutation_catalog.json": [6, "catalog", "sbs"],
  "id_mutation_catalog.json": [6, "catalog", "indel"],
  "sbs_decomposed_prob.json": [6, "decomposed", "sbs"],
  "id_decomposed_prob.json": [6, "decomposed", "indel"],
};

export const visualElementAnchor = (name) => ({
  id: `visual-${name}`,
  style: { scrollMarginTop: 180 },
});

export function visualElementUrl(
  artifact,
  { datasetId, caseId, dataPath },
  currentUrl,
) {
  if (!caseId) return null;
  const target = targets[artifact.path];
  // Some published supplementary artifacts have no report panel.
  if (!target || !datasetId) {
    return dataPath
      ? `${dataPath.replace(/\/$/, "")}/${encodeURIComponent(caseId)}/${artifact.path}`
      : null;
  }
  const url = new URL(currentUrl);
  ["view", "scope", "gene", "location", "signatureType"].forEach((key) =>
    url.searchParams.delete(key),
  );
  url.searchParams.set("dataset", datasetId);
  url.searchParams.set("report", caseId);
  url.searchParams.set("tab", target[0]);
  if (target[2]) url.searchParams.set("signatureType", target[2]);
  const field = artifact.pointer?.match(/^\/0\/([^/]+)$/)?.[1];
  url.hash = `visual-${target[1]}${field ? `-${field.replace(/~1/g, "/").replace(/~0/g, "~")}` : ""}`;
  return url.toString();
}
