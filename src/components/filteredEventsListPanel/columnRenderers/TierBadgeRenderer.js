import React from "react";
import { Avatar, Tooltip, Button, Typography } from "antd";
import { tierColor } from "../../../helpers/utility";
import { BsDashLg } from "react-icons/bs";

const { Text } = Typography;

/**
 * TierBadgeRenderer
 * Renders the tier value as a colored avatar badge with tooltip
 */
class TierBadgeRenderer extends React.Component {
  render() {
    const { value, record, getTierTooltipContent, selectFilteredEvent } = this.props;

    if (value == null) {
      return (
        <Text italic disabled>
          <BsDashLg />
        </Text>
      );
    }

    return (
      <Tooltip
        title={getTierTooltipContent(record)}
        placement="right"
        overlayStyle={{ maxWidth: "350px" }}
      >
        <Button
          type="link"
          onClick={() => selectFilteredEvent(record, "detail")}
        >
          <Avatar
            size="small"
            style={{
              color: "#FFF",
              backgroundColor: tierColor(+value),
            }}
          >
            {value}
          </Avatar>
        </Button>
      </Tooltip>
    );
  }
}

export default TierBadgeRenderer;
