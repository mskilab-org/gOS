# Pipeline monitoring and provenance (v1)

This first runner slice inventories expected WGS cases and gOS artifacts. The
Pipeline page is available at `?view=pipeline`; each case has a Provenance tab
(`tab=7`). Run-bundle generation and Nextflow submission are subsequent phases.

## Configuration

`monitor.py --config /path/to/config.json` reads these local configuration fields:

| Field | Meaning |
| --- | --- |
| `datasetsPath` | Shared `datasets.json` (array) |
| `ingestionStatePath` | Existing GTC ingestion ledger |
| `inventoryPath` / `inventoryUrl` | Local output and browser URL |
| `registerNewBatches` | Register completed post-baseline deliveries |
| `newBatchDataRoot` / `newBatchDataUrl` | Publication roots for those registrations |
| `newBatchReference` | Reference for newly registered datasets |
| `datasetOverrides` | Explicit dataset-ID → pipeline defaults; restores opt-ins if the shared manifest is regenerated |
| `additionalDatasets` | Explicit dataset registrations restored if absent from the shared manifest |

Each opted-in dataset has a `pipeline` object in `datasets.json`:

```json
{
  "schemaVersion": 1,
  "profile": "wgs-paired-v1",
  "batchId": "delivery___batch",
  "study": "paired",
  "inventoryPath": "/published/pipeline/inventory.json",
  "dataRoot": "/local/published/data",
  "datafilesLocalPath": "/local/published/data/datafiles.json",
  "samplesheets": ["/local/run/samplesheet.csv"],
  "expectedInventoryPath": "/local/run/samplesheets/manifest_inventory.csv",
  "inputSnapshots": ["/local/published/data/.uploads/UPLOAD_ID/inputs.json"],
  "sourceSets": [
    {"root": "/local/run/paired", "manifests": ["outputs.csv", "rerun_*/outputs.csv"]}
  ],
  "remapping": {
    "catalogLocalPath": "/local/published/remapping.json",
    "catalogPath": "/published/remapping.json",
    "caseIds": {"pair___TN": "pair"}
  },
  "expectedArtifacts": [{"id": "hetsnps", "required": true}]
}
```

Profiles are `wgs-paired-v1` and `wgs-tumor_only-v1`. `profiles.json` maps visual
elements to files, metadata JSON pointers, and source roles. The initial
required set is metadata, total copy number, coverage, and filtered events;
datasets can override definitions or add artifacts. Actual inputs come from
successful Skilift reader receipts; profile roles do not establish provenance.
Automatic registration includes `paired`, `ffpe_normal`, `heme`, and `tumor_only`.
Only paired uses the paired profile; the other three explicitly reuse the tumor-only
profile while preserving their actual `pipeline.study` for expected-case filtering.
Review/unmatched remain delivery diagnostics and are never registered as runnable datasets.

`inputSnapshots` lists explicit upload input tables and expected cases. `sourceSets`
supports multiple runs for the optional remapping catalog. `export_cohort.R` is a
diagnostic exporter; historical exports are not authoritative upload records.

## Inventory and freshness

Expected cases are the union of the original samplesheet, saved manifest inventory,
and explicit input snapshots. Published-only records remain visible as
extras. The manifest snapshot is written by `create_samplesheet.R` before FASTQ
completeness validation, retained by `ingest_gtc.py` even on failure, and displayed
under the delivery. Unmatched samples remain visible there. Existing `baseline`
deliveries are excluded from automatic registration.

Availability, evidence, and freshness are independent. Production records use
source `size`, `mtime`, and resolved path at consumption. A later difference is
stale; missing sources and inspection errors have separate states. These metadata
fingerprints cannot detect a rewrite that preserves size and mtime. Metadata value
snapshots avoid false staleness when provenance finalization changes its file mtime.
Coverage/HetSNP assessments also inspect their scaling metadata dependencies.
Derived metadata receipts carry upstream field sources and input values (including
purity/ploidy for scaling and SNV count/genome length for TMB).

Normal scans assess only captured/literal provenance from metadata and successful
receipts. Historical reconstructed records are ignored, and missing upload provenance
is shown as unknown. Scanning never rewrites metadata or datafile manifests.

## Optional replacement-path inference

Explicitly prepare the separate catalog when remapping is needed:

```bash
python3 scripts/pipeline/monitor.py --config /path/to/config.json \
  --export-remapping
```

The **Infer replacement paths** button fetches this catalog on demand. No candidates
are selected initially. Explicit `caseIds` aliases can map a renamed case to its run
identity. Export selected mappings and pass the JSON to the cached uploader with
`--remap FILE`; it checks that each original value still matches and that each
replacement exists before changing any input. The next upload records the applied
mapping. Candidates never participate in completed-upload freshness checks.

## Re-uploading explicit caches

```bash
Rscript scripts/pipeline/upload_cached_cohorts.R /path/to/skilift \
  /empty/pipeline-test/data /path/to/cohort.original.rds /path/to/cohort.latest.rds
Rscript scripts/pipeline/verify_cached_upload.R /path/to/skilift \
  /pipeline-test/data /path/to/cohort.original.rds /path/to/cohort.latest.rds
```

