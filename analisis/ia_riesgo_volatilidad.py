from __future__ import annotations

import csv
from pathlib import Path

import numpy as np

try:
    from tensorflow import keras
    from tensorflow.keras import layers
except ImportError as exc:
    raise SystemExit(
        "TensorFlow no esta instalado. Ejecuta: pip install -r analisis/requirements-ia.txt"
    ) from exc


BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "data" / "stablecoins.csv"
OUTPUT_DIR = BASE_DIR / "outputs"
OUTPUT_DIR.mkdir(exist_ok=True)


def cargar_datos() -> tuple[np.ndarray, np.ndarray, list[str]]:
    monedas: list[str] = []
    x_rows: list[list[float]] = []
    y_rows: list[int] = []

    with DATA_PATH.open(newline="", encoding="utf-8") as file:
        reader = csv.DictReader(file)
        for row in reader:
            monedas.append(row["moneda"])
            x_rows.append([
                float(row["capitalizacion_mdd"]),
                float(row["volumen_24h_mdd"]),
                float(row["respaldo_fiat_pct"]),
                float(row["respaldo_crypto_pct"]),
                float(row["respaldo_metales_pct"]),
                float(row["volatilidad_30d_pct"]),
                float(row["liquidez_score"]),
            ])
            # 0 = bajo/medio, 1 = alto. Simplifica la clasificacion para un dataset pequeno.
            y_rows.append(1 if int(row["riesgo_score"]) >= 3 else 0)

    x = np.array(x_rows, dtype=np.float32)
    y = np.array(y_rows, dtype=np.float32)
    return x, y, monedas


def normalizar(x: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    media = x.mean(axis=0)
    desviacion = x.std(axis=0)
    desviacion[desviacion == 0] = 1
    return (x - media) / desviacion, media, desviacion


def construir_modelo(input_dim: int) -> keras.Model:
    model = keras.Sequential([
        layers.Input(shape=(input_dim,)),
        layers.Dense(16, activation="relu"),
        layers.Dense(8, activation="relu"),
        layers.Dense(1, activation="sigmoid"),
    ])
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=0.01),
        loss="binary_crossentropy",
        metrics=["accuracy"],
    )
    return model


def main() -> None:
    x, y, monedas = cargar_datos()
    x_norm, _, _ = normalizar(x)

    model = construir_modelo(x_norm.shape[1])
    history = model.fit(x_norm, y, epochs=250, verbose=0)

    predicciones = model.predict(x_norm, verbose=0).reshape(-1)
    salida = OUTPUT_DIR / "ia_prediccion_riesgo.csv"
    with salida.open("w", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)
        writer.writerow(["moneda", "probabilidad_riesgo_alto", "clase_predicha", "clase_real"])
        for moneda, probabilidad, real in zip(monedas, predicciones, y):
            writer.writerow([moneda, round(float(probabilidad), 4), int(probabilidad >= 0.5), int(real)])

    model.save(OUTPUT_DIR / "modelo_riesgo_stablecoin.keras")
    accuracy = history.history["accuracy"][-1]
    loss = history.history["loss"][-1]
    print(f"Modelo entrenado. accuracy={accuracy:.4f}, loss={loss:.4f}")
    print(f"Resultados guardados en {salida}")


if __name__ == "__main__":
    main()
