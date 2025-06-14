import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { connect } from "react-redux";
import handleViewport from "react-in-viewport";
import {
  Card,
  Space,
  Tooltip,
  Button,
  message,
  Typography,
} from "antd";
import { withTranslation } from "react-i18next";
import { AiOutlineDownload } from "react-icons/ai";
import { TbChartHistogram } from "react-icons/tb";
import { downloadCanvasAsPng, transitionStyle } from "../../helpers/utility";
import * as htmlToImage from "html-to-image";
import Wrapper from "./index.style";
import HistogramPlot from "../histogramPlot";
import ResizableContainer from "../../containers/ResizableContainer/ResizableContainer";

const { Text } = Typography;

const margins = {
  padding: 0,
  gap: 0,
  maxHeight: 500,
};

class HistogramPlotPanel extends Component {
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
      data,
      q1,
      q3,
      q99,
      range,
      scaleX,
      bandwidth,
      markValue,
      markValueText,
      colorMarker,
      format,
      title,
      inViewport,
      renderOutsideViewPort,
      visible,
      height,
    } = this.props;

    return (
        <Wrapper visible={visible} ref={(elem) => (this.container = elem)}>
        <Card
          style={transitionStyle(inViewport || renderOutsideViewPort)}
          loading={loading}
          size="small"
          title={
            <Space>
              <span role="img" className="anticon anticon-dashboard">
                <TbChartHistogram />
              </span>
              <span className="ant-pro-menu-item-title">
                <Text
                  style={
                    true
                      ? {
                          width: 500,
                        }
                      : undefined
                  }
                  ellipsis={
                    true
                      ? {
                          tooltip: title,
                        }
                      : false
                  }
                >
                  {title}
                </Text>
              </span>
            </Space>
          }
          extra={
            <Space>
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
                          <HistogramPlot
                            {...{
                              width,
                              height,
                              data,
                              q1,
                              q3,
                              q99,
                              range,
                              scaleX,
                              bandwidth,
                              markValue,
                              markValueText,
                              colorMarker,
                              format,
                            }}
                          />
                    )
                )}
              </ResizableContainer>
          )}
        </Card>
      </Wrapper>
    );
  }
}
HistogramPlotPanel.propTypes = {
  data: PropTypes.array,
  markValue: PropTypes.number,

};
HistogramPlotPanel.defaultProps = {
  data: [],
  height: 150,

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
    handleViewport(HistogramPlotPanel, { rootMargin: "-1.0px" })
  )
);
