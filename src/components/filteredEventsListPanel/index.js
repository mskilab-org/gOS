import React, { Component, useState, useEffect } from "react";
import { withTranslation } from "react-i18next";
import { withRouter } from "react-router-dom";
import { connect } from "react-redux";
import { Tag, Table, Button, Space, Row, Col, Skeleton, Modal, Input, Spin, Empty, Card, Checkbox } from "antd";
import { roleColorMap } from "../../helpers/utility";
import TracksModal from "../tracksModal";
import Wrapper from "./index.style";
import { CgArrowsBreakeH } from "react-icons/cg";
import { EditFilled } from "@ant-design/icons";
import filteredEventsActions from "../../redux/filteredEvents/actions";
import ErrorPanel from "../errorPanel";

  // Function to query PubMed API
const queryPubMed = async (query) => {
  const searchTerm = `${query}`;
  const encodedTerm = encodeURIComponent(searchTerm);

  // First, get the PMIDs
  const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodedTerm}&retmode=json&retmax=50`;
  const searchResponse = await fetch(searchUrl);
  const searchData = await searchResponse.json();
  const pmids = searchData.esearchresult.idlist;

  // Then, fetch details for each PMID in XML format
  const fetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${pmids.join(',')}&retmode=xml`;
  const fetchResponse = await fetch(fetchUrl);
  const fetchText = await fetchResponse.text();

  // Parse XML
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(fetchText, "text/xml");

  // Extract titles, abstracts, PMIDs, and publication years
  const articles = xmlDoc.getElementsByTagName("PubmedArticle");
  let result = [];
  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    const pmid = article.querySelector("PMID")?.textContent;
    const title = article.querySelector("ArticleTitle")?.textContent || 'No title available';
    const abstract = article.querySelector("AbstractText")?.textContent || 'No abstract available';
    const pubDate = article.querySelector("PubDate");
    const year = pubDate ? pubDate.querySelector("Year")?.textContent : 'Year not available';
    const journal = article.querySelector("Journal > Title")?.textContent || 'Journal not available';
    const link = `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;

    result.push({
      pmid,
      title,
      abstract,
      year,
      journal,
      link
    });
  }
  return result;
};

  // Function to query ClinicalTrials.gov API
const queryClinicalTrials = async (query) => {
  const locationQuery = 'New York';
  const recruitmentStatus = 'RECRUITING|NOT_YET_RECRUITING';

  const searchUrl = `https://clinicaltrials.gov/api/v2/studies?format=json&query.term=${encodeURIComponent(query)}&query.locn=${encodeURIComponent(locationQuery)}&filter.overallStatus=${encodeURIComponent(recruitmentStatus)}&pageSize=50`;

  try {
    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();
    const studies = searchData.studies || [];

    let result = [];
    for (let i = 0; i < studies.length; i++) {
      const study = studies[i];
      const nctId = study.protocolSection?.identificationModule?.nctId || 'N/A';
      const title = study.protocolSection?.identificationModule?.briefTitle || 'No title available';
      const description = study.protocolSection?.descriptionModule?.briefSummary || 'No description available';
      const status = study.protocolSection?.statusModule?.overallStatus || 'Status not available';
      const link = `https://clinicaltrials.gov/study/${nctId}`;

      result.push({
        nctId,
        title,
        description,
        status,
        link
      });
    }

    return result;
  } catch (error) {
    console.error('Error querying ClinicalTrials.gov:', error);
    return [];
  }
};

const ClinicalTrialsCard = ({ trial }) => {
  const { nctId, title, description, status, link } = trial;

  return (
    <Card style={{ marginBottom: '16px' }}>
      <Card.Meta
        title={<span style={{ whiteSpace: 'normal', wordWrap: 'break-word' }}>{title}</span>}
      />
      <div style={{ marginTop: '16px' }}>
        <p><b>NCT ID:</b> {nctId}</p>
        <p><b>Status:</b> {status}</p>
        <p><b>Description:</b> {description}</p>
        <p><b>Link:</b> <a href={link} target="_blank" rel="noopener noreferrer">{link}</a></p>
      </div>
    </Card>
  );
};

