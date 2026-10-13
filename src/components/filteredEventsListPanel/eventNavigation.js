function flattenFilterValues(filters = []) {
  return filters.flatMap(filter => [filter.value, ...flattenFilterValues(filter.children)]);
}

/** Mirror AntD's flat-table ordering: stable sort first, then column filters. */
export function getTableReviewRecords(records = [], columns = []) {
  const sorters = columns
    .filter(column => column.sorter)
    .map(column => ({
      order: "sortOrder" in column ? column.sortOrder : column.defaultSortOrder,
      compare: typeof column.sorter === "function" ? column.sorter : column.sorter.compare,
      priority: column.sorter.multiple || 0,
    }))
    .filter(sorter => sorter.order && typeof sorter.compare === "function")
    .sort((a, b) => b.priority - a.priority);
  const filters = columns.filter(column =>
    column.filteredValue?.length && typeof column.onFilter === "function"
  ).map(column => {
    const options = flattenFilterValues(column.filters);
    return {
      onFilter: column.onFilter,
      values: column.filteredValue.map(value => {
        const index = options.findIndex(option => String(option) === String(value));
        return index >= 0 ? options[index] :
          column.filterDropdown !== undefined ? value : String(value);
      }),
    };
  });
  return [...records].sort((a, b) => {
    for (const { order, compare } of sorters) {
      const result = compare(a, b, order);
      if (result) return order === "descend" ? -result : result;
    }
    return 0;
  }).filter(record => filters.every(({ values, onFilter }) =>
    values.some(value => onFilter(value, record))
  ));
}

/** Descriptors distinguish variants sharing a coordinate or gene. */
export function getEventNavigationKey(record) {
  if (!record) return null;
  const id = record.uid ?? record.key ?? record.id;
  if (id == null) return null;
  return JSON.stringify([id, record.gene ?? null,
    record.variant ?? record.Variant ?? record.name ?? null,
    record.variant_type ?? record.type ?? null]);
}

export function getEventNavigation(records, current) {
  const key = getEventNavigationKey(current);
  const index = current ? records.findIndex(record =>
    record === current || (key !== null && getEventNavigationKey(record) === key)
  ) : -1;
  return {
    index,
    total: records.length,
    previous: index > 0 ? records[index - 1] : null,
    next: index >= 0 && index < records.length - 1 ? records[index + 1] : null,
  };
}

export function getEventNavigationLabel(record) {
  if (!record) return "";
  const text = value => typeof value === "string" ? value.trim() : "";
  const gene = text(record.gene);
  const variant = [record.variant, record.Variant, record.name, record.location, record.type]
    .map(text).find(Boolean);
  return [gene, variant].filter(Boolean).join(" — ") || String(record.uid ?? record.id ?? "");
}
