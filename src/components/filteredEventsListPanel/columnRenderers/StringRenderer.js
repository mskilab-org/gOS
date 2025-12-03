import React from "react";
import { Typography } from "antd";
import { BsDashLg } from "react-icons/bs";

const { Text } = Typography;

/**
 * StringRenderer
 * Renders string values with optional ellipsis tooltip
 */
class StringRenderer extends React.Component {
  render() {
    const { value, record, ellipsis = false } = this.props;

    if (value == null) {
      return (
        <Text italic disabled>
          <BsDashLg />
        </Text>
      );
    }

    if (ellipsis) {
      return (
        <Text
          ellipsis={{ tooltip: value }}
          className="filtered-events-ellipsis-text"
        >
          {value}
        </Text>
      );
    }

    return value;
  }
}

export default StringRenderer;
