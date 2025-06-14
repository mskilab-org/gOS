import React, { Component } from "react";
import { connect } from "react-redux";
import handleViewport from "react-in-viewport";
import {
  Card,
  Space,
  Tooltip,
  Button,
  message,
  Segmented,
  Skeleton,
} from "antd";
import { withTranslation } from "react-i18next";
import { AiOutlineDownload } from "react-icons/ai";
import { FaRegChartBar } from "react-icons/fa";
import { downloadCanvasAsPng, transitionStyle } from "../../helpers/utility";
import * as htmlToImage from "html-to-image";
import Wrapper from "./index.style";
import BarPlot from "../barPlot";
import ResizableContainer from "../../containers/ResizableContainer/ResizableContainer";

const margins = {
  padding: 0,
  gap: 0,
  maxHeight: 500,

};

class BarPlotPanel extends Component {
  constructor(props) {
    super(props);
    this.container = null;
    this.state = {
      parentWidth: null,
      width: 0,
    };
  }

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
      loading,
      dataPoints,
      referenceDataPoints,
      legend,
      xTitle,
      xVariable,
      xRange,
      xFormat,
      xAxisRotation,
      yTitle,
      yVariable,
      colorVariable,
      yRange,
      yFormat,
      title,
      inViewport,
      renderOutsideViewPort,
      visible,
      segmentedOptions,
      handleSegmentedChange,
      segmentedValue,
      height,
    } = this.props;
    if (!colorVariable) {
      return null;
    }

    return (
        <Wrapper visible={visible} ref={(elem) => (this.container = elem)}>
          <Skeleton active loading={loading}>
          <Card
            style={transitionStyle(inViewport || renderOutsideViewPort)}
            loading={loading}
            size="small"
            title={
              <Space>
                <span role="img" className="anticon anticon-dashboard">
                  <FaRegChartBar />
                </span>
                <span className="ant-pro-menu-item-title">{title}</span>
              </Space>
            }
            extra={
              <Space>
                <Segmented
                  size="small"
                  options={segmentedOptions}
                  onChange={(d) => handleSegmentedChange(d)}
                  value={segmentedValue}
                />
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
            {visible && (
                <ResizableContainer
                    defaultHeight={height}
                    gap={margins.gap}
                    padding={margins.padding}
                    maxHeight={margins.maxHeight}
                >
                  {({ width, height }) => (
                      (inViewport || renderOutsideViewPort) && (
                            <BarPlot
                              {...{
                                width,
                                height,
                                dataPoints,
                                referenceDataPoints,
                                legend,
                                xTitle,
                                xVariable,
                                xFormat,
                                xAxisRotation,
                                yTitle,
                                yVariable,
                                yFormat,
                                xRange,
                                yRange,
                                colorVariable,
                              }}
                            />
                      )
                  )}
                </ResizableContainer>
                )}
          </Card>
        </Skeleton>
      </Wrapper>
    );
  }
}
BarPlotPanel.propTypes = {};
BarPlotPanel.defaultProps = {
  visible: true,
  referenceDataPoints: [],
  height: 250,
};
const mapDispatchToProps = () => ({});
const mapStateToProps = (state) => ({
  renderOutsideViewPort: state.App.renderOutsideViewPort,
});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(
  withTranslation("common")(
    handleViewport(BarPlotPanel, { rootMargin: "-1.0px" })
  )
);