The uploader restores the exact cached input rows, validates unique case IDs, and
creates one upload identity per cache. It generates intermediates under the new
dataset and symlinks BAMs/indexes. `bcftools` must be on `PATH`. Each `.uploads/ID/`
contains `cohort.rds`, `inputs.json`, and `upload.json`, including the original cache
path/SHA-256, snapshot SHA-256, reference, options, and invocation arguments.

## Production capture in skilift

The companion changes in `/gpfs/data/imielinskilab/Git/skilift` scope reader capture
to a sample worker and publish receipts after successful writes. Each receipt has
the artifact path, inputs/fingerprints, parameters, reference, producer version,
and production time. `.provenance/history/` retains immutable receipt snapshots;
the top-level receipt is the latest successful production. Downstream reads retain
the matching producer snapshot of intermediates such as `oncotable.rds`.

`lift_datafiles_json()` folds receipts into metadata and publishes the manifest;
`lift_all()` calls it after late BAM, QC, and paired-mode outputs. Partial re-lifts
retain other artifact records. A full metadata re-lift supersedes old field
receipts. For standalone lifters, call `lift_datafiles_json()` afterward. The
scanner can inspect pending receipts before finalization. Reader-session inputs
are a conservative superset for functions that produce several related outputs.
JSON manifests contain native provenance objects; Arrow uses a JSON string column
decoded by `src/helpers/staticManifests.js`.

The instrumented package was installed into the normal `mskilab` R library on
2026-10-16. The previous installed package is backed up under
`.ingestion/pipeline-backfill/Skilift-installed-before-provenance-20261016/` in the
ingestion workspace. This installation includes the pre-existing working-tree
filtered-event changes. New R sessions use the updated package.

## Installed monitoring integration

Operational files live under
`/gpfs/data/imielinskilab/projects/Workspace/set_up_samplesheet/`:

- `pipeline_monitor.json`: monitor configuration and explicit Batch24 opt-in.
- `monitor_pipeline.sh`: invokes this repository's scanner.
- `ingest_gtc.sh`: runs the scanner after zero-argument scans or exactly `--submit`.

The Slurm scrontab runs ingestion with `--submit` daily at **05:17** controller-local time.
Installed 2026-10-28 after synthetic Slurm controller jobs 28894422–28894425 completed
successfully. The existing two-observation readiness gate is unchanged. Inventory is published
at `/external/imielinskilab/mskiweb/hadik01/case-reports-builds/pipeline/inventory.json`.
The UI polls that JSON every minute; **Refresh observations** reloads the most recent
filesystem scan, rather than initiating one.

Batch24 metadata/config backups are under
`.ingestion/pipeline-backfill/before-20261016-120514/`.
Its deployed Arrow manifest was also backed up, regenerated with the installed
converter, and checked against all seven JSON provenance records.
The shared `xanthc01/case-report` directory is not writable by this account, so UI
deployment requires its owner's deployment workflow. Its `datasets.json` is
group-writable; the scanner supports locked in-place updates there and atomic
replacement in writable directories. Other writers must preserve `pipeline`
configuration or run a monitor refresh after regenerating the shared manifest.

A built preview is published at
`https://genome.med.nyu.edu/external/imielinskilab/mskiweb/hadik01/case-reports-builds/pipeline/ui-20261016/?view=pipeline`.
It uses the existing authenticated server and a snapshot of the site's dataset
configuration. Inventory observations remain live. New registered datasets appear
in the Pipeline table; refresh the preview's dataset snapshot to enable their
sample links and normal browsing. An unauthenticated HTTP check returns 401;
authenticated browser verification is still needed.

The Pipeline case table follows the header's dataset selection, including
`?view=pipeline&dataset=batch24-pipeline-test` on initial load. Select **All
accessible datasets** in the header to compare monitored publications; cases
remain distinct by dataset and case ID. A selected dataset with no inventory
entries shows an empty table, not cases from another dataset. There is no separate
Pipeline dataset selector.

Deployed 2026-10-21: `main.4560443d.js` replaces the independent Pipeline scope.
Browser verification used the production bundle and actual published data served
locally: test/original Batch24 selection each showed only its seven entries,
header switching to all datasets showed both, and an unmonitored dataset stayed
empty. The published bundle's test-dataset entry point was also verified locally;
authenticated remote HTTP verification remains outstanding.

Batch24 has six expected pairs and seven published entries. The extra `___TN`
entry uses explicit rerun paths in `cohort.20261009_113349.865555.rds`; the other six
entries use `cohort.20261006_221018.166618.rds`. The user selected all seven for the
captured pipeline-test upload. The original historical backfill is superseded by
captured-only monitoring, so unrelated rerun candidates no longer generate stale
warnings.
The no-argument ingestion wrapper was exercised on 2026-10-16 at 16:32 UTC and
successfully refreshed one dataset with no scan errors. The next daily scheduled
invocation after the 2026-10-28 launch cutover has not yet been observed.

