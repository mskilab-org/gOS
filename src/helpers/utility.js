import { tableFromIPC } from "apache-arrow";
import axios from "axios";
import * as d3 from "d3";
import Connection from "./connection";
import Interval from "./interval";
import { act } from "react";

export function dataRanges(domains, genome) {
  function filterIntervalsByDomain(domain, intervals) {
    let filteredIntervals = intervals.filter(
      (d) => d.startPlace <= domain[1] && d.endPlace >= domain[0]
    );
    let [intervalMin, intervalMax] = d3.extent(filteredIntervals, (d) => d.y);
    let offsetPerc = 1;
    let yDomain = [
      intervalMin - intervalMin * offsetPerc,
      intervalMax + intervalMax * offsetPerc,
    ];
    return yDomain;
  }
  let maxY = d3.max(
    domains
      .map((domain) => filterIntervalsByDomain(domain, genome.intervals))
      .flat()
  );
  let yScale = d3.scaleLinear().domain([0, maxY]).range([1, 0]).nice();
  return yScale.domain();
}

export function chunks(arr, size = 4) {
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size)
  );
}

export function filterGenesByOverlap(genes) {
  // A helper to measure text width precisely via a hidden canvas
  function getTextWidth(text, font = "10px Arial") {
    const canvas =
      getTextWidth.canvas ||
      (getTextWidth.canvas = document.createElement("canvas"));
    const context = canvas.getContext("2d");
    context.font = font;
    return context.measureText(text).width;
  }

  // We’ll sort a copy of the array so we don’t mutate the original
  // Sort by importance descending
  const sortedGenes = [...genes].sort((a, b) => b.importance - a.importance);

  // We’ll store the accepted genes here
  const acceptedGenes = [];

  // Keep track of bounding boxes by strand: {"+" : [...], "-" : [...]}
  // Each bounding box will be { left, right } in pixel coordinates.
  const boxesByStrand = { "+": [], "-": [] };

  // Utility to check if two [left, right] intervals overlap
  function overlaps(aLeft, aRight, bLeft, bRight) {
    return aLeft <= bRight && bLeft <= aRight;
  }

  // Iterate over genes (most important first)
  for (const gene of sortedGenes) {
    const strand = gene.strand;
    // Compute midpoint (x-coord) in the same scale as startPlace/endPlace
    const mid = gene.textPosX;

    // Measure the width of the gene's title in pixels
    const textWidth = getTextWidth(gene.title);

    // Approximate bounding box of the text
    const left = mid - textWidth / 2;
    const right = mid + textWidth / 2;

    // Check if this bounding box overlaps with any existing box on the same strand
    const strandBoxes = boxesByStrand[strand] || [];
    const hasOverlap = strandBoxes.some((box) =>
      overlaps(box.left, box.right, left, right)
    );

    // If no overlap, accept this gene and record its bounding box
    if (!hasOverlap) {
      acceptedGenes.push(gene);
      strandBoxes.push({ left, right });
      boxesByStrand[strand] = strandBoxes;
    }
    gene.textOverlap = hasOverlap;
  }

  // Return only the accepted genes.
  // If you need them in the original array order, you could sort acceptedGenes
  // by their original index. Here we just return the order determined by sorting (by importance).
  return sortedGenes;
}

export function color2RGB(color) {
  let red = Math.floor(color / 65536.0);
  let green = Math.floor((color - red * 65536.0) / 256.0);
  let blue = color - red * 65536.0 - green * 256.0;

  // Make sure to clamp the values to the 0–255 range just in case
  let r = Math.max(0, Math.min(255, red));
  let g = Math.max(0, Math.min(255, green));
  let b = Math.max(0, Math.min(255, blue));

  // Convert each color component to a two‐character hex string
  const toHex = (value) => {
    const hex = value.toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };

  // Concatenate them in the form "#RRGGBB"
  return "#" + toHex(r) + toHex(g) + toHex(b);
}

export function replaceSearchParams(location, params = {}) {
  let searchParams = new URLSearchParams(location.search);
  Object.keys(params).forEach((param) => {
    searchParams.set(param, params[param].toString());
  });
  return decodeURIComponent(searchParams.toString());
}

export function placeholderImage() {
  return "data:image/png;base64,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";
}

export function isNumeric(value) {
  return typeof value === "number" && isFinite(value);
}

export async function loadArrowTable(file, cancelToken) {
  try {
    // Fetch the file with Axios and the provided cancel token
    const response = await axios.get(file, {
      responseType: "arraybuffer", // Ensure the response is in binary format
      cancelToken: cancelToken, // Pass the cancel token here
    });

    // Convert the Axios response data to an Arrow table
    return await tableFromIPC(response.data);
  } catch (error) {
    if (axios.isCancel(error)) {
      console.log(`Request canceled for ${file}`, error.message);
    } else {
      console.error(`Failed to load Arrow table for file ${file}:`, error);
    }
    throw error; // Re-throw error so calling code can handle it
  }
}

export function datafilesArrowTableToJson(table) {
  const structFields = new Set([
    "deconstructsigs_sbs_fraction",
    "hrd",
    "sigprofiler_indel_fraction",
    "sigprofiler_indel_count",
    "sigprofiler_sbs_fraction",
    "sigprofiler_sbs_count",
    "signatures",
    "deletionInsertion",
    "sv_types_count",
  ]);

  const result = [];

  for (let row of table) {
    const obj = {};

    for (let [key, value] of row) {
      if (
        structFields.has(key) &&
        value != null &&
        typeof value.toJSON === "function"
      ) {
        obj[key] = value.toJSON();
      } else {
        obj[key] = value;
      }
    }

    result.push(obj);
  }

  return result;
}

export function transitionStyle(inViewport) {
  if (inViewport) {
    return { WebkitTransition: "opacity 0.75s ease-in-out" };
  } else if (!inViewport) {
    return { WebkitTransition: "none", opacity: "0" };
  }
}

export function dataToGenome(data, chromoBins) {
  let genome = {
    settings: data.settings,
    intervals: [],
    connections: [],
    intervalBins: {},
    frameConnections: [],
  };
  genome.intervalBins = {};
  data.intervals.forEach((d, i) => {
    let interval = new Interval(d);
    if (chromoBins[`${interval.chromosome}`]) {
      interval.startPlace =
        chromoBins[`${interval.chromosome}`].startPlace + interval.startPoint;
      interval.endPlace =
        chromoBins[`${interval.chromosome}`].startPlace + interval.endPoint;
      interval.color = d3
        .rgb(chromoBins[`${interval.chromosome}`].color)
        .toString();
      interval.stroke = d3
        .rgb(chromoBins[`${interval.chromosome}`].color)
        .darker()
        .toString();
      genome.intervalBins[d.iid] = interval;
      genome.intervals.push(interval);
    }
  });
  data.frameConnections = [];
  data.connections.forEach((d, i) => {
    let connection = new Connection(d);
    if (connection.isValid(genome.intervalBins)) {
      connection.pinpoint(genome.intervalBins);
      connection.arc = d3
        .arc()
        .innerRadius(0)
        .outerRadius(plotMargins().bar / 2)
        .startAngle(0)
        .endAngle((e, j) => e * Math.PI);
      genome.frameConnections.push(connection);
    }
    genome.connections.push(connection);
  });

  return genome;
}

export function defaultSearchFilters() {
  return { page: 1, per_page: 10, texts: "", orderId: 1 };
}

export function plotMargins() {
  return {
    gap: 24,
    bar: 10,
    gapY: 24,
    yTicksCount: 10,
  };
}

