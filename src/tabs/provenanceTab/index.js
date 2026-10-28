import React, { useState } from "react";
import { useSelector } from "react-redux";
import { Alert, Button, Space, Spin, Typography } from "antd";
import usePipelineInventory from "../../hooks/usePipelineInventory";
import ProvenancePanel, {
  formatTimestamp,
} from "../../components/provenancePanel";

export default function ProvenanceTab() {
  const dataset = useSelector((s) => s.Settings.dataset);
  const { id, metadata } = useSelector((s) => s.CaseReport);
  const [revision, setRevision] = useState(0);
  const { data, error, loading } = usePipelineInventory(
    dataset?.pipeline?.inventoryPath,
    revision,
  );
  const record = data?.datasets
    .find((d) => d.id === dataset?.id)
    ?.cases.find((c) => c.caseId === id);
  const scanError = data?.errors?.find((e) => e.datasetId === dataset?.id);
  return (
    <Space direction="vertical" style={{ width: "100%", padding: 16 }}>
      <Space>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Provenance
        </Typography.Title>
        <Button onClick={() => setRevision((r) => r + 1)}>
          Refresh observations
        </Button>
      </Space>
      <Typography.Text type="secondary">
        Last filesystem inspection: {formatTimestamp(data?.checkedAt)}
      </Typography.Text>
      {(error || scanError) && (
        <Alert
          type="error"
          showIcon
          message="Inventory unavailable"
          description={error?.message || scanError.message}
        />
      )}
      <Spin spinning={loading}>
        <ProvenancePanel
          artifacts={
            record?.artifacts ||
            metadata?.provenance?.artifacts?.filter((a) =>
              ["captured", "literal"].includes(a.evidence),
            ) ||
            []
          }
          dataPath={dataset?.dataPath}
          caseId={id}
          datasetId={dataset?.id}
          configuredInputs={record?.configuredInputs}
          remapping={record?.remapping}
        />
      </Spin>
    </Space>
  );
}
