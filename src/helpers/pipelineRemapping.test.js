/** @jest-environment node */
import { replacementOptions, remappingDocument } from "./pipelineRemapping";

it("uses an explicit case mapping for the TN entry and preserves the recorded path", () => {
  const catalog = {
    cases: {
      pair: {
        sources: {
          allelic_jabba_gg: [
            { path: "/original" },
            { path: "/rerun" },
            { path: "/original" },
          ],
        },
      },
    },
  };
  const inputs = { allelic_jabba_gg: "/rerun" };
  expect(replacementOptions(catalog, "pair___TN", inputs)).toEqual([]);
  const options = replacementOptions(catalog, "pair___TN", inputs, {
    pair___TN: "pair",
  });
  expect(options).toEqual([
    {
      column: "allelic_jabba_gg",
      fromPath: "/rerun",
      candidates: [{ path: "/original" }],
    },
  ]);
  expect(remappingDocument("test", "pair___TN", options, {}).changes).toEqual(
    [],
  );
  expect(
    remappingDocument("test", "pair___TN", options, {
      allelic_jabba_gg: "/original",
    }).changes,
  ).toEqual([
    { column: "allelic_jabba_gg", fromPath: "/rerun", toPath: "/original" },
  ]);
  expect(inputs.allelic_jabba_gg).toBe("/rerun");
});