export function tierColor(tier) {
  switch (tier) {
    case 1:
      return "#30A02C";
    case 2:
      return "#2177B3";
    case 3:
      return "#974DA3";
    default:
      return "#424242";
  }
}

export function legendColors() {
  // first color for x < μ - 2σ
  // second color for |x - μ| < 2σ
  // third color for x > μ + 2σ
  return ["#1f78b4", "#33a02c", "#fc8d62"];
}

export function qualityStatusTagClasses() {
  return { 0: "success", 1: "warning", 2: "error" };
}

export function qualityStatusTypographyClasses() {
  return { 0: "success", 1: "warning", 2: "danger" };
}

export function nucleotideColors() {
  return ["#1f78b4", "#33a02c", "#fc8d62"];
}

export function getEventType(event) {
  const { type } = event;
  if (["fusion", "fusions"].includes(type?.toLowerCase())) {
    return "fusion";
  } else if (["scna", "cna"].includes(type?.toLowerCase())) {
    return "cna";
  } else {
    return "snv";
  }
}

export function deletionInsertionMutationVariant(input) {
  const label = +input.slice(-1);
  const baseLabel = `${label}${label > 4 ? "+" : ""}`;
  const incrementedLabel = `${label + 1}${label > 4 ? "+" : ""}`;

  const patterns = [
    { match: "1:Del:C", variant: "1DelC", label: incrementedLabel },
    { match: "1:Del:T", variant: "1DelT", label: incrementedLabel },
    { match: "1:Ins:C", variant: "1InsC", label: baseLabel },
    { match: "1:Ins:T", variant: "1InsT", label: baseLabel },
    { match: "2:Del:R", variant: "2DelR", label: incrementedLabel },
    { match: "3:Del:R", variant: "3DelR", label: incrementedLabel },
    { match: "4:Del:R", variant: "4DelR", label: incrementedLabel },
    { match: "5:Del:R", variant: "5DelR", label: incrementedLabel },
    { match: "2:Ins:R", variant: "2InsR", label: baseLabel },
    { match: "3:Ins:R", variant: "3InsR", label: baseLabel },
    { match: "4:Ins:R", variant: "4InsR", label: baseLabel },
    { match: "5:Ins:R", variant: "5InsR", label: baseLabel },
    { match: "2:Del:M", variant: "2DelM", label: baseLabel },
    { match: "3:Del:M", variant: "3DelM", label: baseLabel },
    { match: "4:Del:M", variant: "4DelM", label: baseLabel },
    { match: "5:Del:M", variant: "5DelM", label: baseLabel },
    { match: "long_Del", variant: "longDel", label: "5+" },
    { match: "long_Ins", variant: "longIns", label: "5+" },
    { match: "MH", variant: "delMH", label: "5+" },
    { match: "complex", variant: "delComplex", label: "5+" },
  ];

  const matchedPattern = patterns.find(({ match }) => input.includes(match));
  return matchedPattern
    ? { variant: matchedPattern.variant, label: matchedPattern.label }
    : { variant: null, label: null };
}

export function nucleotideMutationText(nucleotideMutation) {
  // Regular expression to match the nucleotide and mutation parts
  const regex = /\[[^\]]*\]/g;

  return nucleotideMutation
    .replace(regex, "")
    .split("")
    .join(nucleotideMutation.substring(2, 3));
}

export function roleColorMap() {
  return { oncogene: "geekblue", fusion: "green", TSG: "volcano" };
}

export function downloadCanvasAsPng(canvas, filename) {
  /// create an "off-screen" anchor tag
  var lnk = document.createElement("a"),
    e;

  /// the key here is to set the download attribute of the a tag
  lnk.download = filename;

  /// convert canvas content to data-uri for link. When download
  /// attribute is set the content pointed to by link will be
  /// pushed as "download" in HTML5 capable browsers
  lnk.href = canvas.toDataURL("image/png;base64");

  /// create a "fake" click-event to trigger the download
  if (document.createEvent) {
    e = document.createEvent("MouseEvents");
    e.initMouseEvent(
      "click",
      true,
      true,
      window,
      0,
      0,
      0,
      0,
      0,
      false,
      false,
      false,
      false,
      0,
      null
    );

    lnk.dispatchEvent(e);
  } else if (lnk.fireEvent) {
    lnk.fireEvent("onclick");
  }
}

export function measureText(string, fontSize = 10) {
  const widths = [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0.278125, 0.278125, 0.35625, 0.55625, 0.55625,
    0.890625, 0.6671875, 0.1921875, 0.334375, 0.334375, 0.390625, 0.584375,
    0.278125, 0.334375, 0.278125, 0.278125, 0.55625, 0.55625, 0.55625, 0.55625,
    0.55625, 0.55625, 0.55625, 0.55625, 0.55625, 0.55625, 0.278125, 0.278125,
    0.584375, 0.584375, 0.584375, 0.55625, 1.015625, 0.6703125, 0.6671875,
    0.7234375, 0.7234375, 0.6671875, 0.6109375, 0.778125, 0.7234375, 0.278125,
    0.5, 0.6671875, 0.55625, 0.834375, 0.7234375, 0.778125, 0.6671875, 0.778125,
    0.7234375, 0.6671875, 0.6109375, 0.7234375, 0.6671875, 0.9453125, 0.6671875,
    0.6671875, 0.6109375, 0.278125, 0.278125, 0.278125, 0.4703125, 0.584375,
    0.334375, 0.55625, 0.55625, 0.5, 0.55625, 0.55625, 0.3125, 0.55625, 0.55625,
    0.2234375, 0.2703125, 0.5, 0.2234375, 0.834375, 0.55625, 0.55625, 0.55625,
    0.55625, 0.346875, 0.5, 0.278125, 0.55625, 0.5, 0.7234375, 0.5, 0.5, 0.5,
    0.334375, 0.2609375, 0.334375, 0.584375,
  ];
  const avg = 0.528733552631579;
  return (
    string
      .split("")
      .map((c) =>
        c.charCodeAt(0) < widths.length ? widths[c.charCodeAt(0)] : avg
      )
      .reduce((cur, acc) => acc + cur) * fontSize
  );
}

export function guid() {
  function S4() {
    return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
  }
  // then to call it, plus stitch in '4' in the third group
  return (
    S4() +
    S4() +
    "-" +
    S4() +
    "-4" +
    S4().substr(0, 3) +
    "-" +
    S4() +
    "-" +
    S4() +
    S4() +
    S4()
  ).toLowerCase();
}

export function humanize(str) {
  return str
    .replace(/^[\s_]+|[\s_]+$/g, "")
    .replace(/[_\s]+/g, " ")
    .replace(/^[a-z]/, function (m) {
      return m.toUpperCase();
    });
}

/**
 * K-combinations
 *
 * Get k-sized combinations of elements in a set.
 *
 * Usage:
 *   k_combinations(set, k)
 *
 * Parameters:
 *   set: Array of objects of any type. They are treated as unique.
 *   k: size of combinations to search for.
 *
 * Return:
 *   Array of found combinations, size of a combination is k.
 *
 * Examples:
 *
 *   k_combinations([1, 2, 3], 1)
 *   -> [[1], [2], [3]]
 *
 *   k_combinations([1, 2, 3], 2)
 *   -> [[1,2], [1,3], [2, 3]
 *
 *   k_combinations([1, 2, 3], 3)
 *   -> [[1, 2, 3]]
 *
 *   k_combinations([1, 2, 3], 4)
 *   -> []
 *
 *   k_combinations([1, 2, 3], 0)
 *   -> []
 *
 *   k_combinations([1, 2, 3], -1)
 *   -> []
 *
 *   k_combinations([], 0)
 *   -> []
 */