const ClinicalTrialsList = ({ trials, loading, searchTerm, onSearchTermChange, onSearch }) => {
  return (
    <div style={{ maxHeight: '400px', overflowY: 'auto', marginTop: '16px' }}>
      <div style={{ display: 'flex', marginBottom: '16px' }}>
        <Input
          value={searchTerm}
          onChange={onSearchTermChange}
          placeholder="Search Clinical Trials"
        />
        <Button onClick={onSearch}>Search</Button>
      </div>
      {loading ? (
        <Spin tip="Loading clinical trials..." />
      ) : trials.length > 0 ? (
        <Row gutter={[16, 16]}>
          {trials.map((trial, index) => (
            <Col span={32} key={index}>
              <ClinicalTrialsCard trial={trial} />
            </Col>
          ))}
        </Row>
      ) : (
        <Empty description="No clinical trials found" />
      )}
    </div>
  );
};

const ArticleCard = ({ article, onSelect, isSelected }) => {
  const { title, journal, year, abstract, link } = article;

  return (
    <Card style={{ marginBottom: '16px' }}>
      <Card.Meta
        title={
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Checkbox
              checked={isSelected}
              onChange={() => onSelect(article)}
              style={{ marginRight: '16px' }}
            />
            <span style={{ flex: 1, whiteSpace: 'normal', wordWrap: 'break-word' }}>{title}</span>
          </div>
        }
      />
      <div style={{ marginTop: '16px' }}>
        <p><b>Journal:</b> {journal}</p>
        <p><b>Year:</b> {year}</p>
        <p><b>Abstract:</b> {abstract}</p>
        <p><b>Link:</b> <a href={link} target="_blank" rel="noopener noreferrer">{link}</a></p>
      </div>
    </Card>
  );
};

const ArticleList = ({ articles }) => {
  const [selectedArticles, setSelectedArticles] = useState([]);

  const handleSelect = (article) => {
    setSelectedArticles((prevSelected) => {
      if (prevSelected.includes(article)) {
        return prevSelected.filter((a) => a !== article);
      } else {
        return [...prevSelected, article];
      }
    });
  };

  return (
    <Row gutter={[16, 16]}>
      {articles.map((article, index) => (
        <Col span={32} key={index}>
          <ArticleCard
            article={article}
            onSelect={handleSelect}
            isSelected={selectedArticles.includes(article)}
          />
        </Col>
      ))}
    </Row>
  );
};

