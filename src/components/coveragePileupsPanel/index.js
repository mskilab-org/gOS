import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { connect } from "react-redux";

import handleViewport from "react-in-viewport";
import {
  Card,
  Space,
  Button,
  Tooltip,
  message,
  Typography,
  Popover,
  Spin,
} from "antd";
import * as d3 from "d3";
import { withTranslation } from "react-i18next";
import Wrapper from "./index.style";
import { AiOutlineDownload, AiOutlineDotChart } from "react-icons/ai";
import { WarningOutlined } from "@ant-design/icons";
import {
  downloadCanvasAsPng,
  transitionStyle,
  domainsToLocation,
} from "../../helpers/utility";
import * as htmlToImage from "html-to-image";
import ScatterPlot from "../scatterPlot";
import IgvPlot from "../igvPlot";
import ErrorPanel from "../errorPanel";
import HoverLine from "../hoverLine";
import { getViewMode } from "../../helpers/coveragePileupsUtil";
import settingsActions from "../../redux/settings/actions";

const { Text } = Typography;
const { updateDomains } = settingsActions;

const margins = {
  padding: 0,
  gap: 27,
  maxHeight: 500,
};

const PILEUP_THRESHOLD = 5000; // 5kb - switch to pileup view when zoomed in
const PILEUP_HEIGHT = 800; // Fixed height for IGV pileup view
const COVERAGE_HEIGHT = 200; // Default height for coverage scatter plot

// Match GenomePlot/ScatterPlot margins for consistent panel alignment
const panelMargins = {
  gapX: 50,  // Same as GenomePlot
  gapY: 24,
};

// Zero X margins for ScatterPlot when parent handles layout positioning
const zeroMargins = {
  gapX: 0,
  gapY: 24,  // Keep Y margin for labels
};

class CoveragePileupsPanel extends Component {
  constructor(props) {
    super(props);
    this.container = null;
    this.previousMode = null; // Track previous mode for scroll adjustment
    this.state = {
      parentWidth: null,
      width: 0,
      height: this.props.height,
      pileupLoading: {}, // Track loading state per panel index
    };
  }

  shouldComponentUpdate(nextProps, nextState) {
    if (nextState !== this.state) return true;

    const domainsChanged =
      nextProps.domains?.toString() !== this.props.domains?.toString();
    if (domainsChanged) return true;

    if (nextProps.commonRangeY !== this.props.commonRangeY) return true;

    if (
      nextProps.dataPointsY1 !== this.props.dataPointsY1 ||
      nextProps.dataPointsY2 !== this.props.dataPointsY2 ||
      nextProps.dataPointsX !== this.props.dataPointsX ||
      nextProps.dataPointsColor !== this.props.dataPointsColor
    )
      return true;

    if (
      nextProps.loading !== this.props.loading ||
      nextProps.visible !== this.props.visible ||
      nextProps.inViewport !== this.props.inViewport ||
      nextProps.error !== this.props.error
    )
      return true;

    if (
      nextProps.height !== this.props.height ||
      nextProps.chromoBins !== this.props.chromoBins
    )
      return true;

    return false;
  }

  componentDidMount() {
    this.updateWidth();
    window.addEventListener("resize", this.updateWidth);
  }

  componentDidUpdate(prevProps, prevState) {
    if (prevState.parentWidth !== this.state.parentWidth) {
      this.updateWidth();
    }

    // Check for mode change and adjust scroll position
    const { domains, chromoBins } = this.props;
    if (domains && chromoBins) {
      const currentMode = domains.some(
        (domain) => getViewMode(chromoBins, domain, PILEUP_THRESHOLD).mode === "pileup"
      ) ? "pileup" : "coverage";

      if (this.previousMode && this.previousMode !== currentMode && this.container) {
        const heightDiff = PILEUP_HEIGHT - COVERAGE_HEIGHT;

        if (currentMode === "pileup") {
          // Switching to pileup: content below will shift down, adjust scroll to compensate
          window.scrollBy(0, heightDiff);
        } else {
          // Switching to coverage: content below will shift up, adjust scroll to compensate
          window.scrollBy(0, -heightDiff);
        }
      }

      this.previousMode = currentMode;
    }
  }

  componentWillUnmount() {
    window.removeEventListener("resize", this.updateWidth);
  }

  updateWidth = () => {
    if (this.container) {
      this.setState({
        parentWidth: this.container.getBoundingClientRect().width,
      });
    }
  };

