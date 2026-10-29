# gOS Case Report (prebuilt)

This repository now ships prebuilt bundles via **GitHub Releases** and publishes the latest build to **GitHub Pages**. You can run the app locally without rebuilding, explore the demo data baked into `shared/`, or develop from source with the usual React tooling.

![Genome view screenshot](screenshots/gos_genome_view.png)

## Quick start (no build required)
Prereqs: `python3`, `curl`, and `tar`. Optionally set `GITHUB_TOKEN` to avoid GitHub API rate limits.

```bash
./setup.sh
open http://localhost:3001
```

What happens:
- Fetches the latest **stable** GitHub Release for `mskilab/case-report` (override with `REPO=owner/repo`, `TAG=v1.2.3`, or `--channel edge`).
- Downloads `build-<sha>.tar.gz`, its checksum, and the `LATEST` metadata, verifies the checksum, and unpacks into `out/build-<sha>/`.
- Copies the `shared/` data into the unpacked build.
- Serves the static app on `PORT` (default `3001`). Set `SKIP_SERVER=1` to skip launching the server.

## Developing from source
```bash
yarn install --frozen-lockfile
CI=false yarn start   # dev server on http://localhost:3000
yarn test             # interactive tests
CI=false yarn build   # production build into ./build
```

## Shared data bundle
The `shared/` directory contains the minimum data/config the UI expects:
- `shared/datasets.json` – datasets the UI lists in the sidebar.
- `shared/datafiles.json` – maps dataset identifiers to files on disk.
- `shared/settings.json` – defaults for theme, landing dataset, feature toggles.
- `shared/data/`, `shared/common/`, `shared/genes/`, etc. – sample payloads that back the demo experience.

Add your own case report data by mirroring the structure above and updating the JSON manifests accordingly.

### Configuring datasets

The `datasets.json` file defines available datasets and their configuration. Each dataset entry supports:

```json
{
  "id": "my-dataset",
  "title": "My Dataset",
  "datafilesPath": "datafiles.json",
  "commonPath": "common/",
  "dataPath": "data/",
  "reference": "hg19",
  "defaultVisibleFilteredEventsColumns": ["gene", "tier", "custom-col"],
  "optionalFilteredEventsColumns": [
    {
      "id": "custom-col",
      "title": "Custom Column",
      "dataIndex": "customField",
      "viewType": "gene-link"
    }
  ],
  "schema": [
    {
      "id": "sample_type",
      "title": "Sample Type",
      "type": "string"
    }
  ]
}
```

**Filtered Events Columns:** Extend the filtered events list columns using `optionalFilteredEventsColumns`. Supports partial column definitions that merge with defaults. Use the optional `defaultVisibleFilteredEventsColumns` array as an ordered, exact allow-list of merged settings and dataset column IDs to select when the Filtered Events panel first mounts and when **Reset Columns** is clicked. Listed IDs determine the default left-to-right order in the table. Omit the property to show every available column. Unknown IDs are ignored, duplicate IDs use their first position, and an empty array is valid. Columns supplied directly by a panel caller remain selected in their panel-defined position.

**Column filtering and sorting:** Configured Filtered Events data columns, including Location (IGV) and dataset-specific icon columns, default to `filterable: true` and `sortable: true`. Filters appear when records are loaded; sorting uses each column's existing type-specific comparator. To disable either control, set `"filterable": false` or `"sortable": false` on that column's object in the dataset's `optionalFilteredEventsColumns`. The flags are independent. Dataset entries merge with `settings.json` column definitions by `id`: explicit dataset values override settings, omitted dataset properties retain settings values, and a flag defaults to `true` only when omitted from the merged definition. Categorical filters are searchable by default; numeric choices, configured numeric ranges, nested fields, and annotation-class filters retain their existing semantics. Filters start inactive, and **Reset All Filters** clears the user's column filters without changing the column layout or report selection. All events supplied in the case's `filtered.events.json` remain available initially, including germline, non-germline, uncertain, and unclassified records; the frontend neither infers those classifications nor imposes a pillar/origin exclusion. Data omitted by the upstream file cannot be recovered by frontend filtering. The Add to Report checkbox remains a separate selection control, not a data-column filter.

**Column pinning:** Hover over a data-column header (or focus its pin button with the keyboard) to pin or unpin it. Pinned columns stay on the left during horizontal scrolling, after Add to Report. Unpinning returns a column to its previous order. Pinned columns remain resizable; unpin a column before drag-reordering it. Hiding a column does not clear its pin.