export function k_combinations(set, k) {
  var i, j, combs, head, tailcombs;

  // There is no way to take e.g. sets of 5 elements from
  // a set of 4.
  if (k > set.length || k <= 0) {
    return [];
  }

  // K-sized set has only one K-sized subset.
  if (k === set.length) {
    return [set];
  }

  // There is N 1-sized subsets in a N-sized set.
  if (k === 1) {
    combs = [];
    for (i = 0; i < set.length; i++) {
      combs.push([set[i]]);
    }
    return combs;
  }

  // Assert {1 < k < set.length}

  // Algorithm description:
  // To get k-combinations of a set, we want to join each element
  // with all (k-1)-combinations of the other elements. The set of
  // these k-sized sets would be the desired result. However, as we
  // represent sets with lists, we need to take duplicates into
  // account. To avoid producing duplicates and also unnecessary
  // computing, we use the following approach: each element i
  // divides the list into three: the preceding elements, the
  // current element i, and the subsequent elements. For the first
  // element, the list of preceding elements is empty. For element i,
  // we compute the (k-1)-computations of the subsequent elements,
  // join each with the element i, and store the joined to the set of
  // computed k-combinations. We do not need to take the preceding
  // elements into account, because they have already been the i:th
  // element so they are already computed and stored. When the length
  // of the subsequent list drops below (k-1), we cannot find any
  // (k-1)-combs, hence the upper limit for the iteration:
  combs = [];
  for (i = 0; i < set.length - k + 1; i++) {
    // head is a list that includes only our current element.
    head = set.slice(i, i + 1);
    // We take smaller combinations from the subsequent elements
    tailcombs = k_combinations(set.slice(i + 1), k - 1);
    // For each (k-1)-combination we join it with the current
    // and store it to the set of k-combinations.
    for (j = 0; j < tailcombs.length; j++) {
      combs.push(head.concat(tailcombs[j]));
    }
  }
  return combs;
}

export function assessQuality(metadata) {
  let assessment = {
    level: 0,
    clauses: [],
  };
  let clauses = [
    {
      level: 3,
      variable: "!metadata.coverage_qc",
      threshold: "",
      comparison: "",
      label: "missing_qc_metrics",
      format: "",
    },
    {
      level: 2,
      variable: "metadata.tumor_median_coverage",
      threshold: 80,
      comparison: "<",
      label: "tumor_coverage_less_than_80x",
      format: ".1f",
    },
    {
      level: 2,
      variable: "metadata.normal_median_coverage",
      threshold: 20,
      comparison: "<",
      label: "normal_coverage_less_than_20x",
      format: ".1f",
    },
    {
      level: 2,
      variable:
        "metadata.coverage_qc ? metadata.coverage_qc.percent_reads_mapped : undefined",
      threshold: 0.99,
      comparison: "<",
      label: "mapped_reads_per_total_reads_less_than_99_percentage",
      format: ".1%",
    },
    {
      level: 2,
      variable:
        "metadata.coverage_qc ? metadata.coverage_qc.greater_than_or_equal_to_30x : undefined",
      threshold: 0.95,
      comparison: "<",
      label:
        "genome_coverage_at_least_30x_pct_30x_picard_is_less_than_95_percentage",
      format: ".1%",
    },
    {
      level: 1,
      variable:
        "metadata.coverage_qc ? metadata.coverage_qc.insert_size : undefined",
      threshold: 300,
      comparison: "<=",
      label: "median_insert_size_less_or_equal_300",
      format: "d",
    },
    {
      level: 1,
      variable:
        "metadata.coverage_qc ? metadata.coverage_qc.percent_duplication : undefined",
      threshold: 0.2,
      comparison: ">=",
      label: "optical_pcr_dups_greater_or_equal_20_percentage",
      format: ".1%",
    },
  ];

  clauses.forEach((clause) => {
    let evaluationString = `${clause.variable} ${clause.comparison} ${clause.threshold}`;
    try {
      if (eval(evaluationString)) {
        assessment.level = d3.max([assessment.level, clause.level]);
        assessment.clauses.push(clause);
      }
    } catch (error) {
      console.log(error);
    }
  });

  return assessment;
}

export function merge(intervals) {
  // test if there are at least 2 intervals
  if (intervals.length <= 1) {
    return intervals;
  }

  var stack = [];
  var topp = null;

  // sort the intervals based on their start values
  intervals = intervals.sort((a, b) => {
    return a.startPlace - b.startPlace;
  });

  // push the 1st interval into the stack
  stack.push(intervals[0]);

  // start from the next interval and merge if needed
  for (var i = 1; i < intervals.length; i++) {
    // get the topp element
    topp = stack[stack.length - 1];

    // if the current interval doesn't overlap with the
    // stack topp element, push it to the stack
    if (topp.endPlace < intervals[i].startPlace) {
      stack.push(intervals[i]);
    }
    // otherwise update the end value of the topp element
    // if end of current interval is higher
    else if (topp.endPlace < intervals[i].endPlace) {
      topp.endPlace = intervals[i].endPlace;
      stack.pop();
      stack.push(topp);
    }
  }

  return stack;
}

export function updateChromoBins(coordinateSet) {
  let genomeLength = coordinateSet.reduce(
    (acc, elem) => acc + elem.endPoint,
    0
  );
  let boundary = 0;
  let chromoBins = coordinateSet.reduce((hash, element) => {
    let chromo = element;
    chromo.length = chromo.endPoint;
    chromo.startPlace = boundary + chromo.startPoint;
    chromo.endPlace = boundary + chromo.endPoint;
    chromo.scaleToGenome = d3
      .scaleLinear()
      .domain([chromo.startPoint, chromo.endPoint])
      .range([chromo.startPlace, chromo.endPlace]);
    hash[element.chromosome] = chromo;
    boundary += chromo.length;
    return hash;
  }, {});
  return { genomeLength, chromoBins };
}

export function domainsToLocation(chromoBins, domains) {
  return domains.map((d) => locateGenomeRange(chromoBins, d)).join("|");
}

export function locationToDomains(chromoBins, loc) {
  let domains = [];
  loc.split("|").forEach((d, i) => {
    let domainString = d.split("-").map((e) => e.split(":"));
    let domain = [];
    domain.push(
      chromoBins[domainString[0][0]].startPlace +
        +domainString[0][1] -
        chromoBins[domainString[0][0]].startPoint
    );
    domain.push(
      chromoBins[domainString[1][0]].startPlace +
        +domainString[1][1] -
        chromoBins[domainString[1][0]].startPoint
    );
    domains.push(domain);
  });
  return domains;
}

export function lociToDomains(chromoBins, loci) {
  // Extract chromosome and position parts
  let [chromosome, positions] = loci.split(":");
  let [start, end] = positions.split("-");

  // Remove "chr" prefix and fractional parts of numbers
  let parsedChromosome = chromosome.replace("chr", "");
  let parsedStart = Math.floor(parseFloat(start)); // Round down to integer
  let parsedEnd = Math.floor(parseFloat(end)); // Round down to integer

  // Construct the desired location format
  let location = `${parsedChromosome}:${parsedStart}-${parsedChromosome}:${parsedEnd}`;
  return locationToDomains(chromoBins, location);
}

