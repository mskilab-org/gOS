import React, { Component } from "react";
import { PropTypes } from "prop-types";
import * as d3 from "d3";
import { connect } from "react-redux";
import { withTranslation } from "react-i18next";
import Wrapper from "./index.style";
import settingsActions from "../../redux/settings/actions";

const { updateDomains, updateHoveredLocation } = settingsActions;

const defaultMargins = {
  gapX: 50,
  gapY: 24,
  gapYUnits: 3,
};

class HoverLine extends Component {
  plotContainer = null;

  componentDidUpdate(prevProps, prevState) {
    const { hoveredLocationPanelIndex, hoveredLocation, chromoBins, panelIndex } =
      this.props;

    // When panelIndex is provided, only show hoverline if it matches the hovered panel
    // and use index 0 in the local panels array (since we only have one panel)
    const localPanelIndex = panelIndex !== undefined ? 0 : hoveredLocationPanelIndex;
    const shouldShow = panelIndex !== undefined 
      ? hoveredLocationPanelIndex === panelIndex 
      : true;

    if (this.panels[localPanelIndex]) {
      d3.select(this.plotContainer)
        .select(`#hovered-location-line-${localPanelIndex}`)
        .classed("hidden", !hoveredLocation || !shouldShow)
        .attr(
          "transform",
          `translate(${[
            this.panels[localPanelIndex].xScale(hoveredLocation) ||
              -10000,
            0,
          ]})`
        );
      d3.select(this.plotContainer)
        .select(`#hovered-location-text-${localPanelIndex}`)
        .attr(
          "x",
          shouldShow ? (this.panels[localPanelIndex].xScale(hoveredLocation) || -10000) : -10000
        )
        .text(
          Object.values(chromoBins)
            .filter(
              (chromo) =>
                hoveredLocation < chromo.endPlace &&
                hoveredLocation >= chromo.startPlace
            )
            .map((chromo) =>
              d3.format(",")(
                Math.floor(chromo.scaleToGenome.invert(hoveredLocation))
              )
            )
        );
    }
  }

  render() {
    const { width, height, domains: propDomains, reduxDomains, margins } = this.props;
    // Use prop domains if provided, otherwise fall back to Redux domains
    const domains = propDomains || reduxDomains;

    const gapX = margins?.gapX ?? defaultMargins.gapX;
    const gapY = margins?.gapY ?? defaultMargins.gapY;
    const gapYUnits = margins?.gapYUnits ?? defaultMargins.gapYUnits;

    let stageWidth = width - 2 * gapX;
    let stageHeight = height - gapYUnits * gapY;
    let panelWidth =
      (stageWidth - (domains.length - 1) * gapX) / domains.length;
    let panelHeight = stageHeight;
    this.panels = [];

    domains.forEach((xDomain, index) => {
      let offset = index * (panelWidth + margins.gapX);
      let xScale = d3.scaleLinear().domain(xDomain).range([0, panelWidth]);

      this.panels.push({
        index,
        xScale,
        panelWidth,
        panelHeight,
        offset,
      });
    });

    const result = (
      <Wrapper className="hoverline-wrapper" margins={margins} height={height}>
        <svg
          width={width}
          height={height}
          className="plot-container"
          ref={(elem) => (this.plotContainer = elem)}
        >
          <g transform={`translate(${[gapX, gapY]})`}>
            {this.panels.map((panel, i) => (
              <g
                key={`panel-${panel.index}`}
                id={`panel-${panel.index}`}
                transform={`translate(${[panel.offset, 0]})`}
              >
                <line
                  className="hovered-location-line hidden"
                  id={`hovered-location-line-${panel.index}`}
                  y1={0}
                  y2={panel.panelHeight}
                />
                <text
                  className="hovered-location-text"
                  id={`hovered-location-text-${panel.index}`}
                  x={-1000}
                  dx={5}
                  dy={10}
                ></text>
              </g>
            ))}
          </g>
        </svg>
      </Wrapper>
    );
    return result;
  }
}

HoverLine.propTypes = {
  width: PropTypes.number.isRequired,
  height: PropTypes.number.isRequired,
  chromoBins: PropTypes.object.isRequired,
  domains: PropTypes.array.isRequired,
  margins: PropTypes.shape({
    gapX: PropTypes.number,
    gapY: PropTypes.number,
    gapYUnits: PropTypes.number,
  }),
};
HoverLine.defaultProps = {
  margins: defaultMargins,
};
const mapDispatchToProps = (dispatch) => ({
  updateDomains: (domains) => dispatch(updateDomains(domains)),
  updateHoveredLocation: (location) =>
    dispatch(updateHoveredLocation(location)),
});
const mapStateToProps = (state) => ({
  chromoBins: state.Settings.chromoBins,
  reduxDomains: state.Settings.domains,
  hoveredLocation: state.Settings.hoveredLocation,
  hoveredLocationPanelIndex: state.Settings.hoveredLocationPanelIndex,
});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withTranslation("common")(HoverLine));
