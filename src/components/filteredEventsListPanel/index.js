import { Component } from "react";
import { withTranslation } from "react-i18next";
import { withRouter } from "react-router-dom";
import handleViewport from "react-in-viewport";
import { connect } from "react-redux";
import {
  Tag,
  Table,
  Button,
  Space,
  Row,
  Col,
  Segmented,
  Skeleton,
  Typography,
  Select,
  Checkbox,
  Tooltip,
  Popconfirm,
} from "antd";
import { FileTextOutlined, FileTextFilled, CloseOutlined, CheckOutlined, SwapOutlined } from "@ant-design/icons";
import * as d3 from "d3";
import { roleColorMap, transitionStyle } from "../../helpers/utility";
import TracksModal from "../tracksModal";
import Wrapper from "./index.style";
import { CgArrowsBreakeH } from "react-icons/cg";
import filteredEventsActions from "../../redux/filteredEvents/actions";
import interpretationsActions from "../../redux/interpretations/actions";
import { selectMergedEvents } from "../../redux/interpretations/selectors";
import ErrorPanel from "../errorPanel";
import ReportModal from "../reportModal";
import TierDistributionBarChart from "../tierDistributionBarChart";
import { buildColumnsFromSettings } from "./columnBuilders";

const { Text } = Typography;

const { selectFilteredEvent, setSelectedEventUids, toggleEventUidSelection, setColumnFilters, resetColumnFilters } = filteredEventsActions;

const EVENT_TYPES = ["all", "snv", "cna", "fusion", "complexsv"];

// Helper function to extract text from column title (handles both strings and JSX)
const getColumnTitle = (title) => {
  if (typeof title === "string") return title;
  if (typeof title === "object" && title?.props?.children) {
    // Handle Text component with children
    const children = Array.isArray(title.props.children)
      ? title.props.children[title.props.children.length - 1]
      : title.props.children;
    return typeof children === "string" ? children : "Column";
  }
  return "Column";
};

class FilteredEventsListPanel extends Component {
  handleResetFilters = () => {
    const { additionalColumns, resetColumnFilters } = this.props;
    const defaultColumnKeys = this.getDefaultColumnKeys();
    const additionalKeys = (additionalColumns || []).map((col) => col.key);
    const defaultKeys = [...new Set([...defaultColumnKeys, ...additionalKeys])];

    resetColumnFilters();
    this.setState({
      selectedColumnKeys: defaultKeys,
    });
  };

  handleCheckboxChange = (record, checked) => {
    const { toggleEventUidSelection } = this.props;
    toggleEventUidSelection(record.uid, checked);
  };

  handleToggleInReport = async (record) => {
    const { dataset, id: caseId } = this.props;

    const { ensureUser } = await import("../../helpers/userAuth");
    try {
      await ensureUser();
    } catch (error) {
      return; // User cancelled sign-in
    }

    const EventInterpretation = (await import("../../helpers/EventInterpretation")).default;
    const currentInReport = record.inReport;
    const newValue = currentInReport ? null : true;

    // When adding a T3 event to report, also uptier to T1
    const data = { inReport: newValue };
    if (newValue && +record.tier === 3) {
      data.tier = "1";
    }

    const interpretation = new EventInterpretation({
      datasetId: dataset?.id,
      caseId: caseId || "UNKNOWN",
      alterationId: record.uid,
      gene: record.gene,
      variant: record.variant,
      variant_type: record.type,
      data,
    });

    this.props.updateInterpretation(interpretation.toJSON());
  };

  getSelectedRecords = () => {
    const { selectedEventUids, filteredEvents } = this.props;
    return filteredEvents.filter((r) => selectedEventUids.includes(r.uid));
  };

  getRetierLabel = (selectedRecords) => {
    const hasT1or2 = selectedRecords.some(
      (r) => r.tier && (+r.tier === 1 || +r.tier === 2)
    );
    const hasT3 = selectedRecords.some((r) => r.tier && +r.tier === 3);

    if (hasT1or2 && hasT3) return "Tier 1+2 → 3, Tier 3 → 1";
    if (hasT1or2) return "Tier 1+2 → 3";
    if (hasT3) return "Tier 3 → 1";
    return "Retier";
  };