export function domainToLoci(chromoBins, domain) {
  let from = domain[0];
  let to = domain[1];
  let startLoci, endLoci;
  Object.keys(chromoBins).forEach((key, i) => {
    if (
      from <= chromoBins[key].endPlace &&
      from >= chromoBins[key].startPlace
    ) {
      startLoci = {
        chromosome: key,
        point: from - chromoBins[key].startPlace + chromoBins[key].startPoint,
      };
    }
    if (to <= chromoBins[key].endPlace && to >= chromoBins[key].startPlace) {
      endLoci = {
        chromosome: key,
        point: to - chromoBins[key].startPlace + chromoBins[key].startPoint,
      };
    }
  });
  let location = {
    chromosome: startLoci.chromosome,
    startPoint: startLoci.point,
    endPoint:
      endLoci.chromosome === startLoci.chromosome
        ? endLoci.point
        : chromoBins[startLoci.chromosome].endPoint,
  };
  return `chr${location.chromosome}:${location.startPoint}-${location.endPoint}`;
}

export function locateGenomeRange(chromoBins, domain) {
  let from = domain[0];
  let to = domain[1];
  let genomeRange = [];
  Object.keys(chromoBins).forEach((key, i) => {
    if (
      from <= chromoBins[key].endPlace &&
      from >= chromoBins[key].startPlace
    ) {
      genomeRange.push(
        `${key}:${
          from - chromoBins[key].startPlace + chromoBins[key].startPoint
        }`
      );
    }
    if (to <= chromoBins[key].endPlace && to >= chromoBins[key].startPlace) {
      genomeRange.push(
        `${key}:${to - chromoBins[key].startPlace + chromoBins[key].startPoint}`
      );
    }
  });
  return genomeRange.join("-");
}

export function cluster(
  annotatedIntervals,
  genomeLength,
  maxClusters = 6,
  minDistance = 1e7
) {
  let annotated = annotatedIntervals.sort((a, b) =>
    d3.ascending(a.startPlace, b.startPlace)
  );
  let clusters = [
    { startPlace: annotated[0].startPlace, endPlace: annotated[0].endPlace },
  ];
  for (let i = 0; i < annotated.length - 1; i++) {
    if (annotated[i + 1].startPlace - annotated[i].endPlace > minDistance) {
      clusters.push({
        startPlace: annotated[i + 1].startPlace,
        endPlace: annotated[i + 1].endPlace,
      });
    } else {
      clusters[clusters.length - 1].endPlace = annotated[i + 1].endPlace;
    }
  }
  while (clusters.length > maxClusters) {
    clusters = clusters.sort((a, b) =>
      d3.ascending(a.startPlace, b.startPlace)
    );
    let minDistance = Number.MAX_SAFE_INTEGER;
    let minIndex = 0;
    for (let i = 0; i < clusters.length - 1; i++) {
      if (clusters[i + 1].startPlace - clusters[i].endPlace < minDistance) {
        minDistance = clusters[i + 1].startPlace - clusters[i].endPlace;
        minIndex = i;
      }
    }
    clusters = clusters
      .slice(0, minIndex)
      .concat([
        {
          startPlace: clusters[minIndex].startPlace,
          endPlace: clusters[minIndex + 1].endPlace,
        },
      ])
      .concat(clusters.slice(minIndex + 2, clusters.length));
  }
  clusters = merge(
    clusters.map((d, i) => {
      return {
        startPlace: d3.max([
          d.startPlace - 0.16 * (d.endPlace - d.startPlace),
          1,
        ]),
        endPlace: d3.min([
          d.endPlace + 0.16 * (d.endPlace - d.startPlace),
          genomeLength,
        ]),
      };
    })
  ).sort((a, b) => d3.ascending(a.startPlace, b.startPlace));
  return clusters.map((d, i) => [
    Math.floor(d.startPlace),
    Math.floor(d.endPlace),
  ]);
}

// returns the maximum Y value within the domains array as applied to the dataPointsX
export function findMaxInRanges(
  domains,
  dataPointsX,
  dataPointsY,
  usePercentile = false,
  p = 0.99 // 99th percentile by default
) {
  return domains.map(([start, end]) => {
    let left = 0,
      right = dataPointsX.length - 1;

    // // Binary search for the first element >= start
    // while (left <= right) {
    //   const mid = Math.floor((left + right) / 2);
    //   if (dataPointsX[mid] < start) left = mid + 1;
    //   else right = mid - 1;
    // }

    left = findIndexForNum(dataPointsX, start);
    right = findIndexForNum(dataPointsX, end);

    // Collect values within the specified range using slice
    //const sliceEnd = dataPointsX.findIndex((d) => d > end); // Find first index greater than end
    const valuesInRangeSlice = dataPointsY.slice(left, right);

    // Calculate either max or 99th percentile
    let resultValue;
    if (usePercentile && valuesInRangeSlice.length > 0) {
      // After sorting:
      valuesInRangeSlice.sort((a, b) => a - b);

      // "Continuous" approach with optional interpolation:
      const n = valuesInRangeSlice.length;
      const i = (n - 1) * p; // fractional index
      const iLow = Math.floor(i);
      const iHigh = Math.ceil(i);
      if (iLow === iHigh) {
        // If i is an integer, no interpolation needed
        resultValue = valuesInRangeSlice[iLow];
      } else {
        // Linear interpolation (optional, for a more precise percentile):
        const fraction = i - iLow;
        resultValue =
          valuesInRangeSlice[iLow] * (1 - fraction) +
          valuesInRangeSlice[iHigh] * fraction;
      }
    } else {
      resultValue =
        valuesInRangeSlice.length > 0 ? d3.max(valuesInRangeSlice) : -Infinity;
    }

    return resultValue;
  });
}

/**
 * findIndexForNum(sortedArray, num):
 *
 * Returns the smallest index i such that sortedArray[i] >= num.
 * That implies:
 *    - For i > 0: sortedArray[i - 1] < num <= sortedArray[i]
 *    - If i === 0: then sortedArray[0] is already >= num
 *    - If i === sortedArray.length: all elements are < num
 *
 * sortedArray must be sorted in ascending order (no duplicates needed, but it’s typical).
 */
export function findIndexForNum(sortedArray, num) {
  let left = 0;
  let right = sortedArray.length; // note: we use right = length (one past last index)

  while (left < right) {
    const mid = (left + right) >>> 1; // floor((left+right)/2)
    if (sortedArray[mid] < num) {
      // num is bigger, so we must look right of mid
      left = mid + 1;
    } else {
      // sortedArray[mid] >= num, so tighten to [left .. mid]
      right = mid;
    }
  }

  // After the loop, 'left' is the smallest index where sortedArray[left] >= num
  // or left === sortedArray.length if all elements < num
  return left;
}

export function magnitude(n) {
  let order = Math.floor(Math.log(n) / Math.LN10 + 0.000000001); // because float math sucks like that
  return Math.pow(10, order);
}

const attributes = [
  "pair",
  "svCount",
  "snvCount",
  "tmb",
  "lohFraction",
  "purity",
  "ploidy",
  "tumor_median_coverage",
  "hrdScore",
  "hrdB12Score",
  "hrdB1Score",
  "hrdB2Score",
  "msiScore",
];

const sorts = ["ascending", "descending"];

export const orderListViewFilters = attributes.flatMap((attribute, i) =>
  sorts.map((sort, j) => ({
    id: i * sorts.length + j + 1,
    attribute,
    sort,
  }))
);

