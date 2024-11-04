import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { connect } from "react-redux";
import handleViewport from "react-in-viewport";
import { Row, Col, Modal, message, Tooltip, Space, Button } from "antd";
import { withTranslation } from "react-i18next";
import GenomePanel from "../genomePanel";
import { AiOutlineDownload } from "react-icons/ai";
import * as htmlToImage from "html-to-image";
import { transitionStyle, downloadCanvasAsPng } from "../../helpers/utility";
import Wrapper from "./index.style";
import ScatterPlotPanel from "../scatterPlotPanel";
import GenesPanel from "../genesPanel";
import appActions from "../../redux/app/actions";

const { updateHoveredLocation } = appActions;

class TracksModal extends Component {
  container = null;

  onDownloadButtonClicked = () => {
    htmlToImage
      .toCanvas(this.container, { pixelRatio: 2 })
      .then((canvas) => {
        downloadCanvasAsPng(
          canvas,
          `${this.props.modalTitleText.replace(/\s+/g, "_").toLowerCase()}.png`
        );
      })
      .catch((error) => {
        message.error(this.props.t("general.error", { error }));
      });
  };

  render() {
    const {
      t,
      genome,
      mutations,
      genomeCoverage,
      hetsnps,
      coverageYAxisTitle,
      coverageYAxis2Title,
      metadata,
      genes,
      allelic,
      inViewport,
      renderOutsideViewPort,
      chromoBins,
      modalTitle,
      genomePlotTitle,
      genomePlotYAxisTitle,
      mutationsPlotTitle,
      mutationsPlotYAxisTitle,
      coveragePlotTitle,
      hetsnpPlotTitle,
      hetsnpPlotYAxisTitle,
      hetsnpPlotYAxis2Title,
      allelicPlotTitle,
      allelicPlotYAxisTitle,
      handleOkClicked,
      handleCancelClicked,
      width,
      height,
      open,
      viewType,
    } = this.props;
    if (!open) return null;
    const { cov_slope, cov_intercept, hets_slope, hets_intercept } = metadata;
    let content = (
      <Row
        style={transitionStyle(inViewport || renderOutsideViewPort)}
        className="ant-panel-container ant-home-plot-container"
        gutter={[16, 24]}
      >
        {genes && (
          <Col className="gutter-row" span={24}>
            <GenesPanel
              {...{
                loading: genes.loading,
                genes: genes.data,
                error: genes.error,
                filename: genes.filename,
                chromoBins,
                visible: true,
                height,
              }}
            />
          </Col>
        )}
        {genome && (
          <Col className="gutter-row" span={24}>
            <GenomePanel
              {...{
                loading: genome.loading,
                genome: genome.data,
                error: genome.error,
                filename: genome.filename,
                title: genomePlotTitle,
                yAxisTitle: genomePlotYAxisTitle,
                chromoBins,
                visible: true,
                index: 0,
                height,
              }}
            />
          </Col>
        )}
        {genomeCoverage && (
          <Col className="gutter-row" span={24}>
            <ScatterPlotPanel
              {...{
                loading: genomeCoverage.loading,
                data: genomeCoverage.data,
                error: genomeCoverage.error,
                filename: genomeCoverage.filename,
                title: coveragePlotTitle,
                notification: {
                  status: !cov_slope || !cov_intercept ? "warning" : null,
                  heading:
                    !cov_slope || !cov_intercept
                      ? t(`components.tracks-modal.missing-counts-axis`)
                      : null,
                  messages: [
                    ...(!cov_slope
                      ? [
                          t(`general.attributes-missing.description`, {
                            attribute: "cov_slope",
                          }),
                        ]
                      : []),
                    ...(!cov_intercept
                      ? [
                          t(`general.attributes-missing.description`, {
                            attribute: "cov_intercept",
                          }),
                        ]
                      : []),
                  ],
                },
                scaleY2: {
                  show: cov_slope && cov_intercept,
                  slope: cov_slope,
                  intercept: cov_intercept,
                },
                chromoBins,
                visible: true,
                height,
                yAxisTitle: coverageYAxisTitle,
                yAxis2Title: coverageYAxis2Title,
                flipAxesY: true,
              }}
            />
          </Col>
        )}
        {hetsnps && (
          <Col className="gutter-row" span={24}>
            <ScatterPlotPanel
              {...{
                loading: hetsnps.loading,
                data: hetsnps.data,
                error: hetsnps.error,
                filename: hetsnps.filename,
                title: hetsnpPlotTitle,
                notification: {
                  status: !hets_slope || !hets_intercept ? "warning" : null,
                  heading:
                    !cov_slope || !hets_intercept
                      ? t(`components.tracks-modal.missing-counts-axis`)
                      : null,
                  messages: [
                    ...(!hets_slope
                      ? [
                          t(`general.attributes-missing.description`, {
                            attribute: "hets_slope",
                          }),
                        ]
                      : []),
                    ...(!hets_intercept
                      ? [
                          t(`general.attributes-missing.description`, {
                            attribute: "hets_intercept",
                          }),
                        ]
                      : []),
                  ],
                },
                scaleY2: {
                  show: hets_slope && hets_intercept,
                  slope: hets_slope,
                  intercept: hets_intercept,
                },
                chromoBins,
                visible: true,
                height,
                yAxisTitle: hetsnpPlotYAxisTitle,
                yAxis2Title: hetsnpPlotYAxis2Title,
                flipAxesY: true,
              }}
            />
          </Col>
        )}
        {allelic && (
          <Col className="gutter-row" span={24}>
            <GenomePanel
              {...{
                loading: allelic.loading,
                genome: allelic.data,
                error: allelic.error,
                filename: allelic.filename,
                title: allelicPlotTitle,
                yAxisTitle: allelicPlotYAxisTitle,
                chromoBins,
                visible: true,
                index: 0,
                height,
              }}
            />
          </Col>
        )}
        {mutations && (
          <Col className="gutter-row" span={24}>
            <GenomePanel
              {...{
                loading: mutations.loading,
                genome: mutations.data,
                error: mutations.error,
                filename: mutations.filename,
                title: mutationsPlotTitle,
                yAxisTitle: mutationsPlotYAxisTitle,
                chromoBins,
                visible: true,
                index: 0,
                height,
                mutationsPlot: true,
              }}
            />
          </Col>
        )}
      </Row>
    );
    return (
      <Wrapper visible={open}>
        {viewType === "modal" ? (
          <Modal
            title={
              <Space>
                {modalTitle}
                <Button
                  type="default"
                  shape="circle"
                  icon={<AiOutlineDownload />}
                  size="small"
                  onClick={() => this.onDownloadButtonClicked()}
                />
              </Space>
            }
            centered
            open={open}
            onOk={handleOkClicked}
            onCancel={handleCancelClicked}
            width={width}
            footer={null}
            forceRender={true}
          >
            <div ref={(elem) => (this.container = elem)}>{content}</div>
          </Modal>
        ) : (
          <div style={{ height: `${height}px; width: ${width}px` }}>
            {content}
          </div>
        )}
      </Wrapper>
    );
  }
}
TracksModal.propTypes = {
  data: PropTypes.array,
};
TracksModal.defaultProps = {
  width: 1200,
  height: 180,
  viewType: "modal",
};
const mapDispatchToProps = (dispatch) => ({
  updateHoveredLocation: (hoveredLocation, panelIndex) =>
    dispatch(updateHoveredLocation(hoveredLocation, panelIndex)),
});
const mapStateToProps = (state) => ({
  renderOutsideViewPort: state.App.renderOutsideViewPort,
  domains: state.Settings.domains,
  metadata: state.CaseReport.metadata,
  chromoBins: state.Settings.chromoBins,
});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(
  withTranslation("common")(
    handleViewport(TracksModal, { rootMargin: "-1.0px" })
  )
);
