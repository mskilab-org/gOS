import React, { Component } from "react";
import { connect } from "react-redux";
import { withTranslation } from "react-i18next";
import handleViewport from "react-in-viewport";
import {
  Card,
  Space,
  Button,
  Tooltip,
  message,
  Typography,
  Progress,
  Skeleton,
} from "antd";
import { GiDna2 } from "react-icons/gi";
import { AiOutlineDownload } from "react-icons/ai";
import { CgArrowsBreakeH } from "react-icons/cg";
import {
  downloadCanvasAsPng,
  transitionStyle,
  domainsToLocation,
} from "../../helpers/utility";
import * as htmlToImage from "html-to-image";
import * as d3 from "d3";
import ErrorPanel from "../errorPanel";
import Wrapper from "./index.style";
import GenomePlot from "../genomePlot";
import ResizableContainer from "../../containers/ResizableContainer/ResizableContainer";

const { Text } = Typography;

const margins = {
  padding: 0,
  annotations: { minDistance: 10000000, padding: 1000, maxClusters: 6 },
  gap: 0,
  maxHeight: 500,
};

class GenomePanel extends Component {
  constructor(props) {
    super(props);
    this.container = null;
    this.state = {
      parentWidth: null,
    };
  }

  componentDidMount() {
    this.updateWidth();
    window.addEventListener("resize", this.updateWidth);
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

  onDownloadButtonClicked = () => {
    htmlToImage
        .toCanvas(this.container, { pixelRatio: 2 })
        .then((canvas) => {
          downloadCanvasAsPng(
              canvas,
              `${this.props.title.replace(/\s+/g, "_").toLowerCase()}.png`
          );
        })
        .catch((error) => {
          message.error(this.props.t("general.error", { error }));
        });
  };

  render() {
    const {
      t,
      error,
      loading,
      loadingPercentage,
      genome,
      filename,
      title,
      yAxisTitle,
      inViewport,
      renderOutsideViewPort,
      visible,
      zoomedByCmd,
      chromoBins,
      domains,
      mutationsPlot,
      commonRangeY,
      height,
    } = this.props;

    if (!visible) return null;

    return (
        <Wrapper visible={visible} ref={(elem) => (this.container = elem)}>
          {error ? (
              <ErrorPanel
                  avatar={<CgArrowsBreakeH />}
                  header={
                    <Space>
                <span role="img" className="anticon anticon-dashboard">
                  <GiDna2 />
                </span>
                      <span className="ant-pro-menu-item-title">{title}</span>
                      <span>{domainsToLocation(chromoBins, domains)}</span>
                    </Space>
                  }
                  title={t("components.genome-panel.error.title")}
                  subtitle={t("components.genome-panel.error.subtitle", { filename })}
                  explanationTitle={t("components.genome-panel.error.explanation.title")}
                  explanationDescription={error.stack}
              />
          ) : (
              <Card
                  style={transitionStyle(inViewport || renderOutsideViewPort)}
                  size="small"
                  title={
                    <Space>
                <span role="img" className="anticon anticon-dashboard">
                  <GiDna2 />
                </span>
                      <span className="ant-pro-menu-item-title">{title}</span>
                      {genome && (
                          <span>
                    <b>{d3.format(",")(genome.intervals.length)}</b>{" "}
                            {t(
                                `components.genome-panel.${
                                    mutationsPlot ? "mutation" : "interval"
                                }`,
                                { count: genome.intervals.length }
                            )}
                  </span>
                      )}
                      <span>{domainsToLocation(chromoBins, domains)}</span>
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
                            onClick={this.onDownloadButtonClicked}
                        />
                      </Tooltip>
                    </Space>
                  }
              >
                {loading ? (
                    loadingPercentage ? (
                        <Progress percent={loadingPercentage} />
                    ) : (
                        <Skeleton loading={loading} active />
                    )
                ) : (
                    <ResizableContainer
                        defaultHeight={height}
                        gap={margins.gap}
                        padding={margins.padding}
                        maxHeight={margins.maxHeight}
                    >
                      {({ width, height }) =>
                          (inViewport || renderOutsideViewPort) && (
                              <GenomePlot
                                  {...{
                                    width,
                                    height,
                                    genome,
                                    mutationsPlot,
                                    yAxisTitle,
                                    commonRangeY,
                                  }}
                              />
                          )
                      }
                    </ResizableContainer>
                )}
              </Card>
          )}
        </Wrapper>
    );
  }
}

GenomePanel.defaultProps = {
  error: false,
  height: 400,
  mutationsPlot: false,
  visible: true,
  commonRangeY: null,
};

const mapDispatchToProps = () => ({});

const mapStateToProps = (state) => ({
  renderOutsideViewPort: state.App.renderOutsideViewPort,
  genomeLength: state.Settings.genomeLength,
  zoomedByCmd: state.App.zoomedByCmd,
  domains: state.Settings.domains,
  chromoBins: state.Settings.chromoBins,
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(
    withTranslation("common")(
        handleViewport(GenomePanel, { rootMargin: "-1.0px" })
    )
);