export function plotTypes() {
  return {
    tumor_median_coverage: {
      plotType: "histogram",
      tumor_type: "tumor_type",
      format: ",",
      scaleX: "linear",
      scaleXFormat: "~s",
    },
    snvCount: {
      plotType: "histogram",
      tumor_type: "tumor_type",
      format: ",",
      scaleX: "log",
      scaleXFormat: "~s",
    },
    svCount: {
      plotType: "histogram",
      tumor_type: "tumor_type",
      format: ",",
      scaleX: "log",
      scaleXFormat: "~s",
    },
    tmb: {
      plotType: "histogram",
      tumor_type: "tumor_type",
      format: ",",
      scaleX: "log",
      scaleXFormat: "~s",
    },
    lohFraction: {
      plotType: "histogram",
      tumor_type: "tumor_type",
      format: ".3",
      scaleX: "linear",
      scaleXFormat: "0.2f",
    },
    purity: {
      plotType: "histogram",
      tumor_type: "tumor_type",
      format: ".2%",
      scaleX: "linear",
      scaleXFormat: ".0%",
      range: [0, 1],
    },
    ploidy: {
      plotType: "histogram",
      tumor_type: "tumor_type",
      format: ".2f",
      scaleX: "linear",
      scaleXFormat: "0.2f",
      range: [1.5, 5.5],
    },
    hrdScore: {
      plotType: "histogram",
      tumor_type: "tumor_type",
      format: "0.2%",
      scaleX: "linear",
      scaleXFormat: ".0%",
      range: [0, 1],
    },
    hrdB12Score: {
      plotType: "histogram",
      tumor_type: "tumor_type",
      format: "0.2%",
      scaleX: "linear",
      scaleXFormat: ".0%",
      range: [0, 1],
    },
    hrdB1Score: {
      plotType: "histogram",
      tumor_type: "tumor_type",
      format: "0.2%",
      scaleX: "linear",
      scaleXFormat: ".0%",
      range: [0, 1],
    },
    hrdB2Score: {
      plotType: "histogram",
      tumor_type: "tumor_type",
      format: "0.2%",
      scaleX: "linear",
      scaleXFormat: ".0%",
      range: [0, 1],
    },
    msiScore: {
      plotType: "histogram",
      tumor_type: "tumor_type",
      format: ".2%",
      scaleX: "linear",
      scaleXFormat: ".0%",
      range: [0, 1],
    },
  };
}

export function reportAttributesMap() {
  return {
    pair: "pair",
    tumor_type: "tumor",
    tumor_median_coverage: "tumor_median_coverage",
    normal_median_coverage: "normal_median_coverage",
    snv_count: "snvCount",
    sv_count: "svCount",
    tmb: "tmb",
    loh_fraction: "lohFraction",
    purity: "purity",
    ploidy: "ploidy",
    disease: "disease",
    inferred_sex: "sex",
    primary_site: "primary_site",
    beta: "beta",
    gamma: "gamma",
    cov_slope: "cov_slope",
    cov_intercept: "cov_intercept",
    methylation_beta_cov_slope: "methylation_beta_cov_slope",
    methylation_beta_cov_intercept: "methylation_beta_cov_intercept",
    methylation_intensity_cov_slope: "methylation_intensity_cov_slope",
    methylation_intensity_cov_intercept: "methylation_intensity_cov_intercept",
    hets_slope: "hets_slope",
    hets_intercept: "hets_intercept",
    loose_count: "loose_count",
    junction_count: "junction_count",
    sv_types_count: "sv_types_count",
    hrd: "hrd",
    coverage_qc: "coverage_qc",
    snv_count_normal_vaf_greater0: "snv_count_normal_vaf_greater0",
    signatures: "signatures",
    deletionInsertion: "deletionInsertion",
    sigprofiler_indel_fraction: "sigprofiler_indel_fraction",
    sigprofiler_indel_count: "sigprofiler_indel_count",
    sigprofiler_sbs_fraction: "sigprofiler_sbs_fraction",
    sigprofiler_sbs_count: "sigprofiler_sbs_count",
    sigprofiler_indel_cosine_similarity: "sigprofiler_indel_cosine_similarity",
    sigprofiler_sbs_cosine_similarity: "sigprofiler_sbs_cosine_similarity",
    msisensor: "msisensor",
    "msisensor.score": "msiScore",
    "hrd.hrd_score": "hrdScore",
    "hrd.b1_2_score": "hrdB12Score",
    "hrd.b1_score": "hrdB1Score",
    "hrd.b2_score": "hrdB2Score",
    summary: "summary",
  };
}

export function mutationCatalogMetadata() {
  return ["id", "type", "mutations", "mutationType", "label", "probability"];
}

export function reportFilters() {
  return [
    { name: "tags", type: "string", renderer: "cascader" },
    { name: "pair", type: "string", renderer: "select" },
    { name: "tumor_type", type: "string", renderer: "select" },
    { name: "disease", type: "string", renderer: "select" },
    { name: "primary_site", type: "string", renderer: "select" },
    { name: "inferred_sex", type: "string", renderer: "select" },
    {
      name: "tumor_median_coverage",
      type: "number",
      renderer: "slider",
      group: "quality-metrics",
    },
    {
      name: "purity",
      type: "number",
      renderer: "slider",
      group: "quality-metrics",
    },
    {
      name: "ploidy",
      type: "number",
      renderer: "slider",
      group: "quality-metrics",
    },
    {
      name: "snv_count",
      type: "number",
      renderer: "slider",
      group: "event-metrics",
    },
    {
      name: "sv_count",
      type: "number",
      renderer: "slider",
      group: "event-metrics",
    },
    {
      name: "loh_fraction",
      type: "number",
      renderer: "slider",
      group: "event-metrics",
    },
    {
      name: "tmb",
      type: "number",
      renderer: "slider",
      group: "biomarker-metrics",
    },
    {
      name: "hrd.hrd_score",
      type: "number",
      renderer: "slider",
      group: "biomarker-metrics",
    },
    {
      name: "msisensor.score",
      type: "number",
      renderer: "slider",
      group: "biomarker-metrics",
    },
    {
      name: "hrd.b1_2_score",
      type: "number",
      renderer: "slider",
      group: "biomarker-metrics",
    },
    {
      name: "hrd.b1_score",
      type: "number",
      renderer: "slider",
      group: "biomarker-metrics",
    },
    {
      name: "hrd.b2_score",
      type: "number",
      renderer: "slider",
      group: "biomarker-metrics",
    },
  ];
}

export function mutationFilterTypes() {
  return {
    sbs: ["C>A", "C>G", "C>T", "T>A", "T>C", "T>G"],
    indel: [
      "1DelC",
      "1DelT",
      "1InsC",
      "1InsT",
      "2DelR",
      "3DelR",
      "4DelR",
      "5DelR",
      "2InsR",
      "3InsR",
      "4InsR",
      "5InsR",
      "2DelM",
      "3DelM",
      "4DelM",
      "5DelM",
      "longDel",
      "longIns",
      "delMH",
      "delComplex",
    ],
  };
}

export function mutationsColorPalette() {
  return {
    "C>A": "#00BFFE",
    "C>G": "#000000",
    "C>T": "#CE2626",
    "T>A": "#BFBFBF",
    "T>C": "#9ACD34",
    "T>G": "#EEB4B3",
    "1DelC": "#FDBE6D",
    "1DelT": "#FC7F03",
    "1InsC": "#ACDB88",
    "1InsT": "#38A02E",
    "2DelR": "#FCC9B4",
    "3DelR": "#FC896A",
    "4DelR": "#EF4432",
    "5DelR": "#BC191A",
    "2InsR": "#CFE0F0",
    "3InsR": "#94C3DF",
    "4InsR": "#4B97C8",
    "5InsR": "#1764AA",
    "2DelM": "#E1E1EC",
    "3DelM": "#B5B5D7",
    "4DelM": "#8683BC",
    "5DelM": "#623F99",
    longDel: "#BE1819",
    longIns: "#1A65AC",
    delMH: "#614099",
    delComplex: "#E3E1EB",
  };
}