**VAF and tiers:** Filtered Events displays VAF as a two-decimal percentage (for example, `0.371` becomes `37.10`) under **Variant Allele Frequency (%)**, matching the report. Raw data, numeric sorting, and range-filter values are unchanged. Tier filtering starts inactive, with no checked filter options, so all tiers and untiered events are visible. Automatic report inclusion remains limited to Tier 1 and 2.

**Numeric range filters:** Range filters, including VAF, retain NA values by default. Check **Exclude NA values** in a column's filter and click **OK** to remove them; uncheck it to retain them again. Missing, null, blank, and unusable numeric values count as NA, but zero remains a real number. Exclusion also works without narrowing the slider range. Filtering preserves the relative row order and any active sort; other column filters still apply. The filter's **Reset** or **Reset All Filters** restores inclusion of NAs.

**Variant review navigation:** Closing the variant modal without navigating restores the same table page and vertical/horizontal scroll position. The bordered navigation buttons, grouped on the right, show only the destination's gene and variant name with directional chevrons and follow the table's current filters, event type, and sorting across pages. They keep the active modal tab open and update the table's page and row position, so closing reveals the current variant while retaining horizontal scroll. Navigation stops at either end. The compact controls keep full destination names in their hover tooltips. Use **j/k** for next/previous variant, **h/l** for previous/next tab, **u** to toggle Add to report, and **i** to toggle Reviewed. **Left/Right arrow keys** remain previous/next variant aliases, including when a modal tab has focus; arrows do not move tab focus. Tab then Enter/Space also changes views. Controls and tab labels show immediate Ant Design hover tooltips with keyboard-style letter keycaps, without native browser titles. Shortcuts leave text editing, dropdowns, and focused genome/QC controls alone, and pause while another dialog or drawer is open. Modifiers, composition and held-key repeats do not trigger actions.

**Personal review status:** The left side of the persistent modal bar contains **Add to report**, synchronized with the table, and **Reviewed**. First opening a variant in any modal tab (including navigating to it) automatically marks it reviewed. Manually clearing Reviewed remains cleared when reopening or reloading. Reviewed variants have subdued table rows while links retain their normal colors; the last-opened variant has a separate blue highlight. Review decisions are cached only in browser localStorage, separately for each signed-in user, dataset and case; signed-out visits use a separate anonymous browser scope. They do not sync to another browser, change interpretations/report defaults, or indicate clinical approval. Clearing browser storage removes them. If storage cannot save, review works for the current view and the modal shows a warning. Review position/current-row highlight remain temporary for the current case.

**Saved column layout:** Column widths, order, and pins are saved in one browser `localStorage` entry, `gos.filteredEventsColumnLayout.v1`. No user or sign-in is required, and signing in, switching users, or signing out does not change the layout. Matching data-column IDs reuse that layout across cases, datasets, and reloads; saved order overrides the configured default order. Dataset-specific columns retain their preferences when absent from another dataset. Fixed columns keep their positions, and caller-specific columns are not shared. Widths are saved at the end of a resize, not during dragging. **Reset All Filters** clears table filters without changing column order, visibility, widths, or pins. **Reset Columns**, beside the column selector, restores default order and visibility while retaining widths, pins, and active filters. Filters, sorting, visibility, and page size are not persisted. Blocked/full storage does not prevent table use. Preferences are local to this browser and site, not synchronized between browsers or devices. Older user-specific entries remain untouched but are no longer used.

Available `viewType` renderers:
- `"gene-link"` – renders gene names as clickable event-detail links
- `"event-detail-link"` – renders a value as a clickable link that opens event details
- `"tier-badge"` – renders tier/category badges
- `"formatted-number"` – renders formatted numeric values
- `"string-basic"` – renders plain text (default)
- `"location-link"` – renders genomic locations as links
- `"class-icon"` – renders class with icon

**Cohort Filters:** Define dataset-specific filters for the cohort-level view using `schema`. When provided, this overrides the default schema from settings. Each filter must include `id`, `title`, and `type`.

Active cohort metadata filters are skipped only when the metadata key is absent from the case record, including an absent nested key. A present key assigned `N/A`, null, a blank, an empty list, or an invalid value is evaluated normally; it does not bypass the filter. A nested parent assigned an unusable value (for example, `qc: null`) also does not bypass the filter. Source-schema restrictions still apply to present values. Untouched full-range sliders remain inactive. All other active filters still apply. This behavior covers single-dataset and all-accessible-dataset views, saved queries, and aggregations. Dataset, Pair, Patient ID, case-ID, tags, free-text, and interpretation filters remain strict.

### Report styles and primary-site choices

Report presentation is selected by the dataset-level `reportStyle` property:

- Omit `reportStyle`, set it to `"myeloseq"`, or supply an unrecognized value to use the MyeloSeq HTML preview and DOCX download.
- Set `reportStyle` to `"classic"` to use the older classic HTML report for both preview and download.

