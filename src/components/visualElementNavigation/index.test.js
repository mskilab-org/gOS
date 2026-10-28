import React from "react";
import { render, waitFor } from "@testing-library/react";
import VisualElementNavigation from ".";

it("scrolls to a plot that mounts after the initial report navigation", async () => {
  window.history.replaceState({}, "", "/?tab=2#visual-allelic");
  const view = render(<VisualElementNavigation caseId="P" tab="2" />);
  const target = document.createElement("div");
  target.id = "visual-allelic";
  target.getClientRects = () => [{}];
  target.scrollIntoView = jest.fn();
  document.body.appendChild(target);
  await waitFor(() => expect(target.scrollIntoView).toHaveBeenCalledWith({ block: "start" }));
  view.unmount();
  target.remove();
  window.history.replaceState({}, "", "/");
});
