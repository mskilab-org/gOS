const valueFormats = {
  hrd_score: ".4f",
  hrdB12Score: ".3f",
  b1_2_score: ".3f",
  b1_score: ".3f",
  b2_score: ".3f",
  wt_score: ".3f",
  DUP_1kb_100kb: ",.2",
  qrppos: ",",
  qrpmin: ",",
  qrpmix: ",",
  qrdup: ",",
  qrdel: ",",
  tib: ",",
  ihdel: ",",
  del_mh_prop: ".2%",
  loh_score: ".3f",
  SNV3: ".2f",
  SNV8: ".2f",
  RS3: ".2f",
  RS5: ".2f",
  tyfonas: ",",
  dm: ",",
  bfb: ",",
  cpxdm: ",",
  chromothripsis: ",",
  chromoplexy: ",",
  tic: ",",
  rigma: ",",
  pyrgo: ",",
  del: ",",
  dup: ",",
  inv: ",",
  simple: ",",
  tra: ",",
  "DEL-like": ",",
  "DUP-like": ",",
  "INV-like": ",",
  "TRA-like": ",",
  coverage_variance: ".2f",
  tumor_median_coverage: ",",
  snvCount: ",",
  svCount: ",",
  tmb: ",",
  lohFraction: ".3",
  purity: ".2f",
  ploidy: ".2f",
  "msisensor.score": ".2%",
  "msisensor.n_unstable": ",",
  "msisensor.n_evaluated": ",",
  "msisensor.label": "",
};

export const hrdFields = [
  "hrd_score",
  "b1_2_score",
  "b1_score",
  "b2_score",
  "wt_score",
  "DUP_1kb_100kb",
  "qrppos",
  "qrpmin",
  "qrpmix",
  "qrdup",
  "qrdel",
  "tib",
  "ihdel",
  "del_mh_prop",
  "loh_score",
  "SNV3",
  "SNV8",
  "RS3",
  "RS5",
];

export const svCountFields = [
  "tyfonas",
  "dm",
  "bfb",
  "cpxdm",
  "chromothripsis",
  "chromoplexy",
  "tic",
  "rigma",
  "pyrgo",
  "del",
  "dup",
  "simple",
  "DEL-like",
  "DUP-like",
  "INV-like",
  "TRA-like",
];

export const msiFields = ["score", "n_unstable", "n_evaluated", "label"];

export const chartTypes = {
  coverage: "histogram",
  snvCount: "histogram",
  svCount: "histogram",
  hrdB12Score: "histogram",
  tmb: "histogram",
  lohFraction: "histogram",
  purity: "histogram",
  ploidy: "histogram",
};

export const headerList = [
  "tumor_median_coverage",
  "snvCount",
  "svCount",
  "hrdB12Score",
  "msiLabel",
  "tmb",
  "lohFraction",
];

export function valueFormat(value) {
  return valueFormats[value] || ".2f";
}
