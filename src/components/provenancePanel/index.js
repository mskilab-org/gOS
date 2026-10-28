import React from "react";
import {
  Alert,
  Descriptions,
  Empty,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import Remapping from "./remapping";
import { visualElementUrl } from "../../helpers/visualElementLinks";

const { Text, Link } = Typography;
const colors = {
  present: "green",
  stale: "orange",
  "potentially-stale": "orange",
  "source-unavailable": "orange",
  "dependency-unavailable": "orange",
  "missing-output": "red",
  "inspection-error": "red",
};
const flattenSources = (sources = []) =>
  sources.flatMap((source) => [
    source,
    ...flattenSources(source.upstreamSources || source.production?.sources),
  ]);
export const formatTimestamp = (value) => {
  if (value == null) return "Unknown";
  const date = new Date(typeof value === "number" ? value * 1000 : value);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
};

const PathText = ({ value }) =>
  value ? (
    <Text copyable style={{ overflowWrap: "anywhere" }}>
      {value}
    </Text>
  ) : (
    <Text type="secondary">Unresolved</Text>
  );

export default function ProvenancePanel({
  artifacts = [],
  dataPath,
  caseId,
  datasetId,
  configuredInputs,
  remapping,
}) {
  if (!artifacts.length)
    return (
      <Empty description="Provenance has not been recorded for this case." />
    );
  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Remapping
        datasetId={datasetId}
        caseId={caseId}
        configuredInputs={configuredInputs}
        configuration={remapping}
      />
      {artifacts.some(
        (a) =>
          (!a.evidence || a.evidence === "unknown") &&
          (!a.status || a.output?.state === "present"),
      ) && (
        <Alert
          type="info"
          showIcon
          message="Upload provenance unavailable for some artifacts"
          description="Re-upload from an explicit cached cohort with provenance-enabled Skilift to record the consumed inputs."
        />
      )}
      <Table
        rowKey={(a) => a.id || `${a.path}#${a.pointer || ""}`}
        dataSource={artifacts}
        pagination={{ defaultPageSize: 20, showSizeChanger: true }}
        scroll={{ x: 850 }}
        columns={[
          {
            title: "Visual element",
            render: (_, a) => (
              <Space direction="vertical" size={0}>
                <Link
                  strong
                  href={visualElementUrl(
                    a,
                    { datasetId, caseId, dataPath },
                    window.location.href,
                  )}
                >
                  {a.label || a.id || a.path}
                </Link>
                <Text type="secondary">{a.group}</Text>
              </Space>
            ),
          },
          {
            title: "gOS artifact",
            render: (_, a) =>
              dataPath && caseId ? (
                <Link
                  href={`${dataPath}${encodeURIComponent(caseId)}/${a.path}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {a.path}
                  {a.pointer ? `#${a.pointer}` : ""}
                </Link>
              ) : (
                <Text>
                  {a.path}
                  {a.pointer ? `#${a.pointer}` : ""}
                </Text>
              ),
          },
          {
            title: "Availability",
            render: (_, a) => (
              <Tag color={colors[a.status]}>{a.status || "Not inspected"}</Tag>
            ),
          },
          { title: "Evidence", dataIndex: "evidence" },
          { title: "Freshness", render: (_, a) => a.freshness || "Unknown" },
          { title: "Next action", dataIndex: "action" },
        ]}
        expandable={{
          expandedRowRender: (artifact) => (
            <Space direction="vertical" style={{ width: "100%" }}>
              <Descriptions
                size="small"
                column={2}
                bordered
                items={[
                  {
                    key: "upload",
                    label: "Upload ID",
                    children: artifact.upload?.id || "Unknown",
                  },
                  {
                    key: "cache",
                    label: "Cached cohort",
                    children: (
                      <PathText value={artifact.upload?.cachedCohort?.path} />
                    ),
                  },
                  {
                    key: "selection",
                    label: "Selected graph column",
                    children: artifact.selection?.graphColumn || "—",
                  },
                  {
                    key: "produced",
                    label: "Produced",
                    children: formatTimestamp(artifact.producedAt),
                  },
                  {
                    key: "modified",
                    label: "Output modified",
                    children: formatTimestamp(artifact.output?.mtime),
                  },
                  {
                    key: "relation",
                    label: "Timestamp relationship",
                    children: artifact.timestampRelationship || "Unknown",
                  },
                  {
                    key: "producer",
                    label: "Producer",
                    children: artifact.producer
                      ? `${artifact.producer.package} ${artifact.producer.version}`
                      : "Historical build unknown",
                  },
                  {
                    key: "scope",
                    label: "Input scope",
                    children: artifact.sourceScope || "Unknown",
                  },
                  {
                    key: "metadata",
                    label: "Metadata dependencies",
                    children: artifact.metadataFields?.join(", ") || "—",
                  },
                ]}
              />
              {artifact.unresolvedRoles?.length > 0 && (
                <Alert
                  type="warning"
                  message={`Unresolved input roles: ${artifact.unresolvedRoles.join(", ")}`}
                />
              )}
              {artifact.output?.error && (
                <Alert type="error" message={artifact.output.error} />
              )}
              {artifact.metadataDependencies?.map((dependency) => (
                <Text key={dependency.id}>
                  Metadata {dependency.id}: {dependency.status} ·{" "}
                  {dependency.freshness}
                </Text>
              ))}
              {artifact.parameters && (
                <Text code>
                  Parameters: {JSON.stringify(artifact.parameters)}
                </Text>
              )}
              <Table
                size="small"
                pagination={false}
                rowKey={(s, index) => `${s.path}:${s.role}:${index}`}
                dataSource={flattenSources(artifact.sources)}
                columns={[
                  { title: "Role", dataIndex: "role" },
                  {
                    title: "Source path",
                    render: (_, s) => (
                      <Space direction="vertical">
                        <PathText value={s.path} />
                        <Text type="secondary">
                          Resolved:{" "}
                          {s.observation?.resolvedPath ||
                            s.fingerprintAtUse?.resolvedPath ||
                            "Unknown"}
                        </Text>
                        {s.tablePath && (
                          <Text type="secondary">
                            From {s.tablePath} · {s.originalColumn}
                          </Text>
                        )}
                      </Space>
                    ),
                  },
                  {
                    title: "State",
                    render: (_, s) =>
                      s.observation?.error ||
                      s.observation?.state ||
                      "Not inspected",
                  },
                  {
                    title: "Source modified",
                    render: (_, s) => formatTimestamp(s.observation?.mtime),
                  },
                  {
                    title: "Consumed version",
                    render: (_, s) =>
                      s.fingerprintAtUse
                        ? `${formatTimestamp(s.fingerprintAtUse.mtime)} · ${s.fingerprintAtUse.size} bytes`
                        : "Unknown",
                  },
                ]}
              />
              {artifact.evidence === "literal" && (
                <Text>
                  Input value: {JSON.stringify(artifact.value)} ·{" "}
                  {artifact.origin || "cohort input"}
                </Text>
              )}
            </Space>
          ),
        }}
      />
    </Space>
  );
}
