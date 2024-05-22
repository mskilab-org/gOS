import React, { Component } from "react";
import { withTranslation } from "react-i18next";
import { connect } from "react-redux";
import { withRouter } from "react-router-dom";
import { ScrollToHOC } from "react-scroll-to";
import { Tabs, Skeleton, Affix, Card, Segmented, Space } from "antd";
import { reportFilters } from "../../helpers/utility";
import HomeWrapper from "./home.style";
import HeaderPanel from "../../components/headerPanel";
import PopulationTab from "../../components/populationTab";
import SummaryTab from "../../components/summaryTab";
import QcTab from "../../components/qcTab";
import appActions from "../../redux/app/actions";
import BinQCTab from "../../components/binQCTab";
import ListView from "../listView";
import TracksTab from "../../components/tracksTab";
import BarPlotPanel from "../../components/barPlotPanel";

const { TabPane } = Tabs;
const { Meta } = Card;

const { selectReport, searchReports, selectTab } = appActions;

class Home extends Component {
  state = {
    populationKPIMode: "total",
    signatureKPIMode: "total",
  };

  handleTabChanged = (tab) => {
    const { selectTab } = this.props;
    selectTab(tab);
  };

  handleCardClick = (event, report) => {
    event.stopPropagation();
    // In case cmd buttom is clicked
    if (event.metaKey) {
      let url = new URL(decodeURI(document.location));
      url.searchParams.set("report", report);
      const newWindow = window.open(url, "_blank", "noopener,noreferrer");
      if (newWindow) newWindow.opener = null;
    } else {
      this.props.selectReport(report);
    }
  };

  handlePopulationKPIsSegmentedChange = (populationKPIMode) => {
    this.setState({ populationKPIMode });
  };

  handleSignatureKPIsSegmentedChange = (signatureKPIMode) => {
    this.setState({ signatureKPIMode });
  };

  render() {
    const {
      t,
      loading,
      metadata,
      plots,
      tumorPlots,
      report,
      reports,
      totalReports,
      variantQC,
      sageQC,
      mutationCatalog,
      mutationsColorPalette,
      ppFitImage,
      ppfit,
      chromoBins,
      reportsFilters,
      searchReports,
      searchFilters,
      coverageData,
      hetsnpsData,
      genesData,
      tab,
      signaturePlots,
      signatureTumorPlots,
    } = this.props;
    if (!metadata) return null;
    const { beta, gamma } = metadata;
    const { populationKPIMode, signatureKPIMode } = this.state;
    return (
      <HomeWrapper>
        <Skeleton active loading={loading}>
          {report && (
            <Affix offsetTop={0}>
              <div className="ant-home-header-container">
                <HeaderPanel />
              </div>
            </Affix>
          )}
          {report && (
            <div className="ant-home-content-container">
              <Tabs
                defaultActiveKey="1"
                activeKey={tab.toString()}
                onChange={(tab) => this.handleTabChanged(tab)}
              >
                <TabPane tab={t("components.tabs.tab1")} key="1">
                  <SummaryTab />
                </TabPane>
                <TabPane tab={t("components.tabs.tab2")} key="2">
                  <TracksTab />
                </TabPane>
                <TabPane tab={t("components.tabs.tab3")} key="3">
                  <Segmented
                    options={[
                      {
                        label: t("components.segmented-filter.total"),
                        value: "total",
                      },
                      {
                        label: t("components.segmented-filter.tumor", {
                          tumor: metadata.tumor,
                        }),
                        value: "byTumor",
                      },
                    ]}
                    onChange={(d) =>
                      this.handlePopulationKPIsSegmentedChange(d)
                    }
                  />
                  <PopulationTab
                    {...{
                      loading,
                      metadata,
                      plots,
                      visible: populationKPIMode === "total",
                    }}
                  />
                  <PopulationTab
                    {...{
                      loading,
                      metadata,
                      plots: tumorPlots,
                      visible: populationKPIMode === "byTumor",
                    }}
                  />
                </TabPane>
                <TabPane tab={t("components.tabs.tab4")} key="4">
                  <QcTab variants={variantQC} sages={sageQC} />
                </TabPane>
                <TabPane tab={t("components.tabs.tab5")} key="5">
                  <BinQCTab
                    imageBlob={ppFitImage}
                    fits={ppfit}
                    coverageData={coverageData}
                    hetsnpsData={hetsnpsData}
                    genesData={genesData}
                    chromoBins={chromoBins}
                    slope={1 / beta}
                    intercept={gamma / beta}
                  />
                </TabPane>
                <TabPane tab={t("components.tabs.tab6")} key="6">
                  <BarPlotPanel
                    dataPoints={mutationCatalog}
                    title={t("components.mutation-catalog-panel.title")}
                    legendTitle={t("metadata.mutation-type")}
                    xTitle={""}
                    xVariable={"tnc"}
                    xFormat={null}
                    yTitle={t("components.mutation-catalog-panel.y-title")}
                    yVariable={"mutations"}
                    yFormat={"~s"}
                    colorVariable={"variant"}
                    colorPalette={mutationsColorPalette}
                  />
                  <br />
                  <Segmented
                    options={[
                      {
                        label: t("components.segmented-filter.total"),
                        value: "total",
                      },
                      {
                        label: t("components.segmented-filter.tumor", {
                          tumor: metadata.tumor,
                        }),
                        value: "byTumor",
                      },
                    ]}
                    onChange={(d) => this.handleSignatureKPIsSegmentedChange(d)}
                  />
                  <PopulationTab
                    {...{
                      loading,
                      metadata,
                      plots: signaturePlots,
                      visible: signatureKPIMode === "total",
                    }}
                  />
                  <PopulationTab
                    {...{
                      loading,
                      metadata,
                      plots: signatureTumorPlots,
                      visible: signatureKPIMode === "byTumor",
                    }}
                  />
                </TabPane>
              </Tabs>
            </div>
          )}
          {!report && (
            <ListView
              records={reports}
              handleCardClick={this.handleCardClick}
              filters={reportsFilters}
              onSearch={searchReports}
              searchFilters={searchFilters}
              totalRecords={totalReports}
            />
          )}
        </Skeleton>
      </HomeWrapper>
    );
  }
}
Home.propTypes = {};
Home.defaultProps = {};
const mapDispatchToProps = (dispatch) => ({
  selectReport: (report) => dispatch(selectReport(report)),
  searchReports: (filters) => dispatch(searchReports(filters)),
  selectTab: (tab) => dispatch(selectTab(tab)),
});
const mapStateToProps = (state) => ({
  loading: state.App.loading,
  report: state.App.report,
  reports: state.App.reports,
  reportsFilters: state.App.reportsFilters,
  searchFilters: state.App.searchFilters,
  totalReports: state.App.totalReports,
  metadata: state.App.metadata,
  mutationsColorPalette: state.App.settings?.mutationsColorPalette,
  plots: state.App.populationMetrics,
  tumorPlots: state.App.tumorPopulationMetrics,
  signaturePlots: state.App.signatureMetrics,
  signatureTumorPlots: state.App.tumorSignatureMetrics,
  variantQC: state.App.variantQC,
  sageQC: state.App.sageQC,
  mutationCatalog: state.App.mutationCatalog,
  ppFitImage: state.App.ppFitImage,
  ppfit: state.App.ppfit,
  chromoBins: state.App.chromoBins,
  coverageData: state.App.coverageData,
  hetsnpsData: state.App.hetsnpsData,
  genesData: state.App.genesData,
  tab: state.App.tab,
});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withRouter(withTranslation("common")(ScrollToHOC(Home))));
