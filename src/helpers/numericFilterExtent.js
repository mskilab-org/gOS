import * as d3 from "d3";
import { normalizeNumericFilterValue } from "./numericRangeFilter";

// Normalize numeric strings so extent bounds do not depend on record order.
export const getNumericFilterExtent = (values = []) =>
  d3.extent(
    values
      .map(normalizeNumericFilterValue)
      .filter((value) => value !== undefined),
  );
