import copy
import tempfile
import unittest
from pathlib import Path

from monitor import (assess_artifact, observe, read_json, register_new_batches,
                     run, safe_child, scan_dataset, write_json, HERE)


class MonitorTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.source = self.root / "source.txt"
        self.source.write_text("source")
        self.output = self.root / "coverage.arrow"
        self.output.write_bytes(b"output")
        self.definition = {"id": "coverage", "path": "coverage.arrow", "required": True}
        self.lineage = {"evidence": "captured", "sources": [{"path": str(self.source), "fingerprintAtUse": observe(self.source)}], "outputFingerprint": observe(self.output)}

    def tearDown(self):
        self.temp.cleanup()

    def assess(self, lineage=None):
        return assess_artifact(self.definition, lineage or self.lineage, self.root, [])

    def test_source_changes_and_output_replacement(self):
        self.assertEqual(self.assess()["freshness"], "current")
        self.source.write_text("changed source")
        self.assertEqual(self.assess()["status"], "stale")
        self.output.write_bytes(b"replaced output")
        self.assertEqual(self.assess()["freshness"], "output-changed")

    def test_reconstructed_is_never_current(self):
        lineage = copy.deepcopy(self.lineage)
        lineage["evidence"] = "reconstructed"
        self.assertEqual(self.assess(lineage)["freshness"], "unknown")

    def test_transitive_source_change_marks_downstream_stale(self):
        upstream = self.root / "upstream.txt"
        upstream.write_text("original")
        self.lineage["sources"][0]["production"] = {"sources": [{"path": str(upstream), "fingerprintAtUse": observe(upstream)}]}
        self.assertEqual(self.assess()["status"], "present")
        upstream.write_text("changed upstream")
        self.assertEqual(self.assess()["status"], "stale")

    def test_metadata_value_change_detected_without_mtime_comparison(self):
        write_json(self.root / "metadata.json", [{"tmb": 1}])
        definition = {"id": "tmb", "path": "metadata.json", "pointer": "/0/tmb", "required": True}
        lineage = {"evidence": "literal", "outputValue": 0}
        self.assertEqual(assess_artifact(definition, lineage, self.root, [{"tmb": 1}])["status"], "stale")
        self.assertEqual(assess_artifact(definition, lineage, self.root, [{"tmb": 0}])["freshness"], "current")

    def test_missing_source_not_missing_output(self):
        self.source.unlink()
        self.assertEqual(self.assess()["status"], "source-unavailable")

    def test_metadata_input_edit_invalidates_derived_value(self):
        metadata = [{"purity": 0.7, "cov_slope": 2}]
        write_json(self.root / "metadata.json", metadata)
        definition = {"id": "scaling", "path": "metadata.json", "pointer": "/0/cov_slope", "required": True}
        lineage = {"evidence": "captured", "outputValue": 2, "metadataInputs": {"purity": 0.5}}
        self.assertEqual(assess_artifact(definition, lineage, self.root, metadata)["status"], "stale")

    def test_zero_metadata_value_is_present(self):
        write_json(self.root / "metadata.json", [{"tmb": 0}])
        definition = {"id": "tmb", "path": "metadata.json", "pointer": "/0/tmb", "required": True}
        self.assertEqual(assess_artifact(definition, {}, self.root, [{"tmb": 0}])["status"], "present")

    def test_scaling_metadata_dependency_propagates_staleness(self):
        data = self.root / "data"
        case = data / "a"
        write_json(data / "datafiles.json", [{"pair": "a"}])
        write_json(case / "metadata.json", [{"pair": "a", "cov_slope": 2, "cov_intercept": 0}])
        (case / "coverage.arrow").write_bytes(b"coverage")
        write_json(case / ".provenance" / "field-cov_slope.json", {
            "path": "metadata.json", "pointer": "/0/cov_slope", "outputValue": 1,
            "evidence": "literal", "sources": []})
        dataset = {"id": "d", "pipeline": {"batchId": "b", "study": "paired", "dataRoot": str(data), "datafilesLocalPath": str(data / "datafiles.json")}}
        result = scan_dataset(dataset, read_json(HERE / "profiles.json"))
        coverage = next(a for a in result["cases"][0]["artifacts"] if a["id"] == "coverage")
        self.assertEqual(coverage["status"], "stale")
        self.assertEqual(coverage["action"], "Refresh metadata dependency")

    def test_manifest_only_case_does_not_reconstruct_or_modify_metadata(self):
        sheet = self.root / "samplesheet.csv"
        sheet.write_text("patient,pair,sample,status\na,a,t,1\nb,b,u,1\n")
        data = self.root / "data"
        write_json(data / "a" / "metadata.json", [{"pair": "a", "tmb": 0}])
        write_json(data / "datafiles.json", [{"pair": "a", "tmb": 0}])
        dataset = {"id": "d", "pipeline": {"batchId": "b24", "study": "paired", "dataRoot": str(data), "datafilesLocalPath": str(data / "datafiles.json"), "samplesheets": [str(sheet)]}}
        profiles = read_json(HERE / "profiles.json")
        before = (data / "a" / "metadata.json").read_bytes()
        result = scan_dataset(dataset, profiles)
        self.assertEqual({r["caseId"] for r in result["cases"]}, {"a", "b"})
        self.assertFalse(next(r for r in result["cases"] if r["caseId"] == "b")["published"])
        self.assertTrue(all(not a["sources"] for a in result["cases"][0]["artifacts"]))
        scan_dataset(dataset, profiles)
        self.assertEqual(before, (data / "a" / "metadata.json").read_bytes())
        self.assertEqual(read_json(data / "datafiles.json")[0]["tmb"], 0)

    def test_baseline_excluded_and_new_registration_idempotent(self):
        batch = self.root / "nextflow" / "new_batch"
        sheet = batch / "samplesheets" / "samplesheet_paired.csv"
        sheet.parent.mkdir(parents=True)
        sheet.write_text("patient,pair,sample,status\na,a,t,1\n")
        ledger = {"destination": str(batch.parent), "deliveries": {"old": {"status": "baseline"}, "new": {"status": "complete", "target": str(batch)}}}
        config = {"newBatchDataRoot": str(self.root / "gos"), "newBatchDataUrl": "/gos/", "inventoryUrl": "/inventory.json"}
        datasets = []
        self.assertTrue(register_new_batches(config, datasets, ledger))
        self.assertEqual(len(datasets), 1)
        self.assertFalse(register_new_batches(config, datasets, ledger))

    def test_all_runnable_studies_keep_case_scope_and_applicability(self):
        batch = self.root / "nextflow" / "mixed"
        sheets = batch / "samplesheets"
        sheets.mkdir(parents=True)
        studies = ("paired", "ffpe_normal", "heme", "tumor_only")
        all_labels = (*studies, "review", "unmatched", "ffpe")
        for study in all_labels:
            (sheets / ("samplesheet_" + study + ".csv")).write_text(
                "patient,pair,sample,status\n{0},{0},{0},1\n".format(study))
        (sheets / "manifest_inventory.csv").write_text(
            "sample,pair,study_label,reason\n" + "".join(
                "{0},{0},{0},\n".format(study) for study in all_labels))
        ledger = {"destination": str(batch.parent), "deliveries": {
            "new": {"status": "complete", "target": str(batch)}}}
        config = {"newBatchDataRoot": str(self.root / "gos"),
                  "newBatchDataUrl": "/gos/", "inventoryUrl": "/inventory.json"}
        datasets = []
        self.assertTrue(register_new_batches(config, datasets, ledger))
        self.assertEqual({d["pipeline"]["study"] for d in datasets}, set(studies))
        self.assertFalse(register_new_batches(config, datasets, ledger))
        profiles = read_json(HERE / "profiles.json")
        for dataset in datasets:
            study = dataset["pipeline"]["study"]
            result = scan_dataset(dataset, profiles)
            self.assertEqual([case["caseId"] for case in result["cases"]], [study])
            for artifact in result["cases"][0]["artifacts"]:
                if artifact.get("pairedOnly") and study != "paired":
                    self.assertEqual(artifact["status"], "not-applicable")

    def test_opt_in_restored_and_incomplete_delivery_manifest_visible(self):
        sheet = self.root / "inventory.csv"
        sheet.write_text("sample,pair,study_label,reason\nT,P,paired,\nU,U,unmatched,no inventory mapping\n")
        config = {"datasetsPath": str(self.root / "datasets.json"),
                  "ingestionStatePath": str(self.root / "state.json"),
                  "inventoryPath": str(self.root / "inventory.json"),
                  "datasetOverrides": {"d": {"schemaVersion": 1, "study": "paired", "batchId": "B",
                      "dataRoot": str(self.root / "data"), "datafilesLocalPath": str(self.root / "datafiles.json"),
                      "expectedInventoryPath": str(sheet)}}}
        write_json(config["datasetsPath"], [{"id": "d", "title": "Preserved"}])
        write_json(config["ingestionStatePath"], {"deliveries": {
            "old": {"status": "baseline"},
            "new": {"status": "observed", "error": "Missing FASTQs", "expectedInventoryPath": str(sheet)}}})
        result = run(config)
        self.assertEqual(read_json(config["datasetsPath"])[0]["title"], "Preserved")
        self.assertEqual(len(result["deliveries"]), 1)
        self.assertEqual(len(result["deliveries"][0]["expectedSamples"]), 2)
        self.assertEqual([c["caseId"] for c in result["datasets"][0]["cases"]], ["P"])
        self.assertFalse(result["datasets"][0]["cases"][0]["published"])
        # A site manifest generator can remove custom pipeline fields.
        write_json(config["datasetsPath"], [{"id": "d", "title": "Updated externally"}])
        run(config)
        restored = read_json(config["datasetsPath"])[0]
        self.assertEqual(restored["title"], "Updated externally")
        self.assertEqual(restored["pipeline"]["batchId"], "B")
        config["additionalDatasets"] = [{"id": "test", "title": "Pipeline test", "pipeline": restored["pipeline"]}]
        result = run(config)
        self.assertEqual(len(result["datasets"]), 2)
        run(config)
        self.assertEqual(len(read_json(config["datasetsPath"])), 2)

    def test_path_traversal_rejected(self):
        with self.assertRaises(ValueError):
            safe_child(self.root, "../other")

    def test_reconstructed_sources_are_ignored_and_other_runs_do_not_mark_stale(self):
        data = self.root / "data"
        case = data / "a"
        write_json(case / "metadata.json", [{"pair": "a", "provenance": {"artifacts": [
            {"path": "allelic.json", "evidence": "reconstructed", "sources": [{"path": "/wrong"}]}]}}])
        write_json(data / "datafiles.json", [{"pair": "a"}])
        (case / "allelic.json").write_text("{}")
        dataset = {"id": "d", "pipeline": {"batchId": "b", "study": "paired", "dataRoot": str(data),
                   "datafilesLocalPath": str(data / "datafiles.json"), "sourceSets": [{"root": "/inaccessible", "manifests": ["outputs.csv"]}]}}
        profiles = read_json(HERE / "profiles.json")
        artifact = lambda: next(a for a in scan_dataset(dataset, profiles)["cases"][0]["artifacts"] if a["id"] == "allelic")
        self.assertEqual(artifact()["sources"], [])
        write_json(case / ".provenance" / "allelic.json.json", {"path": "allelic.json", "evidence": "captured",
            "sources": [{"path": str(self.source), "fingerprintAtUse": observe(self.source)}],
            "outputFingerprint": observe(case / "allelic.json")})
        self.assertEqual(artifact()["freshness"], "current")
        self.assertEqual(len(artifact()["sources"]), 1)

    def test_explicit_snapshot_registers_expected_case_without_inferring_provenance(self):
        snapshot = self.root / "inputs.json"
        write_json(snapshot, [{"pair": "P___TN", "allelic_jabba_gg": str(self.source)}])
        dataset = {"id": "test", "pipeline": {"batchId": "B", "study": "paired",
            "dataRoot": str(self.root / "data"), "datafilesLocalPath": str(self.root / "datafiles.json"),
            "inputSnapshots": [str(snapshot)]}}
        case = scan_dataset(dataset, read_json(HERE / "profiles.json"))["cases"][0]
        self.assertTrue(case["expected"])
        self.assertFalse(case["published"])
        self.assertEqual(case["configuredInputs"]["row"]["allelic_jabba_gg"], str(self.source))
        self.assertTrue(all(not artifact["sources"] for artifact in case["artifacts"]))


if __name__ == "__main__":
    unittest.main()
