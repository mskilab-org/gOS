import React, { Component } from "react";
import { PropTypes } from "prop-types";
import * as d3 from "d3";
import { connect } from "react-redux";
import { withTranslation } from "react-i18next";
import { measureText, mutationCatalogMetadata } from "../../helpers/utility";
import Wrapper from "./index.style";

const margins = {
  gap: 0,
  gapX: 34,
  gapY: 24,
  yTicksCount: 10,
  tooltipGap: 5,
  gapLegend: 30,
  barLengend: 15,
};

class BarPlot extends Component {
  plotContainer = null;

  state = {
    tooltip: {
      id: -1,
      visible: false,
      shapeId: -1,
      x: -1000,
      y: -1000,
      text: [],
    },
  };

  componentDidMount() {
    this.getPlotConfiguration();
    this.renderYAxis();
    this.renderXAxis();
  }

  componentDidUpdate() {
    this.getPlotConfiguration();
    this.renderYAxis();
    this.renderXAxis();
  }

  getPlotConfiguration() {
    const {
      width,
      height,
      dataPoints,
      referenceDataPoints,
      legend,
      xVariable,
      yVariable,
      xFormat,
      yFormat,
      xTitle,
      xAxisRotation,
      yTitle,
      colorVariable,
    } = this.props;

    let stageWidth = width - 2 * margins.gapX;
    let stageHeight = height - 3 * margins.gapY;

    let panelWidth = stageWidth;
    let panelHeight = stageHeight - margins.gapLegend;

    let legendIds = legend.map((d) => d.id);
    let legendTitles = legend.map((d) => d.title);
    let rectangleBars = dataPoints.sort((a, b) =>
      d3.ascending(
        legendIds.indexOf(a.mutationType),
        legendIds.indexOf(b.mutationType)
      )
    );

    let rectangleBarsReference = referenceDataPoints.sort((a, b) =>
      d3.ascending(
        legendIds.indexOf(a.mutationType),
        legendIds.indexOf(b.mutationType)
      )
    );

    let xScale = d3
      .scaleBand()
      .domain(dataPoints.map((d) => d[xVariable]))
      .range([0, panelWidth])
      .padding(0.1);

    let yScale = d3
      .scaleLinear()
      .domain([
        0,
        d3.max([...dataPoints, ...referenceDataPoints], (d) => d[yVariable]),
      ])
      .range([panelHeight, 0])
      .nice();

    let color = d3.scaleOrdinal(
      legendIds,
      legend.map((d) => d.color)
    );

    let colorLegendTitles = d3.scaleOrdinal(
      legend.map((d) => d.id),
      legend.map((d) => d.color)
    );

    return {
      width,
      height,
      panelWidth,
      panelHeight,
      xScale,
      yScale,
      xFormat,
      yFormat,
      color,
      legend,
      xTitle,
      xAxisRotation,
      yTitle,
      dataPoints,
      rectangleBars,
      rectangleBarsReference,
      xVariable,
      yVariable,
      colorVariable,
      legendTitles,
      colorLegendTitles,
    };
  }

  renderXAxis() {
    const { xScale, xFormat, dataPoints, colorLegendTitles, xAxisRotation } =
      this.getPlotConfiguration();

    let xAxisContainer = d3
      .select(this.plotContainer)
      .select(".x-axis-container");

    const axisX = d3.axisBottom(xScale).tickSize(3);

    if (xFormat) {
      axisX.tickFormat(d3.format(xFormat));
    }
    axisX.tickFormat(function (d, i) {
      return dataPoints[i].label;
    });

    xAxisContainer.call(axisX);

    if (xAxisRotation < 0) {
      xAxisContainer
        .call(axisX)
        .selectAll("text")
        .attr("y", xAxisRotation < 0 ? -4 : 8)
        .attr("x", 0)
        .attr("dx", xAxisRotation < 0 ? "-3.2em" : 0)
        .attr("transform", `rotate(${xAxisRotation})`)
        .style("text-anchor", "middle")
        .call(function (text) {
          text.each(function (d, i) {
            var text = d3.select(this),
              words = text.text().split("").reverse(),
              word,
              line = [],
              lineNumber = 0,
              lineHeight = 0.8, // ems
              dx = parseFloat(text.attr("dx")),
              tspan = text
                .text(null)
                .append("tspan")
                .attr("x", 0)
                .attr("dx", dx + "em");
            let index = 0;
            while ((word = words.pop())) {
              line.push(word);
              tspan.text(line.join(" "));
              line.pop();
              tspan.text(line.join(" "));
              line = [word];
              tspan = text
                .append("tspan")
                .attr(
                  "fill",
                  index === 1
                    ? colorLegendTitles(dataPoints[i].mutationType)
                    : "gray"
                )
                .attr("font-weight", index === 1 ? "bold" : "normal")
                .attr("x", 0)
                .attr("dx", ++lineNumber * lineHeight + dx + "em")
                .text(word);
              index += 1;
            }
          });
        });
    }
  }

