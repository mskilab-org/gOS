const actions = {
  FETCH_COVERAGE_DATA_REQUEST: "FETCH_COVERAGE_DATA_REQUEST",
  FETCH_COVERAGE_DATA_SUCCESS: "FETCH_COVERAGE_DATA_SUCCESS",
  FETCH_COVERAGE_DATA_FAILED: "FETCH_COVERAGE_DATA_FAILED",

  fetchCoverageData: () => ({
    type: actions.FETCH_COVERAGE_DATA_REQUEST,
  }),
};

export default actions;
