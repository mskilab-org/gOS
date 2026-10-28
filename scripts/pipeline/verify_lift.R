#!/usr/bin/env Rscript
# Real Batch24 source-to-artifact verification in an isolated output directory.
args <- commandArgs(trailingOnly = TRUE)
if (length(args) != 3L) stop("Usage: verify_lift.R skilift-repo outputs.csv scratch-dir")
devtools::load_all(args[[1]], quiet = TRUE)
dir.create(args[[3]], recursive = TRUE, showWarnings = FALSE)
rows <- data.table::fread(args[[2]])[1]
cohort <- Skilift::Cohort$new(rows, reference_name = "hg19", merge_tumor_type_db = FALSE)
Skilift::lift_signatures(cohort, output_data_dir = args[[3]])
Skilift::lift_denoised_coverage(cohort, output_data_dir = args[[3]])
invisible(Skilift::lift_metadata(cohort, output_data_dir = args[[3]]))
Skilift::lift_datafiles_json(args[[3]])
case_dir <- file.path(args[[3]], cohort$inputs$pair[[1]])
metadata <- jsonlite::read_json(file.path(case_dir, "metadata.json"))
records <- metadata[[1]]$provenance$artifacts
coverage <- Filter(function(x) identical(x$path, "coverage.arrow"), records)
stopifnot(length(coverage) == 1L, length(coverage[[1]]$sources) > 0L)
catalog <- Filter(function(x) identical(x$path, "mutation_catalog.json"), records)
stopifnot(length(catalog) == 1L, length(catalog[[1]]$sources) == 1L)
tmb <- Filter(function(x) identical(x$pointer, "/0/tmb"), records)[[1]]
scaling <- Filter(function(x) identical(x$pointer, "/0/cov_slope"), records)[[1]]
stopifnot(tmb$evidence == "captured", length(tmb$sources) > 0L,
          all(c("snv_count", "total_genome_length") %in% names(tmb$metadataInputs)),
          all(c("purity", "ploidy") %in% names(scaling$metadataInputs)))
tbl <- arrow::read_feather(file.path(args[[3]], "datafiles.arrow"))
stopifnot(is.character(tbl$provenance))
decoded <- jsonlite::fromJSON(tbl$provenance[[1]], simplifyVector = FALSE)
stopifnot(identical(decoded, metadata[[1]]$provenance))
cat("Verified real Batch24 coverage, signatures, metadata and Arrow provenance in", args[[3]], "\n")
