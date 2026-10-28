import React, { useState } from "react";
import axios from "axios";
import {
  Alert,
  Button,
  Empty,
  Modal,
  Select,
  Space,
  Table,
  Typography,
} from "antd";
import {
  replacementOptions,
  remappingDocument,
} from "../../helpers/pipelineRemapping";

export default function Remapping({
  datasetId,
  caseId,
  configuredInputs,
  configuration,
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [groups, setGroups] = useState([]);
  const [selected, setSelected] = useState({});
  if (!configuration?.catalogPath || !configuredInputs?.row) return null;
  const infer = async () => {
    setOpen(true);
    setLoading(true);
    setError(null);
    setSelected({});
    setGroups([]);
    try {
      const { data } = await axios.get(configuration.catalogPath, {
        params: { checked: Date.now() },
      });
      if (data.schemaVersion !== 1 || data.datasetId !== datasetId)
        throw new Error("Replacement catalog does not match this dataset");
      setGroups(
        replacementOptions(
          data,
          caseId,
          configuredInputs.row,
          configuration.caseIds,
        ),
      );
    } catch (failure) {
      setError(failure.message);
    } finally {
      setLoading(false);
    }
  };
  const download = () => {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            remappingDocument(datasetId, caseId, groups, selected),
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${caseId}.remapping.json`;
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <>
      <Button onClick={infer}>Infer replacement paths</Button>
      <Modal
        title="Infer replacement paths"
        open={open}
        width={1000}
        onCancel={() => setOpen(false)}
        footer={
          <Button
            type="primary"
            disabled={!Object.values(selected).some(Boolean)}
            onClick={download}
          >
            Export selected remapping
          </Button>
        }
      >
        <Space direction="vertical" style={{ width: "100%" }}>
          <Alert
            type="info"
            message="Select proposed inputs for a subsequent upload"
            description="Candidates are matched from the configured run catalog. Exported selections can be passed to upload_cached_cohorts.R with --remap. Recorded provenance continues to describe the completed upload."
          />
          {error && <Alert type="error" message={error} />}
          <Table
            loading={loading}
            dataSource={groups}
            rowKey="column"
            pagination={false}
            locale={{
              emptyText: <Empty description="No alternative paths found" />,
            }}
            columns={[
              { title: "Cohort column", dataIndex: "column" },
              {
                title: "Recorded input",
                render: (_, group) => (
                  <Typography.Text
                    copyable
                    style={{ overflowWrap: "anywhere" }}
                  >
                    {group.fromPath}
                  </Typography.Text>
                ),
              },
              {
                title: "Proposed replacement",
                render: (_, group) => (
                  <Select
                    allowClear
                    placeholder="Keep recorded path"
                    style={{ width: 380 }}
                    value={selected[group.column]}
                    onChange={(value) =>
                      setSelected((current) => ({
                        ...current,
                        [group.column]: value,
                      }))
                    }
                    options={group.candidates.map((candidate) => ({
                      value: candidate.path,
                      label: candidate.path,
                    }))}
                  />
                ),
              },
            ]}
          />
        </Space>
      </Modal>
    </>
  );
}
