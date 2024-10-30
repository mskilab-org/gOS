import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { connect } from "react-redux";
import ContainerDimensions from "react-container-dimensions";
import handleViewport from "react-in-viewport";
import { Card, Space, Tooltip, Button, message, Row, Col } from "antd";
import { withTranslation } from "react-i18next";
import { AiOutlineDownload } from "react-icons/ai";
import { GiHistogram } from "react-icons/gi";
import {
  downloadCanvasAsPng,
  transitionStyle,
  locationToDomains,
} from "../../helpers/utility";
import * as htmlToImage from "html-to-image";
import * as d3 from "d3";
import Wrapper from "./index.style";
import BinPlot from "../binPlot";
import TracksModal from "../tracksModal";
import settingsActions from "../../redux/settings/actions";

const { updateDomains } = settingsActions;

const margins = {
  padding: 0,
  gap: 0,
};

class BinPlotPanel extends Component {
  container = null;

  state = {
    segment: null,
    open: false,
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

  handleSelectSegment = (segment) => {
    const { chromoBins, updateDomains } = this.props;
    let location = `${segment.chromosome}:${segment.startPoint}-${segment.chromosome}:${segment.endPoint}`;
    let domains = locationToDomains(chromoBins, location);
    domains = domains.map((d) => [
      Math.floor((19 * d[0] - d[1]) / 18),
      Math.floor((19 * d[1] - d[0]) / 18),
    ]);
    this.setState({ segment, domains, open: true }, () =>
      updateDomains(domains)
    );
  };

  handleModalOKClicked = () => {
    this.setState({ open: false });
  };

  handleModalCancelClicked = () => {
    this.setState({ open: false });
  };

  render() {
    const {
      t,
      loading,
      coverageDataLoading,
      coverageData,
      hetsnpsDataLoading,
      hetsnpsData,
      genesDataLoading,
      genesData,
      inViewport,
      renderOutsideViewPort,
      visible,
      chromoBins,
      ppfitLoading,
      ppfit,
      metadata,
    } = this.props;

    const { beta, gamma } = metadata;

    if (!metadata.pair || ppfit.intervals.length < 1) {
      return null;
    }
    const { segment, open } = this.state;
    return (
      <Wrapper visible={visible}>
        <Card
          style={transitionStyle(inViewport || renderOutsideViewPort)}
          loading={loading}
          size="small"
          title={
            <Space>
              <span role="img" className="anticon anticon-dashboard">
                <GiHistogram />
              </span>
              <span className="ant-pro-menu-item-title">
                {t(`components.binQc-panel.binplot.title`)}
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
            <div
              className="ant-wrapper"
              ref={(elem) => (this.container = elem)}
            >
              <TracksModal
                {...{
                  loading,
                  genomeDataLoading: ppfitLoading,
                  genomeData: ppfit,
                  coverageDataLoading,
                  coverageData,
                  hetsnpsDataLoading,
                  hetsnpsData,
                  genesDataLoading,
                  genesData,
                  chromoBins,
                  modalTitleText: `sequence-${segment?.iid}`,
                  modalTitle: (
                    <span
                      dangerouslySetInnerHTML={{
                        __html: t("components.binQc-panel.modal-title", {
                          iid: segment?.iid,
                          chromosome: segment?.chromosome,
                          width: d3.format(",")(segment?.width),
                          mean: segment?.mean,
                        }),
                      }}
                    />
                  ),
                  genomePlotTitle: t("components.tracks-modal.genome-plot"),
                  genomePlotYAxisTitle: t(
                    "components.tracks-modal.genome-y-axis-title"
                  ),
                  coveragePlotTitle: t("components.tracks-modal.coverage-plot"),
                  coverageYAxisTitle: t(
                    "components.tracks-modal.coverage-y-axis-title"
                  ),
                  coverageYAxis2Title: t(
                    "components.tracks-modal.coverage-y-axis2-title"
                  ),
                  hetsnpPlotTitle: t("components.tracks-modal.hetsnp-plot"),
                  hetsnpPlotYAxisTitle: t(
                    "components.tracks-modal.hetsnp-plot-y-axis-title"
                  ),
                  hetsnpPlotYAxis2Title: t(
                    "components.tracks-modal.hetsnp-plot-y-axis2-title"
                  ),
                  handleOkClicked: this.handleModalOKClicked,
                  handleCancelClicked: this.handleModalCancelClicked,
                  open,
                }}
              />
              <ContainerDimensions>
                {({ width, height }) => {
                  return (
                    (inViewport || renderOutsideViewPort) && (
                      <Row style={{ width }} gutter={[margins.gap, 0]}>
                        <Col flex={1}>
                          <BinPlot
                            {...{
                              width,
                              height: 600,
                              data: ppfit.intervals,
                              xTitle: t(
                                `components.binQc-panel.binplot.x-title`
                              ),
                              yTitle: t(
                                `components.binQc-panel.binplot.y-title`
                              ),
                              selectSegment: (e) => this.handleSelectSegment(e),
                              slope: 1 / beta,
                              intercept: gamma / beta,
                            }}
                          />
                        </Col>
                      </Row>
                    )
                  );
                }}
              </ContainerDimensions>
            </div>
          )}
        </Card>
      </Wrapper>
    );
  }
}
BinPlotPanel.propTypes = {};
BinPlotPanel.defaultProps = {
  visible: true,
};
const mapDispatchToProps = (dispatch) => ({
  updateDomains: (domains) => dispatch(updateDomains(domains)),
});
const mapStateToProps = (state) => ({
  renderOutsideViewPort: state.App.renderOutsideViewPort,
  metadata: state.CaseReport.metadata,
  ppfitLoading: state.Ppfit.loading,
  ppfit: state.Ppfit.data,
  chromoBins: state.Settings.chromoBins,
  coverageDataLoading: state.GenomeCoverage.loading,
  coverageData: state.GenomeCoverage.data,
  hetsnpsDataLoading: state.Hetsnps.loading,
  hetsnpsData: state.Hetsnps.data,
  genesDataLoading: state.Genes.loading,
  genesData: state.Genes.data,
});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(
  withTranslation("common")(
    handleViewport(BinPlotPanel, { rootMargin: "-1.0px" })
  )
);