const NotesModal = ({
  isVisible,
  currentRecord,
  notes,
  articles,
  clinicalTrials,
  loadingArticles,
  loadingClinicalTrials,
  onOk,
  onCancel,
  onNoteChange,
  onPubMedQuery,
  onClinicalTrialsQuery,
  searchTerm,
  onSearchTermChange,
  clinicalTrialsSearchTerm,
  onClinicalTrialsSearchTermChange,
}) => {
  const [isPubMedChecked, setIsPubMedChecked] = useState(false);
  const [isClinicalTrialsChecked, setIsClinicalTrialsChecked] = useState(false);
  const [showArticles, setShowArticles] = useState(false);
  const [showClinicalTrials, setShowClinicalTrials] = useState(false);

  useEffect(() => {
    setShowArticles(false); // Reset showArticles when modal is opened for a new record
    setShowClinicalTrials(false); // Reset showClinicalTrials when modal is opened for a new record
  }, [currentRecord]);

  const handlePubMedCheckboxChange = async (e) => {
    setIsPubMedChecked(e.target.checked);
    if (e.target.checked) {
      setShowArticles(true);
      onPubMedQuery();
    } else {
      setShowArticles(false);
    }
  };

  const handleClinicalTrialsCheckboxChange = async (e) => {
    setIsClinicalTrialsChecked(e.target.checked);
    if (e.target.checked) {
      setShowClinicalTrials(true);
      onClinicalTrialsQuery();
    } else {
      setShowClinicalTrials(false);
    }
  };

  const handleOk = () => {
    onOk();
    setShowArticles(false);
    setShowClinicalTrials(false);
    setIsPubMedChecked(false);
    setIsClinicalTrialsChecked(false);
  };

  const handleCancel = () => {
    onCancel();
    setShowArticles(false);
    setShowClinicalTrials(false);
    setIsPubMedChecked(false);
    setIsClinicalTrialsChecked(false);
  };

  return (
    <Modal
      title="Add Notes"
      visible={isVisible}
      onOk={handleOk}
      onCancel={handleCancel}
      width={800} // Adjust the width as needed
    >
      <Checkbox onChange={handlePubMedCheckboxChange} checked={isPubMedChecked}>PubMed Articles</Checkbox>
      <Checkbox onChange={handleClinicalTrialsCheckboxChange} checked={isClinicalTrialsChecked}>Clinical Trials</Checkbox>
      <Input.TextArea
        rows={4}
        value={currentRecord ? notes[currentRecord.gene] : ""}
        onChange={onNoteChange}
      />
      {showArticles && (
        <div style={{ maxHeight: '400px', overflowY: 'auto', marginTop: '16px' }}>
          <div style={{ display: 'flex', marginBottom: '16px' }}>
            <Input
              value={searchTerm[currentRecord.gene]}
              onChange={onSearchTermChange}
              placeholder="Search PubMed"
            />
            <Button onClick={onPubMedQuery}>Search</Button>
          </div>
          {loadingArticles ? (
            <Spin tip="Loading articles..." />
          ) : articles[currentRecord?.gene]?.length > 0 ? (
            <ArticleList articles={articles[currentRecord.gene]} />
          ) : (
            <Empty description="No articles found" />
          )}
        </div>
      )}
      {showClinicalTrials && (
        <ClinicalTrialsList
          trials={clinicalTrials[currentRecord?.gene] || []}
          loading={loadingClinicalTrials}
          searchTerm={clinicalTrialsSearchTerm[currentRecord.gene] || ''}
          onSearchTermChange={(e) => onClinicalTrialsSearchTermChange(e, currentRecord.gene)}
          onSearch={onClinicalTrialsQuery}
        />
      )}
    </Modal>
  );
};


const { selectFilteredEvent } = filteredEventsActions;

class FilteredEventsListPanel extends Component {
  state = {
    isModalVisible: false,
    currentRecord: null,
    notes: {},
    pubMedSearchTerm: {},
    clinicalTrialsSearchTerm: {},
    articles: {},
    clinicalTrials: {},
    loadingArticles: false,
    loadingClinicalTrials: false,
  };

  componentDidMount() {
    const savedNotes = JSON.parse(localStorage.getItem("notes")) || {};
    this.setState({ notes: savedNotes });
  }

  showModal = (record) => {
    this.setState({ isModalVisible: true, currentRecord: record });
  };

  handleOk = () => {
    const { currentRecord, notes } = this.state;
    localStorage.setItem("notes", JSON.stringify(notes));
    this.setState({ isModalVisible: false, currentRecord: null });
  };

  handleCancel = () => {
    this.setState({ isModalVisible: false, currentRecord: null });
  };

  handleNoteChange = (e) => {
    const { currentRecord, notes } = this.state;
    const updatedNotes = { ...notes, [currentRecord.gene]: e.target.value };
    this.setState({ notes: updatedNotes });
  };

  handleSearchTermChange = (e) => {
    const { currentRecord, pubMedSearchTerm } = this.state;
    const updatedSearchTerm = { ...pubMedSearchTerm, [currentRecord.gene]: e.target.value };
    this.setState({ pubMedSearchTerm: updatedSearchTerm });
  };

  handleClinicalTrialsSearchTermChange = (e, gene) => {
    const { clinicalTrialsSearchTerm } = this.state;
    const updatedSearchTerm = { ...clinicalTrialsSearchTerm, [gene]: e.target.value };
    this.setState({ clinicalTrialsSearchTerm: updatedSearchTerm });
  };

  handlePubMedQuery = async () => {
    const { currentRecord, articles, pubMedSearchTerm } = this.state;
    if (currentRecord) {
      const gene = currentRecord.gene;
      const defaultSearchTerm = `${gene} ${currentRecord.variant}`;
      if (!articles[gene] || pubMedSearchTerm[gene] !== defaultSearchTerm) {
        this.setState({ loadingArticles: true });
        const fetchedArticles = await queryPubMed(pubMedSearchTerm[gene] || defaultSearchTerm);
        this.setState({
          articles: { ...articles, [gene]: fetchedArticles },
          loadingArticles: false,
        });
      }
    }
  };

