import actions from "./actions";

const initState = {
  loading: false,
  filename: "hetsnps.arrow",
  data: null,
  error: null,
};

export default function appReducer(state = initState, action) {
  switch (action.type) {
    case actions.FETCH_HETSNPS_DATA_REQUEST:
      return {
        ...state,
        data: null,
        error: null,
        loading: true,
      };
    case actions.FETCH_HETSNPS_DATA_SUCCESS:
      return {
        ...state,
        data: action.data,
        loading: false,
      };
    case actions.FETCH_HETSNPS_DATA_FAILED:
      return {
        ...state,
        error: action.error,
        loading: false,
      };
    default:
      return state;
  }
}
