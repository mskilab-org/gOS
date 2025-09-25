import { all, takeEvery, put, select, take, call } from "redux-saga/effects";
import axios from "axios";
import {
  getSignatureMetrics,
  nucleotideMutationText,
  deletionInsertionMutationVariant,
  mutationsGroups,
} from "../../helpers/utility";
import { getCurrentState } from "./selectors";
import * as d3 from "d3";
import actions from "./actions";
import caseReportActions from "../caseReport/actions";
import signatureProfilesActions from "../signatureProfiles/actions";
import { getCancelToken } from "../../helpers/cancelToken";

function* fetchData(action) {
  let errors = [];
  try {
    const currentState = yield select(getCurrentState);
    let { signatures, signaturesReference } = currentState.SignatureProfiles;
    const { dataset } = currentState.Settings;
    const { id, metadata } = currentState.CaseReport;
    const { sigprofiler_sbs_count, sigprofiler_indel_count } = metadata;

    let signatureMetrics = {
      indel: { count: [], fraction: [] },
      sbs: { count: [], fraction: [] },
    };
    let tumorSignatureMetrics = {
      indel: { count: [], fraction: [] },
      sbs: { count: [], fraction: [] },
    };
    let mutationCatalog = [];
    let decomposedCatalog = [];
    let referenceCatalog = [];

    const requiredFiles = [
      `${dataset.dataPath}${id}/mutation_catalog.json`,
      `${dataset.dataPath}${id}/id_mutation_catalog.json`,
      `${dataset.dataPath}${id}/sbs_decomposed_prob.json`,
      `${dataset.dataPath}${id}/id_decomposed_prob.json`,
    ];

    let missing = false;
    for (let file of requiredFiles) {
      try {
        yield call(axios.head, file);
      } catch (e) {
        missing = true;
        break;
      }
    }
    if (missing) {
      yield put({
        type: actions.FETCH_SIGNATURE_STATISTICS_MISSING,
        missing: true,
      });
      return;
    }

    Object.keys(signatures).forEach((type) => {
      signatureMetrics[type] = {};
      Object.keys(signatures[type]).forEach((mode) => {
        signatureMetrics[type][mode] = getSignatureMetrics(
          signatures[type][mode],
          {
            markData: metadata[`sigprofiler_${type}_${mode}`],
            format: mode === "fraction" ? ".4f" : ",",
            range: mode === "fraction" ? [0, 1] : null,
            scaleX: "linear",
            type: "histogram",
          }
        );
      });
    });

    Object.keys(signatures).forEach((type) => {
      tumorSignatureMetrics[type] = {};
      Object.keys(signatures[type]).forEach((mode) => {
        tumorSignatureMetrics[type][mode] = getSignatureMetrics(
          signatures[type][mode],
          {
            markData: metadata[`sigprofiler_${type}_${mode}`],
            tumorType: metadata.tumor,
            format: mode === "fraction" ? ".4f" : ",",
            range: mode === "fraction" ? [0, 1] : null,
          }
        );
      });
    });

    try {
      yield axios
        .all(
          ["", "id_"].map((e) =>
            axios.get(`${dataset.dataPath}${id}/${e}mutation_catalog.json`)
          ),
          { cancelToken: getCancelToken() }
        )
        .then(
          axios.spread((...responses) => {
            responses.forEach((d, i) => {
              if (i < 1) {
                let data = d.data.data || [];
                data.forEach((d, i) => {
                  d.type = d.tnc;
                  d.mutationType = (d.tnc?.match(/\[(.*?)\]/) || [])[1];
                  d.variantType = "sbs";
                  d.group = mutationsGroups()[d.mutationType];
                  d.label = nucleotideMutationText(d.tnc);
                  d.probability = 1.0;
                  mutationCatalog.push(d);
                });
              } else {
                let data = d.data.data || [];
                data.forEach((d, i) => {
                  let { variant, label } = deletionInsertionMutationVariant(
                    d.insdel
                  );
                  d.type = d.insdel;
                  d.mutationType = variant;
                  d.group = mutationsGroups()[d.mutationType];
                  d.variantType = "indel";
                  d.label = label;
                  d.probability = 1.0;
                  if (variant) {
                    mutationCatalog.push(d);
                  }
                });
              }
            });
            mutationCatalog = mutationCatalog.sort((a, b) =>
              d3.ascending(a.mutationType, b.mutationType)
            );
          })
        )
        .catch((err) => {
          if (axios.isCancel(err)) {
            console.log(
              `fetch mutation_catalog.json or id_mutation_catalog.json request canceled`,
              err.message
            );
          } else {
            console.log("got errors on loading mutation catalogs", err);
            errors.push(
              `got errors on loading mutation_catalog.json or id_mutation_catalog.json: ${err}`
            );
          }
        });
    } catch (err) {
      console.log("General error on signature Statistics", err);
      errors.push(err);
    }

    try {
      yield axios
        .all(
          ["sbs", "id"].map((e) =>
            axios.get(`${dataset.dataPath}${id}/${e}_decomposed_prob.json`)
          ),
          { cancelToken: getCancelToken() }
        )
        .then(
          axios.spread((...responses) => {
            responses.forEach((d, i) => {
              let data = d.data || [];
              if (i < 1) {
                Object.entries(sigprofiler_sbs_count).forEach(
                  ([signature, value]) => {
                    if (value > 0) {
                      decomposedCatalog.push({
                        id: signature,
                        variantType: "sbs",
                        count: value,
                        catalog: data
                          .filter((e) => e.signature === signature)
                          .map((d, i) => {
                            let mutationGlobalValue =
                              mutationCatalog.find(
                                (k) =>
                                  k.variantType === "sbs" && k.type === d.tnc
                              )?.mutations || 0;
                            let entry = {
                              id: `sbs-${signature}-${i}`,
                              signature: d.signature,
                              probability: d.p,
                              mutations: Math.round(d.p * mutationGlobalValue),
                              type: d.tnc,
                              mutationType: (d.tnc?.match(/\[(.*?)\]/) ||
                                [])[1],
                              variantType: "sbs",
                              label: nucleotideMutationText(d.tnc),
                              group:
                                mutationsGroups()[
                                  (d.tnc?.match(/\[(.*?)\]/) || [])[1]
                                ],
                            };
                            return entry;
                          })
                          .sort((a, b) =>
                            d3.ascending(a.mutationType, b.mutationType)
                          ),
                      });
                    }
                  }
                );
              } else {
                Object.entries(sigprofiler_indel_count).forEach(
                  ([signature, value]) => {
                    if (value > 0) {
                      decomposedCatalog.push({
                        id: signature,
                        variantType: "indel",
                        count: value,
                        catalog: data
                          .filter((e) => e.signature === signature)
                          .map((d, i) => {
                            let { variant, label } =
                              deletionInsertionMutationVariant(d.insdel);
                            let mutationGlobalValue =
                              mutationCatalog.find(
                                (k) =>
                                  k.variantType === "indel" &&
                                  k.type === d.insdel
                              )?.mutations || 0;
                            let entry = {
                              id: `indel-${signature}-${i}`,
                              variant,
                              label,
                              signature: d.signature,
                              probability: d.p,
                              mutations: Math.round(d.p * mutationGlobalValue),
                              type: d.insdel,
                              group: mutationsGroups()[variant],
                              mutationType: variant,
                              variantType: "indel",
                            };
                            return entry;
                          })
                          .filter((e) => e.variant)
                          .sort((a, b) =>
                            d3.ascending(a.mutationType, b.mutationType)
                          ),
                      });
                    }
                  }
                );
              }
            });
          })
        )
        .catch((err) => {
          if (axios.isCancel(err)) {
            console.log(
              `fetch sbs_decomposed_prob.json or id_decomposed_prob.json request canceled`,
              err.message
            );
          } else {
            console.log("got errors on loading mutation catalogs", err);
            errors.push(
              `got errors on loading sbs_decomposed_prob.json or id_decomposed_prob.json: ${err}`
            );
          }
        });
    } catch (err) {
      console.log(err);
      errors.push(err);
    }

    // mutation catalog for reference weights for sbs
    Object.entries(sigprofiler_sbs_count).forEach(([signature, value]) => {
      if (signaturesReference.sbs[signature] && value > 0) {
        referenceCatalog.push({
          id: signature,
          variantType: "sbs",
          count: value,
          catalog: signaturesReference.sbs[signature]
            .map((d, i) => {
              let entry = {
                id: `sbs-${signature}-ref-${i}`,
                signature,
                probability: d.value,
                mutations: Math.round(d.value * value),
                type: d.tnc,
                mutationType: (d.tnc?.match(/\[(.*?)\]/) || [])[1],
                variantType: "sbs",
                label: nucleotideMutationText(d.tnc),
              };
              return entry;
            })
            .sort((a, b) => d3.ascending(a.mutationType, b.mutationType)),
        });
      }
    });

    // mutation catalog for reference weights for indels
    Object.entries(sigprofiler_indel_count).forEach(([signature, value]) => {
      if (signaturesReference.indel[signature] && value > 0) {
        referenceCatalog.push({
          id: signature,
          variantType: "indel",
          count: value,
          catalog: signaturesReference.indel[signature]
            .map((d, i) => {
              let { variant, label } = deletionInsertionMutationVariant(d.tnc);
              let entry = {
                id: `indel-${signature}-ref-${i}`,
                variant,
                label,
                signature,
                probability: d.value,
                mutations: Math.round(d.value * value),
                type: d.tnc,
                mutationType: variant,
                variantType: "indel",
              };
              return entry;
            })
            .filter((e) => e.variant)
            .sort((a, b) => d3.ascending(a.mutationType, b.mutationType)),
        });
      }
    });

    if (errors.length < 1) {
      yield put({
        type: actions.FETCH_SIGNATURE_STATISTICS_SUCCESS,
        signatureMetrics,
        tumorSignatureMetrics,
        mutationCatalog,
        decomposedCatalog,
        referenceCatalog,
      });
    } else {
      yield put({
        type: actions.FETCH_SIGNATURE_STATISTICS_FAILED,
        error: errors.join(","),
      });
    }
  } catch (error) {
    yield put({
      type: actions.FETCH_SIGNATURE_STATISTICS_FAILED,
      error,
    });
  }
}

function* watchForMultipleActions() {
  yield all([
    take(signatureProfilesActions.FETCH_SIGNATURE_PROFILES_SUCCESS),
    take(caseReportActions.FETCH_CASE_REPORT_SUCCESS),
  ]);

  yield put({
    type: actions.FETCH_SIGNATURE_STATISTICS_REQUEST,
  });
}

function* actionWatcher() {
  yield takeEvery(actions.FETCH_SIGNATURE_STATISTICS_REQUEST, fetchData);
}
export default function* rootSaga() {
  yield all([actionWatcher(), watchForMultipleActions()]);
}
