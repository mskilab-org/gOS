import { useEffect, useState } from "react";
import axios from "axios";

export default function usePipelineInventory(path, revision = 0) {
  const [state, setState] = useState({
    path: null,
    loading: false,
    data: null,
    error: null,
  });
  useEffect(() => {
    if (!path) return undefined;
    const cancel = axios.CancelToken.source();
    let active = true;
    const load = async () => {
      try {
        const response = await axios.get(path, {
          cancelToken: cancel.token,
          params: { checked: Date.now() },
        });
        if (
          response.data?.schemaVersion !== 1 ||
          !Array.isArray(response.data.datasets)
        ) {
          throw new Error("Unsupported pipeline inventory format");
        }
        if (active)
          setState({ path, loading: false, data: response.data, error: null });
      } catch (error) {
        if (active && !axios.isCancel(error)) {
          setState({ path, loading: false, data: null, error });
        }
      }
    };
    setState({ path, loading: true, data: null, error: null });
    load();
    const timer = setInterval(load, 60000);
    return () => {
      active = false;
      clearInterval(timer);
      cancel.cancel();
    };
  }, [path, revision]);
  return state.path === path
    ? state
    : { loading: Boolean(path), data: null, error: null };
}
