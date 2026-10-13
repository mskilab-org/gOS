/** @jest-environment node */

import React from "react";
import { Checkbox, InputNumber, Slider } from "antd";
import { renderToStaticMarkup } from "react-dom/server";
import SliderFilterDropdown from "./SliderFilterDropdown";

function makeDropdown(props = {}) {
  const dropdown = new SliderFilterDropdown({
    min: 0, max: 1, step: 0.01, selectedKeys: [],
    setSelectedKeys: jest.fn(), clearFilters: jest.fn(), confirm: jest.fn(),
    ...props,
  });
  dropdown.setState = (update) => {
    dropdown.state = { ...dropdown.state, ...(typeof update === "function" ? update(dropdown.state) : update) };
  };
  return dropdown;
}

function updateProps(dropdown, props) {
  const previous = dropdown.props;
  dropdown.props = { ...previous, ...props };
  dropdown.componentDidUpdate(previous);
}

function findElement(node, type) {
  if (!React.isValidElement(node)) return null;
  if (node.type === type) return node;
  for (const child of React.Children.toArray(node.props.children)) {
    const match = findElement(child, type);
    if (match) return match;
  }
  return null;
}

describe("numeric range filter dropdown", () => {
  test("starts with a labeled, unchecked NA exclusion control and full range", () => {
    const dropdown = makeDropdown();
    expect(dropdown.state).toEqual({ range: [0, 1], excludeNA: false });
    const checkbox = findElement(dropdown.render(), Checkbox);
    expect(checkbox.props.checked).toBe(false);
    expect(checkbox.props.children).toBe("Exclude NA values");
    const view = renderToStaticMarkup(dropdown.render());
    expect(view).toContain('type="checkbox"');
    expect(view).toContain("Exclude NA values");
  });

  test("uses the supplied translated toggle label", () => {
    const dropdown = makeDropdown({ excludeNALabel: "Exclude unavailable values" });
    expect(findElement(dropdown.render(), Checkbox).props.children).toBe("Exclude unavailable values");
  });

  test("applies the range with NAs included by default", () => {
    const dropdown = makeDropdown();
    dropdown.handleSliderChange([0.1, 0.5]);
    dropdown.handleConfirm();
    expect(dropdown.props.setSelectedKeys).toHaveBeenCalledWith(["0.1,0.5"]);
    expect(dropdown.props.confirm).toHaveBeenCalledTimes(1);
  });

  test("applies exclusion even at the full range, and removes it when turned off", () => {
    const dropdown = makeDropdown();
    findElement(dropdown.render(), Checkbox).props.onChange({ target: { checked: true } });
    expect(dropdown.props.confirm).not.toHaveBeenCalled();
    dropdown.handleConfirm();
    expect(dropdown.props.setSelectedKeys).toHaveBeenLastCalledWith(["0,1,exclude-na"]);
    findElement(dropdown.render(), Checkbox).props.onChange({ target: { checked: false } });
    dropdown.handleConfirm();
    expect(dropdown.props.setSelectedKeys).toHaveBeenLastCalledWith([]);
  });

  test("turning exclusion off preserves an active range", () => {
    const dropdown = makeDropdown({ selectedKeys: ["0.1,0.5,exclude-na"] });
    findElement(dropdown.render(), Checkbox).props.onChange({ target: { checked: false } });
    dropdown.handleConfirm();
    expect(dropdown.props.setSelectedKeys).toHaveBeenLastCalledWith(["0.1,0.5"]);
  });

  test.each([false, true])("restores the applied range and exclusion %p on remount", (excludeNA) => {
    const dropdown = makeDropdown({ selectedKeys: [`0.1,0.5${excludeNA ? ",exclude-na" : ""}`] });
    expect(dropdown.state).toEqual({ range: [0.1, 0.5], excludeNA });
    expect(findElement(dropdown.render(), Slider).props.value).toEqual([0.1, 0.5]);
    expect(findElement(dropdown.render(), InputNumber).props.value).toBe(0.1);
  });

  test("syncs changed keys and clears stale state on external Reset All Filters", () => {
    const dropdown = makeDropdown({ selectedKeys: ["0.1,0.5,exclude-na"] });
    updateProps(dropdown, { selectedKeys: ["0.2,0.4"] });
    expect(dropdown.state).toEqual({ range: [0.2, 0.4], excludeNA: false });
    updateProps(dropdown, { selectedKeys: [] });
    expect(dropdown.state).toEqual({ range: [0, 1], excludeNA: false });
    dropdown.handleConfirm();
    expect(dropdown.props.setSelectedKeys).toHaveBeenLastCalledWith([]);
  });

  test("does not erase an unfinished draft when equal keys arrive in a new array", () => {
    const dropdown = makeDropdown({ selectedKeys: ["0.1,0.5"] });
    dropdown.handleSliderChange([0.2, 0.4]);
    findElement(dropdown.render(), Checkbox).props.onChange({ target: { checked: true } });
    updateProps(dropdown, { selectedKeys: ["0.1,0.5"] });
    expect(dropdown.state).toEqual({ range: [0.2, 0.4], excludeNA: true });
  });

  test("reset restores both defaults and clears the selected key before confirming", () => {
    const dropdown = makeDropdown({ selectedKeys: ["0.1,0.5,exclude-na"] });
    dropdown.handleReset();
    expect(dropdown.state).toEqual({ range: [0, 1], excludeNA: false });
    expect(dropdown.props.clearFilters).toHaveBeenCalledTimes(1);
    expect(dropdown.props.confirm).toHaveBeenCalledTimes(1);
    expect(dropdown.props.clearFilters.mock.invocationCallOrder[0]).toBeLessThan(dropdown.props.confirm.mock.invocationCallOrder[0]);
    dropdown.handleConfirm();
    expect(dropdown.props.setSelectedKeys).toHaveBeenCalledWith([]);
  });

  test("updates inactive bounds but preserves an applied range when data bounds change", () => {
    const inactive = makeDropdown();
    updateProps(inactive, { min: 10, max: 100 });
    expect(inactive.state).toEqual({ range: [10, 100], excludeNA: false });
    const active = makeDropdown({ selectedKeys: ["0.1,0.5,exclude-na"] });
    updateProps(active, { min: 0.2, max: 0.8 });
    expect(active.state).toEqual({ range: [0.1, 0.5], excludeNA: true });
  });

  test("input changes retain exclusion and cannot reverse the range", () => {
    const dropdown = makeDropdown({ selectedKeys: ["0.1,0.5,exclude-na"] });
    dropdown.handleMinChange(0.6);
    expect(dropdown.state).toEqual({ range: [0.5, 0.5], excludeNA: true });
    dropdown.handleMaxChange(0.2);
    expect(dropdown.state).toEqual({ range: [0.5, 0.5], excludeNA: true });
    dropdown.handleMinChange(null);
    dropdown.handleMaxChange(null);
    expect(dropdown.state).toEqual({ range: [0, 1], excludeNA: true });
  });
});
