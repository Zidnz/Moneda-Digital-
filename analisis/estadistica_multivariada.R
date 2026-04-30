args <- commandArgs(trailingOnly = FALSE)
file_arg <- grep("^--file=", args, value = TRUE)
script_path <- if (length(file_arg) > 0) {
  sub("^--file=", "", file_arg[[1]])
} else {
  "analisis/estadistica_multivariada.R"
}

base_dir <- dirname(normalizePath(script_path))
data_path <- file.path(base_dir, "data", "stablecoins.csv")
output_dir <- file.path(base_dir, "outputs")

if (!dir.exists(output_dir)) {
  dir.create(output_dir, recursive = TRUE)
}

stablecoins <- read.csv(data_path, stringsAsFactors = FALSE)

variables <- stablecoins[, c(
  "capitalizacion_mdd",
  "volumen_24h_mdd",
  "respaldo_fiat_pct",
  "respaldo_crypto_pct",
  "respaldo_metales_pct",
  "volatilidad_30d_pct",
  "liquidez_score",
  "riesgo_score"
)]

correlacion <- cor(variables)
write.csv(correlacion, file.path(output_dir, "correlacion_stablecoins.csv"))

pca <- prcomp(variables, scale. = TRUE)
pca_scores <- data.frame(moneda = stablecoins$moneda, pca$x)
pca_importancia <- data.frame(
  componente = paste0("PC", seq_along(pca$sdev)),
  desviacion_estandar = pca$sdev,
  varianza_explicada = (pca$sdev ^ 2) / sum(pca$sdev ^ 2),
  varianza_acumulada = cumsum((pca$sdev ^ 2) / sum(pca$sdev ^ 2))
)

write.csv(pca_scores, file.path(output_dir, "pca_scores.csv"), row.names = FALSE)
write.csv(pca_importancia, file.path(output_dir, "pca_importancia.csv"), row.names = FALSE)

set.seed(42)
clusters <- kmeans(scale(variables), centers = 3, nstart = 25)
cluster_resultado <- data.frame(
  moneda = stablecoins$moneda,
  cluster = clusters$cluster,
  riesgo_score = stablecoins$riesgo_score,
  volatilidad_30d_pct = stablecoins$volatilidad_30d_pct,
  liquidez_score = stablecoins$liquidez_score
)

write.csv(cluster_resultado, file.path(output_dir, "clusters_stablecoins.csv"), row.names = FALSE)

cat("Analisis multivariado completado.\n")
cat("Archivos generados en:", output_dir, "\n")
