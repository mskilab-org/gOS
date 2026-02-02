/**
 * Determines the view mode for a coverage/pileups panel based on domain width
 * and whether the domain spans a single chromosome.
 * 
 * @param {Object} chromoBins - Chromosome bins with startPlace/endPlace
 * @param {Array} domain - [startPlace, endPlace] in genome-wide coordinates
 * @param {number} threshold - Maximum domain width (bp) to show pileup view (default: 5000)
 * @returns {{ mode: 'coverage' | 'pileup', chromosome: string | null, start: number | null, end: number | null }}
 */
export function getViewMode(chromoBins, domain, threshold = 5000) {
  if (!chromoBins || !domain || domain.length !== 2) {
    return { mode: 'coverage', chromosome: null, start: null, end: null };
  }

  const [domainStart, domainEnd] = domain;
  const width = domainEnd - domainStart;

  // If domain is wider than threshold, always show coverage
  if (width > threshold) {
    return { mode: 'coverage', chromosome: null, start: null, end: null };
  }

  // Find which chromosome(s) the domain spans
  let startChr = null;
  let endChr = null;
  let localStart = null;
  let localEnd = null;

  for (const [chr, bin] of Object.entries(chromoBins)) {
    // Check if domain start falls in this chromosome
    if (domainStart >= bin.startPlace && domainStart < bin.endPlace) {
      startChr = chr;
      localStart = domainStart - bin.startPlace + bin.startPoint;
    }
    // Check if domain end falls in this chromosome
    if (domainEnd > bin.startPlace && domainEnd <= bin.endPlace) {
      endChr = chr;
      localEnd = domainEnd - bin.startPlace + bin.startPoint;
    }
  }

  // If domain spans multiple chromosomes, show coverage
  if (startChr !== endChr || !startChr) {
    return { mode: 'coverage', chromosome: null, start: null, end: null };
  }

  // Single chromosome and within threshold - show pileup
  return {
    mode: 'pileup',
    chromosome: startChr,
    start: Math.floor(localStart),
    end: Math.ceil(localEnd),
  };
}

/**
 * Formats chromosome and coordinates into igv.js locus string.
 * @param {string} chromosome - Chromosome name (e.g., "1", "X")
 * @param {number} start - Start position (1-based)
 * @param {number} end - End position (1-based)
 * @returns {string} Locus string (e.g., "chr1:1000-2000")
 */
export function formatLocus(chromosome, start, end) {
  return `chr${chromosome}:${start}-${end}`;
}