  onFirstBoxResize = (event, { element, size, handle }) => {
    this.setState({
      width: size.width,
      height: d3.min([
        d3.max([size.height, this.props.height]),
        margins.maxHeight,
      ]),
    });
  };

  onDownloadButtonClicked = () => {
    htmlToImage
      .toCanvas(this.container, { pixelRatio: 2 })
      .then((canvas) => {
        downloadCanvasAsPng(
          canvas,
          `${this.props.title
            .replace(/\s+/g, "_")
            .toLowerCase()}_${domainsToLocation(
            this.props.chromoBins,
            this.props.domains
          )}.png`
        );
      })
      .catch((error) => {
        message.error(this.props.t("general.error", { error }));
      });
  };

  handleUpdateDomain = (domain, index) => {
    if (this.props.domains[index]?.toString() !== domain?.toString()) {
      let newDomains = JSON.parse(JSON.stringify(this.props.domains));
      newDomains[index] = domain;
      this.props.updateDomains(newDomains);
    }
  };

  handlePileupLoading = (index, isLoading) => {
    this.setState((prevState) => ({
      pileupLoading: {
        ...prevState.pileupLoading,
        [index]: isLoading,
      },
    }));
  };

  renderPanelContent(domain, index, panelWidth, panelHeight) {
    const {
      chromoBins,
      domains,
      dataPointsY1,
      dataPointsY2,
      dataPointsX,
      dataPointsXHigh,
      dataPointsXLow,
      dataPointsColor,
      yAxisTitle,
      yAxis2Title,
      commonRangeY,
      urlTumor,
      indexTumorURL,
      urlNormal,
      indexNormalURL,
      filenameTumorPresent,
      filenameNormalPresent,
      format,
    } = this.props;

    const { pileupLoading } = this.state;
    const viewMode = getViewMode(chromoBins, domain, PILEUP_THRESHOLD);

    if (viewMode.mode === "pileup") {
      const isLoading = pileupLoading[index];

      return (
        <div className="pileup-container" style={{ position: "relative" }}>
          {isLoading && (
            <div className="loading-overlay">
              <Spin size="large" tip="Loading alignments..." />
            </div>
          )}
          <IgvPlot
            key={`pileup-${index}-${viewMode.chromosome}-${viewMode.start}-${viewMode.end}`}
            index={index}
            domain={domain}
            urlTumor={urlTumor}
            indexTumorURL={indexTumorURL}
            urlNormal={urlNormal}
            indexNormalURL={indexNormalURL}
            filenameTumorPresent={filenameTumorPresent}
            filenameNormalPresent={filenameNormalPresent}
            format={format}
            chromoBins={chromoBins}
            updateDomain={this.handleUpdateDomain}
            onLoadingChange={(loading) =>
              this.handlePileupLoading(index, loading)
            }
          />
        </div>
      );
    }

    // Coverage mode
    return (
      <div className="coverage-container">
        <ScatterPlot
          width={panelWidth}
          height={panelHeight}
          dataPointsY1={dataPointsY1}
          dataPointsY2={dataPointsY2}
          dataPointsX={dataPointsX}
          dataPointsXHigh={dataPointsXHigh}
          dataPointsXLow={dataPointsXLow}
          dataPointsColor={dataPointsColor}
          domains={[domain]}
          yAxisTitle={index === 0 ? yAxisTitle : ""}
          yAxis2Title={index === domains.length - 1 ? yAxis2Title : ""}
          commonRangeY={commonRangeY}
          panelIndex={index}
          onUpdateDomain={this.handleUpdateDomain}
          margins={zeroMargins}
        />
        <HoverLine width={panelWidth} height={panelHeight} domains={[domain]} panelIndex={index} margins={zeroMargins} />
      </div>
    );
  }