  renderYAxis() {
    const { yScale, yFormat } = this.getPlotConfiguration();

    let yAxisContainer = d3
      .select(this.plotContainer)
      .select(".y-axis-container");

    let yAxis = d3.axisLeft(yScale).tickFormat(d3.format(yFormat));
    yAxisContainer.call(yAxis);
  }

  handleMouseEnter = (d, i) => {
    const { t } = this.props;
    const { xScale, yScale, xVariable, width } = this.getPlotConfiguration();
    let tooltipText = mutationCatalogMetadata().map((e) => {
      return { label: t(`metadata.${e}`), value: d[e] };
    });
    let tooltipTextLength = d3.max(
      tooltipText,
      (d) => measureText(`${d.label}: ${d.value}`, 12) + 30
    );
    let diffX = d3.min([
      0,
      width -
        xScale(d[xVariable]) +
        margins.tooltipGap -
        tooltipTextLength -
        60,
    ]);
    this.setState({
      tooltip: {
        id: d.id,
        visible: true,
        x: xScale(d[xVariable]) + margins.tooltipGap + diffX,
        y: yScale(0) - mutationCatalogMetadata().length * 20,
        text: mutationCatalogMetadata().map((e) => {
          return { label: t(`metadata.${e}`), value: d[e] };
        }),
      },
    });
  };

  handleMouseOut = (d) => {
    this.setState({
      tooltip: {
        id: null,
        visible: false,
        shapeId: -1,
        x: -1000,
        y: -1000,
        text: [],
      },
    });
  };

