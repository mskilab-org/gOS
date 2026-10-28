#!/usr/bin/env Rscript
# Export only path/identity fields from an existing cohort; never regenerate it.
args <- commandArgs(trailingOnly = TRUE)
if (length(args) != 2L) stop("Usage: export_cohort.R cohort.rds output.json")
cohort <- readRDS(args[[1]])
inputs <- as.data.frame(cohort$inputs)
keep <- vapply(inputs, function(value) {
    is.character(value) && any(grepl("^(/|~|\\./|\\.\\./)", value), na.rm = TRUE)
}, logical(1)) | names(inputs) %in% c("pair", "tumor_sample", "normal_sample")
jsonlite::write_json(inputs[, keep, drop = FALSE], args[[2]], auto_unbox = TRUE,
                     pretty = TRUE, null = "null", na = "null")