  getReportToggleLabel = (selectedRecords) => {
    const { t } = this.props;
    const notInReport = selectedRecords.filter((r) => !r.inReport);
    const inReport = selectedRecords.filter((r) => !!r.inReport);

    if (notInReport.length > 0) {
      // Check if any not-in-report events are T3 (will be uptiered)
      const hasT3ToAdd = notInReport.some((r) => +r.tier === 3);
      const key = hasT3ToAdd
        ? "components.filtered-events-panel.action-bar.uptier-add-to-report"
        : "components.filtered-events-panel.action-bar.add-to-report";
      return t(key, { count: notInReport.length });
    }
    return t("components.filtered-events-panel.action-bar.remove-from-report", {
      count: inReport.length,
    });
  };

  handleBatchReportToggle = async () => {
    const { ensureUser } = await import("../../helpers/userAuth");
    try {
      await ensureUser();
    } catch (error) {
      return;
    }

    const selectedRecords = this.getSelectedRecords();
    const notInReport = selectedRecords.filter((r) => !r.inReport);
    const willAdd = notInReport.length > 0;

    // Capture inverse for undo (include tier for T3 events that will be uptiered)
    const inverseChanges = selectedRecords.map((r) => {
      const data = { inReport: r.inReport ? true : null };
      // If adding and this is T3, undo needs to restore original tier
      if (willAdd && +r.tier === 3) {
        data.tier = String(r.tier);
      }
      return {
        alterationId: r.uid,
        gene: r.gene,
        variant: r.variant,
        variant_type: r.type,
        data,
      };
    });

    // Build forward changes (uptier T3 events when adding to report)
    const changes = selectedRecords.map((r) => {
      const data = { inReport: willAdd ? true : null };
      if (willAdd && +r.tier === 3) {
        data.tier = "1";
      }
      return {
        alterationId: r.uid,
        gene: r.gene,
        variant: r.variant,
        variant_type: r.type,
        data,
      };
    });

    this.props.batchUpdateInterpretations(changes);

    const { t } = this.props;
    const message = willAdd
      ? t("components.filtered-events-panel.action-bar.undo-add-report", {
          count: selectedRecords.length,
        })
      : t("components.filtered-events-panel.action-bar.undo-remove-report", {
          count: selectedRecords.length,
        });

    this.props.setSelectedEventUids([]);
    this.setState({
      lastBatchAction: { message, inverseChanges },
    });
  };

  handleBatchRetier = async () => {
    const { ensureUser } = await import("../../helpers/userAuth");
    try {
      await ensureUser();
    } catch (error) {
      return;
    }

    const selectedRecords = this.getSelectedRecords();

    // Capture inverse for undo
    const inverseChanges = selectedRecords.map((r) => ({
      alterationId: r.uid,
      gene: r.gene,
      variant: r.variant,
      variant_type: r.type,
      data: { tier: String(r.tier) },
    }));

    // Build forward changes: T1/T2 → T3, T3 → T1
    const changes = selectedRecords.map((r) => ({
      alterationId: r.uid,
      gene: r.gene,
      variant: r.variant,
      variant_type: r.type,
      data: {
        tier: +r.tier === 1 || +r.tier === 2 ? "3" : "1",
      },
    }));

    this.props.batchUpdateInterpretations(changes);

    const label = this.getRetierLabel(selectedRecords);
    const { t } = this.props;
    const message = t(
      "components.filtered-events-panel.action-bar.undo-retier",
      { count: selectedRecords.length }
    ) + ` (${label})`;

    this.props.setSelectedEventUids([]);
    this.setState({
      lastBatchAction: { message, inverseChanges },
    });
  };

  handleUndo = async () => {
    const { lastBatchAction } = this.state;
    if (!lastBatchAction) return;

    this.props.batchUpdateInterpretations(lastBatchAction.inverseChanges);
    this.setState({ lastBatchAction: null });
  };

  handleDismissActionBar = () => {
    this.props.setSelectedEventUids([]);
    this.setState({ lastBatchAction: null });
  };

