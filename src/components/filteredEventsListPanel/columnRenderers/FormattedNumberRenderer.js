import React from "react";
import { Typography } from "antd";
import { BsDashLg } from "react-icons/bs";
import * as d3 from "d3";

const { Text } = Typography;

/**
 * FormattedNumberRenderer
 * Renders numeric values with d3 formatting
 */
class FormattedNumberRenderer extends React.Component {
  render() {
    const { value, record, format = ".3f" } = this.props;

    if (value == null) {
      return (
        <Text italic disabled>
          <BsDashLg />
        </Text>
      );
    }

    return d3.format(format)(+value);
  }
}

export default FormattedNumberRenderer;