  render() {
    const {
      t,
      loading,
      dataPointsColor,
      error,
      filename,
      title,
      domains,
      chromoBins,
      inViewport,
      visible,
      zoomedByCmd,
      notification,
    } = this.props;

    if (!visible) return null;
    const { parentWidth, height } = this.state;
    let { gap } = margins;
    let w = parentWidth || this.container?.getBoundingClientRect().width;
    let h = height;

    // Calculate dimensions matching GenomePlot pattern exactly
    const containerWidth = w - gap;  // Same as what GenomePanel passes
    const stageWidth = containerWidth - 2 * panelMargins.gapX;
    const panelWidth = domains.length > 1
      ? (stageWidth - (domains.length - 1) * panelMargins.gapX) / domains.length
      : stageWidth;

    // Calculate offset for each panel (matching GenomePlot)
    const getPanelOffset = (index) => panelMargins.gapX + index * (panelWidth + panelMargins.gapX);

    // Check if any domain is in pileup mode
    const isAnyPileupMode = domains.some(
      (domain) => getViewMode(chromoBins, domain, PILEUP_THRESHOLD).mode === "pileup"
    );
    const containerHeight = isAnyPileupMode ? PILEUP_HEIGHT : COVERAGE_HEIGHT;



    return (
      <Wrapper visible={visible} ref={(elem) => (this.container = elem)}>
        {error ? (
          <ErrorPanel
            avatar={<AiOutlineDotChart />}
            header={
              <Space>
                <span role="img" className="anticon anticon-dashboard">
                  <AiOutlineDotChart />
                </span>
                <span className="ant-pro-menu-item-title">{title}</span>
              </Space>
            }
            title={t("components.coverage-panel.error.title")}
            subtitle={t("components.coverage-panel.error.subtitle", {
              filename,
            })}
            explanationTitle={t(
              "components.coverage-panel.error.explanation.title"
            )}
            explanationDescription={error.stack}
          />
        ) : (
          <Card
            style={transitionStyle(inViewport)}
            loading={loading}
            size="small"
            title={
              <Space>
                <span role="img" className="anticon anticon-dashboard">
                  <AiOutlineDotChart />
                </span>
                <span className="ant-pro-menu-item-title">
                  <Space>
                    {title}
                    <span>
                      <b>{d3.format(",")(dataPointsColor?.length || 0)}</b>{" "}
                      {t("components.coverage-panel.datapoint", {
                        count: dataPointsColor?.length || 0,
                      })}
                    </span>
                    {notification?.status && (
                      <Popover
                        placement="bottomLeft"
                        title={
                          <Space>
                            <Text>{notification.heading}</Text>
                          </Space>
                        }
                        content={
                          <Space direction="vertical">
                            {notification.messages.map((d, i) => (
                              <Text key={i}>
                                <span
                                  dangerouslySetInnerHTML={{
                                    __html: d,
                                  }}
                                />
                              </Text>
                            ))}
                          </Space>
                        }
                        trigger="hover"
                      >
                        <Text type="warning">
                          <WarningOutlined />
                        </Text>
                      </Popover>
                    )}
                  </Space>
                </span>
              </Space>
            }
            extra={
              <Space>
                {zoomedByCmd && (
                  <Text type="secondary">{t("components.zoom-help")}</Text>
                )}
                <Tooltip title={t("components.download-as-png-tooltip")}>
                  <Button
                    type="default"
                    shape="circle"
                    disabled={!visible}
                    icon={<AiOutlineDownload style={{ marginTop: 4 }} />}
                    size="small"
                    onClick={() => this.onDownloadButtonClicked()}
                  />
                </Tooltip>
              </Space>
            }
          >
            {visible && w > 0 && (
              <div
                className="ant-wrapper"
                style={{
                  width: containerWidth + "px",
                  height: containerHeight + "px",
                  overflow: "auto",
                  position: "relative",
                }}
              >
                {inViewport && domains.map((domain, index) => (
                  <div
                    key={index}
                    className="panel-wrapper"
                    style={{
                      position: "absolute",
                      left: getPanelOffset(index),
                      top: 0,
                      width: panelWidth,
                      height: containerHeight,
                    }}
                  >
                    {this.renderPanelContent(
                      domain,
                      index,
                      panelWidth,
                      h
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </Wrapper>
    );
  }
}

CoveragePileupsPanel.propTypes = {
  width: PropTypes.number,
  height: PropTypes.number,
  visible: PropTypes.bool,
};

CoveragePileupsPanel.defaultProps = {
  notification: { status: null, heading: null, messages: [] },
  commonRangeY: null,
  height: 200,
  visible: true,
};

const mapDispatchToProps = (dispatch) => ({
  updateDomains: (domains) => dispatch(updateDomains(domains)),
});

const mapStateToProps = (state) => ({
  domains: state.Settings.domains,
  chromoBins: state.Settings.chromoBins,
  zoomedByCmd: state.Settings.zoomedByCmd,
  dataset: state.Settings.dataset,
  id: state.CaseReport.id,
});

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(
  withTranslation("common")(
    handleViewport(CoveragePileupsPanel, { rootMargin: "-1.0px" })
  )
);