  getEffectiveVisibleRecords = (records) => {
    const { visibleRecords } = this.state;
    if (visibleRecords) return visibleRecords;

    // Fallback: apply columnFilters manually when Table hasn't fired onChange yet
    const { columnFilters } = this.props;
    if (!columnFilters || Object.keys(columnFilters).length === 0) return records;

    return records.filter((record) => {
      for (const [key, values] of Object.entries(columnFilters)) {
        if (!values || values.length === 0) continue;
        const recordValue = record[key];
        // Match if record value is in the filter values (string comparison)
        if (!values.some((v) => String(recordValue) === String(v))) {
          return false;
        }
      }
      return true;
    });
  };

  getRetierPopconfirmContent = (selectedRecords) => {
    const downTier = selectedRecords.filter(
      (r) => +r.tier === 1 || +r.tier === 2
    );
    const upTier = selectedRecords.filter((r) => +r.tier === 3);

    return (
      <div>
        {downTier.length > 0 && (
          <div>{downTier.length} alteration(s): Tier 1+2 → 3</div>
        )}
        {upTier.length > 0 && (
          <div>{upTier.length} alteration(s): Tier 3 → 1</div>
        )}
      </div>
    );
  };

  handleHeaderCheckboxChange = (records) => {
    const { selectedEventUids, setSelectedEventUids } = this.props;

    // Use post-filter visible records, with manual filter fallback for initial load
    const targetRecords = this.getEffectiveVisibleRecords(records);
    const targetUids = targetRecords.map((r) => r.uid);

    const selectedTarget = targetUids.filter((uid) =>
      selectedEventUids.includes(uid)
    );
    const allSelected =
      selectedTarget.length === targetUids.length && targetUids.length > 0;

    if (allSelected) {
      const newUids = selectedEventUids.filter(
        (uid) => !targetUids.includes(uid)
      );
      setSelectedEventUids(newUids);
    } else {
      const newUids = [...new Set([...selectedEventUids, ...targetUids])];
      setSelectedEventUids(newUids);
    }

    // Clear any pending undo when starting new selection
    this.setState({ lastBatchAction: null });
  };

  getHeaderCheckboxState = (records) => {
    const { selectedEventUids } = this.props;

    // Use post-filter visible records, with manual filter fallback for initial load
    const targetRecords = this.getEffectiveVisibleRecords(records);
    const targetUids = targetRecords.map((r) => r.uid);

    if (targetUids.length === 0) {
      return { checked: false, indeterminate: false };
    }

    const selectedTarget = targetUids.filter((uid) =>
      selectedEventUids.includes(uid)
    );

    if (selectedTarget.length === 0) {
      return { checked: false, indeterminate: false };
    } else if (selectedTarget.length === targetUids.length) {
      return { checked: true, indeterminate: false };
    } else {
      return { checked: false, indeterminate: true };
    }
  };

  isEventSelected = (record) => {
    const { selectedEventUids } = this.props;
    return selectedEventUids.includes(record.uid);
  };
  state = {
    eventType: "all",
    tierCountsMap: {},
    geneVariantsWithTierChanges: null,
    selectedColumnKeys: [],
    lastBatchAction: null, // { message, inverseChanges } or null
    visibleRecords: null,  // post-filter rows from antd Table onChange
  };

  // Track if a fetch is in progress to prevent concurrent calls
  _isFetchingTierCounts = false;

  getDefaultColumnKeys = () => {
    const { data: settingsData, dataset } = this.props;

    // Get columns from settings.json
    const settingsColumns = settingsData?.filteredEventsColumns || [];
    const settingsColumnIds = (
      Array.isArray(settingsColumns) ? settingsColumns : []
    )
      .map((col) => col?.id)
      .filter(Boolean);

    // Get optional columns from current dataset
    // Safely handles cases where optionalFilteredEventsColumns attribute is missing or undefined
    const datasetColumns = dataset?.optionalFilteredEventsColumns || [];
    const datasetColumnIds = (
      Array.isArray(datasetColumns) ? datasetColumns : []
    )
      .map((col) => col?.id)
      .filter(Boolean);

    // Merge: settings columns first, then dataset-specific columns
    const mergedColumnIds = [
      ...new Set([...settingsColumnIds, ...datasetColumnIds]),
    ];
    return mergedColumnIds;
  };

  handleCloseReportModal = async () => {
    this.props.selectFilteredEvent(null);
  };

  handleSegmentedChange = (eventType) => {
    this.setState({ eventType });
  };

  handleColumnSelectionChange = (selectedKeys) => {
    this.setState({ selectedColumnKeys: selectedKeys });
  };

