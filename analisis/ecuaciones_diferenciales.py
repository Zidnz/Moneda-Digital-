from __future__ import annotations

import csv
import math
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = BASE_DIR / "outputs"
OUTPUT_DIR.mkdir(exist_ok=True)


def demanda(t: int) -> float:
    return 0.02 * math.sin(t / 6) + 0.01


def inflacion(t: int) -> float:
    return 0.004 + 0.002 * math.sin(t / 12)


def simular_precio(
    dias: int = 180,
    precio_inicial: float = 1.0,
    precio_respaldo: float = 1.0,
    alpha: float = 0.18,
    beta: float = 0.55,
    gamma: float = 0.75,
    dt: float = 1.0,
) -> list[dict[str, float]]:
    precio = precio_inicial
    serie = []

    for dia in range(dias + 1):
        d = demanda(dia)
        i = inflacion(dia)
        derivada = alpha * (precio_respaldo - precio) + beta * d - gamma * i
        serie.append({
            "dia": dia,
            "precio_qchaucoin": round(precio, 6),
            "demanda": round(d, 6),
            "inflacion": round(i, 6),
            "dP_dt": round(derivada, 6),
        })
        precio = precio + derivada * dt

    return serie


def main() -> None:
    serie = simular_precio()
    salida = OUTPUT_DIR / "qchaucoin_dinamica.csv"

    with salida.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=serie[0].keys())
        writer.writeheader()
        writer.writerows(serie)

    print(f"Simulacion completada. Archivo generado: {salida}")


if __name__ == "__main__":
    main()