MyeloSeq is the compatibility default. Only classic requires an explicit opt-in:

```json
{
  "id": "classic-dataset",
  "reportStyle": "classic"
}
```

The header's primary-site value is separate from `tumor_type`. A MyeloSeq dataset always shows the specimen selector, even when `metadata.primary_site` is missing, null, empty, or whitespace-only, or the dataset's `fields` omit `primary_site`. Existing loading and save restrictions still apply. With no saved or raw value, the selector shows its placeholder rather than choosing an option automatically. A classic dataset still shows only nonblank, schema-enabled raw primary-site metadata as ordinary, non-editable text.

The supplied MyeloSeq choices are exactly lowercase: **bone marrow aspirate**, **peripheral blood**, and **na**. They are configured in the top-level `primarySiteOptions.myeloseq` array in `public/settings.json` and `shared/settings.json`. There is no `Other` choice or whole-genome cancer-type fallback.

A MyeloSeq dataset can replace those choices with a custom array:

```json
{
  "id": "custom-myelo-dataset",
  "primarySiteOptions": [
    { "value": "custom specimen", "label": "custom specimen" },
    "na"
  ]
}
```

Reusable custom arrays may still be added to the global `primarySiteOptions` map and referenced by name. Missing, unknown, or malformed configuration falls back to `primarySiteOptions.myeloseq`. An explicit array replaces the catalog; `[]` stays empty. Invalid entries are dropped, surrounding whitespace is trimmed, and duplicate values keep their first label. No first option is selected automatically; existing out-of-list values remain displayable but cannot be selected again.

MyeloSeq selections use the existing interpretation backend: the dataset's `auditLoggingRepo` when configured, otherwise the existing IndexedDB repository. They are scoped to the active dataset, canonical case ID, and signed-in author. A `PRIMARY_SITE` interpretation saves `data.primarySite = { value, label }`; selecting **na** stores a real choice. Existing case-interpretation reset behavior also clears this override.

For MyeloSeq cases, the selected current-author snapshot takes precedence over `metadata.primary_site` and its label is used as report **Specimen Type**, regardless of source metadata or dataset fields. Classic reports and headers use the schema-enabled raw source primary site instead. Existing saved selections remain stored and become effective again when MyeloSeq style applies. Source metadata and tumor type are never rewritten. When neither a saved selection nor raw metadata is available, the MyeloSeq report renders Specimen Type as `NA`.

### MyeloSeq report display

- **Tumor sample** shows `metadata.pair` exactly as supplied by the backend, falling back to the source case ID only if pair is absent. Report titles and filenames still use the source case ID.
- A fusion event may provide a nonblank `locus`, for example `"22:23632600,9:133729451"`. The report displays it as `chr22:23632600-chr9:133729451` in both Locus and Breakpoint. If `locus` is missing or blank, the existing `fusion_gene_coords`, `location`, or `Genome_Location` is used, in that order. Gene ranges are never converted into guessed breakpoints.
- Event **Comments** show `variant_summary` as supplied by the backend, without removing any source tags in the frontend. HTML output still escapes markup; source records are not modified.

These display rules apply to both the MyeloSeq HTML preview and Word export; classic report display is unchanged.

## Deployments
- **Edge channel (latest `main`):** `.github/workflows/build-artifacts.yml` builds on every push to `main` and publishes a GitHub **prerelease**. This is intended for an “edge” instance that should always track the newest commit on `main`.
- **Stable channel (promoted builds):** Use `.github/workflows/promote-stable.yml` to promote a specific `build-*` prerelease to a **stable** (non-prerelease) release. The GitHub `.../releases/latest` endpoint will then point at the promoted release.
- **GitHub Pages:** The build workflow also deploys to the `github-pages` environment, so the live Pages site tracks the edge channel.

### Picking what to deploy
- **Edge instance:** deploy the most recent release (including prereleases). In GitHub API terms, call `GET /repos/:owner/:repo/releases` and pick the first entry.
- **Staging instance:** deploy only stable releases via `GET /repos/:owner/:repo/releases/latest` (this endpoint ignores prereleases).

### Running locally
- Stable (default): `./setup.sh`
- Edge: `./setup.sh --channel edge`

The legacy `deploy-builds` branch is no longer used; artifacts now live solely on GitHub Releases.

## Troubleshooting
- If downloads fail, set `GITHUB_TOKEN` (PAT or Actions token) to raise the GitHub API limit.
- If the checksum mismatches, rerun `./setup.sh` to redownload the assets.
- Ensure `python3` is on your `PATH`; it powers the local HTTP server.
