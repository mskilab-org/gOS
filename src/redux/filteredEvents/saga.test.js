/** @jest-environment node */
/* eslint-disable import/first */

// Exercise real ingestion without loading plotting dependencies or patient data.
jest.mock("d3", () => ({
  ascending: (a, b) => (a < b ? -1 : a > b ? 1 : 0),
}));
jest.mock("../../helpers/connection", () => class Connection {});
jest.mock("../../helpers/interval", () => class Interval {});

import axios from "axios";
import { runSaga, stdChannel } from "redux-saga";
import filteredEventsSaga from "./saga";
import actions from "./actions";
import reducer from "./reducer";
import { getDefaultSelectedEventUids } from "./selectors";

jest.mock("../../helpers/userAuth", () => ({ getCurrentUserId: () => null }));

test("loads all supplied events without imposing pillar or germline classifications", async () => {
  const previousDocument = global.document;
  global.document = { location: "http://localhost/?case=case-1" };
  const source = Object.freeze([
    { id: "germline", origin: "germline", pillar: "unsettled", Tier: 3 },
    { id: "somatic", origin: "non-germline", pillar: "other", Tier: 1 },
    { id: "uncertain", origin: "uncertain", pillar: "unsettled", Tier: 2 },
    { id: "untiered", origin: null, pillar: null, Tier: null },
    { id: "additional-tier", Tier: 4 },
  ].map((event, index) => Object.freeze({
    ...event,
    gene: `GENE${index}`,
    type: "SNV",
    vartype: "SNV",
    Genome_Location: "1:1-1000",
    Variant_g: `1:${100 + index}-${100 + index} A>G`,
    Variant: `p.V${index}A`,
  })));
  const get = jest.spyOn(axios, "get").mockResolvedValue({ data: source });
  const channel = stdChannel();
  let finish;
  const outcome = new Promise((resolve) => { finish = resolve; });
  let state = {
    Settings: { dataset: { id: "dataset-1", dataPath: "/data/" } },
    CaseReport: { id: "case-1" },
    FilteredEvents: reducer(undefined, actions.fetchFilteredEvents()),
  };
  const task = runSaga({
    channel,
    getState: () => state,
    dispatch: (action) => {
      state = { ...state, FilteredEvents: reducer(state.FilteredEvents, action) };
      finish(action);
    },
    onError: finish,
  }, filteredEventsSaga);

  try {
    channel.put(actions.fetchFilteredEvents());
    const result = await outcome;
    expect(result.type).toBe(actions.FETCH_FILTERED_EVENTS_SUCCESS);
    expect(get).toHaveBeenCalledWith("/data/case-1/filtered.events.json", expect.any(Object));
    expect(state.FilteredEvents.columnFilters).toEqual({});
    expect(result.filteredEvents).toHaveLength(source.length);
    source.forEach((event) => {
      const loaded = result.filteredEvents.find((record) => record.id === event.id);
      expect(loaded).toMatchObject(event);
      expect(loaded.tier).toBe(event.Tier);
    });
    expect(state.FilteredEvents.originalFilteredEvents).toEqual(result.filteredEvents);
    // Loading every row does not automatically add every row to the report.
    expect(getDefaultSelectedEventUids(result.filteredEvents)).toEqual([
      result.filteredEvents.find((event) => event.id === "somatic").uid,
      result.filteredEvents.find((event) => event.id === "uncertain").uid,
    ]);
  } finally {
    task.cancel();
    channel.close();
    await task.toPromise();
    get.mockRestore();
    if (previousDocument === undefined) delete global.document;
    else global.document = previousDocument;
  }
});
