#!/usr/bin/env Rscript
# Reproduce explicit cached inputs; each cache is a separate captured upload.
args <- commandArgs(trailingOnly = TRUE)
if (length(args) < 3L) stop("Usage: upload_cached_cohorts.R SKILIFT_REPO OUTPUT_DIR COHORT_RDS... [--remap FILE]")
devtools::load_all(args[[1]], quiet = TRUE)
output <- args[[2]]
caches <- args[-c(1, 2)]
remapping <- NULL
if ("--remap" %in% caches) {
    index <- match("--remap", caches)
    if (index != length(caches) - 1L) stop("--remap must be followed by one JSON file at the end")
    remapping <- jsonlite::read_json(caches[[index + 1L]])
    caches <- caches[seq_len(index - 1L)]
}
cohorts <- lapply(caches, Skilift:::provenance_load_cohort)
ids <- unlist(lapply(cohorts, function(x) x$inputs$pair))
stopifnot(length(ids) > 0L, !anyDuplicated(ids))
if (dir.exists(output) && length(list.files(output, all.files = TRUE, no.. = TRUE))) {
    stop("Output directory must be empty for a new captured test upload")
}
if (!is.null(remapping)) {
    stopifnot(remapping$schemaVersion == 1L, remapping$caseId %in% ids)
    for (cohort in cohorts) {
        if (remapping$caseId %in% cohort$inputs$pair) {
            Skilift:::provenance_apply_remapping(cohort, remapping)
        }
    }
}
dir.create(output, recursive = TRUE, showWarnings = FALSE)
for (i in seq_along(cohorts)) {
    cohort <- cohorts[[i]]
    cat("Uploading", nrow(cohort$inputs), "cases from", caches[[i]], "\n")
    # Intermediates belong to this upload's output root.
    cohort$nextflow_results_path <- NULL
    invisible(Skilift::lift_all(cohort, output_data_dir = output, cores = 2L, symlink = TRUE))
}
Skilift::lift_datafiles_json(output)
manifest <- jsonlite::read_json(file.path(output, "datafiles.json"))
stopifnot(setequal(vapply(manifest, function(x) x$pair, character(1)), ids))
for (row in manifest) {
    for (name in c("complex.json", "allelic.json", "coverage.arrow", "filtered.events.json", "metadata.json")) {
        receipts <- Filter(function(x) identical(x$path, name) && is.null(x$pointer), row$provenance$artifacts)
        stopifnot(length(receipts) == 1L, receipts[[1]]$evidence == "captured", !is.null(receipts[[1]]$upload$id))
    }
}
cat("Verified", length(ids), "cases with captured core artifact provenance in", output, "\n")
