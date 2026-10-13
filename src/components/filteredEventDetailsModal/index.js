import React, { Component } from "react";
import { Modal, Tabs, Alert, Button, Space, Spin, Tag, Typography } from "antd";
import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import { getEventNavigationLabel } from "../filteredEventsListPanel/eventNavigation";
import { getReviewShortcutDirection } from "./reviewShortcuts";
import Wrapper from "./index.style";

import TracksModal from "../tracksModal";
import AlterationCard from "../alterationCard";
import { withTranslation } from "react-i18next";
import { roleColorMap } from "../../helpers/utility";
import {
  FILTERED_EVENT_DETAILS_TAB_ORDER,
  FILTERED_EVENT_DETAILS_TABS,
  getFilteredEventDetailsHeading,
  getInlineTracksProps,
  normalizeFilteredEventDetailsTab,
} from "./model";

const { Text } = Typography;

export class FilteredEventDetailsModal extends Component {
  modalRoot = React.createRef();
  keyboardDocument = null;

  componentDidMount() {
    this.keyboardDocument = this.modalRoot.current?.ownerDocument ||
      (typeof document !== "undefined" ? document : null);
    // Capture before AntD's tab handler: arrows review variants, not tab focus.
    this.keyboardDocument?.addEventListener("keydown", this.handleReviewKeyDown, true);
  }

  componentWillUnmount() {
    this.keyboardDocument?.removeEventListener("keydown", this.handleReviewKeyDown, true);
    this.keyboardDocument = null;
  }

  handleReviewKeyDown = (event) => {
    const { open, navigation, onNavigate } = this.props;
    if (!open || !this.state.contentReady || !navigation || !onNavigate) return;
    const direction = getReviewShortcutDirection(event, this.modalRoot.current);
    if (!direction) return;
    event.preventDefault();
    event.stopPropagation();
    // Consume endpoints/repeats too, so they cannot move tab focus instead.
    if (!event.repeat && navigation[direction]) {
      onNavigate(navigation[direction], this.state.activeTab);
    }
  };

  constructor(props) {
    super(props);
    this.state = {
      activeTab: normalizeFilteredEventDetailsTab(props.initialTab),
      contentReady: false,
    };
  }

  componentDidUpdate(prevProps) {
    // Without arrow-key tab traversal, each tab must remain reachable with Tab.
    if (this.props.navigation && this.props.onNavigate) {
      this.modalRoot.current?.querySelectorAll('.filtered-event-details-tabs > .ant-tabs-nav [role="tab"]')
        .forEach(tab => { if (tab.getAttribute("aria-disabled") !== "true") tab.tabIndex = 0; });
    }
    const requestedTabChanged = prevProps.initialTab !== this.props.initialTab;
    const closed = prevProps.open && !this.props.open;
    const opened = !prevProps.open && this.props.open;

    // A neighbor selection changes content, not the user's chosen tab.
    if (!requestedTabChanged && !closed && !opened) return;

    const nextState = {};
    const nextTab = normalizeFilteredEventDetailsTab(this.props.initialTab);
    if (this.state.activeTab !== nextTab) {
      nextState.activeTab = nextTab;
    }
    if (closed && this.state.contentReady) {
      nextState.contentReady = false;
    }
    if (Object.keys(nextState).length > 0) {
      this.setState(nextState);
    }
  }

  handleModalOpenChange = (presented) => {
    if (presented !== this.state.contentReady) {
      this.setState({ contentReady: presented });
    }
    if (this.props.afterOpenChange) {
      this.props.afterOpenChange(presented);
    }
  };

  handleTabChange = (activeTab) => {
    this.setState({
      activeTab: normalizeFilteredEventDetailsTab(activeTab),
    });
  };

  getTracksProps = (contentView) =>
    getInlineTracksProps({ ...this.props, contentView });

  renderHeading = () => {
    const heading = getFilteredEventDetailsHeading(this.props.record);
    const roleColors = roleColorMap();

    return (
      <Space>
        {heading.gene}
        {heading.name}
        {heading.type}
        {heading.roles.map((role, index) => (
          <Tag color={roleColors[role]} key={`${role}-${index}`}>
            {role}
          </Tag>
        ))}
        {heading.tier}
        {heading.location}
      </Space>
    );
  };

  renderTabContent = (tab) => {
    const { record, t } = this.props;

    if (tab === FILTERED_EVENT_DETAILS_TABS.ALTERATION) {
      return record ? (
        <AlterationCard record={record} />
      ) : (
        <Alert
          type="info"
          message={t("components.filtered-event-details-modal.no-selection")}
          showIcon
        />
      );
    }

    return (
      <div className="filtered-event-tab-content" data-variant-review-shortcuts="off">
        <TracksModal {...this.getTracksProps(tab)} />
      </div>
    );
  };

  getTabItems = () => {
    const { t } = this.props;
    const { activeTab } = this.state;
    return FILTERED_EVENT_DETAILS_TAB_ORDER.map((tab) => ({
      key: tab,
      label: t(`components.filtered-event-details-modal.tabs.${tab}`),
      children: activeTab === tab ? this.renderTabContent(tab) : null,
    }));
  };

  renderNavigation = () => {
    const { navigation, onNavigate, t } = this.props;
    if (!navigation) return null;
    return (
      <nav
        className="filtered-event-review-navigation"
        aria-label={t("components.filtered-event-details-modal.navigation")}
      >
        {["previous", "next"].map(direction => {
          const record = navigation[direction];
          const directionLabel = t(`components.filtered-event-details-modal.${direction}`);
          const name = getEventNavigationLabel(record);
          const label = name ? `${directionLabel}: ${name}` : directionLabel;
          return (
            <Button
              key={direction}
              className={`filtered-event-review-${direction}`}
              type="text"
              size="small"
              disabled={!record || !onNavigate}
              title={`${label} (${direction === "previous" ? "←" : "→"})`}
              aria-label={label}
              aria-keyshortcuts={direction === "previous" ? "ArrowLeft" : "ArrowRight"}
              onClick={() => onNavigate(record, this.state.activeTab)}
            >
              {direction === "previous" && <LeftOutlined aria-hidden="true" />}
              <span className="filtered-event-review-direction">{directionLabel}</span>
              {name && <span className="filtered-event-review-name">{name}</span>}
              {direction === "next" && <RightOutlined aria-hidden="true" />}
            </Button>
          );
        })}
      </nav>
    );
  };

  renderModalContent = () => {
    if (!this.state.contentReady) {
      return (
        <div className="filtered-event-details-modal-loading">
          <Space direction="vertical" align="center" size="middle">
            <Spin size="large" />
            <Text>
              {this.props.t("components.filtered-event-details-modal.loading")}
            </Text>
          </Space>
        </div>
      );
    }

    return (
      <Tabs
        className="filtered-event-details-tabs"
        activeKey={this.state.activeTab}
        onChange={this.handleTabChange}
        items={this.getTabItems()}
      />
    );
  };

  render() {
    const { open, onClose } = this.props;
    if (!open) return null;

    return (
      <Wrapper ref={this.modalRoot}>
        <Modal
          open={open}
          onCancel={onClose}
          afterOpenChange={this.handleModalOpenChange}
          footer={null}
          title={this.renderHeading()}
          width="95vw"
          getContainer={false}
          forceRender
        >
          {this.renderNavigation()}
          {this.renderModalContent()}
        </Modal>
      </Wrapper>
    );
  }
}

FilteredEventDetailsModal.defaultProps = {
  initialTab: FILTERED_EVENT_DETAILS_TABS.ALTERATION,
};

export default withTranslation("common")(FilteredEventDetailsModal);