export function mutationsGroups() {
  return {
    "C>A": "Cmutation",
    "C>G": "Cmutation",
    "C>T": "Cmutation",
    "T>A": "Tmutation",
    "T>C": "Tmutation",
    "T>G": "Tmutation",
    "1DelC": "1Del",
    "1DelT": "1Del",
    "1InsC": "1Ins",
    "1InsT": "1Ins",
    "2DelR": "longDel",
    "3DelR": "longDel",
    "4DelR": "longDel",
    "5DelR": "longDel",
    "2InsR": "longIns",
    "3InsR": "longIns",
    "4InsR": "longIns",
    "5InsR": "longIns",
    "2DelM": "delMH",
    "3DelM": "delMH",
    "4DelM": "delMH",
    "5DelM": "delMH",
    longDel: "longDel",
    longIns: "longIns",
    delMH: "delMH",
    delComplex: "delComplex",
  };
}

export function snvplicityGroups() {
  return [
    { type: "somatic", mode: "altered" },
    { type: "somatic", mode: "total" },
    { type: "germline", mode: "altered" },
    { type: "germline", mode: "total" },
    { type: "hetsnps", mode: "major" },
    { type: "hetsnps", mode: "minor" },
  ];
}

export function binDataByCopyNumber(rawArray, binSize = 0.05) {
  // 1) Group data by `jabba_cn`
  const dataByCN = d3.group(rawArray, (d) => d.jabba_cn);

  // 2) Figure out min & max of `mult_cn` to define domain
  const minMult = d3.min(rawArray, (d) => d.mult_cn);
  const maxMult = d3.max(rawArray, (d) => d.mult_cn);

  // 3) Create a bin generator
  //    - .thresholds() expects an array of bin boundaries
  const binGenerator = d3
    .bin()
    .value((d) => d.mult_cn)
    .domain([minMult, maxMult])
    .thresholds(d3.range(minMult, maxMult, binSize));

  // 4) Build the final result
  let final = [];

  // For each distinct jabba_cn group
  for (const [jabbaCN, records] of dataByCN.entries()) {
    // bin the records based on `mult_cn`
    const bins = binGenerator(records);
    // Each bin is an array. bin.x0 and bin.x1 define the bin boundaries

    bins.forEach((bin, index) => {
      // sum up the "count" for everything that fell in this bin
      const totalCount = d3.sum(bin, (d) => d.count);

      // only push if there's at least one data point in the bin
      if (bin.length > 0) {
        final.push({
          index: `${index}-${jabbaCN}`,
          jabba_cn: jabbaCN,
          mult_cn_bin: [bin.x0, bin.x1], // an array of [lower, upper]
          count: totalCount,
        });
      }
    });
  }

  return final;
}

/**
 * Creates a color scale for copy-number values using schemeTableau10.
 * If there are more than 10 distinct values, we reuse the palette but
 * increasingly darken each subsequent group of 10.
 *
 * @param {number[]} cnValues - Array of numeric copy-number values.
 * @returns {d3.ScaleOrdinal<number, string>} A D3 ordinal scale mapping CN -> color.
 */
export function createCnColorScale(cnValues) {
  // 1) Remove duplicates and sort
  const distinctValues = Array.from(new Set(cnValues)).sort((a, b) => a - b);

  // 2) For each distinct CN, assign a color by cycling through schemeTableau10
  //    and darkening by 0.15 for each repeated lap.
  const basePalette = d3.schemeTableau10; // 10-element array of base colors
  const colorRange = distinctValues.map((cn, i) => {
    const baseColor = d3.color(basePalette[i % 10]);
    if (!baseColor) return basePalette[i % 10]; // Fallback if something is null

    // darker(...) each time we wrap around by 10
    const repeatCount = Math.floor(i / 10);
    const darkerColor = baseColor.darker(repeatCount * 0.15);

    return darkerColor.formatHex(); // e.g. "#abcdef"
  });

  // 3) Create the ordinal scale
  const colorScale = d3.scaleOrdinal().domain(distinctValues).range(colorRange);

  return colorScale;
}

export function coverageQCFields() {
  return [
    { variable: "percent_reads_mapped", format: ".1%" },
    { variable: "percent_gc", format: ".1%" },
    { variable: "greater_than_or_equal_to_30x", format: ".1%" },
    { variable: "greater_than_or_equal_to_50x", format: ".1%" },
    { variable: "insert_size", format: "d" },
    { variable: "percent_mapq_0_reads", format: ".1%" },
    { variable: "coverage_variance", format: ".1%" },
  ];
}
export function flip(data) {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [value, key])
  );
}

export function snakeCaseToHumanReadable(str) {
  return str
    ? str
        .toString()
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
    : "";
}

export function segmentAttributes() {
  return {
    iid: "",
    mean: ".4f",
    y: ",",
    chromosome: "",
    width: ",",
    startPoint: ",",
    endPoint: ",",
    raw_var: ".4f",
    nbins: ",",
    nbins_tot: ",",
    nbins_nafrac: ".4f",
    wbins_nafrac: ".4f",
    max_na: ".4f",
    loess_var: ".4f",
    tau_sq_post: ".4f",
    post_var: ".4f",
    var: ".4f",
    sd: ".4f",
  };
}

export function higlassGenesFieldsArrayToObject(fields, chromoBins) {
  /* Example Fields
# 0: chr (chr1)
# 1: txStart (52301201) [9]
# 2: txEnd (52317145) [10]
# 3: geneName (ACVRL1)   [2]
# 4: citationCount (123) [16]
# 5: strand (+)  [8]
# 6: refseqId (NM_000020)
# 7: geneId (94) [1]
# 8: geneType (protein-coding)
# 9: geneDesc (activin A receptor type II-like 1)
# 10: cdsStart (52306258)
# 11: cdsEnd (52314677)
# 12: exonStarts (52301201,52306253,52306882,52307342,52307757,52308222,52309008,52309819,52312768,52314542,)
# 13: exonEnds (52301479,52306319,52307134,52307554,52307857,52308369,52309284,52310017,52312899,52317145,)

*/
  let chromosome = fields[0].replaceAll("chr", "");
  let startPoint = +fields[1];
  let endPoint = +fields[2];
  let cdsStartPoint = +fields[10];
  let cdsEndPoint = +fields[11];
  return {
    chromosome,
    startPoint,
    endPoint,
    startPlace: chromoBins[chromosome].startPlace + startPoint - 1,
    endPlace: chromoBins[chromosome].startPlace + endPoint - 1,
    fillColor: chromoBins[chromosome].color,
    title: fields[3],
    importance: +fields[4],
    strand: fields[5],
    id: fields[6],
    internalId: fields[7],
    bioType: fields[8],
    description: fields[9],
    cdsStartPoint,
    cdsEndPoint,
    cdsStartPlace: chromoBins[chromosome].startPlace + cdsStartPoint - 1,
    cdsEndPlace: chromoBins[chromosome].startPlace + cdsEndPoint - 1,
    exons: fields[12].split(",").map((d, i) => {
      return {
        startPoint: +d,
        endPoint: +fields[13].split(",")[i],
        startPlace: chromoBins[chromosome].startPlace + +d - 1,
        endPlace:
          chromoBins[chromosome].startPlace + +fields[13].split(",")[i] - 1,
      };
    }),
  };
}

