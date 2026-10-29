import * as d3 from "d3";

// Normalize numeric strings so extent bounds do not depend on record order.
export const getNumericFilterExtent = (values = []) =>
  d3.extent(
    values
      .filter((value) => value != null && !isNaN(value))
      .map(Number),
  );
