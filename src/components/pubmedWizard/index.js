import React, { useState } from "react";
import { PropTypes } from "prop-types";
import { Input, Alert, DatePicker, Form, Pagination, Tooltip, message } from "antd";
import { PlusOutlined, LoadingOutlined } from '@ant-design/icons';
import {
  Container,
  SearchSection,
  FiltersGrid,
  ResultsSection,
  ResultsHeader,
  List,
  ViewLink
} from "./index.style";
import { withTranslation } from "react-i18next";
import { usePubmedSearch } from "../../hooks/usePubmedSearch";
import { useGPT } from "../../hooks/useGPT";
import { usePaperSummarizer } from '../../hooks/usePaperSummarizer';
import { usePubmedFullText } from '../../hooks/usePubmedFullText';
import { OPENAI_TOOLS } from "../../hooks/useGPTToolRouter"; // Import the tools

const { RangePicker } = DatePicker;
const PubmedWizard = ({ t, onAddCitation, record }) => {
  const [searchTerm, setSearchTerm] = useState(() => {
    if (!record) return "";
  
    const terms = [];
    if (record.gene) terms.push(record.gene);
  
    return terms.join(" ");
  });
  const [results, setResults] = useState([]);
  const [prevSearchTerm, setPrevSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [range, setRange] = useState([0, 0]);
  const [filters, setFilters] = useState({
    author: '',
    journal: '',
    dateRange: null
  });

  const { searchPubmed, isLoading, error } = usePubmedSearch();
  const { queryGPT } = useGPT(); // queryGPT function from the hook
  const { summarizePaper } = usePaperSummarizer();
  const { getFullText } = usePubmedFullText();

  const [isRanking, setIsRanking] = useState(false);
  const [addingPmid, setAddingPmid] = useState(null); // State for loading indicator

  // Encapsulated function for getting ranked PMIDs using GPT tool call
  async function getRankedPmidsFromGPT(variantSummary, papers, gptQueryFunc) {
    if (!variantSummary || !papers || papers.length === 0) {
      return []; // No context or papers, no recommendations
    }

    const systemMessage = {
      role: 'system',
      content: `You are an expert clinical research assistant. Your task is to identify the most relevant PubMed papers from a provided list, given a specific clinical context (e.g., a patient's variant summary).`
    };

    const userMessageContent = `
      Context:
      ${variantSummary}
      The user is a clinician investigating a cancer patient harboring this mutation.

      Papers (PMID and Title):
      ${JSON.stringify(papers)}

      Based on the context and the list of papers, please identify the PMIDs of the most relevant papers and use the "rankPapersByRelevance" tool to provide them.
      `;

    const messages = [
      systemMessage,
      { role: 'user', content: userMessageContent }
    ];

    try {
      // Use the passed queryGPT function
      const gptResponse = await gptQueryFunc(null, { 
        messages: messages,
        tools: OPENAI_TOOLS,
        tool_choice: {"type": "function", "function": {"name": "rankPapersByRelevance"}},
        model: 'smart',
      });

      console.log("GPT response for ranking:", gptResponse);

      if (gptResponse && gptResponse.tool_calls && gptResponse.tool_calls.length > 0) {
        const toolCall = gptResponse.tool_calls[0];
        if (toolCall.function.name === "rankPapersByRelevance") {
          const args = JSON.parse(toolCall.function.arguments);
          console.log("Parsed arguments from rankPapersByRelevance tool call:", args);
          return args.recommendedPmids || []; 
        }
      }
      console.warn("rankPapersByRelevance tool was not called as expected or returned no PMIDs. Response:", gptResponse);
      return []; 
    } catch (e) {
      console.error('Error fetching recommendations via GPT tool:', e);
      return []; 
    }
  }

  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleSearch = async (page = 1) => {
    setIsRanking(true);
    const pageToUse = searchTerm !== prevSearchTerm ? 1 : page;
    const searchResults = await searchPubmed(searchTerm, filters, pageToUse);
    // Extract paper titles from the search results
    const paperTitles = searchResults.articles.map(item => { return {pmid: Number(item.pmid), title: item.title} }) // Ensure pmid is number for stringify
    
    const papersInfo = searchResults.articles.map(item => { 
      return {
        pmid: Number(item.pmid), 
        title: item.title,
        abstract: item.abstract,
        journal: item.journal,
        year: item.year,
      } 
    })

    // Determine recommended PMIDs if context is provided
    let recommendedPmidsArray = []; // This will be an array of numbers
    if (record && record.variant_summary && paperTitles.length) {
      // Call the new function, passing the queryGPT function from the hook
      recommendedPmidsArray = await getRankedPmidsFromGPT(record.variant_summary, papersInfo, queryGPT);
      console.log("Recommended PMIDs from tool:", recommendedPmidsArray);
    }

    // Mark and sort articles: recommended ones first
    const recommendedArticles = [];
    const nonRecommendedArticles = [];
    searchResults.articles.forEach(article => {
      // recommendedPmidsArray is now an array of numbers
      if (Array.isArray(recommendedPmidsArray) && recommendedPmidsArray.includes(Number(article.pmid))) {
        article.recommended = true;
        recommendedArticles.push(article);
      } else {
        article.recommended = false;
        nonRecommendedArticles.push(article);
      }
    });

    const sortedArticles = [...recommendedArticles, ...nonRecommendedArticles];

    setResults(sortedArticles);
    setIsRanking(false);
    setTotal(searchResults.total);
    setRange(searchResults.range);
    setCurrentPage(pageToUse);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    handleSearch(page);
  };

  const handleAddCitation = async (item) => {
    if (onAddCitation) {
      setAddingPmid(item.pmid);
      let summary = null;
      try {
        const pmid = item.pmid;
        const fullTextResult = await getFullText(pmid);
        if (fullTextResult) {
          if (fullTextResult.isFullText && fullTextResult.fullText) {
            try {
              summary = await summarizePaper(fullTextResult.fullText);
            } catch (summaryError) {
              console.error(`Error summarizing PMID ${pmid}:`, summaryError);
              // Optionally, inform the user that summarization failed but abstract might be available
            }
          } else if (fullTextResult.abstract) {
            summary = fullTextResult.abstract; // Use abstract if full text not available or summarization fails
          }
        }
      } catch (fetchError) {
        console.error('Error fetching full text or abstract:', fetchError);
        // Using a more generic key as this message is for the console, actual user message for failure is not requested here.
        // If user-facing error is needed: message.error(t('components.pubmed-wizard.fetch-summary-error', 'Failed to fetch paper summary.'));
      } finally {
        // Ensure memoryItem is created and onAddCitation is called even if summary fetching fails
        const memoryItem = {
          id: `paper-${item.pmid}`,
          type: 'paper',
          title: `Paper: ${item.title} (PMID: ${item.pmid})`,
          data: {
            abstract: item.abstract,
            authors: item.authors,
            journal: item.journal,
            year: item.year,
            pmid: item.pmid, // Ensure pmid is part of data
            summary: summary, // Add the fetched/summarized text (could be null)
            source: 'pubmed'
          }, // Send the whole article or selected fields
          selectedForContext: true // Default to selected, can be changed in NotesModal
        };
        console.log("Adding citation:", memoryItem);
        onAddCitation(memoryItem);
        setAddingPmid(null);
      }
    }
  };

  return (
    <Container>
      <SearchSection>
        <Form layout="vertical">
          <Input.Search
            value={searchTerm}
            onChange={handleSearchChange}
            onSearch={() => {
              setPrevSearchTerm(searchTerm);
              handleSearch(1);
            }}
            placeholder={t("components.pubmed-wizard.search-placeholder")}
            loading={isLoading}
            enterButton
          />
          
          <FiltersGrid>
            <Form.Item label={t("components.pubmed-wizard.author")}>
              <Input
                placeholder={t("components.pubmed-wizard.author-placeholder")}
                value={filters.author}
                onChange={(e) => handleFilterChange('author', e.target.value)}
              />
            </Form.Item>
            
            <Form.Item label={t("components.pubmed-wizard.journal")}>
              <Input
                placeholder={t("components.pubmed-wizard.journal-placeholder")}
                value={filters.journal}
                onChange={(e) => handleFilterChange('journal', e.target.value)}
              />
            </Form.Item>
            
            <Form.Item label={t("components.pubmed-wizard.date-range")}>
              <RangePicker
                style={{ width: '100%' }}
                onChange={(dates) => handleFilterChange('dateRange', dates)}
                placeholder={['YYYY-MM-DD', 'YYYY-MM-DD']}
              />
            </Form.Item>
          </FiltersGrid>
        </Form>
      </SearchSection>

      <ResultsSection>
        {error && (
          <Alert
            type="error"
            message={t("components.pubmed-wizard.error-searching")}
            description={error}
            style={{ marginBottom: 16 }}
          />
        )}

        {results.length > 0 && (
          <ResultsHeader>
            <h2>{t("components.pubmed-wizard.results.title")} ({total})</h2>
          </ResultsHeader>
        )}

        <List
          itemLayout="vertical"
          dataSource={results}
          loading={isLoading || isRanking}
          locale={{ emptyText: t("components.pubmed-wizard.no-results") }}
          pagination={false}
          renderItem={item => (
            <List.Item>
              <List.Item.Meta
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <ViewLink 
                      href={item.link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      {item.title}
                      {item.recommended && (
                        <span style={{ color: "red", marginLeft: 8, fontWeight: "bold" }}>
                          Recommended
                        </span>
                      )}
                    </ViewLink>
                    <Tooltip title={t("components.pubmed-wizard.results.add-citation-tooltip")}>
                      {addingPmid === item.pmid ? (
                        <LoadingOutlined style={{ fontSize: '16px', color: '#1890ff' }} />
                      ) : (
                        <PlusOutlined 
                          onClick={(e) => {
                            e.preventDefault();
                            handleAddCitation(item);
                          }}
                          style={{ 
                            cursor: 'pointer',
                          fontSize: '16px',
                          color: '#1890ff'
                        }}
                      />
                    )}
                    </Tooltip>
                  </div>
                }
                description={
                  <>
                    <div>{`${item.journal} (${item.year})`}</div>
                    <div style={{ fontStyle: 'italic' }}>{item.authors}</div>
                  </>
                }
              />
              {item.abstract}
            </List.Item>
          )}
        />
        {total > 0 && (
          <Pagination
            current={currentPage}
            total={total}
            pageSize={10}
            onChange={handlePageChange}
            showTotal={() => `${range[0]}-${range[1]} of ${total}`}
            style={{ marginTop: '20px', textAlign: 'center' }}
            showSizeChanger={false}
            showQuickJumper={true}
          />
        )}
      </ResultsSection>
    </Container>
  );
};

PubmedWizard.propTypes = {
  t: PropTypes.func.isRequired,
};

export default withTranslation("common")(PubmedWizard);