function transformFusionGeneCoords(fusionGeneCoords) {
  return fusionGeneCoords
    .split(",")
    .map((coord) => {
      const [chrom, positions] = coord.split(":");
      const [start, end] = positions.split("-");
      return `${chrom}:${start}-${chrom}:${end.replace(/[+-]$/, "")}`;
    })
    .join("|");
}

export function transformFilteredEventAttributes(filteredEvents) {
  return filteredEvents
    .map((event) => {
      let gene = event.gene;
      let location = null;
      let chromosome = null;
      let startPoint = null;
      let endPoint = null;
      let actualLocation = null;
      if (event.Genome_Location) {
        const regex = /^(\w+):(\d+)-(\d+).*/;
        let match = regex.exec(event.Genome_Location);
        chromosome = match[1];
        startPoint = match[2];
        endPoint = match[3];
        location = `${chromosome}:${startPoint}-${chromosome}:${endPoint}`;
        actualLocation = location;
        if (["SNV", "DEL"].includes(event.vartype)) {
          // center the SNV in the plot while encapsulating its gene in the
          // window
          try {
            const snvMatch = regex.exec(event.Variant_g);
            const snvStartPoint = parseInt(snvMatch[2]);
            const snvEndPoint = parseInt(snvMatch[3]);

            let padding = 250;
            startPoint = parseInt(snvStartPoint - padding);
            endPoint = parseInt(snvEndPoint + padding);
            location = event.Variant_g;
            actualLocation = `${chromosome}:${startPoint}-${chromosome}:${endPoint}`;
          } catch (error) {
            console.log(error);
          }
        } else if (event.vartype === "fusion") {
          gene = event.fusion_genes;
          try {
            location = event.fusion_gene_coords;
            actualLocation = transformFusionGeneCoords(
              event.fusion_gene_coords
            );
            chromosome = event.fusion_gene_coords
              .split(",")
              .map((d) => d.split(":")[0]);
            startPoint = event.fusion_gene_coords
              .split(",")
              .map((d) => d.split(":")[1].split("-")[0]);
            endPoint = event.fusion_gene_coords
              .split(",")
              .map((d) => d.split(":")[1].split("-")[1]);
          } catch (error) {
            console.log(error);
          }
        }
      }
      return {
        gene: gene,
        type: event.type,
        name: event.Name,
        tier: event.Tier,
        role: event.role,
        chromosome: chromosome,
        startPoint: startPoint,
        endPoint: endPoint,
        location: location,
        actualLocation: actualLocation,
        uid: actualLocation,
        id: event.id,
        variant: event.Variant,
        dosage: event.dosage,
        prognoses: event.prognoses,
        diagnoses: event.diagnoses,
        therapeutics: event.therapeutics,
        resistances: event.resistances,
        estimatedAlteredCopies: event.estimated_altered_copies,
        effect: event.effect,
        refCounts: event.ref,
        altCounts: event.alt,
        vaf: event.VAF,
        segmentCopyNumber: event.segment_cn,
        fusionCopyNumber: event.fusion_cn,
        variant_summary: event.variant_summary,
        gene_summary: event.gene_summary,
        effect_description: event.effect_description,
      };
    })
    .sort((a, b) => {
      // If `tier` is null or undefined, place that item at the end
      if (a.tier == null) return 1;
      if (b.tier == null) return -1;

      // Otherwise, sort by tier in ascending order
      return d3.ascending(+a.tier, +b.tier);
    });
}

export function kde(kernel, thresholds, data) {
  return thresholds.map((t) => [t, d3.mean(data, (d) => kernel(t - d))]);
}

export function epanechnikov(bandwidth) {
  return (x) =>
    Math.abs((x /= bandwidth)) <= 1 ? (0.75 * (1 - x * x)) / bandwidth : 0;
}

export function sequencesToGenome(ppfit) {
  return {
    settings: ppfit.settings,
    intervals: ppfit.intervals
      .filter((d) => !d.metadata.bad)
      .filter((d) => d.endPoint - d.startPoint >= 10000)
      .map((d, i) => {
        return {
          iid: d.iid,
          chromosome: d.chromosome,
          startPoint: d.startPoint,
          endPoint: d.endPoint,
          y: d.y,
          cn: d.y,
          type: "interval",
          strand: d.strand,
          title: d.title,
          ...d.metadata,
          metadata: { ...d.metadata, width: d.endPoint - d.startPoint },
        };
      }),
    connections: ppfit.connections,
  };
}

export function allelicToGenome(allelic) {
  allelic.intervals.forEach((interval1, i) => {
    allelic.intervals.forEach((interval2, j) => {
      if (
        i !== j &&
        interval1.chromosome === interval2.chromosome &&
        interval1.startPoint === interval2.startPoint &&
        interval1.y === interval2.y &&
        interval1.endPoint === interval2.endPoint
      ) {
        interval1.overlapping = true;
        interval2.overlapping = true;
        interval1.metadata.overlaps_with = interval2.iid;
        interval2.metadata.overlaps_with = interval2.iid;
      }
    });
  });
  return {
    settings: allelic.settings,
    intervals: allelic.intervals,
    connections: allelic.connections,
  };
}

export function getPopulationMetrics(
  populations,
  metadata = {},
  tumour_type = null
) {
  // Extract the data from the responses and store it in an object
  return Object.keys(plotTypes()).map((d, i) => {
    let plot = {};
    let cutoff = Infinity;
    plot.id = d;
    plot.type = plotTypes()[d].plotType;
    plot.scaleX = plotTypes()[d].scaleX;
    plot.allData = populations[d].map((e) => +e.value);
    plot.data = populations[d]
      .filter((e) =>
        tumour_type ? e[plotTypes()[d].tumor_type] === tumour_type : true
      )
      .map((e) => +e.value)
      .filter((e) => e < cutoff)
      .sort((a, b) => d3.ascending(a, b));
    plot.bandwidth = Math.pow(
      (4 * Math.pow(d3.deviation(plot.data), 5)) / (3.0 * plot.data.length),
      0.2
    );
    plot.q1 = d3.quantile(plot.data, 0.25);
    plot.q3 = d3.quantile(plot.data, 0.75);
    plot.q99 = d3.quantile(plot.data, 0.99);
    plot.range = plotTypes()[d].range || [
      d3.max([d3.min(plot.allData), 0.01]),
      d3.quantile(plot.allData, 0.99),
    ];
    plot.format = plotTypes()[d].scaleXFormat;
    if (metadata[d]) {
      plot.markValue = metadata[d];
      plot.markValueText = d3.format(plotTypes()[d].format)(metadata[d]);
      plot.colorMarker =
        plot.markValue < plot.q1
          ? legendColors()[0]
          : plot.markValue > plot.q3
          ? legendColors()[2]
          : legendColors()[1];
    }
    return plot;
  });
}

