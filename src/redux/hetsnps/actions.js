const actions = {
  FETCH_HETSNPS_DATA_REQUEST: "FETCH_HETSNPS_DATA_REQUEST",
  FETCH_HETSNPS_DATA_SUCCESS: "FETCH_HETSNPS_DATA_SUCCESS",
  FETCH_HETSNPS_DATA_FAILED: "FETCH_HETSNPS_DATA_FAILED",

  fetchHetsnpsData: () => ({
    type: actions.FETCH_HETSNPS_DATA_REQUEST,
  }),
};

export default actions;
