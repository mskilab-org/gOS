#!/usr/bin/env Rscript
args <- commandArgs(trailingOnly = TRUE)
if (length(args) < 3L) stop("Usage: verify_cached_upload.R SKILIFT_REPO OUTPUT_DIR COHORT_RDS...")
devtools::load_all(args[[1]], quiet = TRUE)
output <- args[[2]]
cohorts <- lapply(args[-c(1, 2)], Skilift:::provenance_load_cohort)
inputs <- data.table::rbindlist(lapply(cohorts, function(x) x$inputs), fill = TRUE)
manifest <- jsonlite::read_json(file.path(output, "datafiles.json"))
arrow <- arrow::read_feather(file.path(output, "datafiles.arrow"))
stopifnot(setequal(inputs$pair, vapply(manifest, function(x) x$pair, character(1))),
          is.character(arrow$provenance))
for (row in manifest) {
    source_cohort <- Filter(function(x) row$pair %in% x$inputs$pair, cohorts)[[1]]
    input <- source_cohort$inputs[pair == row$pair]
    metadata <- jsonlite::read_json(file.path(output, row$pair, "metadata.json"))[[1]]
    stopifnot(identical(row$provenance, metadata$provenance))
    decoded <- jsonlite::fromJSON(arrow$provenance[match(row$pair, arrow$pair)], simplifyVector = FALSE)
    stopifnot(identical(row$provenance, decoded))
    artifacts <- row$provenance$artifacts
    find <- function(path, pointer = NULL) Filter(function(x) identical(x$path, path) && identical(x$pointer, pointer), artifacts)[[1]]
    for (name in c("complex.json", "allelic.json", "coverage.arrow", "filtered.events.json", "metadata.json",
                   "tumor.bam", "tumor.bam.bai", "normal.bam", "normal.bam.bai")) {
        receipt <- find(name)
        stopifnot(receipt$evidence == "captured", !is.null(receipt$upload$id),
                  !is.null(receipt$upload$cachedCohort$sha256),
                  file.exists(receipt$upload$snapshot$path))
    }
    upload <- find("metadata.json")$upload
    captured_input <- readRDS(upload$snapshot$path)$inputs[pair == row$pair]
    stopifnot(identical(captured_input, input),
              identical(digest::digest(file = upload$snapshot$path, algo = "sha256"), upload$snapshot$sha256),
              identical(digest::digest(file = upload$cachedCohort$path, algo = "sha256"), upload$cachedCohort$sha256),
              isTRUE(upload$arguments$symlink))
    for (mapping in list(c("complex.json", "events"), c("allelic.json", "allelic_jabba_gg"), c("coverage.arrow", "tumor_coverage"))) {
        artifact <- find(mapping[[1]])
        expected <- input[[mapping[[2]]]]
        stopifnot(sum(vapply(artifact$sources, function(s) identical(s$path, expected), logical(1))) == 1L)
        if (mapping[[1]] %in% c("complex.json", "allelic.json")) {
            graph_sources <- Filter(function(s) any(unlist(s$cohortColumns) %in% c("events", "balanced_jabba_gg", "jabba_gg", "allelic_jabba_gg")), artifact$sources)
            stopifnot(length(graph_sources) == 1L, artifact$selection$graphColumn == mapping[[2]])
        }
    }
    event_sources <- find("filtered.events.json")$sources
    intermediate <- Filter(function(x) "oncotable" %in% unlist(x$cohortColumns), event_sources)
    stopifnot(length(intermediate) == 1L, !is.null(intermediate[[1]]$production$upload$id),
              startsWith(intermediate[[1]]$path, file.path(output, "oncotable")))
    upstream <- intermediate[[1]]$production
    stopifnot(upstream$selection$graphColumn == "events", upstream$parameters$amp.thresh == 1.5,
              any(vapply(upstream$sources, function(x) grepl("gencode.*rds$", x$path), logical(1))),
              any(vapply(upstream$sources, function(x) basename(x$path) == "cytoband.rds", logical(1))))
    scaling <- find("metadata.json", "/0/cov_slope")
    stopifnot(all(c("purity", "ploidy") %in% names(scaling$metadataInputs)))
    cat("Verified cached graph selection, intermediate lineage, metadata and JSON/Arrow:", row$pair, "\n")
}
