/** @jest-environment node */
/* eslint-disable import/first */

jest.mock("react-i18next", () => ({
  withTranslation: () => (Component) => Component,
}));
jest.mock("antd", () => ({
  Alert: "Alert",
  Button: "Button",
  Checkbox: "Checkbox",
  Modal: "Modal",
  Space: "Space",
  Spin: "Spin",
  Tabs: "Tabs",
  Tag: "Tag",
  Tooltip: "Tooltip",
  Typography: { Text: "Text" },
}));
jest.mock("@ant-design/icons", () => ({ LeftOutlined: "LeftOutlined", RightOutlined: "RightOutlined" }));
jest.mock("./reviewShortcuts", () => ({ getReviewShortcutAction: jest.fn() }));
jest.mock("../tracksModal", () => "TracksModal");
jest.mock("../alterationCard", () => "AlterationCard");
jest.mock("../../helpers/utility", () => ({
  roleColorMap: () => ({ oncogenic: "red", resistance: "blue" }),
}));
jest.mock("./index.style", () => "Wrapper");

import React from "react";
import { Modal, Spin, Tabs } from "antd";
import { FilteredEventDetailsModal } from "./index";
import { getReviewShortcutAction } from "./reviewShortcuts";

function findElementByType(node, type, predicate = () => true) {
  if (!React.isValidElement(node)) return null;
  if (node.type === type && predicate(node)) return node;

  for (const child of React.Children.toArray(node.props.children)) {
    const match = findElementByType(child, type, predicate);
    if (match) return match;
  }
  return null;
}

function reviewCheckboxes(modal) {
  return React.Children.toArray(modal.renderReviewControls().props.children)
    .map(child => findElementByType(child, "Checkbox"));
}

function modalProps(overrides = {}) {
  return {
    t: (key) => key,
    open: true,
    onClose: jest.fn(),
    afterOpenChange: jest.fn(),
    initialTab: "detail",
    record: { uid: "event-1", gene: "TP53" },
    genome: { loading: false },
    ...overrides,
  };
}

function createModal(overrides = {}) {
  const modal = new FilteredEventDetailsModal(modalProps(overrides));
  modal.setState = (update) => {
    const nextState =
      typeof update === "function"
        ? update(modal.state, modal.props)
        : update;
    modal.state = { ...modal.state, ...nextState };
  };
  return modal;
}

