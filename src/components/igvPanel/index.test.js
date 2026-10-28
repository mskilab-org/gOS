/** @jest-environment node */

jest.mock("react-redux", () => ({
  connect: () => (Component) => Component,
}));
jest.mock("react-i18next", () => ({
  withTranslation: () => (Component) => Component,
}));
jest.mock("react-in-viewport", () => (Component) => Component);
jest.mock("react-router-dom", () => ({ withRouter: (Component) => Component }));
jest.mock("../igvPlot", () => "IgvPlot");
jest.mock("../../assets/images/igv-logo.png", () => "igv-logo.png");
jest.mock("./index.style", () => "div");
jest.mock("html-to-image", () => ({}));
jest.mock("../../helpers/utility", () => ({
  domainsToLocation: jest.fn(() => ""),
  downloadCanvasAsPng: jest.fn(),
  transitionStyle: jest.fn(() => ({})),
}));
jest.mock("../../redux/settings/actions", () => ({
  __esModule: true,
  default: { updateDomains: jest.fn() },
}));

const { IgvPanel } = require("./index");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

describe("IgvPanel initial visibility", () => {
  it("honors an expanded default supplied by its event-plots owner", () => {
    expect(new IgvPanel({ defaultVisible: true }).state.visible).toBe(true);
  });

  it("stays collapsed when no expanded default is supplied", () => {
    expect(new IgvPanel({}).state.visible).toBe(false);
  });
});

it("renders an IGV configuration request failure without crashing the report", () => {
  const error = new Error("Request failed with status code 403");
  error.response = { status: 403 };
  const html = renderToStaticMarkup(
    React.createElement(IgvPanel, {
      error,
      dataset: { dataPath: "/data/" },
      id: "T___vs___N",
      missingFiles: [],
      domains: [[1, 100]],
      t: (key) => key,
    }),
  );
  expect(html).toContain("Request failed with status code 403");
});
