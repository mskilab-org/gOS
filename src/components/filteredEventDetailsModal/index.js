import React, { Component } from "react";
import { Modal, Tabs, Alert, Button, Checkbox, Space, Spin, Tag, Tooltip, Typography } from "antd";
import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import { getEventNavigationLabel } from "../filteredEventsListPanel/eventNavigation";
import { getReviewShortcutAction } from "./reviewShortcuts";
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

  isReportControlDisabled = () => !this.state.contentReady || this.props.actionsDisabled ||
    this.props.record?.uid == null || !this.props.onReportChange;

  isReviewedControlDisabled = () => !this.state.contentReady || this.props.actionsDisabled ||
    !this.props.record || this.props.reviewDisabled || !this.props.onReviewedChange;

  handleReviewKeyDown = (event) => {
    const { open, navigation, onNavigate, onReportChange, onReviewedChange, reportSelected, reviewed } = this.props;
    if (!open || !this.state.contentReady || this.props.actionsDisabled) return;
    const action = getReviewShortcutAction(event, this.modalRoot.current);
    if (!action) return;
    const variantAction = action === "previous" || action === "next";
    if (variantAction && (!navigation || !onNavigate)) return;
    if (action === "toggleReport" && this.isReportControlDisabled()) return;
    if (action === "toggleReviewed" && this.isReviewedControlDisabled()) return;
    event.preventDefault();
    event.stopPropagation();
    // Consume endpoints/repeats too, so they cannot move tab focus or toggle twice.
    if (event.repeat) return;
    if (variantAction) {
      if (navigation[action]) onNavigate(navigation[action], this.state.activeTab);
    } else if (action === "toggleReport") {
      onReportChange(!reportSelected);
    } else if (action === "toggleReviewed") {
      onReviewedChange(!reviewed);
    } else {
      const index = FILTERED_EVENT_DETAILS_TAB_ORDER.indexOf(this.state.activeTab);
      const nextIndex = index + (action === "previousTab" ? -1 : 1);
      if (FILTERED_EVENT_DETAILS_TAB_ORDER[nextIndex]) {
        this.handleTabChange(FILTERED_EVENT_DETAILS_TAB_ORDER[nextIndex]);
      }
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

  renderShortcutHint = (label, keys) => (
    <Space size={6} wrap>
      <span>{label}</span>
      {keys.map(key => <Text keyboard key={key} style={{ color: "inherit" }}>{key}</Text>)}
    </Space>
  );

  getTabItems = () => {
    const { t } = this.props;
    const { activeTab } = this.state;
    return FILTERED_EVENT_DETAILS_TAB_ORDER.map((tab) => ({
      key: tab,
      label: (
        <Tooltip
          title={this.renderShortcutHint(t("components.filtered-event-details-modal.switch-tabs"), ["h", "l"])}
          mouseEnterDelay={0}
          mouseLeaveDelay={0}
        >
          <span>{t(`components.filtered-event-details-modal.tabs.${tab}`)}</span>
        </Tooltip>
      ),
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
            <Tooltip
              key={direction}
              title={this.renderShortcutHint(label, [direction === "previous" ? "k" : "j"])}
              mouseEnterDelay={0}
              mouseLeaveDelay={0}
            >
              <span className="filtered-event-review-button">
                <Button
                  className={`filtered-event-review-${direction}`}
                  type="default"
                  size="small"
                  disabled={!record || !onNavigate}
                  aria-label={label}
                  aria-keyshortcuts={direction === "previous" ? "k ArrowLeft" : "j ArrowRight"}
                  onClick={() => onNavigate(record, this.state.activeTab)}
                >
                  {direction === "previous" && <LeftOutlined aria-hidden="true" />}
                  <span className="filtered-event-review-name">{name || "—"}</span>
                  {direction === "next" && <RightOutlined aria-hidden="true" />}
                </Button>
              </span>
            </Tooltip>
          );
        })}
      </nav>
    );
  };

  renderReviewControls = () => {
    const { t, reportSelected, reviewed, onReportChange, onReviewedChange } = this.props;
    if (!onReportChange && !onReviewedChange) return null;
    return (
      <div className="filtered-event-review-controls" role="group" aria-label={t("components.filtered-event-details-modal.review-controls")}>
        <Tooltip
          title={this.renderShortcutHint(t("components.filtered-event-details-modal.toggle-report"), ["u"])}
          mouseEnterDelay={0}
          mouseLeaveDelay={0}
        >
          <span className="filtered-event-review-control">
            <Checkbox
              checked={Boolean(reportSelected)}
              disabled={this.isReportControlDisabled()}
              aria-keyshortcuts="u"
              onChange={event => onReportChange(event.target.checked)}
            >
              {t("components.filtered-events-panel.add-to-report")}
            </Checkbox>
          </span>
        </Tooltip>
        <Tooltip
          title={this.renderShortcutHint(t("components.filtered-event-details-modal.toggle-reviewed"), ["i"])}
          mouseEnterDelay={0}
          mouseLeaveDelay={0}
        >
          <span className="filtered-event-review-control">
            <Checkbox
              checked={Boolean(reviewed)}
              disabled={this.isReviewedControlDisabled()}
              aria-keyshortcuts="i"
              aria-description={t("components.filtered-event-details-modal.reviewed-description")}
              onChange={event => onReviewedChange(event.target.checked)}
            >
              {t("components.filtered-event-details-modal.reviewed")}
            </Checkbox>
          </span>
        </Tooltip>
      </div>
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
          <div className="filtered-event-review-bar">
            {this.renderReviewControls()}
            {this.renderNavigation()}
          </div>
          {this.props.reviewCacheError && (
            <Text type="warning" role="status" className="filtered-event-review-cache-error">
              {this.props.t("components.filtered-event-details-modal.review-cache-error")}
            </Text>
          )}
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