describe("FilteredEventDetailsModal", () => {
  it("commits one lightweight shell before opening Plots", () => {
    const afterOpenChange = jest.fn();
    const modalComponent = createModal({
      initialTab: "tracks",
      afterOpenChange,
    });

    const view = modalComponent.render();
    const modal = findElementByType(view, Modal);

    expect(modal).not.toBeNull();
    expect(findElementByType(view, Spin)).not.toBeNull();
    expect(findElementByType(view, Tabs)).toBeNull();

    modal.props.afterOpenChange(true);

    const tabs = findElementByType(modalComponent.render(), Tabs);
    expect(afterOpenChange).toHaveBeenCalledWith(true);
    expect(tabs.props.activeKey).toBe("plots");
    expect(tabs.props.items.map(({ key }) => key)).toEqual([
      "plots",
      "alteration",
      "variantQc",
    ]);
    expect(tabs.props.items.map(({ label }) => label.props.children.props.children)).toEqual([
      "components.filtered-event-details-modal.tabs.plots",
      "components.filtered-event-details-modal.tabs.alteration",
      "components.filtered-event-details-modal.tabs.variantQc",
    ]);

    const plotsContent = tabs.props.items.find(
      ({ key }) => key === "plots",
    ).children;
    const tracks = findElementByType(plotsContent, "TracksModal");
    expect(tracks.props).toMatchObject({
      open: true,
      viewType: "inline",
      contentView: "plots",
      genome: { loading: false },
      selectedVariantId: "event-1",
    });
    expect(tracks.props).not.toHaveProperty("handleOkClicked");
    expect(tracks.props).not.toHaveProperty("handleCancelClicked");
    expect(tracks.props).not.toHaveProperty("modalTitle");
    expect(tracks.props).not.toHaveProperty("loading");
  });

  it("derives the ordered heading and role colors from the record", () => {
    const modalComponent = createModal({
      record: {
        uid: "event-1",
        gene: "TP53",
        name: "p.R248Q",
        type: "Missense",
        role: " oncogenic, resistance ",
        tier: 1,
        location: "17:7577539-7577539 G>A",
      },
    });

    const modal = findElementByType(modalComponent.render(), Modal);
    const headingParts = React.Children.toArray(
      modal.props.title.props.children,
    ).map((part) =>
      React.isValidElement(part)
        ? {
            type: part.type,
            label: part.props.children,
            color: part.props.color,
          }
        : part,
    );

    expect(headingParts).toEqual([
      "TP53",
      "p.R248Q",
      "Missense",
      { type: "Tag", label: "oncogenic", color: "red" },
      { type: "Tag", label: "resistance", color: "blue" },
      1,
      "17:7577539-7577539 G>A",
    ]);
    expect(modal.props.title).not.toBe("Report");
  });

  it("opens Alteration from detail mode and switches to Variant QC", () => {
    const modalComponent = createModal({ initialTab: "detail" });
    modalComponent.handleModalOpenChange(true);

    let tabs = findElementByType(modalComponent.render(), Tabs);
    const alteration = tabs.props.items.find(
      ({ key }) => key === "alteration",
    ).children;
    expect(tabs.props.activeKey).toBe("alteration");
    expect(alteration.type).toBe("AlterationCard");

    tabs.props.onChange("variantQc");
    tabs = findElementByType(modalComponent.render(), Tabs);
    const variantQcContent = tabs.props.items.find(
      ({ key }) => key === "variantQc",
    ).children;
    const variantQc = findElementByType(variantQcContent, "TracksModal");

    expect(tabs.props.activeKey).toBe("variantQc");
    expect(variantQc.props.contentView).toBe("variantQc");
    expect(
      tabs.props.items.find(({ key }) => key === "plots").children,
    ).toBeNull();
  });

  it("renders shortcut letters as AntD keyboard keycaps with readable tooltip color", () => {
    const modal = createModal();
    for (const keys of [[], ["u"], ["h", "l"]]) {
      const view = modal.renderShortcutHint("Action", keys);
      const [label, ...keycaps] = React.Children.toArray(view.props.children);
      expect(label.props.children).toBe("Action");
      expect(keycaps.map(element => element.props.children)).toEqual(keys);
      expect(keycaps.every(element => element.type === "Text" && element.props.keyboard && element.props.style.color === "inherit")).toBe(true);
    }
  });

  it("names the neighboring variants and navigates with the current modal tab", () => {
    const previous = { uid: "previous", gene: "FLT3", variant: "p.D835Y" };
    const next = { uid: "next", gene: "NPM1", variant: "p.W288fs" };
    const onNavigate = jest.fn();
    const modal = createModal({ navigation: { previous, next }, onNavigate });
    modal.handleTabChange("variantQc");
    const hints = React.Children.toArray(modal.renderNavigation().props.children);
    const buttons = hints.map(hint => findElementByType(hint, "Button"));
    expect(hints.every(hint => hint.type === "Tooltip" && hint.props.mouseEnterDelay === 0 && hint.props.mouseLeaveDelay === 0)).toBe(true);
    expect(hints.map(hint => React.Children.toArray(hint.props.title.props.children)[0].props.children)).toEqual([
      "components.filtered-event-details-modal.previous: FLT3 — p.D835Y",
      "components.filtered-event-details-modal.next: NPM1 — p.W288fs",
    ]);
    expect(hints.map(hint => findElementByType(hint.props.title, "Text").props.children)).toEqual(["k", "j"]);
    expect(buttons.every(button => button.props.title === undefined)).toBe(true);
    expect(buttons.map(button => findElementByType(button, "span").props.children)).toEqual(["FLT3 — p.D835Y", "NPM1 — p.W288fs"]);
    expect(buttons.map(button => button.props.type)).toEqual(["default", "default"]);
    expect(buttons.map(button => button.props.size)).toEqual(["small", "small"]);
    expect(buttons.map(button => button.props["aria-keyshortcuts"])).toEqual(["k ArrowLeft", "j ArrowRight"]);
    expect(findElementByType(buttons[0], "LeftOutlined")).not.toBeNull();
    expect(findElementByType(buttons[1], "RightOutlined")).not.toBeNull();
    buttons[1].props.onClick();
    expect(onNavigate).toHaveBeenCalledWith(next, "variantQc");
    buttons[0].props.onClick();
    expect(onNavigate).toHaveBeenLastCalledWith(previous, "variantQc");
  });

  it("disables missing neighbors and keeps navigation out of unrelated callers", () => {
    expect(createModal().renderNavigation()).toBeNull();
    const modal = createModal({ navigation: { previous: null, next: null }, onNavigate: jest.fn() });
    const buttons = React.Children.toArray(modal.renderNavigation().props.children).map(hint => findElementByType(hint, "Button"));
    expect(buttons.every(button => button.props.disabled)).toBe(true);
    expect(buttons.every(button => findElementByType(button, "span").props.children === "—")).toBe(true);
  });

  it.each(["plots", "alteration", "variantQc"])("preserves %s while changing records and retargets tab content", (tab) => {
    const modal = createModal();
    modal.handleModalOpenChange(true);
    modal.handleTabChange(tab);
    const previousProps = modal.props;
    modal.props = { ...previousProps, record: { uid: "event-2", gene: "KRAS" } };
    modal.componentDidUpdate(previousProps);
    expect(modal.state.activeTab).toBe(tab);
    expect(modal.state.contentReady).toBe(true);
    const view = modal.renderTabContent(tab);
    const selectedId = tab === "alteration" ? view.props.record.uid :
      findElementByType(view, "TracksModal").props.selectedVariantId;
    expect(selectedId).toBe("event-2");
  });

  it.each(["plots", "variantQc"])("protects focused genome/QC controls in %s from shortcuts", tab => {
    const view = createModal().renderTabContent(tab);
    expect(view.props["data-variant-review-shortcuts"]).toBe("off");
  });

  it("captures eligible arrows before tabs and dispatches the latest neighbor with the active tab", () => {
    const next = { uid: "next" };
    const previous = { uid: "previous" };
    const onNavigate = jest.fn();
    const modal = createModal({ navigation: { previous, next }, onNavigate });
    modal.handleModalOpenChange(true);
    modal.handleTabChange("variantQc");
    const event = { preventDefault: jest.fn(), stopPropagation: jest.fn() };
    getReviewShortcutAction.mockReturnValue("next");
    modal.handleReviewKeyDown(event);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(event.stopPropagation).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith(next, "variantQc");
    getReviewShortcutAction.mockReturnValue("previous");
    modal.handleReviewKeyDown(event);
    expect(onNavigate).toHaveBeenLastCalledWith(previous, "variantQc");
    const updated = { uid: "updated" };
    modal.props = { ...modal.props, navigation: { previous: updated } };
    modal.handleReviewKeyDown(event);
    expect(onNavigate).toHaveBeenLastCalledWith(updated, "variantQc");
    expect(modal.state.activeTab).toBe("variantQc");
  });

  it("consumes endpoint and held arrows without navigating or leaking to tab focus", () => {
    const modal = createModal({ navigation: { next: null }, onNavigate: jest.fn() });
    modal.handleModalOpenChange(true);
    const event = { preventDefault: jest.fn(), stopPropagation: jest.fn() };
    getReviewShortcutAction.mockReturnValue("next");
    modal.handleReviewKeyDown(event);
    modal.props = { ...modal.props, navigation: { next: { uid: "next" } } };
    modal.handleReviewKeyDown({ ...event, repeat: true });
    expect(event.preventDefault).toHaveBeenCalledTimes(2);
    expect(event.stopPropagation).toHaveBeenCalledTimes(2);
    expect(modal.props.onNavigate).not.toHaveBeenCalled();
  });

  it.each(["closed", "loading", "no navigation", "no callback", "protected"])("does not consume arrows when %s", mode => {
    const modal = createModal({ navigation: { next: { uid: "next" } }, onNavigate: jest.fn() });
    modal.state.contentReady = mode !== "loading";
    if (mode === "closed") modal.props.open = false;
    if (mode === "no navigation") modal.props.navigation = null;
    if (mode === "no callback") modal.props.onNavigate = null;
    getReviewShortcutAction.mockReturnValue(mode === "protected" ? null : "next");
    const event = { preventDefault: jest.fn(), stopPropagation: jest.fn() };
    modal.handleReviewKeyDown(event);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(event.stopPropagation).not.toHaveBeenCalled();
  });

  it("keeps every enabled tab reachable with Tab after replacing arrow-key traversal", () => {
    const modal = createModal({ navigation: {}, onNavigate: jest.fn() });
    const enabled = { tabIndex: -1, getAttribute: () => "false" };
    const disabled = { tabIndex: -1, getAttribute: () => "true" };
    modal.modalRoot.current = { querySelectorAll: jest.fn(() => [enabled, disabled]) };
    modal.componentDidUpdate(modal.props);
    expect(enabled.tabIndex).toBe(0);
    expect(disabled.tabIndex).toBe(-1);
  });

  it("renders controlled report/review controls outside tabs with short hover hints", () => {
    const onReportChange = jest.fn(); const onReviewedChange = jest.fn();
    const modal = createModal({ reportSelected: true, reviewed: false, onReportChange, onReviewedChange });
    modal.handleModalOpenChange(true);
    const view = modal.renderReviewControls();
    const hints = React.Children.toArray(view.props.children);
    const checkboxes = reviewCheckboxes(modal);
    expect(checkboxes.map(element => element.props.checked)).toEqual([true, false]);
    expect(checkboxes.every(element => element.props.title === undefined)).toBe(true);
    expect(hints.every(hint => hint.type === "Tooltip" && hint.props.mouseEnterDelay === 0 && hint.props.mouseLeaveDelay === 0)).toBe(true);
    expect(hints.map(hint => React.Children.toArray(hint.props.title.props.children)[0].props.children)).toEqual([
      "components.filtered-event-details-modal.toggle-report",
      "components.filtered-event-details-modal.toggle-reviewed",
    ]);
    expect(hints.map(hint => findElementByType(hint.props.title, "Text").props.children)).toEqual(["u", "i"]);
    checkboxes[0].props.onChange({ target: { checked: false } });
    checkboxes[1].props.onChange({ target: { checked: true } });
    expect(onReportChange).toHaveBeenCalledWith(false);
    expect(onReviewedChange).toHaveBeenCalledWith(true);
    modal.handleTabChange("plots");
    expect(findElementByType(modal.render(), "Checkbox")).not.toBeNull();
    const tabHint = modal.getTabItems()[0].label;
    expect(tabHint.type).toBe("Tooltip");
    expect(tabHint.props.mouseEnterDelay).toBe(0);
    expect(tabHint.props.mouseLeaveDelay).toBe(0);
    expect(tabHint.props.children.props.title).toBeUndefined();
    expect(React.Children.toArray(tabHint.props.title.props.children).slice(1).map(element => element.props.children)).toEqual(["h", "l"]);
  });

  it("puts report/review controls before navigation for left-to-right layout and tab order", () => {
    const modal = createModal({ navigation: {}, onNavigate: jest.fn(), onReportChange: jest.fn(), onReviewedChange: jest.fn() });
    const view = modal.render();
    const bar = findElementByType(view, "div", element => element.props.className === "filtered-event-review-bar");
    expect(React.Children.toArray(bar.props.children).map(element => element.props.className)).toEqual([
      "filtered-event-review-controls", "filtered-event-review-navigation",
    ]);
  });

  it("dispatches h/l tab actions within the ordered boundaries", () => {
    const modal = createModal(); modal.handleModalOpenChange(true);
    const event = { preventDefault: jest.fn(), stopPropagation: jest.fn() };
    getReviewShortcutAction.mockReturnValue("previousTab"); modal.handleReviewKeyDown(event);
    expect(modal.state.activeTab).toBe("plots");
    modal.handleReviewKeyDown(event); expect(modal.state.activeTab).toBe("plots");
    getReviewShortcutAction.mockReturnValue("nextTab"); modal.handleReviewKeyDown(event);
    expect(modal.state.activeTab).toBe("alteration");
    modal.handleReviewKeyDown(event); expect(modal.state.activeTab).toBe("variantQc");
    modal.handleReviewKeyDown(event); expect(modal.state.activeTab).toBe("variantQc");
  });

  it("toggles the latest controlled values with u/i and ignores held keys", () => {
    const modal = createModal({ reportSelected: false, reviewed: true, onReportChange: jest.fn(), onReviewedChange: jest.fn() });
    modal.handleModalOpenChange(true);
    const event = { preventDefault: jest.fn(), stopPropagation: jest.fn() };
    getReviewShortcutAction.mockReturnValue("toggleReport"); modal.handleReviewKeyDown(event);
    expect(modal.props.onReportChange).toHaveBeenLastCalledWith(true);
    modal.props = { ...modal.props, reportSelected: true };
    modal.handleReviewKeyDown(event); expect(modal.props.onReportChange).toHaveBeenLastCalledWith(false);
    getReviewShortcutAction.mockReturnValue("toggleReviewed"); modal.handleReviewKeyDown(event);
    expect(modal.props.onReviewedChange).toHaveBeenCalledWith(false);
    modal.handleReviewKeyDown({ ...event, repeat: true });
    expect(modal.props.onReviewedChange).toHaveBeenCalledTimes(1);
  });

  it("disables checkboxes while loading or without an identity/callback and shows cache failure", () => {
    const modal = createModal({ record: {}, reviewDisabled: true, onReportChange: jest.fn(), onReviewedChange: jest.fn(), reviewCacheError: true });
    expect(reviewCheckboxes(modal).every(control => control.props.disabled)).toBe(true);
    modal.handleModalOpenChange(true);
    expect(reviewCheckboxes(modal).every(control => control.props.disabled)).toBe(true);
    expect(findElementByType(modal.render(), "Text").props.children).toBe("components.filtered-event-details-modal.review-cache-error");
    const event = { preventDefault: jest.fn(), stopPropagation: jest.fn() };
    for (const action of ["toggleReport", "toggleReviewed"]) {
      getReviewShortcutAction.mockReturnValue(action); modal.handleReviewKeyDown(event);
    }
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(modal.props.onReportChange).not.toHaveBeenCalled();
    expect(modal.props.onReviewedChange).not.toHaveBeenCalled();
  });

  it("disables controls and shortcuts during an owning-case load", () => {
    const modal = createModal({ actionsDisabled: true, onReportChange: jest.fn(), onReviewedChange: jest.fn() });
    modal.handleModalOpenChange(true);
    expect(reviewCheckboxes(modal).every(control => control.props.disabled)).toBe(true);
    getReviewShortcutAction.mockReturnValue("toggleReport");
    const event = { preventDefault: jest.fn(), stopPropagation: jest.fn() }; modal.handleReviewKeyDown(event);
    expect(event.preventDefault).not.toHaveBeenCalled(); expect(modal.props.onReportChange).not.toHaveBeenCalled();
  });

  it("installs and removes the same capturing listener on the owning document", () => {
    const modal = createModal();
    const doc = { addEventListener: jest.fn(), removeEventListener: jest.fn() };
    modal.modalRoot.current = { ownerDocument: doc };
    modal.componentDidMount();
    expect(doc.addEventListener).toHaveBeenCalledWith("keydown", modal.handleReviewKeyDown, true);
    modal.componentWillUnmount();
    expect(doc.removeEventListener).toHaveBeenCalledWith("keydown", modal.handleReviewKeyDown, true);
  });

  it("resets content and the cell-derived tab for the next selection", () => {
    const modalComponent = createModal({ initialTab: "tracks" });
    modalComponent.handleModalOpenChange(true);
    modalComponent.handleTabChange("variantQc");

    const previousProps = modalComponent.props;
    modalComponent.props = {
      ...previousProps,
      open: false,
      initialTab: "detail",
      record: { uid: "event-2", gene: "KRAS" },
    };
    modalComponent.componentDidUpdate(previousProps);

    expect(modalComponent.state.contentReady).toBe(false);
    expect(modalComponent.state.activeTab).toBe("alteration");
  });
});
