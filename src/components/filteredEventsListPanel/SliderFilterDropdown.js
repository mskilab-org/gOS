import React, { Component } from "react";
import { Slider, Button, Space, InputNumber, Checkbox } from "antd";
import {
  parseNumericRangeFilter,
  getNumericRangeFilterKeys,
} from "../../helpers/numericRangeFilter";

class SliderFilterDropdown extends Component {
  constructor(props) {
    super(props);
    this.state = SliderFilterDropdown.getFilterState(props);
  }

  static getFilterState({ selectedKeys, min, max }) {
    return parseNumericRangeFilter(selectedKeys?.[0]) || {
      range: [min, max],
      excludeNA: false,
    };
  }

  componentDidUpdate(prevProps) {
    if (
      prevProps.min !== this.props.min ||
      prevProps.max !== this.props.max ||
      prevProps.selectedKeys?.[0] !== this.props.selectedKeys?.[0]
    ) {
      this.setState(SliderFilterDropdown.getFilterState(this.props));
    }
  }

  handleSliderChange = (range) => {
    this.setState({ range });
  };

  handleMinChange = (value) => {
    const newMin = value != null ? value : this.props.min;
    this.setState((prev) => ({
      range: [Math.min(newMin, prev.range[1]), prev.range[1]],
    }));
  };

  handleMaxChange = (value) => {
    const newMax = value != null ? value : this.props.max;
    this.setState((prev) => ({
      range: [prev.range[0], Math.max(newMax, prev.range[0])],
    }));
  };

  handleExcludeNAChange = (event) => {
    this.setState({ excludeNA: event.target.checked });
  };

  handleReset = () => {
    const { min, max, clearFilters, confirm } = this.props;
    this.setState({ range: [min, max], excludeNA: false });
    clearFilters();
    confirm();
  };

  handleConfirm = () => {
    const { setSelectedKeys, confirm, min, max } = this.props;
    const { range, excludeNA } = this.state;
    setSelectedKeys(getNumericRangeFilterKeys(range, excludeNA, min, max));
    confirm();
  };

  render() {
    const { min, max, step, excludeNALabel = "Exclude NA values" } = this.props;
    const { range, excludeNA } = this.state;

    return (
      <div style={{ padding: 12, width: 280 }}>
        <Slider
          range
          min={min}
          max={max}
          step={step}
          value={range}
          onChange={this.handleSliderChange}
          style={{ marginBottom: 16 }}
        />
        <Space style={{ marginBottom: 12 }}>
          <InputNumber
            size="small"
            min={min}
            max={max}
            step={step}
            value={range[0]}
            onChange={this.handleMinChange}
            style={{ width: 100 }}
          />
          <span>to</span>
          <InputNumber
            size="small"
            min={min}
            max={max}
            step={step}
            value={range[1]}
            onChange={this.handleMaxChange}
            style={{ width: 100 }}
          />
        </Space>
        <Checkbox
          checked={excludeNA}
          onChange={this.handleExcludeNAChange}
          style={{ display: "flex", marginBottom: 12 }}
        >
          {excludeNALabel}
        </Checkbox>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <Button size="small" onClick={this.handleReset}>
            Reset
          </Button>
          <Button type="primary" size="small" onClick={this.handleConfirm}>
            OK
          </Button>
        </div>
      </div>
    );
  }
}

export default SliderFilterDropdown;