  componentDidMount() {
    this.fetchTierCountsForRecords();
    this.initializeSelectedColumns();
  }

  componentDidUpdate(prevProps, prevState) {
    if (
      prevProps.filteredEvents !== this.props.filteredEvents ||
      prevState.eventType !== this.state.eventType
    ) {
      this.fetchTierCountsForRecords();
    }
    if (
      prevProps.additionalColumns !== this.props.additionalColumns ||
      prevProps.data !== this.props.data ||
      prevProps.dataset !== this.props.dataset
    ) {
      this.initializeSelectedColumns();
    }
  }

  initializeSelectedColumns = () => {
    const { additionalColumns } = this.props;
    const defaultColumnKeys = this.getDefaultColumnKeys();
    const additionalKeys = (additionalColumns || []).map((col) => col.key);
    const selectedKeys = [
      ...new Set([...defaultColumnKeys, ...additionalKeys]),
    ];
    this.setState({ selectedColumnKeys: selectedKeys });
  };

  handleTableChange = (pagination, filters, sorter, extra) => {
    this.setState({ visibleRecords: extra?.currentDataSource || null });

    const columnFilters = {};
    Object.keys(filters).forEach((key) => {
      if (filters[key] && filters[key].length > 0) {
        columnFilters[key] = filters[key];
      }
    });
    this.props.setColumnFilters(columnFilters);
  };

  fetchTierCountsForRecords = async () => {
    // Prevent concurrent fetches
    if (this._isFetchingTierCounts) {
      return;
    }

    const { filteredEvents, dataset } = this.props;
    const { eventType } = this.state;

    // Guard: don't fetch if no events or no dataset
    if (!filteredEvents || filteredEvents.length === 0 || !dataset) {
      return;
    }

    let recordsHash = d3.group(
      filteredEvents.filter(
        (d) => (d.tier && +d.tier < 3) || d.eventType === "complexsv"
      ),
      (d) => d.eventType
    );
    let records =
      (eventType === "all" ? filteredEvents : recordsHash.get(eventType)) || [];

    // Guard: don't fetch if no records after filtering
    if (records.length === 0) {
      return;
    }

    this._isFetchingTierCounts = true;

    try {
      const { getActiveRepository } = await import("../../services/repositories");
      const repository = getActiveRepository({ dataset });

      // OPTIMIZATION: First get gene-variants that have tier changes
      const geneVariantsWithTiers = await repository.getGeneVariantsWithTierChanges();

      // If no gene-variants have tier changes, nothing to fetch
      if (geneVariantsWithTiers.size === 0) {
        this.setState({ tierCountsMap: {}, geneVariantsWithTierChanges: geneVariantsWithTiers });
        return;
      }

      const map = {};

      // Deduplicate AND filter to only gene-variants with tier changes
      const uniqueKeys = new Set();
      const uniqueRecords = records.filter((record) => {
        if (!record.gene || !record.type) return false;
        const key = `${record.gene}-${record.type}`;
        if (uniqueKeys.has(key)) return false;
        // NEW: Only include if this gene-variant has tier changes
        if (!geneVariantsWithTiers.has(key)) return false;
        uniqueKeys.add(key);
        return true;
      });

      // Guard: nothing to fetch after filtering
      if (uniqueRecords.length === 0) {
        this.setState({ tierCountsMap: {}, geneVariantsWithTierChanges: geneVariantsWithTiers });
        return;
      }

      console.log(`Fetching tier counts for ${uniqueRecords.length} gene-variants (filtered from ${records.length} records)`);

      // Process in batches to avoid overwhelming IndexedDB/network
      const BATCH_SIZE = 5;

      for (let i = 0; i < uniqueRecords.length; i += BATCH_SIZE) {
        const batch = uniqueRecords.slice(i, i + BATCH_SIZE);
        const batchPromises = batch.map(async (record) => {
          const key = `${record.gene}-${record.type}`;
          try {
            const counts = await repository.getTierCountsByGeneVariantType(
              record.gene,
              record.type
            );
            map[key] = counts;
          } catch (error) {
            // Silently handle errors - tier counts are non-critical
            map[key] = { 1: 0, 2: 0, 3: 0 };
          }
        });
        await Promise.all(batchPromises);
      }

      this.setState({ tierCountsMap: map, geneVariantsWithTierChanges: geneVariantsWithTiers });
    } finally {
      this._isFetchingTierCounts = false;
    }
  };