  render() {
    const {
      width,
      height,
      panelWidth,
      panelHeight,
      color,
      xTitle,
      yTitle,
      xScale,
      yScale,
      dataPoints,
      rectangleBars,
      rectangleBarsReference,
      legend,
      xVariable,
      yVariable,
      colorVariable,
    } = this.getPlotConfiguration();

    const { tooltip } = this.state;
    const { visible, id } = tooltip;

    let variantLegendPositions = d3
      .groups(dataPoints, (d) => d.mutationType)
      .map((d) => {
        return {
          key: legend.find((e) => e.id === d[0]).title,
          color: legend.find((e) => e.id === d[0]).color,
          pos: xScale(d[1][0][xVariable]) + (0 * xScale.bandwidth()) / 2,
          distance:
            xScale(d[1][d[1].length - 1][xVariable]) -
            xScale(d[1][0][xVariable]) +
            xScale.bandwidth(),
        };
      });

    let variantLegendHeaderPositions = d3
      .groups(dataPoints, (d) => d.group)
      .map((d) => {
        return {
          key: legend.find((e) => e.group === d[0])?.header,
          subtitle: legend.find((e) => e.group === d[0])?.subtitle,
          pos: xScale(d[1][0][xVariable]) + (0 * xScale.bandwidth()) / 2,
          distance:
            xScale(d[1][d[1].length - 1][xVariable]) -
            xScale(d[1][0][xVariable]) +
            xScale.bandwidth(),
        };
      });

    return (
      <Wrapper className="ant-wrapper" margins={margins}>
        <div
          className="histogram-plot"
          style={{ width: width, height: height }}
          ref={(elem) => (this.container = elem)}
        >
          <svg
            width={width}
            height={height}
            className="plot-container"
            ref={(elem) => (this.plotContainer = elem)}
          >
            <g
              transform={`translate(${[
                margins.gapX,
                margins.gapY + margins.gapLegend,
              ]})`}
            >
              <g
                key={`panel`}
                id={`panel`}
                transform={`translate(${[0, margins.xDistributionHeight]})`}
              >
                <g
                  className="axis--y y-axis-container"
                  transform={`translate(${[margins.gap, 0]})`}
                ></g>
                <g className="axis--y-text">
                  <text
                    className="x-axis-title"
                    x={-margins.gapX}
                    y={-0.5 * margins.gapY - margins.gapLegend}
                    textAnchor="start"
                  >
                    {yTitle}
                  </text>
                </g>
                <g
                  className="axis--x x-axis-container"
                  transform={`translate(${[margins.gap, panelHeight]})`}
                ></g>
                <g className="axis--x-text">
                  <text
                    x={panelWidth}
                    y={panelHeight + 1.5 * margins.gapY}
                    className="x-axis-title"
                    textAnchor="end"
                  >
                    {xTitle}
                  </text>
                </g>
              </g>
              <g className="x-distribution-container">
                {rectangleBars.map((d, i) => (
                  <rect
                    key={`bar-${d.id}`}
                    id={`bar-${d.id}`}
                    x={xScale(d[xVariable])}
                    y={yScale(d[yVariable])}
                    width={xScale.bandwidth()}
                    height={yScale(0) - yScale(d[yVariable])}
                    fill={
                      visible && id === d.id
                        ? "#ff7f0e"
                        : color(d[colorVariable])
                    }
                    data-key={d.mutationType}
                    data-color-key={d[colorVariable]}
                    data-fill-key={color(d[colorVariable])}
                    onMouseEnter={(e) => this.handleMouseEnter(d)}
                    onMouseOut={(e) => this.handleMouseOut(d)}
                  />
                ))}
              </g>
              <g className="x-distribution-reference-container">
                {rectangleBarsReference.map((d, i) => (
                  <rect
                    key={`bar-reference-${d.id}`}
                    id={`bar-reference-${d.id}`}
                    x={xScale(d[xVariable]) + xScale.bandwidth() / 4}
                    y={yScale(d[yVariable])}
                    width={xScale.bandwidth() / 2}
                    height={yScale(0) - yScale(d[yVariable])}
                    fill={visible && id === d.id ? "#ff7f0e" : "#EDEDED"}
                    stroke={d3.rgb(color(d[colorVariable])).darker()}
                    strokeWidth={1}
                    data-key={d.mutationType}
                    data-color-key={d[colorVariable]}
                    data-fill-key={color(d[colorVariable])}
                    onMouseEnter={(e) => this.handleMouseEnter(d)}
                    onMouseOut={(e) => this.handleMouseOut(d)}
                  />
                ))}
              </g>
              <g>
                {variantLegendPositions.map((d,i) => (
                  <g
                    key={i}
                    transform={`translate(${[
                      d.pos,
                      panelHeight + 1.66 * margins.gapY,
                    ]})`}
                  >
                    <rect
                        className="legendBar"
                      y={-panelHeight - 1.66 * margins.gapY - margins.gapLegend}
                      width={d.distance}
                      height={margins.barLengend}
                      fill={d.color}
                    />
                    <text
                      textAnchor="middle"
                      x={d.distance / 2}
                      y={
                        -panelHeight -
                        1.66 * margins.gapY -
                        margins.gapLegend +
                        0.68 * margins.barLengend
                      }
                      className="legendBarText variant-legend"
                      fill={"#FFF"}
                      stroke={"#FFF"}
                      strokeWidth={0.5}
                      transform={`rotate(${d.distance > 0 ? 0 : -45})`}
                    >
                      {d.key}
                    </text>
                  </g>
                ))}
              </g>
              <g className="variant-legend-headers">
                {variantLegendHeaderPositions.map((d,i) => (
                  <g key={i}>
                    <g
                      transform={`translate(${[
                        d.pos,
                        -margins.gapLegend - 0.5 * margins.barLengend,
                      ]})`}
                    >
                      <text
                        textAnchor="middle"
                        x={d.distance / 2}
                        className="variant-legend-header"
                        fill="currentColor"
                      >
                        {d.key}
                      </text>
                    </g>
                    <g
                      transform={`translate(${[
                        d.pos,
                        panelHeight + 1.66 * margins.gapY,
                      ]})`}
                    >
                      {d.distance > 0 && d.subtitle.length > 0 && (
                        <polyline
                            className="legendPolyline"
                          points={`${[0, 0]} ${[0, 5]} ${[d.distance, 5]} ${[
                            d.distance,
                            0,
                          ]}`}
                          fill="none"
                          stroke="black"
                        />
                      )}
                      <text
                        textAnchor="middle"
                        x={d.distance / 2}
                        className="legendLowerText variant-legend"
                        fill="currentColor"
                      >
                        {d.subtitle}
                      </text>
                    </g>
                  </g>
                ))}
              </g>
              {visible && (
                <g
                  className="tooltip"
                  transform={`translate(${[tooltip.x, tooltip.y]})`}
                  pointerEvents="none"
                >
                  <rect
                    x="0"
                    y="0"
                    width={d3.max(
                      tooltip.text,
                      (d) => measureText(`${d.label}: ${d.value}`, 12) + 30
                    )}
                    height={tooltip.text.length * 16 + 12}
                    rx="5"
                    ry="5"
                    fill="rgb(97, 97, 97)"
                    fillOpacity="0.67"
                  />
                  <text x="10" y="28" fontSize="12" fill="#FFF">
                    {tooltip.text.map((d, i) => (
                      <tspan key={i} x={10} y={18 + i * 16}>
                        <tspan fontWeight="bold">{d.label}</tspan>: {d.value}
                      </tspan>
                    ))}
                  </text>
                </g>
              )}
            </g>
          </svg>
        </div>
      </Wrapper>
    );
  }
}
BarPlot.propTypes = {
  width: PropTypes.number.isRequired,
  height: PropTypes.number.isRequired,
  dataPoints: PropTypes.array,
};
BarPlot.defaultProps = {
  dataPoints: [],
  referenceDataPoints: [],
  radius: 3.33,
  yDomainRange: [0, 50],
  colorDomain: [0, 40],
  colorSchemeSeq: d3.interpolateYlGnBu,
};
const mapDispatchToProps = () => ({});
const mapStateToProps = () => ({});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withTranslation("common")(BarPlot));