export function getSignatureMetrics(
  populations,
  props = {
    range: null,
    markData: {},
    tumorType: null,
    format: "0.4f",
    scaleX: "linear",
    type: "histogram",
  }
) {
  const { range, markData, tumorType, type, format, scaleX } = props;
  // Extract the data from the responses and store it in an object
  return Object.keys(populations)
    .map((d, i) => {
      let plot = {};
      let cutoff = Infinity;
      plot.id = d;
      plot.type = type;
      plot.scaleX = scaleX;
      plot.allData = populations[d].map((e) => +e.value);
      plot.data = populations[d]
        .filter((e) =>
          tumorType ? !e.tumor_type || e.tumor_type === tumorType : true
        )
        .map((d) => +d.value)
        .filter((d) => d < cutoff)
        .sort((a, b) => d3.ascending(a, b));
      plot.bandwidth = Math.pow(
        (4 * Math.pow(d3.deviation(plot.data), 5)) / (3.0 * plot.data.length),
        0.15
      );
      plot.q1 = d3.quantile(plot.data, 0.25);
      plot.q3 = d3.quantile(plot.data, 0.75);
      plot.q99 = d3.quantile(plot.data, 0.99);
      let minValue = scaleX === "log" ? 1 : 0;
      let maxValue = d3.max([
        plot.allData.find((e) => e > 0),
        d3.quantile(plot.data, 0.8),
      ]);
      plot.range = range ? range : [minValue, maxValue];
      plot.format = format;
      if (Object.keys(markData).includes(d)) {
        plot.markValue = +markData[d];
        plot.markValueText = d3.format(format)(markData[d]);
        plot.colorMarker =
          plot.markValue < plot.q1
            ? legendColors()[0]
            : plot.markValue > plot.q3
            ? legendColors()[2]
            : legendColors()[1];
      }
      return plot;
    })
    .sort((a, b) => d3.descending(a.markValue, b.markValue));
}

// Function to calculate optimum number of bins using Doane's rule
export function calculateOptimalBins(data) {
  const n = data.length;

  // Calculate skewness
  const mean = data.reduce((acc, val) => acc + val, 0) / n;
  const variance =
    data.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);
  const skewness =
    data.reduce((acc, val) => acc + Math.pow((val - mean) / stdDev, 3), 0) / n;

  // Calculate bins using Doane's rule
  const k = 1 + Math.log2(n) + Math.log2(1 + Math.abs(skewness));

  return Math.ceil(k);
}

export function parseCosmicSignatureWeightMatrix(matrixText) {
  const lines = matrixText.trim().split("\n");
  const headers = lines[0].split(/\s+/).slice(1);
  const matrix = {};

  headers.forEach((sig) => {
    if (sig !== "") {
      matrix[sig] = {};
    }
  });

  lines.slice(1).forEach((line) => {
    const [tnc, ...weights] = line.split(/\s+/);
    headers.forEach((sig, index) => {
      if (sig !== "") {
        matrix[sig][tnc] = parseFloat(weights[index]);
      }
    });
  });

  return matrix;
}

export function Legend(
  color,
  {
    title,
    tickSize = 6,
    width = 320,
    height = 44 + tickSize,
    marginTop = 18,
    marginRight = 0,
    marginBottom = 16 + tickSize,
    marginLeft = 0,
    ticks = width / 64,
    tickFormat,
    tickValues,
  } = {}
) {
  function ramp(color, n = 256) {
    const canvas = document.createElement("canvas");
    canvas.width = n;
    canvas.height = 1;
    const context = canvas.getContext("2d");
    for (let i = 0; i < n; ++i) {
      context.fillStyle = color(i / (n - 1));
      context.fillRect(i, 0, 1, 1);
    }
    return canvas;
  }

  const svg = d3
    .create("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", [0, 0, width, height])
    .style("overflow", "visible")
    .style("display", "block");

  let tickAdjust = (g) =>
    g.selectAll(".tick line").attr("y1", marginTop + marginBottom - height);
  let x;

  // Continuous
  if (color.interpolate) {
    const n = Math.min(color.domain().length, color.range().length);

    x = color
      .copy()
      .rangeRound(
        d3.quantize(d3.interpolate(marginLeft, width - marginRight), n)
      );

    svg
      .append("image")
      .attr("x", marginLeft)
      .attr("y", marginTop)
      .attr("width", width - marginLeft - marginRight)
      .attr("height", height - marginTop - marginBottom)
      .attr("preserveAspectRatio", "none")
      .attr(
        "href",
        ramp(
          color.copy().domain(d3.quantize(d3.interpolate(0, 1), n))
        ).toDataURL()
      );
  }

  // Sequential
  else if (color.interpolator) {
    x = Object.assign(
      color
        .copy()
        .interpolator(d3.interpolateRound(marginLeft, width - marginRight)),
      {
        range() {
          return [marginLeft, width - marginRight];
        },
      }
    );

    svg
      .append("image")
      .attr("x", marginLeft)
      .attr("y", marginTop)
      .attr("width", width - marginLeft - marginRight)
      .attr("height", height - marginTop - marginBottom)
      .attr("preserveAspectRatio", "none")
      .attr("href", ramp(color.interpolator()).toDataURL());

    // scaleSequentialQuantile doesn’t implement ticks or tickFormat.
    if (!x.ticks) {
      if (tickValues === undefined) {
        const n = Math.round(ticks + 1);
        tickValues = d3
          .range(n)
          .map((i) => d3.quantile(color.domain(), i / (n - 1)));
      }
      if (typeof tickFormat !== "function") {
        tickFormat = d3.format(tickFormat === undefined ? ",f" : tickFormat);
      }
    }
  }

  // Threshold
  else if (color.invertExtent) {
    const thresholds = color.thresholds
      ? color.thresholds() // scaleQuantize
      : color.quantiles
      ? color.quantiles() // scaleQuantile
      : color.domain(); // scaleThreshold

    const thresholdFormat =
      tickFormat === undefined
        ? (d) => d
        : typeof tickFormat === "string"
        ? d3.format(tickFormat)
        : tickFormat;

    x = d3
      .scaleLinear()
      .domain([-1, color.range().length - 1])
      .rangeRound([marginLeft, width - marginRight]);

    svg
      .append("g")
      .selectAll("rect")
      .data(color.range())
      .join("rect")
      .attr("x", (d, i) => x(i - 1))
      .attr("y", marginTop)
      .attr("width", (d, i) => x(i) - x(i - 1))
      .attr("height", height - marginTop - marginBottom)
      .attr("fill", (d) => d);

    tickValues = d3.range(thresholds.length);
    tickFormat = (i) => thresholdFormat(thresholds[i], i);
  }

  // Ordinal
  else {
    x = d3
      .scaleBand()
      .domain(color.domain())
      .rangeRound([marginLeft, width - marginRight])
      .padding(0.1);

    svg
      .append("g")
      .selectAll("rect")
      .data(color.domain())
      .join("rect")
      .attr("x", x)
      .attr("y", marginTop)
      .attr("width", Math.max(0, x.bandwidth() - 1))
      .attr("height", height - marginTop - marginBottom)
      .attr("fill", color);

    tickAdjust = () => {};
  }

  svg
    .append("g")
    .attr("transform", `translate(0,${height - marginBottom})`)
    .call(
      d3
        .axisBottom(x)
        .ticks(ticks, typeof tickFormat === "string" ? tickFormat : undefined)
        .tickFormat(typeof tickFormat === "function" ? tickFormat : undefined)
        .tickSize(tickSize)
        .tickValues(tickValues)
    )
    .call(tickAdjust)
    .call((g) => g.select(".domain").remove())
    .call((g) =>
      g
        .append("text")
        .attr("x", marginLeft)
        .attr("y", marginTop + marginBottom - height - 6)
        .attr("fill", "currentColor")
        .attr("text-anchor", "start")
        .attr("font-weight", "bold")
        .attr("class", "title")
        .text(title)
    );

  return svg.node();
}