  getTierTooltipContent = (record) => {
    const key = `${record.gene}-${record.type}`;
    const { tierCountsMap, geneVariantsWithTierChanges } = this.state;
    
    // Check if this gene-variant has no tier changes
    if (geneVariantsWithTierChanges && !geneVariantsWithTierChanges.has(key)) {
      return "No tier change";
    }
    
    const tierCounts = tierCountsMap[key];
    if (!tierCounts) return "Loading tier distribution...";
    const total =
      (tierCounts[1] || 0) + (tierCounts[2] || 0) + (tierCounts[3] || 0);
    if (total === 0) {
      return "No retiering found for this gene variant";
    }
    const originalRecord = this.props.originalFilteredEvents.find(
      (r) => r.uid === record.uid
    );
    const originalTier = originalRecord?.tier || 3;
    return (
      <TierDistributionBarChart
        width={300}
        height={150}
        tierCounts={tierCounts}
        originalTier={originalTier}
        gene={record.gene}
        variantType={record.type}
      />
    );
  };

  render() {
    const {
      t,
      id,
      filteredEvents,
      selectedFilteredEvent,
      viewMode,
      loading,
      error,
      genome,
      mutations,
      chromoBins,
      genomeCoverage,
      methylationBetaCoverage,
      methylationIntensityCoverage,
      hetsnps,
      genes,
      allelic,
      igv,
      selectFilteredEvent,
      additionalColumns,
      data,
      dataset,
      inViewport,
      selectedEventUids,
    } = this.props;

    let open = selectedFilteredEvent?.id;

    let { eventType, selectedColumnKeys } = this.state;

    let recordsHash = d3.group(
      filteredEvents.filter(
        (d) => (d.tier && +d.tier < 3) || d.eventType === "complexsv"
      ),
      (d) => d.eventType
    );
    let records =
      (eventType === "all" ? filteredEvents : recordsHash.get(eventType)) || [];

    const { columnFilters } = this.props;
    const filterValues = { ...columnFilters };

    // Build columns from settings.json and dataset configuration
    const columns = buildColumnsFromSettings(
      data?.filteredEventsColumns || [],
      dataset?.optionalFilteredEventsColumns || [],
      records,
      {
        t,
        selectFilteredEvent,
        getTierTooltipContent: this.getTierTooltipContent,
      },
      filterValues
    );

    // Checkbox column for selecting events
    const headerCheckboxState = this.getHeaderCheckboxState(records);
    const checkboxColumn = {
      title: (
        <Checkbox
          checked={headerCheckboxState.checked}
          indeterminate={headerCheckboxState.indeterminate}
          onChange={() => this.handleHeaderCheckboxChange(records)}
        />
      ),
      key: "select",
      width: 50,
      fixed: "left",
      align: "center",
      render: (_, record) => (
        <Checkbox
          checked={this.isEventSelected(record)}
          onChange={(e) => this.handleCheckboxChange(record, e.target.checked)}
        />
      ),
    };

    // Report membership icon column
    const reportColumn = {
      title: (
        <Tooltip title={t("components.filtered-events-panel.in-report")}>
          <FileTextOutlined style={{ fontSize: 14 }} />
        </Tooltip>
      ),
      key: "inReport",
      width: 40,
      fixed: "left",
      align: "center",
      render: (_, record) => {
        const isInReport = !!record.inReport;
        const isT3 = +record.tier === 3;
        const addTooltipKey = isT3
          ? "components.filtered-events-panel.in-report-tooltip-uptier-add"
          : "components.filtered-events-panel.in-report-tooltip-add";
        return (
          <Tooltip
            title={
              isInReport
                ? t("components.filtered-events-panel.in-report-tooltip-remove")
                : t(addTooltipKey)
            }
          >
            <Button
              type="text"
              size="small"
              icon={
                isInReport ? (
                  <FileTextFilled style={{ color: "#1890ff" }} />
                ) : (
                  <FileTextOutlined style={{ color: "#d9d9d9" }} />
                )
              }
              onClick={() => this.handleToggleInReport(record)}
            />
          </Tooltip>
        );
      },
    };

    return (
      <Wrapper>
        {error ? (
          <Row className="ant-panel-container ant-home-plot-container">
            <Col className="gutter-row table-container" span={24}>
              <ErrorPanel
                avatar={<CgArrowsBreakeH />}
                header={t("components.filtered-events-panel.header")}
                title={t("components.filtered-events-panel.error.title", {
                  id,
                })}
                subtitle={t("components.filtered-events-panel.error.subtitle")}
                explanationTitle={t(
                  "components.filtered-events-panel.error.explanation.title"
                )}
                explanationDescription={error.stack}
              />
            </Col>
          </Row>
        ) : (
          <div>
            <Row
              className="ant-panel-container ant-home-plot-container"
              align="middle"
              justify="space-between"
              style={transitionStyle(inViewport)}
            >
              {inViewport && (
                <Col flex="auto">
                  <Segmented
                    size="small"
                    options={EVENT_TYPES.map((d) => {
                      return {
                        label: (
                          <span
                            dangerouslySetInnerHTML={{
                              __html: t(
                                "components.filtered-events-panel.event",
                                {
                                  eventType: t(
                                    `components.filtered-events-panel.event-types.${d}`
                                  ),
                                  count: (d === "all"
                                    ? filteredEvents
                                    : recordsHash.get(d) || []
                                  ).length,
                                }
                              ),
                            }}
                          />
                        ),
                        value: d,
                        disabled:
                          (d === "all"
                            ? filteredEvents
                            : recordsHash.get(d) || []
                          ).length === 0,
                      };
                    })}
                    onChange={(d) => this.handleSegmentedChange(d)}
                    value={eventType}
                  />
                </Col>
              )}
              {inViewport && (
                <Col style={{ textAlign: "right" }} flex="none">
                  <Button
                    type="link"
                    onClick={this.handleResetFilters}
                    className="reset-filters-btn"
                  >
                    {t("components.filtered-events-panel.reset-filters")}
                  </Button>
                </Col>
              )}
            </Row>
            <Row
              className="ant-panel-container ant-home-plot-container"
              align="middle"
              justify="space-between"
              style={{ marginBottom: "12px", ...transitionStyle(inViewport) }}
            >
              {inViewport && (
                <Col flex="auto">
                  <Select
                    mode="multiple"
                    placeholder={t(
                      "components.filtered-events-panel.select-columns"
                    )}
                    value={selectedColumnKeys}
                    onChange={this.handleColumnSelectionChange}
                    style={{ width: "50%" }}
                    size="small"
                    maxTagCount="responsive"
                  >
                    {columns.map((col) => (
                      <Select.Option key={col.key} value={col.key}>
                        {getColumnTitle(col.title)}
                      </Select.Option>
                    ))}
                    {(additionalColumns || []).map((col) => (
                      <Select.Option key={col.key} value={col.key}>
                        {getColumnTitle(col.title)}
                      </Select.Option>
                    ))}
                  </Select>
                </Col>
              )}
            </Row>
            <Row
              className="ant-panel-container ant-home-plot-container"
              style={transitionStyle(inViewport)}
            >
              {inViewport && (
                <Col className="gutter-row table-container" span={24}>
                  <Skeleton active loading={loading}>
                    <Table
                      columns={[
                        checkboxColumn,
                        reportColumn,
                        ...(additionalColumns || []),
                        ...columns,
                      ].filter((col) => col.key === "select" || col.key === "inReport" || selectedColumnKeys.includes(col.key))}
                      dataSource={records}
                      pagination={{ pageSize: 50 }}
                      showSorterTooltip={false}
                      onChange={this.handleTableChange}
                      scroll={{ x: "100%", y: 500 }}
                      tableLayout="fixed"
                    />
                    {(selectedEventUids.length > 0 || this.state.lastBatchAction) && (
                      <div className="batch-action-bar">
                        {this.state.lastBatchAction ? (
                          <>
                            <CheckOutlined style={{ color: "#52c41a" }} />
                            <span className="batch-action-success">
                              {this.state.lastBatchAction.message}
                            </span>
                            <Button size="small" onClick={this.handleUndo}>
                              {t("components.filtered-events-panel.action-bar.undo")}
                            </Button>
                            <Button
                              type="text"
                              size="small"
                              icon={<CloseOutlined />}
                              onClick={this.handleDismissActionBar}
                            />
                          </>
                        ) : (
                          <>
                            <span className="batch-action-count">
                              {t("components.filtered-events-panel.action-bar.selected", {
                                count: selectedEventUids.length,
                              })}
                            </span>
                            <Button
                              size="small"
                              icon={<FileTextOutlined />}
                              onClick={this.handleBatchReportToggle}
                            >
                              {this.getReportToggleLabel(this.getSelectedRecords())}
                            </Button>
                            <Popconfirm
                              title={t("components.filtered-events-panel.action-bar.retier")}
                              description={this.getRetierPopconfirmContent(
                                this.getSelectedRecords()
                              )}
                              onConfirm={this.handleBatchRetier}
                              okText="Apply"
                              cancelText="Cancel"
                            >
                              <Button size="small" icon={<SwapOutlined />}>
                                {this.getRetierLabel(this.getSelectedRecords())}
                              </Button>
                            </Popconfirm>
                            <Button
                              type="text"
                              size="small"
                              icon={<CloseOutlined />}
                              onClick={this.handleDismissActionBar}
                            />
                          </>
                        )}
                      </div>
                    )}
                    {selectedFilteredEvent && viewMode === "tracks" && (
                      <TracksModal
                        {...{
                          showVariants: true,
                          selectedVariantId: selectedFilteredEvent.uid,
                          loading,
                          genome,
                          mutations,
                          genomeCoverage,
                          methylationBetaCoverage,
                          methylationIntensityCoverage,
                          hetsnps,
                          genes,
                          igv,
                          chromoBins,
                          allelic,
                          modalTitleText: selectedFilteredEvent.gene,
                          modalTitle: (
                            <Space>
                              {selectedFilteredEvent.gene}
                              {selectedFilteredEvent.name}
                              {selectedFilteredEvent.type}
                              {selectedFilteredEvent.role
                                ?.split(",")
                                .map((tag) => (
                                  <Tag
                                    color={roleColorMap()[tag.trim()]}
                                    key={tag.trim()}
                                  >
                                    {tag.trim()}
                                  </Tag>
                                ))}
                              {selectedFilteredEvent.tier}
                              {selectedFilteredEvent.location}
                            </Space>
                          ),
                          genomePlotTitle: t(
                            "components.tracks-modal.genome-plot"
                          ),
                          genomePlotYAxisTitle: t(
                            "components.tracks-modal.genome-y-axis-title"
                          ),
                          coveragePlotTitle: t(
                            "components.tracks-modal.coverage-plot"
                          ),
                          coverageYAxisTitle: t(
                            "components.tracks-modal.coverage-copy-number"
                          ),
                          coverageYAxis2Title: t(
                            "components.tracks-modal.coverage-count"
                          ),
                          methylationBetaCoveragePlotTitle: t(
                            "components.tracks-modal.methylation-beta-coverage-plot"
                          ),
                          methylationBetaCoverageYAxisTitle: t(
                            "components.tracks-modal.methylation-beta-coverage-y-axis-title"
                          ),
                          methylationBetaCoverageYAxis2Title: t(
                            "components.tracks-modal.methylation-beta-coverage-y-axis2-title"
                          ),
                          methylationIntensityCoveragePlotTitle: t(
                            "components.tracks-modal.methylation-intensity-coverage-plot"
                          ),
                          methylationIntensityCoverageYAxisTitle: t(
                            "components.tracks-modal.methylation-intensity-coverage-y-axis-title"
                          ),
                          methylationIntensityCoverageYAxis2Title: t(
                            "components.tracks-modal.methylation-intensity-coverage-y-axis2-title"
                          ),
                          hetsnpPlotTitle: t(
                            "components.tracks-modal.hetsnp-plot"
                          ),
                          hetsnpPlotYAxisTitle: t(
                            "components.tracks-modal.hetsnp-copy-number"
                          ),
                          hetsnpPlotYAxis2Title: t(
                            "components.tracks-modal.hetsnps-count"
                          ),
                          mutationsPlotTitle: t(
                            "components.tracks-modal.mutations-plot"
                          ),
                          mutationsPlotYAxisTitle: t(
                            "components.tracks-modal.mutations-plot-y-axis-title"
                          ),
                          allelicPlotTitle: t(
                            "components.tracks-modal.allelic-plot"
                          ),
                          allelicPlotYAxisTitle: t(
                            "components.tracks-modal.allelic-plot-y-axis-title"
                          ),
                          handleOkClicked: () => selectFilteredEvent(null),
                          handleCancelClicked: () => selectFilteredEvent(null),
                          open,
                        }}
                      />
                    )}
                    {selectedFilteredEvent && viewMode === "detail" && (
                      <ReportModal
                        open
                        onClose={this.handleCloseReportModal}
                        title={
                          <Space>
                            {selectedFilteredEvent.gene}
                            {selectedFilteredEvent.name}
                            {selectedFilteredEvent.type}
                            {selectedFilteredEvent.role
                              ?.split(",")
                              .map((tag) => (
                                <Tag
                                  color={roleColorMap()[tag.trim()]}
                                  key={tag.trim()}
                                >
                                  {tag.trim()}
                                </Tag>
                              ))}
                            {selectedFilteredEvent.tier}
                            {selectedFilteredEvent.location}
                          </Space>
                        }
                        loading={loading}
                        genome={genome}
                        mutations={mutations}
                        genomeCoverage={genomeCoverage}
                        methylationBetaCoverage={methylationBetaCoverage}
                        methylationIntensityCoverage={
                          methylationIntensityCoverage
                        }
                        hetsnps={hetsnps}
                        genes={genes}
                        igv={igv}
                        chromoBins={chromoBins}
                        allelic={allelic}
                        selectedVariantId={selectedFilteredEvent?.uid}
                        showVariants
                        record={selectedFilteredEvent}
                      />
                    )}
                  </Skeleton>
                </Col>
              )}
            </Row>
          </div>
        )}
      </Wrapper>
    );
  }
}
FilteredEventsListPanel.propTypes = {};
FilteredEventsListPanel.defaultProps = {};
const mapDispatchToProps = (dispatch) => ({
  selectFilteredEvent: (filteredEvent, viewMode) =>
    dispatch(selectFilteredEvent(filteredEvent, viewMode)),
  setSelectedEventUids: (uids) =>
    dispatch(setSelectedEventUids(uids)),
  toggleEventUidSelection: (uid, selected) =>
    dispatch(toggleEventUidSelection(uid, selected)),
  setColumnFilters: (columnFilters) =>
    dispatch(setColumnFilters(columnFilters)),
  resetColumnFilters: () =>
    dispatch(resetColumnFilters()),
  updateInterpretation: (interpretation) =>
    dispatch(interpretationsActions.updateInterpretation(interpretation)),
  batchUpdateInterpretations: (changes) =>
    dispatch(interpretationsActions.batchUpdateInterpretations(changes)),
});
const mapStateToProps = (state) => {
  const mergedEvents = selectMergedEvents(state);

  return {
    loading: state.FilteredEvents.loading,
    filteredEvents: mergedEvents.filteredEvents,
    originalFilteredEvents: state.FilteredEvents.originalFilteredEvents,
    selectedFilteredEvent: mergedEvents.selectedFilteredEvent,
    selectedEventUids: state.FilteredEvents.selectedEventUids || [],
    columnFilters: state.FilteredEvents.columnFilters || { tier: [1, 2] },
    viewMode: state.FilteredEvents.viewMode,
    error: state.FilteredEvents.error,
    id: state.CaseReport.id,
    report: state.CaseReport.metadata,
    genome: state.Genome,
    mutations: state.Mutations,
    allelic: state.Allelic,
    chromoBins: state.Settings.chromoBins,
    genomeCoverage: state.GenomeCoverage,
    methylationBetaCoverage: state.MethylationBetaCoverage,
    methylationIntensityCoverage: state.MethylationIntensityCoverage,
    hetsnps: state.Hetsnps,
    genes: state.Genes,
    igv: state.Igv,
    CaseReport: state.CaseReport,
    Interpretations: state.Interpretations,
    dataset: state?.Settings?.dataset,
    data: state?.Settings?.data,
  };
};
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(
  withRouter(
    withTranslation("common")(
      handleViewport(FilteredEventsListPanel, { rootMargin: "-1.0px" })
    )
  )
);
