export function replacementOptions(catalog, caseId, inputs, caseIds = {}) {
  const sourceCase = catalog.cases?.[caseIds[caseId] || caseId];
  if (!sourceCase || !inputs) return [];
  return Object.entries(sourceCase.sources || {}).flatMap(
    ([column, sources]) => {
      const fromPath = inputs[column];
      if (typeof fromPath !== "string" || !fromPath.startsWith("/")) return [];
      const unique = [
        ...new Map(sources.map((source) => [source.path, source])).values(),
      ];
      const candidates = unique.filter((source) => source.path !== fromPath);
      return candidates.length ? [{ column, fromPath, candidates }] : [];
    },
  );
}

export function remappingDocument(datasetId, caseId, groups, selected) {
  return {
    schemaVersion: 1,
    datasetId,
    caseId,
    changes: groups
      .filter((group) => selected[group.column])
      .map((group) => ({
        column: group.column,
        fromPath: group.fromPath,
        toPath: selected[group.column],
      })),
  };
}
