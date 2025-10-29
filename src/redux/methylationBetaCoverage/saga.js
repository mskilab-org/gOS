import { all, takeEvery, put, call, select } from "redux-saga/effects";
import { loadArrowTable } from "../../helpers/utility";
import axios from "axios";
import actions from "./actions";
import { getCurrentState } from "./selectors";
import { getCancelToken } from "../../helpers/cancelToken";

function* fetchArrowData(plot) {
  yield loadArrowTable(plot.path, getCancelToken())
    .then((results) => (plot.data = results))
    .catch((error) => {
      console.log(plot.path, error);
      plot.data = null;
    });
}

function* fetchData(action) {
  try {
    const currentState = yield select(getCurrentState);
    const { filename } = currentState.MethylationBetaCoverage;
    const { dataset } = currentState.Settings;
    const { id, metadata } = currentState.CaseReport;

    const filePath = `${dataset.dataPath}${id}/${filename}`;

    try {
      // Check if file exists using HEAD request
      yield call(axios.head, filePath);
    } catch (error) {
      // File doesn't exist or can't be accessed
      yield put({
        type: actions.FETCH_METHYLATION_BETA_DATA_MISSING,
        missing: true,
      });
      return; // Exit early
    }

    let plot = {
      path: filePath,
      data: null,
    };
    yield call(fetchArrowData, plot);

    let dataPointsCount = Array.from(plot.data.getChild("y").toArray());
    let dataPointsCopyNumber = dataPointsCount.map(
      (d) =>
        d * (metadata?.methylation_beta_cov_slope || 1) +
        (metadata?.methylation_beta_cov_intercept || 0)
    );
    let dataPointsX = null
    let dataPointsColor = Array.from(plot.data.getChild("color").toArray());

    let dataPointsX_hi = null;
    let dataPointsX_lo = null;
    if (plot.data.schema.fields.some(f => f.name === 'x_hi')) {
      dataPointsX_hi = Array.from(plot.data.getChild("x_hi").toArray());
      dataPointsX_lo = Array.from(plot.data.getChild("x_lo").toArray());
    }

    yield put({
      type: actions.FETCH_METHYLATION_BETA_DATA_SUCCESS,
      dataPointsCount,
      dataPointsCopyNumber,
      dataPointsX,
      dataPointsColor,
      dataPointsX_hi,
      dataPointsX_lo,
    });
  } catch (error) {
    yield put({
      type: actions.FETCH_METHYLATION_BETA_DATA_FAILED,
      error,
    });
  }
}

function* actionWatcher() {
  yield takeEvery(actions.FETCH_METHYLATION_BETA_DATA_REQUEST, fetchData);
}
export default function* rootSaga() {
  yield all([actionWatcher()]);
}
