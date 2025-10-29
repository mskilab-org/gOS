import React, { Component } from "react";
import { PropTypes } from "prop-types";
import * as d3 from "d3";
import { connect } from "react-redux";
import { withTranslation } from "react-i18next";
import { findMaxInRanges } from "../../helpers/utility";
import Grid from "../grid/index";
import Points from "./points";
import Wrapper from "./index.style";
import appActions from "../../redux/app/actions";
import settingsActions from "../../redux/settings/actions";

const { updateHoveredLocation } = appActions;
const { updateDomains } = settingsActions;

const margins = {
  gapX: 50,
  gapY: 24,
};

class ScatterPlot extends Component {
  regl = null;
  container = null;
  plotContainer = null;
  zoom = null;
  extentDataPointsY1 = null;
  extentDataPointsY2 = null;
  maxY2Values = null;

  constructor(props) {
    super(props);
    //this.updateDomains = debounce(this.props.updateDomains, 1);
    this.updateDomains = this.props.updateDomains;
    this._computedDataPointsX = null;
    this._lastProps = null;
  }

  getComputedDataPointsX() {
    if (
      this._computedDataPointsX !== null &&
      this._lastProps &&
      this._lastProps.dataPointsX === this.props.dataPointsX &&
      this._lastProps.dataPointsX_hi === this.props.dataPointsX_hi &&
      this._lastProps.dataPointsX_lo === this.props.dataPointsX_lo
    ) {
      return this._computedDataPointsX;
    }
    this._computedDataPointsX = this.props.dataPointsX || (this.props.dataPointsX_hi && this.props.dataPointsX_lo ? this.props.dataPointsX_hi.map((hi, i) => hi + this.props.dataPointsX_lo[i]) : null);
    this._lastProps = {
      dataPointsX: this.props.dataPointsX,
      dataPointsX_hi: this.props.dataPointsX_hi,
      dataPointsX_lo: this.props.dataPointsX_lo,
    };
    return this._computedDataPointsX;
  }

  componentDidMount() {
    this.regl = require("regl")({
      extensions: ["ANGLE_instanced_arrays"],
      container: this.container,
      pixelRatio: 2.0,
      attributes: {
        antialias: true,
        depth: false,
        stencil: false,
        preserveDrawingBuffer: false,
      },
    });

    this.regl.on("lost", () => {
      console.log("lost webgl context");
    });

    this.regl.on("restore", () => {
      console.log("webgl context restored");
      this.points = new Points(this.regl, margins.gapX, 0);
      this.updateStage(true);
    });

    this.points = new Points(this.regl, margins.gapX, 0);

    const { domains, zoomedByCmd } = this.props;
    this.panels.forEach((panel, index) => {
      let domain = domains[index];
      var s = [
        panel.panelGenomeScale(domain[0]),
        panel.panelGenomeScale(domain[1]),
      ];
      d3.select(this.plotContainer)
        .select(`#panel-rect-${index}`)
        .attr("preserveAspectRatio", "xMinYMin meet")
        .call(
          panel.zoom.filter(
            (event) => !zoomedByCmd || (!event.button && event.metaKey)
          )
        );
      d3.select(this.plotContainer)
        .select(`#panel-rect-${index}`)
        .call(
          panel.zoom.filter(
            (event) => !zoomedByCmd || (!event.button && event.metaKey)
          ).transform,
          d3.zoomIdentity
            .scale(panel.panelWidth / (s[1] - s[0]))
            .translate(-s[0], 0)
        );
    });

    this.updateStage(true);
  }

  shouldComponentUpdate(nextProps, nextState) {
    const nextLength = nextProps.dataPointsX ? nextProps.dataPointsX.length : (nextProps.dataPointsX_hi ? nextProps.dataPointsX_hi.length : 0);
    const currentLength = this.props.dataPointsX ? this.props.dataPointsX.length : (this.props.dataPointsX_hi ? this.props.dataPointsX_hi.length : 0);
    return (
      nextLength !== currentLength ||
      nextProps.domains.toString() !== this.props.domains.toString() ||
      nextProps.width !== this.props.width ||
      nextProps.height !== this.props.height ||
      nextProps.hoveredLocation !== this.props.hoveredLocation ||
      nextProps.hoveredLocationPanelIndex !==
        this.props.hoveredLocationPanelIndex ||
      nextProps.commonRangeY !== this.props.commonRangeY
    );
  }

