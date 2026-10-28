import React, { useState } from "react";
import { useSelector } from "react-redux";
import {
  Alert,
  Button,
  Card,
  Input,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from "antd";
import usePipelineInventory from "../../hooks/usePipelineInventory";
import {
  getBrowseScopeDatasetId,
  isAllDatasetsBrowseScope,
} from "../../helpers/browseScope";
import ProvenancePanel, {
  formatTimestamp,
} from "../../components/provenancePanel";

export default function PipelinePage() {
  const datasets = useSelector((s) => s.Datasets.records || []);
  const selected = useSelector((s) => s.Settings.dataset);
  const browseScope = useSelector((s) => s.Settings.browseScope);
  const scope = isAllDatasetsBrowseScope(browseScope)
    ? null
    : getBrowseScopeDatasetId(browseScope) || selected?.id;
  const settings = useSelector((s) => s.Settings.data);
  const path =
    selected?.pipeline?.inventoryPath ||
    settings.pipelineInventoryPath ||
    datasets.find((d) => d.pipeline?.inventoryPath)?.pipeline.inventoryPath;
  const [revision, setRevision] = useState(0);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const { data, error, loading } = usePipelineInventory(path, revision);
  const rows = (data?.datasets || [])
    .filter((dataset) => !scope || dataset.id === scope)
    .flatMap((dataset) =>
      dataset.cases.map((record) => ({
        ...record,
        datasetTitle: dataset.title,
      })),
    )
    .filter((row) =>
      `${row.caseId} ${row.batchId} ${row.samples?.join(" ") || ""}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .filter(
      (row) =>
        filter === "all" ||
        (filter === "missing"
          ? !row.published || row.missingRequired > 0 || row.sourceIssues > 0
          : filter === "stale"
            ? row.stale > 0 || row.potentiallyStale > 0
            : row.inspectionErrors > 0),
    );
  const caseUrl = (record) => {
    const url = new URL(window.location.href);
    url.searchParams.delete("view");
    url.searchParams.delete("scope");
    url.searchParams.set("dataset", record.datasetId);
    url.searchParams.set("report", record.caseId);
    url.searchParams.set("tab", "7");
    return url.toString();
  };
  return (
    <Card style={{ margin: 24 }}>
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Space>
          <Typography.Title level={3} style={{ margin: 0 }}>
            Pipeline
          </Typography.Title>
          <Button onClick={() => setRevision((r) => r + 1)}>
            Refresh observations
          </Button>
        </Space>
        <Typography.Text>
          New batches and explicitly registered backfills. Last filesystem
          inspection: {formatTimestamp(data?.checkedAt)}
        </Typography.Text>
        {!path && (
          <Alert
            type="info"
            message="No pipeline inventory configured"
            description="Set pipelineInventoryPath in settings.json or pipeline.inventoryPath on a dataset."
          />
        )}
        {error && (
          <Alert
            type="error"
            message="Could not load pipeline inventory"
            description={error.message}
          />
        )}
        {data?.errors?.map((e) => (
          <Alert
            key={e.datasetId}
            type="error"
            message={`${e.datasetId}: ${e.message}`}
          />
        ))}
        <Space wrap>
          <Input.Search
            placeholder="Find batch or sample"
            allowClear
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ width: 260 }}
          />
          <Select
            value={filter}
            onChange={setFilter}
            style={{ minWidth: 180 }}
            options={[
              { value: "all", label: "All statuses" },
              { value: "missing", label: "Missing required data" },
              { value: "stale", label: "Stale artifacts" },
              { value: "error", label: "Inspection errors" },
            ]}
          />
        </Space>
        <Spin spinning={loading}>
          <Table
            dataSource={rows}
            rowKey={(r) => `${r.datasetId}:${r.caseId}`}
            scroll={{ x: 950 }}
            columns={[
              {
                title: "Case",
                render: (_, r) =>
                  r.published && r.metadataPresent ? (
                    <Typography.Link href={caseUrl(r)}>
                      {r.caseId}
                    </Typography.Link>
                  ) : (
                    <Typography.Text>{r.caseId}</Typography.Text>
                  ),
              },
              {
                title: "Dataset / batch",
                render: (_, r) => (
                  <Space direction="vertical" size={0}>
                    <Typography.Text>{r.datasetTitle}</Typography.Text>
                    <Typography.Text type="secondary">
                      {r.batchId}
                    </Typography.Text>
                  </Space>
                ),
              },
              { title: "Study", dataIndex: "study" },
              {
                title: "In gOS",
                render: (_, r) => (
                  <Tag color={r.published ? "green" : "orange"}>
                    {r.published ? "Published" : "Not published"}
                  </Tag>
                ),
              },
              {
                title: "Expected",
                render: (_, r) =>
                  r.expected ? "Yes" : "Extra published/run entry",
              },
              { title: "Missing required", dataIndex: "missingRequired" },
              {
                title: "Source / dependency issues",
                dataIndex: "sourceIssues",
              },
              { title: "Stale", dataIndex: "stale" },
              { title: "Potentially stale", dataIndex: "potentiallyStale" },
              { title: "Inspection errors", dataIndex: "inspectionErrors" },
            ]}
            expandable={{
              expandedRowRender: (r) => (
                <ProvenancePanel
                  artifacts={r.artifacts}
                  caseId={r.caseId}
                  datasetId={r.datasetId}
                  configuredInputs={r.configuredInputs}
                  remapping={r.remapping}
                  dataPath={
                    datasets.find((d) => d.id === r.datasetId)?.dataPath
                  }
                />
              ),
            }}
          />
        </Spin>
        {data?.deliveries?.length > 0 && (
          <Table
            size="small"
            rowKey="delivery"
            dataSource={data.deliveries}
            pagination={false}
            columns={[
              { title: "Discovered delivery", dataIndex: "delivery" },
              { title: "Ingestion state", dataIndex: "status" },
              { title: "Publication target", dataIndex: "target" },
              {
                title: "Issue",
                render: (_, r) => r.error || r.inventoryError || "—",
              },
            ]}
            expandable={{
              expandedRowRender: (r) => (
                <Table
                  size="small"
                  pagination={false}
                  rowKey="sample"
                  dataSource={r.expectedSamples || []}
                  columns={[
                    { title: "Expected sample", dataIndex: "sample" },
                    { title: "Pair", dataIndex: "pair" },
                    { title: "Study", dataIndex: "study_label" },
                    { title: "Matching issue", dataIndex: "reason" },
                  ]}
                />
              ),
            }}
          />
        )}
      </Space>
    </Card>
  );
}
