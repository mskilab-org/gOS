import React from "react";
import { Button, Typography } from "antd";
import { ArrowRightOutlined } from "@ant-design/icons";
import { BsDashLg } from "react-icons/bs";

const { Text } = Typography;

/**
 * LocationRenderer
 * Renders location with ellipsis tooltip and button to open tracks view
 */
class LocationRenderer extends React.Component {
  render() {
    const { value, record, selectFilteredEvent } = this.props;

    if (value == null) {
      return (
        <Text italic disabled>
          <BsDashLg />
        </Text>
      );
    }

    return (
      <div className="filtered-events-location-cell">
        <Text
          ellipsis={{ tooltip: value }}
          className="filtered-events-location-text filtered-events-ellipsis-text"
        >
          {value}
        </Text>
        <Button
          type="link"
          onClick={() => selectFilteredEvent(record, "tracks")}
        >
          <ArrowRightOutlined />
        </Button>
      </div>
    );
  }
}

export default LocationRenderer;