  componentDidUpdate(prevProps, prevState) {
    const {
      domains,
      hoveredLocationPanelIndex,
      hoveredLocation,
      chromoBins,
      zoomedByCmd,
    } = this.props;

    this.panels.forEach((panel, index) => {
      let domain = domains[index];
      var s = [
        panel.panelGenomeScale(domain[0]),
        panel.panelGenomeScale(domain[1]),
      ];
      d3.select(this.plotContainer)
        .select(`#panel-rect-${index}`)
        .attr("preserveAspectRatio", "xMinYMin meet")
        .call(
          panel.zoom.filter(
            (event) => !zoomedByCmd || (!event.button && event.metaKey)
          )
        );
      d3.select(this.plotContainer)
        .select(`#panel-rect-${index}`)
        .call(
          panel.zoom.filter(
            (event) => !zoomedByCmd || (!event.button && event.metaKey)
          ).transform,
          d3.zoomIdentity
            .scale(panel.panelWidth / (s[1] - s[0]))
            .translate(-s[0], 0)
        );
    });
    if (this.panels[hoveredLocationPanelIndex]) {
      d3.select(this.plotContainer)
        .select(`#hovered-location-line-${hoveredLocationPanelIndex}`)
        .classed("hidden", !hoveredLocation)
        .attr(
          "transform",
          `translate(${[
            this.panels[hoveredLocationPanelIndex].xScale(hoveredLocation) ||
              -10000,
            0,
          ]})`
        );
      d3.select(this.plotContainer)
        .select(`#hovered-location-text-${hoveredLocationPanelIndex}`)
        .attr(
          "x",
          this.panels[hoveredLocationPanelIndex].xScale(hoveredLocation) ||
            -10000
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
    if (
      prevProps?.width !== this.props.width ||
      prevProps?.height !== this.props.height
    ) {
      this.componentWillUnmount();
      this.componentDidMount();
    } else {
      const prevLength = prevProps.dataPointsX ? prevProps.dataPointsX.length : (prevProps.dataPointsX_hi ? prevProps.dataPointsX_hi.length : 0);
      const currentLength = this.props.dataPointsX ? this.props.dataPointsX.length : (this.props.dataPointsX_hi ? this.props.dataPointsX_hi.length : 0);
      this.updateStage(
        prevLength !== currentLength ||
          (prevProps.commonRangeY === null &&
            this.props.commonRangeY !== null) ||
          (prevProps.commonRangeY !== null && this.props.commonRangeY === null)
      );
    }
  }

  componentWillUnmount() {
    try {
      if (this.regl) {
        this.regl.destroy();
        this.regl._gl.clear(this.regl._gl.COLOR_BUFFER_BIT);
        this.regl._gl.clear(this.regl._gl.DEPTH_BUFFER_BIT);
        this.regl._gl.clear(this.regl._gl.STENCIL_BUFFER_BIT);
      }
    } catch (err) {
      console.log(`Scatterplot webgl failed with error: ${err}`);
    }
  }

  updateStage(reloadData = false) {
    const {
      domains,
      width,
      height,
      dataPointsY1,
      dataPointsY2,
      dataPointsX,
      dataPointsColor,
      dataPointsX_hi,
      dataPointsX_lo,
      commonRangeY,
    } = this.props;

    const stageWidth = width - 2 * margins.gapX;
    const stageHeight = height - 3 * margins.gapY;

    if (reloadData) {
      console.log("Reloading data");
      const computedDataPointsX = dataPointsX || this.getComputedDataPointsX();
      this.points.setData(
        computedDataPointsX,
        commonRangeY ? dataPointsY1 : dataPointsY2,
        dataPointsColor,
        dataPointsX_hi,
        dataPointsX_lo
      );
    }

    this.points.updateDomains(
      stageWidth,
      stageHeight,
      domains,
      commonRangeY ? domains.map((d) => commonRangeY[1]) : this.maxY2Values
    );
    this.points.render();
  }

  zooming(event, index) {
    let panel = this.panels[index];
    let newDomain = event.transform
      .rescaleX(panel.panelGenomeScale)
      .domain()
      .map(Math.round);
    let newDomains = [...this.props.domains];
    let selection = Object.assign([], newDomain);

    let otherSelections = this.props.domains.filter((d, i) => i !== index);
    let lowerEdge = d3.max(
      otherSelections
        .filter(
          (d, i) => selection && d[0] <= selection[0] && selection[0] <= d[1]
        )
        .map((d, i) => d[1])
    );

    // calculate the upper allowed selection edge this brush can move
    let upperEdge = d3.min(
      otherSelections
        .filter(
          (d, i) => selection && d[1] >= selection[0] && selection[1] <= d[1]
        )
        .map((d, i) => d[0])
    );

    // if there is an upper edge, then set this to be the upper bound of the current selection
    if (upperEdge !== undefined && selection[1] >= upperEdge) {
      selection[1] = upperEdge;
      selection[0] = d3.min([selection[0], upperEdge - 1]);
    }

    // if there is a lower edge, then set this to the be the lower bound of the current selection
    if (lowerEdge !== undefined && selection[0] <= lowerEdge) {
      selection[0] = lowerEdge;
      selection[1] = d3.max([selection[1], lowerEdge + 1]);
    }

    newDomains[index] = selection;

    if (newDomains.toString() !== this.props.domains.toString()) {
      this.setState({ domains: newDomains }, () => {
        this.updateDomains(newDomains);
      });
    }
  }

  zoomEnded(event, index) {
    this.zooming(event, index);
  }

  handleMouseMove = (e, panelIndex) => {
    this.props.updateHoveredLocation(
      this.panels[panelIndex].xScale.invert(d3.pointer(e)[0]),
      panelIndex
    );
  };

  handleMouseOut = (e, panelIndex) => {
    this.props.updateHoveredLocation(null, panelIndex);
  };

  render() {
    const {
      width,
      height,
      domains,
      chromoBins,
      defaultDomain,
      yAxisTitle,
      yAxis2Title,
      dataPointsX,
      dataPointsY1,
      dataPointsY2,
      commonRangeY,
    } = this.props;

    let stageWidth = width - 2 * margins.gapX;
    let stageHeight = height - 3 * margins.gapY;
    let panelWidth =
      (stageWidth - (domains.length - 1) * margins.gapX) / domains.length;
    let panelHeight = stageHeight;
    this.panels = [];
    const computedDataPointsX = dataPointsX || this.getComputedDataPointsX();
    this.maxY2Values = findMaxInRanges(domains, computedDataPointsX, dataPointsY2);
    this.extentDataPointsY1 = this.extentDataPointsY1 || d3.extent(dataPointsY1);
    this.extentDataPointsY2 = this.extentDataPointsY2 || d3.extent(dataPointsY2);

    domains.forEach((xDomain, index) => {
      let offset = index * (panelWidth + margins.gapX);
      let zoom = d3
        .zoom()
        .scaleExtent([1, Infinity])
        .translateExtent([
          [0, 0],
          [panelWidth, panelHeight],
        ])
        .extent([
          [0, 0],
          [panelWidth, panelHeight],
        ])
        .on("zoom", (event) => this.zooming(event, index))
        .on("end", (event) => this.zoomEnded(event, index));

      let panelGenomeScale = d3
        .scaleLinear()
        .domain(defaultDomain)
        .range([0, panelWidth]);

      let yScale1, yScale2;
      if (commonRangeY) {
        d3.scaleLinear().domain(commonRangeY).ticks();
        let yExtent1 = commonRangeY;
        let yExtent2 = yExtent1.map((d) =>
          d3
            .scaleLinear()
            .domain(this.extentDataPointsY1)
            .range(this.extentDataPointsY2)(d)
        );

        yScale1 = d3.scaleLinear().domain(yExtent1).range([panelHeight, 0]);
        yScale2 = d3.scaleLinear().domain(yExtent2).range([panelHeight, 0]);
      } else {
        let yExtent2 = [0, this.maxY2Values[index]];
        let yExtent1 = yExtent2.map((d) =>
          d3
            .scaleLinear()
            .domain(this.extentDataPointsY2)
            .range(this.extentDataPointsY1)(d)
        );

        yScale1 = d3.scaleLinear().domain(yExtent1).range([panelHeight, 0]);
        yScale2 = d3.scaleLinear().domain(yExtent2).range([panelHeight, 0]);
      }

      let xScale = d3.scaleLinear().domain(xDomain).range([0, panelWidth]);

      this.panels.push({
        index,
        xScale,
        yScale1,
        yScale2,
        zoom,
        panelWidth,
        panelHeight,
        offset,
        panelGenomeScale,
      });
    });
    return (
      <Wrapper className="ant-wrapper" margins={margins} height={height}>
        <div
          className="scatterplot"
          style={{ width: stageWidth, height: stageHeight }}
          ref={(elem) => (this.container = elem)}
        />
        <svg
          width={width}
          height={height}
          className="plot-container"
          ref={(elem) => (this.plotContainer = elem)}
        >
          <text
            className="y-axis-title"
            transform={`translate(${[margins.gapX / 2, margins.gapY / 3]})`}
          >
            {yAxisTitle}
          </text>
          <text
            className="y-axis-title"
            transform={`translate(${[width, margins.gapY / 3]})`}
            textAnchor="end"
          >
            {yAxis2Title}
          </text>
          <g transform={`translate(${[margins.gapX, margins.gapY]})`}>
            {this.panels.map((panel, i) => (
              <g
                key={`panel-${panel.index}`}
                id={`panel-${panel.index}`}
                transform={`translate(${[panel.offset, 0]})`}
              >
                <Grid
                  gap={0}
                  scaleX={panel.xScale}
                  scaleY={panel.yScale1}
                  scaleY2={panel.yScale2}
                  axisWidth={panelWidth}
                  axisHeight={panelHeight}
                  chromoBins={chromoBins}
                />
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
                <rect
                  className="zoom-background"
                  id={`panel-rect-${panel.index}`}
                  x={0.5}
                  width={panelWidth}
                  height={panelHeight}
                  onMouseMove={(e) => this.handleMouseMove(e, i)}
                  onMouseOut={(e) => this.handleMouseOut(e, i)}
                  style={{
                    stroke: "steelblue",
                    fill: "transparent",
                    strokeWidth: 0,
                    opacity: 0.375,
                    pointerEvents: "all",
                  }}
                />
              </g>
            ))}
          </g>
        </svg>
      </Wrapper>
    );
  }
}
ScatterPlot.propTypes = {
  width: PropTypes.number.isRequired,
  height: PropTypes.number.isRequired,
  data: PropTypes.object,
  chromoBins: PropTypes.object,
  dataPointsX: PropTypes.array,
  dataPointsX_hi: PropTypes.array,
  dataPointsX_lo: PropTypes.array,
};
ScatterPlot.defaultProps = {
  commonRangeY: null,
  dataPointsX: null,
  dataPointsX_hi: null,
  dataPointsX_lo: null,
};
const mapDispatchToProps = (dispatch) => ({
  updateDomains: (domains) => dispatch(updateDomains(domains)),
  updateHoveredLocation: (hoveredLocation, panelIndex) =>
    dispatch(updateHoveredLocation(hoveredLocation, panelIndex)),
});
const mapStateToProps = (state) => ({
  chromoBins: state.Settings.chromoBins,
  defaultDomain: state.Settings.defaultDomain,
  hoveredLocation: state.App.hoveredLocation,
  hoveredLocationPanelIndex: state.App.hoveredLocationPanelIndex,
  zoomedByCmd: state.App.zoomedByCmd,
});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withTranslation("common")(ScatterPlot));