  handleClinicalTrialsQuery = async () => {
    const { currentRecord, clinicalTrials, clinicalTrialsSearchTerm } = this.state;
    if (currentRecord) {
      const gene = currentRecord.gene;
      const defaultSearchTerm = `${gene} ${currentRecord.variant}`;
      if (!clinicalTrials[gene] || clinicalTrialsSearchTerm[gene] !== defaultSearchTerm) {
        this.setState({ loadingClinicalTrials: true });
        const fetchedTrials = await queryClinicalTrials(clinicalTrialsSearchTerm[gene] || defaultSearchTerm);
        this.setState({
          clinicalTrials: { ...clinicalTrials, [gene]: fetchedTrials },
          loadingClinicalTrials: false,
        });
      }
    }
  };

  exportToMarkdown = () => {
    const { filteredEvents } = this.props;
    const { notes } = this.state;

    let markdownContent = "# Filtered Events\n\n";

    // Add table
    markdownContent += "| Gene | Name | Variant | Type | Role | Tier | OncoKB Cancer Types | OncoKB Tier | OncoKB Alterations | OncoKB Drugs | Location |\n";
    markdownContent += "|------|------|---------|------|------|------|---------------------|-------------|---------------------|--------------|----------|\n";
    filteredEvents.forEach(event => {
      markdownContent += `| ${event.gene} | ${event.name} | ${event.variant} | ${event.type} | ${event.role} | ${event.tier} | ${event.oncokb_cancer_types} | ${event.oncokb_tier} | ${event.oncokb_alterations} | ${event.oncokb_drugs} | ${event.location} |\n`;
    });

    // Add notes
    markdownContent += "\n# Notes\n\n";
    filteredEvents.forEach(event => {
      markdownContent += `## ${event.gene}\n`;
      markdownContent += `**Details:**\n`;
      markdownContent += `- Name: ${event.name}\n`;
      markdownContent += `- Variant: ${event.variant}\n`;
      markdownContent += `- Type: ${event.type}\n`;
      markdownContent += `- Role: ${event.role}\n`;
      markdownContent += `- Tier: ${event.tier}\n`;
      markdownContent += `- OncoKB Cancer Types: ${event.oncokb_cancer_types}\n`;
      markdownContent += `- OncoKB Tier: ${event.oncokb_tier}\n`;
      markdownContent += `- OncoKB Alterations: ${event.oncokb_alterations}\n`;
      markdownContent += `- OncoKB Drugs: ${event.oncokb_drugs}\n`;
      markdownContent += `- Location: ${event.location}\n\n`;
      markdownContent += `**Notes:**\n${notes[event.gene] || "No notes"}\n\n`;
    });

    // Create a blob and download the file
    const blob = new Blob([markdownContent], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "filtered_events.md";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  render() {
    const {
      t,
      id,
      filteredEvents,
      selectedFilteredEvent,
      loading,
      error,
      genome,
      mutations,
      chromoBins,
      coverageData,
      hetsnpsData,
      genesData,
      allelicData,
      selectFilteredEvent,
    } = this.props;

    const {
      isModalVisible,
      currentRecord,
      notes,
      articles,
      clinicalTrials,
      loadingArticles,
      loadingClinicalTrials,
      pubMedSearchTerm,
      clinicalTrialsSearchTerm,
    } = this.state;

    let open = selectedFilteredEvent?.id;
    const columns = [
      {
        title: 'Notes',
        key: "notes",
        render: (_, record) => (
          <Button
            type="link"
            icon={<EditFilled />}
            onClick={() => this.showModal(record)}
          />
        ),
      },
      {
        title: t("components.filtered-events-panel.gene"),
        dataIndex: "gene",
        key: "gene",
        filters: [...new Set(filteredEvents.map((d) => d.gene))].map((d) => {
          return {
            text: d,
            value: d,
          };
        }),
        filterMultiple: false,
        onFilter: (value, record) => record.gene.indexOf(value) === 0,
      },
      {
        title: t("components.filtered-events-panel.name"),
        dataIndex: "name",
        key: "name",
      },
      {
        title: t("components.filtered-events-panel.variant"),
        dataIndex: "variant",
        key: "variant",
        filters: [...new Set(filteredEvents.map((d) => d.variant))].map((d) => {
          return {
            text: d,
            value: d,
          };
        }),
        filterMultiple: false,
        onFilter: (value, record) => record.variant.indexOf(value) === 0,
      },
      {
        title: t("components.filtered-events-panel.type"),
        dataIndex: "type",
        key: "type",
        filters: [...new Set(filteredEvents.map((d) => d.type))].map((d) => {
          return {
            text: d,
            value: d,
          };
        }),
        filterMultiple: false,
        onFilter: (value, record) => record.type.indexOf(value) === 0,
      },
      {
        title: t("components.filtered-events-panel.role"),
        dataIndex: "role",
        key: "role",
        render: (role) => (
          <>
            {role?.split(",").map((tag) => (
              <Tag color={roleColorMap()[tag.trim()]} key={tag.trim()}>
                {tag.trim()}
              </Tag>
            ))}
          </>
        ),
        filters: [
          ...new Set(
            filteredEvents
              .map((d) => d.role.split(","))
              .flat()
              .map((d) => d.trim())
          ),
        ].map((d) => {
          return {
            text: d,
            value: d,
          };
        }),
        onFilter: (value, record) => record.role.includes(value),
      },
      {
        title: t("components.filtered-events-panel.tier"),
        dataIndex: "tier",
        key: "tier",
        sorter: (a, b) => a.tier - b.tier,
        filters: [...new Set(filteredEvents.map((d) => d.tier))].map((d) => {
          return {
            text: d,
            value: d,
          };
        }),
        filterMultiple: false,
        onFilter: (value, record) => record.tier === value,
      },
      {
        title: t("components.filtered-events-panel.oncokb_cancer_types"),
        dataIndex: "oncokb_cancer_types",
        key: "oncokb_cancer_types",
        filters: [...new Set(filteredEvents.map((d) => d.oncokb_cancer_types))].map((d) => {
          return {
            text: d,
            value: d,
          };
        }),
        filterMultiple: false,
        onFilter: (value, record) => record.oncokb_cancer_types === value,
      },
      {
        title: t("components.filtered-events-panel.oncokb_tier"),
        dataIndex: "oncokb_tier",
        key: "oncokb_tier",
        sorter: (a, b) => a.oncokb_tier - b.oncokb_tier,
        filters: [...new Set(filteredEvents.map((d) => d.oncokb_tier))].map((d) => {
          return {
            text: d,
            value: d,
          };
        }),
        filterMultiple: false,
        onFilter: (value, record) => record.oncokb_tier === value,
      },
      {
        title: t("components.filtered-events-panel.oncokb_alterations"),
        dataIndex: "oncokb_alterations",
        key: "oncokb_alterations",
        filters: [...new Set(filteredEvents.map((d) => d.oncokb_alterations))].map((d) => {
          return {
            text: d,
            value: d,
          };
        }),
        filterMultiple: false,
        onFilter: (value, record) => record.oncokb_alterations === value,
      },
      {
        title: t("components.filtered-events-panel.oncokb_drugs"),
        dataIndex: "oncokb_drugs",
        key: "oncokb_drugs",
        filters: [...new Set(filteredEvents.map((d) => d.oncokb_drugs))].map((d) => {
          return {
            text: d,
            value: d,
          };
        }),
        filterMultiple: false,
        onFilter: (value, record) => record.oncokb_drugs === value,
      },
      {
        title: t("components.filtered-events-panel.location"),
        dataIndex: "location",
        key: "location",
        render: (_, record) => (
          <Button type="link" onClick={() => selectFilteredEvent(record)}>
            {record.location}
          </Button>
        ),
      },
    ];

    return (
      <Wrapper>
        <Row className="ant-panel-container ant-home-plot-container">
          <Col className="gutter-row" span={24}>
            {error ? (
              <ErrorPanel
                avatar={<CgArrowsBreakeH />}
                header={t("components.filtered-events-panel.header")}
                title={t("components.filtered-events-panel.error.title", {
                  id,
                })}
                subtitle={t("components.filtered-events-panel.error.subtitle")}
                explanationTitle={t(
                  "components.filtered-events-panel.error.explanation.title"
                )}
                explanationDescription={error.stack}
              />
            ) : (
              <Skeleton active loading={loading}>
                <Table
                  columns={columns}
                  dataSource={filteredEvents}
                  pagination={{ pageSize: 50 }}
                />
                <Button type="primary" onClick={this.exportToMarkdown}>
                  Export to Markdown
                </Button>
                {selectedFilteredEvent && (
                  <TracksModal
                    {...{
                      loading,
                      genomeData: genome,
                      mutationsData: mutations,
                      coverageData,
                      hetsnpsData,
                      genesData,
                      chromoBins,
                      allelicData,
                      modalTitleText: selectedFilteredEvent.gene,
                      modalTitle: (
                        <Space>
                          {selectedFilteredEvent.gene}
                          {selectedFilteredEvent.name}
                          {selectedFilteredEvent.type}
                          {selectedFilteredEvent.role?.split(",").map((tag) => (
                            <Tag
                              color={roleColorMap()[tag.trim()]}
                              key={tag.trim()}
                            >
                              {tag.trim()}
                            </Tag>
                          ))}
                          {selectedFilteredEvent.tier}
                          {selectedFilteredEvent.location}
                        </Space>
                      ),
                      genomePlotTitle: t("components.tracks-modal.genome-plot"),
                      genomePlotYAxisTitle: t(
                        "components.tracks-modal.genome-y-axis-title"
                      ),
                      coveragePlotTitle: t(
                        "components.tracks-modal.coverage-plot"
                      ),
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
                      mutationsPlotTitle: t(
                        "components.tracks-modal.mutations-plot"
                      ),
                      mutationsPlotYAxisTitle: t(
                        "components.tracks-modal.mutations-plot-y-axis-title"
                      ),
                      allelicPlotTitle: t(
                        "components.tracks-modal.allelic-plot"
                      ),
                      allelicPlotYAxisTitle: t(
                        "components.tracks-modal.allelic-plot-y-axis-title"
                      ),
                      handleOkClicked: () => selectFilteredEvent(null),
                      handleCancelClicked: () => selectFilteredEvent(null),
                      open,
                    }}
                  />
                )}
              </Skeleton>
            )}
          </Col>
        </Row>
        <NotesModal
          isVisible={isModalVisible}
          currentRecord={currentRecord}
          notes={notes}
          articles={articles}
          clinicalTrials={clinicalTrials}
          loadingArticles={loadingArticles}
          loadingClinicalTrials={loadingClinicalTrials}
          onOk={this.handleOk}
          onCancel={this.handleCancel}
          onNoteChange={this.handleNoteChange}
          onPubMedQuery={this.handlePubMedQuery}
          onClinicalTrialsQuery={this.handleClinicalTrialsQuery}
          searchTerm={pubMedSearchTerm}
          onSearchTermChange={this.handleSearchTermChange}
          clinicalTrialsSearchTerm={clinicalTrialsSearchTerm}
          onClinicalTrialsSearchTermChange={this.handleClinicalTrialsSearchTermChange}
        />
      </Wrapper>
    );
  }
}

FilteredEventsListPanel.propTypes = {};
FilteredEventsListPanel.defaultProps = {};

const mapDispatchToProps = (dispatch) => ({
  selectFilteredEvent: (filteredEvent) =>
    dispatch(selectFilteredEvent(filteredEvent)),
});

const mapStateToProps = (state) => ({
  loading: state.FilteredEvents.loading,
  filteredEvents: state.FilteredEvents.filteredEvents,
  selectedFilteredEvent: state.FilteredEvents.selectedFilteredEvent,
  error: state.FilteredEvents.error,
  id: state.CaseReport.id,
  report: state.CaseReport.metadata,
  genome: state.Genome.data,
  mutations: state.Mutations.data,
  allelicData: state.Allelic.data,
  chromoBins: state.Settings.chromoBins,
  coverageData: state.GenomeCoverage.data,
  hetsnpsData: state.Hetsnps.data,
  genesData: state.Genes.data,
});

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withRouter(withTranslation("common")(FilteredEventsListPanel)));
