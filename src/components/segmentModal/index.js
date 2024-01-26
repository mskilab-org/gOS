import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { connect } from "react-redux";
import handleViewport from "react-in-viewport";
import { Row, Col, Modal } from "antd";
import { withTranslation } from "react-i18next";
import GenomePanel from "../genomePanel";
import { transitionStyle } from "../../helpers/utility";
import Wrapper from "./index.style";
import ScatterPlotPanel from "../scatterPlotPanel";
import GenesPanel from "../genesPanel";
import appActions from "../../redux/app/actions";

const { updateDomains, updateHoveredLocation } = appActions;

class SegmentPanel extends Component {
  render() {
    const {
      loading,
      genomeData,
      coverageData,
      genesData,
      inViewport,
      renderOutsideViewPort,
      chromoBins,
      modalTitle,
      genomePlotTitle,
      coveragePlotTitle,
      handleOkClicked,
      handleCancelClicked,
      width,
      open,
    } = this.props;
    if (!open) return null;
    return (
      <Wrapper visible={open}>
        <Modal
          title={
            <span
              dangerouslySetInnerHTML={{
                __html: modalTitle,
              }}
            />
          }
          centered
          open={open}
          onOk={handleOkClicked}
          onCancel={handleCancelClicked}
          width={width}
          footer={null}
          forceRender={true}
        >
          <Row
            style={transitionStyle(inViewport || renderOutsideViewPort)}
            className="ant-panel-container ant-home-plot-container"
            gutter={16}
          >
            <Col className="gutter-row" span={24}>
              <GenesPanel
                {...{
                  genes: genesData,
                  chromoBins,
                  visible: true,
                  height: 140,
                  width: 1152,
                }}
              />
            </Col>
            <Col className="gutter-row" span={24}>
              <GenomePanel
                {...{
                  loading,
                  genome: genomeData,
                  title: genomePlotTitle,
                  chromoBins,
                  visible: true,
                  index: 0,
                  height: 280,
                }}
              />
            </Col>

            <Col className="gutter-row" span={24}>
              <ScatterPlotPanel
                {...{
                  data: coverageData,
                  title: coveragePlotTitle,
                  chromoBins,
                  visible: true,
                  loading,
                  height: 280,
                  width: 1152,
                }}
              />
            </Col>
          </Row>
        </Modal>
      </Wrapper>
    );
  }
}
SegmentPanel.propTypes = {
  data: PropTypes.array,
};
SegmentPanel.defaultProps = {
  genomeData: { intervals: [], connections: [] },
  width: 1200,
};
const mapDispatchToProps = (dispatch) => ({
  updateDomains: (domains) => dispatch(updateDomains(domains)),
  updateHoveredLocation: (hoveredLocation, panelIndex) =>
    dispatch(updateHoveredLocation(hoveredLocation, panelIndex)),
});
const mapStateToProps = (state) => ({
  renderOutsideViewPort: state.App.renderOutsideViewPort,
  domains: state.App.domains,
});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(
  withTranslation("common")(
    handleViewport(SegmentPanel, { rootMargin: "-1.0px" })
  )
);