### Completed captured Batch24 test upload (2026-10-16)

- Dataset ID: `batch24-pipeline-test`; title: **Batch24 · Pipeline test (7 captured cases)**.
- Published data: `/gpfs/data/imielinskilab/external/mskiweb/hadik01/case-reports-builds/pipeline/batch24-captured-test-20261016/data-v2/`.
- Registered in the shared and preview `datasets.json`; operational `additionalDatasets`
  and `datasetOverrides` preserve this explicit registration across external rewrites.
- All seven exact cached rows verified against upload snapshots and SHA-256 hashes.
  Metadata, JSON and Arrow provenance agree exactly, including BAM/index receipts.
- The original WG-26-228 allelic artifact records only its original graph; `___TN`
  records only the explicitly cached rerun graph. References and oncotable production
  snapshots are captured alongside inputs and parameters.
- Inventory at 19:22 UTC: two monitored datasets, zero scan errors; all seven test
  cases expected and published, zero missing required/stale/source-error artifacts,
  and no present artifacts with unknown provenance. Optional highlights are absent.
- Built frontend exercised in headless Chromium with requests routed to the actual
  published files. Verified captured source display, no default candidate fetch,
  on-click catalog fetch, and disabled remapping export until selection. This checks
  the production bundle/data; authenticated remote HTTP verification is still pending.
- Screenshots: `/tmp/opencode/captured-provenance-ui.png` and
  `/tmp/opencode/captured-remapping-ui.png`. Upload and verification logs:
  `/tmp/opencode/batch24-captured-upload-v2.log` and
  `/tmp/opencode/batch24-captured-verification.log`.
- BAM receipt capture now handles `Sys.readlink()` returning `NA` for absent paths.
  Existing test BAM/index symlinks were re-published with captured receipts after this
  fix; the updated package is installed in the `mskilab` R library.
- Earlier upload attempts remain in sibling `data/` and `attempt-missing-bcftools/`
  directories for diagnosis; the dataset registration uses only `data-v2/`.

Final checks: 14 scanner tests and 16 focused UI tests pass; installed provenance
and BAM tests pass; production frontend build succeeds with existing warnings.

Visual-element labels now deep-link to their owning report tab and panel, including
expanded metadata fields and SBS/indel signature modes. Supplementary outputs without
a report renderer link directly to their published artifact. The preview build was
checked in Chromium for allelic-plot navigation/scrolling, metadata expansion, and
indel decomposition selection; 10 focused navigation/Pipeline tests pass.

Following the blank-viewer investigation, the experimental one-shot scrolling and
keep-mounted plot changes were rolled back at the user's request. The original
visual-element deep-link navigation and viewport rendering are restored. The
preview was missing `genes/` and `cytobands/`; hg19/hg38 reference assets (including
`_chr` variants) were copied from the shared case-report deployment. The published
hg19 files match the source SHA-256 hashes. Rollback checks: seven focused tests,
production build, and `git diff --check` pass.

The subsequent browser network trace identified `igvGenomes.json` returning 403.
Replaying that failure on the original Batch24 genome link reproduced a React
crash: `IgvPanel` passed an Error object as `explanationDescription`, unmounting
the whole report. It now renders the error as text. The preview's cross-owner
`igvGenomes.json` symlink was replaced atomically with a regular mode-0644 copy;
its previous target/content are saved under `pipeline/igv-config-before-fix-*`.
The nonexistent IGV 2.13.11 CSS reference was removed (the JS embeds styles).
Browser regression checks against published local assets verify both successful
configuration loading and an injected 403 with the genome plot still rendered;
10 focused tests and the production build pass. This test replays HTTP failures
but does not verify authenticated remote HTTP access. Logs and helper:
`/tmp/opencode/igv-browser-repro.log`, `/tmp/opencode/igv-published-failure-check.log`,
and `/tmp/opencode/verify-igv-failure.cjs`. Published bundle: `main.12b8d881.js`.

## Verification

```bash
python3 -m unittest discover -s scripts/pipeline -p 'test_*.py' -v
CI=true npm test -- --watchAll=false --runInBand
npm run build
```

`verify_lift.R SKILIFT_REPO OUTPUTS_CSV SCRATCH_DIRECTORY` exercises real coverage,
signature, metadata and JSON/Arrow provenance in an isolated output directory.
Companion `tests/testthat/test-provenance.R` checks reader/field capture, immutable
history, and transitive lineage.

Validation on 2026-10-16: production build succeeded with existing lint warnings;
Pipeline UI tests and impacted manifest/navigation tests passed. The broader UI
suite is blocked by two absent, unrelated fixture files under `public/`. The broad
skilift comparison had 104 baseline failures versus 103 current failures, with no
additional failures in shared tests; focused provenance/BAM checks passed. The
real Batch24 check verifies exact provenance equality through JSON and Arrow.

The frontend dependencies were installed on local disk to avoid repeated GPFS
installation timeouts. This checkout's `node_modules` points to
`/tmp/opencode/gos-pipeline-node/node_modules`; the incomplete installation is
retained at `.git/opencode-node-modules-incomplete`.
