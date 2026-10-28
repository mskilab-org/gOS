#!/usr/bin/env python3
"""Publish read-only gOS pipeline observations. No sequencing payloads are read.

Only explicitly opted-in datasets and post-baseline ingestion deliveries are scanned.
Source mapping comes from successful upload receipts. Candidate discovery is opt-in.
"""

import argparse
import csv
import datetime
import fcntl
import hashlib
import json
import os
from pathlib import Path
import tempfile


HERE = Path(__file__).resolve().parent


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def read_json(path):
    with Path(path).open() as handle:
        return json.load(handle)


def write_json(path, value):
    """Same-filesystem atomic replacement, retaining the existing file mode."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    mode = path.stat().st_mode & 0o777 if path.exists() else 0o644
    with tempfile.NamedTemporaryFile(mode="w", dir=path.parent, delete=False) as handle:
        temporary = Path(handle.name)
        try:
            json.dump(value, handle, indent=2, allow_nan=False)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
            os.chmod(temporary, mode)
            os.replace(temporary, path)
        finally:
            temporary.unlink(missing_ok=True)


def write_dataset_config(path, value):
    """The shared deployment permits editing datasets.json but not its directory.

    Use atomic replacement wherever supported; shared-file fallback serializes
    writers and keeps a backup in the monitor's writable state directory.
    """
    path = Path(path)
    def merge(current):
        additions = {dataset["id"]: dataset for dataset in value}
        merged = []
        for dataset in current:
            proposed = additions.pop(dataset["id"], None)
            if proposed and proposed.get("pipeline"):
                dataset = {**dataset, "pipeline": {**proposed["pipeline"], **dataset.get("pipeline", {})}}
            merged.append(dataset)
        return merged + list(additions.values())

    if os.access(path.parent, os.W_OK):
        write_json(path, merge(read_json(path)))
        return
    with path.open("r+") as handle:
        fcntl.flock(handle, fcntl.LOCK_EX)
        payload = json.dumps(merge(json.load(handle)), indent=2, allow_nan=False) + "\n"
        handle.seek(0)
        handle.write(payload)
        handle.truncate()
        handle.flush()
        os.fsync(handle.fileno())


def safe_child(root, relative):
    relative = Path(relative)
    if relative.is_absolute() or ".." in relative.parts or str(relative) in ("", "."):
        raise ValueError("Expected a relative artifact/case path: " + str(relative))
    return Path(root) / relative


def observe(path):
    try:
        stat = Path(path).stat()
        return {"state": "present", "resolvedPath": str(Path(path).resolve()),
                "size": stat.st_size, "mtime": stat.st_mtime,
                "mtimeNs": str(stat.st_mtime_ns), "symlink": Path(path).is_symlink()}
    except FileNotFoundError:
        return {"state": "missing"}
    except OSError as error:
        return {"state": "error", "error": str(error)}


def same_fingerprint(left, right):
    if not left or not right or left.get("state") != "present" or right.get("state") != "present":
        return False
    if left.get("resolvedPath") != right.get("resolvedPath") or left.get("size") != right.get("size"):
        return False
    if left.get("mtimeNs") and right.get("mtimeNs"):
        return left["mtimeNs"] == right["mtimeNs"]
    return abs(left.get("mtime", 0) - right.get("mtime", 0)) < 0.00001


def populated(value):
    return isinstance(value, str) and value.strip() not in ("", "NA", "null", "/dev/null")


def csv_rows(path):
    with Path(path).open(newline="") as handle:
        return list(csv.DictReader(handle))


def file_id(path):
    return hashlib.sha256(str(path).encode()).hexdigest()[:20]


def source_index(pipeline, aliases):
    """Retain all matching run candidates; never pick the newest run by mtime."""
    cases = {}
    manifests = []
    for source_set in pipeline.get("sourceSets", []):
        root = Path(source_set["root"])
        for pattern in source_set.get("manifests", ["outputs.csv"]):
            if Path(pattern).is_absolute() or ".." in Path(pattern).parts:
                raise ValueError("Source manifest patterns must be relative")
            manifests.extend(sorted(root.glob(pattern)))
    cohort_file = pipeline.get("cohortInputsPath")
    tables = [(str(path), csv_rows(path), False) for path in dict.fromkeys(manifests)]
    if cohort_file:
        tables.append((cohort_file, read_json(cohort_file), True))
    for table_path, rows, is_cohort in tables:
        for row in rows:
            case_id = row.get("pair") or row.get("patient_id")
            if not case_id:
                continue
            info = cases.setdefault(case_id, {"sources": {}, "tables": [], "identity": {}})
            info["tables"].append(table_path)
            for key in ("tumor_sample", "normal_sample"):
                if row.get(key):
                    info["identity"][key] = row[key]
            for role in set(row) | set(aliases):
                for column in aliases.get(role, [role]):
                    value = row.get(column)
                    if not populated(value) or not (value.startswith(("/", "./", "../", "~"))):
                        continue
                    path = Path(value).expanduser()
                    if not path.is_absolute():
                        path = Path(table_path).parent / path
                    source = {"id": file_id(path), "role": role, "path": str(path),
                              "originalColumn": column, "tablePath": table_path}
                    if is_cohort:
                        info["sources"][role] = [source]
                    else:
                        existing = info["sources"].setdefault(role, [])
                        if not any(x["path"] == source["path"] for x in existing):
                            existing.append(source)
                    break
    for info in cases.values():
        for kind in ("tumor", "normal"):
            candidates = []
            for bam in info["sources"].get(kind + "_bam", []):
                path = Path(bam["path"])
                resolved = path.resolve()
                options = [Path(str(path) + ".bai"), path.with_suffix(".bai"),
                           Path(str(resolved) + ".bai"), resolved.with_suffix(".bai")]
                index = next((x for x in options if x.is_file()), options[0])
                candidates.append({**bam, "id": file_id(index), "role": kind + "_bai", "path": str(index)})
            info["sources"][kind + "_bai"] = candidates
    return cases


def expected_cases(pipeline):
    result = {}
    inventory_path = pipeline.get("expectedInventoryPath")
    paths = pipeline.get("samplesheets", []) + ([inventory_path] if inventory_path else [])
    for path in paths:
        for row in csv_rows(path):
            if row.get("study_label") and row["study_label"] != pipeline["study"]:
                continue
            case_id = row.get("pair") or row.get("patient") or row.get("sample")
            if case_id:
                entry = result.setdefault(case_id, {"samplesheetPaths": [], "samples": [], "reasons": []})
                if path not in entry["samplesheetPaths"]:
                    entry["samplesheetPaths"].append(path)
                if row.get("sample") not in entry["samples"]:
                    entry["samples"].append(row.get("sample"))
                if row.get("reason") and row["reason"] not in entry["reasons"]:
                    entry["reasons"].append(row["reason"])
    return result


def artifact_definitions(pipeline, profiles):
    profile = pipeline.get("profile", "wgs-" + pipeline["study"] + "-v1")
    if profile not in ("wgs-paired-v1", "wgs-tumor_only-v1"):
        raise ValueError("Unsupported artifact profile: " + profile)
    definitions = {x["id"]: dict(x) for x in profiles["artifacts"]}
    for override in pipeline.get("expectedArtifacts", []):
        definitions[override["id"]] = {**definitions.get(override["id"], {}), **override}
    for definition in definitions.values():
        definition.setdefault("label", definition["id"])
        definition.setdefault("required", False)
        if definition.get("pairedOnly") and pipeline.get("study") != "paired":
            definition["applicable"] = False
    return list(definitions.values())


def pointer_value(document, pointer):
    value = document
    for part in pointer.strip("/").split("/"):
        key = part.replace("~1", "/").replace("~0", "~")
        value = value[int(key)] if isinstance(value, list) else value[key]
    return value


def observe_sources(sources):
    result = []
    for source in sources:
        observed = {**source, "observation": observe(source["path"])}
        if source.get("production"):
            observed["upstreamSources"] = observe_sources(source["production"].get("sources", []))
        result.append(observed)
    return result


def flatten_sources(sources):
    return [s for source in sources for s in [source, *flatten_sources(source.get("upstreamSources", []))]]


def assess_artifact(definition, lineage, case_dir, metadata):
    output = observe(safe_child(case_dir, definition["path"]))
    if output["state"] == "present" and definition.get("pointer"):
        try:
            value = pointer_value(metadata, definition["pointer"])
            if value is None:
                output = {**output, "state": "missing-value"}
        except (KeyError, ValueError, TypeError, IndexError):
            output = {**output, "state": "missing-value"}
    # Inferred mappings never establish what an upload consumed.
    if lineage.get("evidence") not in ("captured", "literal"):
        lineage = {}
    sources = observe_sources(lineage.get("sources", []))
    all_sources = flatten_sources(sources)
    states = [s["observation"]["state"] for s in all_sources]
    status, action = "present", "None"
    evidence = lineage.get("evidence", "unknown")
    freshness = "unknown"
    if definition.get("applicable") is False:
        status, action = "not-applicable", "None"
    elif output["state"] == "error" or "error" in states:
        status, action = "inspection-error", "Inspect access/error"
    elif output["state"] != "present":
        ready = bool(sources) and "missing" not in states and not lineage.get("unresolvedRoles")
        status = "missing-output" if definition["required"] else "optional-missing"
        action = "Ready to lift" if ready else "Resolve upstream inputs"
    elif "missing" in states:
        status, action = "source-unavailable", "Locate source"
    if evidence == "captured" and all_sources and all(s.get("fingerprintAtUse") for s in all_sources):
        changed = any(not same_fingerprint(s["fingerprintAtUse"], s["observation"]) for s in all_sources)
        output_at_use = lineage.get("outputFingerprint")
        replaced = (not definition.get("pointer") and definition["path"] != "metadata.json"
                    and output_at_use and not same_fingerprint(output_at_use, output))
        freshness = "changed" if changed else "current"
        if replaced:
            freshness = "output-changed"
        if (changed or replaced) and status == "present":
            status, action = "stale", "Re-lift"
    if definition["path"] == "metadata.json" and output["state"] == "present":
        if evidence == "literal" and ("outputValue" in lineage or "outputValues" in lineage):
            freshness = "current"
        replaced = any(metadata[0].get(field) != value for field, value in (lineage.get("metadataInputs") or {}).items())
        if "outputValue" in lineage and definition.get("pointer"):
            replaced = replaced or pointer_value(metadata, definition["pointer"]) != lineage["outputValue"]
        elif "outputValues" in lineage and metadata:
            replaced = {k: v for k, v in metadata[0].items() if k != "provenance"} != lineage["outputValues"]
        if replaced:
            freshness = "output-changed"
            if status == "present":
                status, action = "stale", "Re-lift"
    relationship = "unknown"
    present_sources = [s["observation"] for s in sources if s["observation"]["state"] == "present"]
    if output.get("mtime") and present_sources:
        relationship = "source-newer" if max(s["mtime"] for s in present_sources) > output["mtime"] else "output-newer-or-equal"
    return {**definition, **lineage, "id": definition["id"], "path": definition["path"], "pointer": definition.get("pointer"),
            "status": status, "action": action, "freshness": freshness, "evidence": evidence,
            "output": output, "sources": sources, "timestampRelationship": relationship}


def scan_dataset(dataset, profiles):
    pipeline = dataset["pipeline"]
    root = Path(pipeline["dataRoot"])
    manifest_path = Path(pipeline["datafilesLocalPath"])
    manifest = read_json(manifest_path) if manifest_path.exists() else []
    if not isinstance(manifest, list):
        raise ValueError("datafiles manifest must be an array")
    published = {r.get("caseReportId") or r.get("pair"): r for r in manifest}
    expected = expected_cases(pipeline)
    configured_inputs = {}
    for path in pipeline.get("inputSnapshots", []):
        for row in read_json(path):
            configured_inputs[row["pair"]] = {"row": row, "snapshotPath": path}
            expected.setdefault(row["pair"], {"samples": [row[key] for key in ("tumor_sample", "normal_sample") if row.get(key)]})
    definitions = artifact_definitions(pipeline, profiles)
    cases = []
    for case_id in sorted(set(published) | set(expected) | set(configured_inputs)):
        case_dir = safe_child(root, case_id)
        metadata_path = case_dir / "metadata.json"
        metadata = read_json(metadata_path) if metadata_path.exists() else []
        if metadata and (not isinstance(metadata, list) or not isinstance(metadata[0], dict)):
            raise ValueError("Invalid metadata for " + case_id)
        provenance = metadata[0].get("provenance") if metadata else None
        provenance = provenance or {}
        lineages = {(a["path"], a.get("pointer")): a for a in provenance.get("artifacts", [])
                    if a.get("evidence") in ("captured", "literal")}
        # Successful individual lifters leave receipts even before metadata finalization.
        for receipt in sorted((case_dir / ".provenance").glob("*.json")):
            artifact = read_json(receipt)
            if artifact.get("evidence") in ("captured", "literal"):
                lineages[(artifact["path"], artifact.get("pointer"))] = artifact
        metadata_lineage = lineages.get(("metadata.json", None), {})
        if metadata_lineage.get("evidence") == "captured":
            lineages = {key: value for key, value in lineages.items()
                        if key[0] != "metadata.json" or not key[1]
                        or value.get("producedAt") == metadata_lineage.get("producedAt")}
        case_definitions = list(definitions)
        known = {(d["path"], d.get("pointer")) for d in definitions}
        for key, lineage in lineages.items():
            if key not in known:
                case_definitions.append({"id": "recorded:" + key[0] + (key[1] or ""), "path": key[0],
                                         "pointer": key[1], "label": key[1] or key[0], "group": "Recorded provenance", "required": False})
        artifacts = []
        for definition in case_definitions:
            lineage = lineages.get((definition["path"], definition.get("pointer")), {})
            if not lineage and definition.get("pointer"):
                lineage = lineages.get((definition["path"], None), {})
            artifacts.append(assess_artifact(definition, lineage, case_dir, metadata))
        fields = {a.get("pointer"): a for a in artifacts if a["path"] == "metadata.json"}
        for artifact in artifacts:
            dependencies = []
            for field in artifact.get("metadataFields", []):
                pointer = "/0/" + field
                dependency = fields.get(pointer)
                if not dependency:
                    dependency = assess_artifact({"id": field, "path": "metadata.json", "pointer": pointer, "required": True},
                                                 lineages.get(("metadata.json", pointer), metadata_lineage), case_dir, metadata)
                dependencies.append(dependency)
            artifact["metadataDependencies"] = dependencies
            if artifact["status"] == "present" and dependencies:
                bad = next((d for d in dependencies if d["status"] not in ("present", "not-applicable")), None)
                if bad:
                    artifact["status"] = "dependency-unavailable" if bad["status"] in ("missing-output", "optional-missing") else bad["status"]
                    artifact["action"] = "Refresh metadata dependency"
                    artifact["freshness"] = "changed" if bad["status"] == "stale" else "unknown"
                elif any(d["freshness"] == "unknown" for d in dependencies):
                    artifact["freshness"] = "unknown"
        cases.append({"caseId": case_id, "datasetId": dataset["id"], "batchId": pipeline["batchId"],
                      "study": pipeline["study"], "published": case_id in published,
                      "metadataPresent": bool(metadata), "expected": case_id in expected,
                       "configuredInputs": configured_inputs.get(case_id),
                       "remapping": pipeline.get("remapping"),
                      **expected.get(case_id, {}), "artifacts": artifacts,
                      "missingRequired": sum(a["required"] and a["status"] == "missing-output" for a in artifacts),
                      "stale": sum(a["status"] == "stale" for a in artifacts),
                      "potentiallyStale": sum(a["status"] == "potentially-stale" for a in artifacts),
                      "sourceIssues": sum(a["status"] in ("source-unavailable", "dependency-unavailable") for a in artifacts),
                      "inspectionErrors": sum(a["status"] == "inspection-error" for a in artifacts)})
    return {"id": dataset["id"], "title": dataset.get("title", dataset["id"]),
            "batchId": pipeline["batchId"], "study": pipeline["study"], "cases": cases}


def register_new_batches(config, datasets, ledger):
    """Explicit batch/study mapping derived from ingestion-owned publication targets."""
    existing = {d["id"] for d in datasets}
    changed = False
    destination = Path(ledger["destination"]).resolve()
    for delivery, record in ledger.get("deliveries", {}).items():
        if record.get("status") != "complete":
            continue
        target = Path(record["target"])
        if target.resolve().parent != destination:
            raise ValueError("Ingestion target outside destination: " + str(target))
        for study in ("paired", "tumor_only"):
            sheet = target / "samplesheets" / ("samplesheet_" + study + ".csv")
            if not sheet.is_file() or not csv_rows(sheet):
                continue
            dataset_id = "pipeline-" + target.name.lower() + "-" + study
            if dataset_id in existing:
                continue
            data_root = Path(config["newBatchDataRoot"]) / target.name / study / "data"
            data_url = config["newBatchDataUrl"].rstrip("/") + "/" + target.name + "/" + study + "/data/"
            manifest = data_root / "datafiles.json"
            if not manifest.exists():
                write_json(manifest, [])
            datasets.append({"id": dataset_id, "title": target.name + " · " + study,
                             "reference": config.get("newBatchReference", "hg19"),
                             "dataPath": data_url, "datafilesPath": data_url + "datafiles.json",
                             "pipeline": {"schemaVersion": 1, "profile": "wgs-" + study + "-v1",
                                          "batchId": target.name, "study": study,
                                          "inventoryPath": config["inventoryUrl"],
                                          "dataRoot": str(data_root), "datafilesLocalPath": str(manifest),
                                          "samplesheets": [str(sheet)],
                                          "sourceSets": [{"root": str(target / study), "manifests": ["outputs.csv"]}]}})
            inventory = target / "samplesheets" / "manifest_inventory.csv"
            if inventory.is_file():
                datasets[-1]["pipeline"]["expectedInventoryPath"] = str(inventory)
            existing.add(dataset_id)
            changed = True
    return changed


def run(config, export_remapping=False):
    datasets = read_json(config["datasetsPath"])
    ledger = read_json(config["ingestionStatePath"])
    profiles = read_json(HERE / "profiles.json")
    config_changed = False
    known_ids = {dataset["id"] for dataset in datasets}
    for dataset in config.get("additionalDatasets", []):
        if dataset["id"] not in known_ids:
            datasets.append(dataset)
            known_ids.add(dataset["id"])
            config_changed = True
    for dataset in datasets:
        override = config.get("datasetOverrides", {}).get(dataset["id"])
        if override:
            pipeline = {**override, **dataset.get("pipeline", {})}
            if dataset.get("pipeline") != pipeline:
                dataset["pipeline"] = pipeline
                config_changed = True
    if config.get("registerNewBatches"):
        config_changed = register_new_batches(config, datasets, ledger) or config_changed
    if config_changed:
        write_json(Path(config["inventoryPath"]).parent / "datasets.before-registration.json", read_json(config["datasetsPath"]))
        write_dataset_config(config["datasetsPath"], datasets)
    monitored = [d for d in datasets if d.get("pipeline", {}).get("schemaVersion") == 1]
    inventory = {"schemaVersion": 1, "checkedAt": now(), "datasets": [], "deliveries": [], "errors": []}
    for delivery, record in ledger.get("deliveries", {}).items():
        if record.get("status") != "baseline":
            entry = {"delivery": delivery, **record}
            if record.get("expectedInventoryPath"):
                try:
                    entry["expectedSamples"] = csv_rows(record["expectedInventoryPath"])
                except (OSError, ValueError) as error:
                    entry["inventoryError"] = str(error)
            inventory["deliveries"].append(entry)
    for dataset in monitored:
        try:
            inventory["datasets"].append(scan_dataset(dataset, profiles))
            remapping = dataset["pipeline"].get("remapping", {})
            if export_remapping and remapping.get("catalogLocalPath"):
                write_json(remapping["catalogLocalPath"], {"schemaVersion": 1, "datasetId": dataset["id"],
                           "checkedAt": now(), "cases": source_index(dataset["pipeline"], profiles["aliases"])})
        except (OSError, ValueError, KeyError, TypeError) as error:
            inventory["errors"].append({"datasetId": dataset["id"], "message": str(error)})
    write_json(config["inventoryPath"], inventory)
    return inventory


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", required=True)
    parser.add_argument("--export-remapping", action="store_true", help="Explicitly export run-path catalogs for the optional UI inference action")
    args = parser.parse_args()
    config = read_json(args.config)
    lock_path = Path(config["inventoryPath"]).with_suffix(".lock")
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    with lock_path.open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        result = run(config, args.export_remapping)
    print(json.dumps({"checkedAt": result["checkedAt"], "datasets": len(result["datasets"]), "errors": result["errors"]}))
    return 1 if result["errors"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
