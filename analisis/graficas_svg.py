from __future__ import annotations

import csv
import math
from pathlib import Path
from statistics import mean, pstdev


BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "data" / "stablecoins.csv"
OUTPUT_DIR = BASE_DIR / "outputs"
OUTPUT_DIR.mkdir(exist_ok=True)


def read_stablecoins() -> list[dict[str, str]]:
    with DATA_PATH.open(newline="", encoding="utf-8") as file:
        return list(csv.DictReader(file))


def numeric(rows: list[dict[str, str]], key: str) -> list[float]:
    return [float(row[key]) for row in rows]


def svg_page(width: int, height: int, body: str) -> str:
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
        f'viewBox="0 0 {width} {height}">\n'
        '<rect width="100%" height="100%" fill="#f8fafc" />\n'
        f"{body}\n</svg>\n"
    )


def text(x: float, y: float, value: str, size: int = 14, anchor: str = "middle", color: str = "#0f172a") -> str:
    return (
        f'<text x="{x}" y="{y}" text-anchor="{anchor}" font-family="Segoe UI, Arial" '
        f'font-size="{size}" fill="{color}">{value}</text>'
    )


def bar_chart(rows: list[dict[str, str]], key: str, title: str, filename: str, color: str) -> None:
    width, height = 1100, 620
    left, right, top, bottom = 95, 45, 95, 115
    chart_w = width - left - right
    chart_h = height - top - bottom
    values = numeric(rows, key)
    labels = [row["moneda"] for row in rows]
    max_value = max(values)
    bar_w = chart_w / len(values) * 0.65
    gap = chart_w / len(values)

    body = [
        text(width / 2, 45, title, 26),
        f'<line x1="{left}" y1="{top + chart_h}" x2="{width - right}" y2="{top + chart_h}" stroke="#334155" />',
        f'<line x1="{left}" y1="{top}" x2="{left}" y2="{top + chart_h}" stroke="#334155" />',
    ]

    for i, (label, value) in enumerate(zip(labels, values)):
        x = left + i * gap + (gap - bar_w) / 2
        h = chart_h * (value / max_value)
        y = top + chart_h - h
        body.append(f'<rect x="{x:.2f}" y="{y:.2f}" width="{bar_w:.2f}" height="{h:.2f}" rx="6" fill="{color}" />')
        body.append(text(x + bar_w / 2, y - 8, f"{value:.2f}", 11, color="#475569"))
        body.append(text(x + bar_w / 2, top + chart_h + 28, label, 12, color="#334155"))

    (OUTPUT_DIR / filename).write_text(svg_page(width, height, "\n".join(body)), encoding="utf-8")


def scatter_chart(rows: list[dict[str, str]]) -> None:
    width, height = 1050, 650
    left, right, top, bottom = 105, 70, 90, 95
    chart_w = width - left - right
    chart_h = height - top - bottom
    xs = numeric(rows, "volatilidad_30d_pct")
    ys = numeric(rows, "liquidez_score")
    risks = numeric(rows, "riesgo_score")
    labels = [row["moneda"] for row in rows]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)

    def sx(value: float) -> float:
        return left + (value - min_x) / (max_x - min_x) * chart_w

    def sy(value: float) -> float:
        return top + chart_h - (value - min_y) / (max_y - min_y) * chart_h

    body = [
        text(width / 2, 45, "Volatilidad vs liquidez por stablecoin", 26),
        f'<line x1="{left}" y1="{top + chart_h}" x2="{width - right}" y2="{top + chart_h}" stroke="#334155" />',
        f'<line x1="{left}" y1="{top}" x2="{left}" y2="{top + chart_h}" stroke="#334155" />',
        text(width / 2, height - 35, "Volatilidad 30 dias (%)", 15),
        text(30, height / 2, "Liquidez", 15, color="#334155"),
    ]

    for label, x, y, risk in zip(labels, xs, ys, risks):
        cx, cy = sx(x), sy(y)
        radius = 7 + risk * 2
        color = "#22c55e" if risk <= 2 else "#f97316" if risk == 3 else "#ef4444"
        body.append(f'<circle cx="{cx:.2f}" cy="{cy:.2f}" r="{radius:.2f}" fill="{color}" opacity="0.82" />')
        body.append(text(cx + 10, cy - 10, label, 12, anchor="start", color="#334155"))

    (OUTPUT_DIR / "dispersion_volatilidad_liquidez.svg").write_text(svg_page(width, height, "\n".join(body)), encoding="utf-8")


def correlation_heatmap(rows: list[dict[str, str]]) -> None:
    keys = [
        "capitalizacion_mdd",
        "volumen_24h_mdd",
        "respaldo_fiat_pct",
        "respaldo_crypto_pct",
        "volatilidad_30d_pct",
        "liquidez_score",
        "riesgo_score",
    ]
    labels = ["cap", "vol", "fiat", "crypto", "volat", "liq", "riesgo"]
    values = [numeric(rows, key) for key in keys]

    def corr(a: list[float], b: list[float]) -> float:
        ma, mb = mean(a), mean(b)
        sa, sb = pstdev(a), pstdev(b)
        if sa == 0 or sb == 0:
            return 0
        return sum((x - ma) * (y - mb) for x, y in zip(a, b)) / (len(a) * sa * sb)

    width, height = 820, 820
    start_x, start_y, cell = 165, 120, 82
    body = [text(width / 2, 55, "Mapa de calor de correlaciones", 26)]

    for i, label in enumerate(labels):
        body.append(text(start_x + i * cell + cell / 2, start_y - 18, label, 13))
        body.append(text(start_x - 18, start_y + i * cell + cell / 2 + 4, label, 13, anchor="end"))

    for row_i, a in enumerate(values):
        for col_i, b in enumerate(values):
            value = corr(a, b)
            red = int(245 if value < 0 else 255 - 90 * value)
            green = int(245 - 120 * abs(value))
            blue = int(245 if value > 0 else 255 + 90 * value)
            color = f"rgb({max(0, red)},{max(80, green)},{max(0, blue)})"
            x = start_x + col_i * cell
            y = start_y + row_i * cell
            body.append(f'<rect x="{x}" y="{y}" width="{cell}" height="{cell}" fill="{color}" stroke="#ffffff" />')
            body.append(text(x + cell / 2, y + cell / 2 + 5, f"{value:.2f}", 13))

    (OUTPUT_DIR / "heatmap_correlacion.svg").write_text(svg_page(width, height, "\n".join(body)), encoding="utf-8")


def line_chart_dynamics() -> None:
    dynamics_path = OUTPUT_DIR / "qchaucoin_dinamica.csv"
    if not dynamics_path.exists():
        from ecuaciones_diferenciales import main as generar_dinamica

        generar_dinamica()

    with dynamics_path.open(newline="", encoding="utf-8") as file:
        rows = list(csv.DictReader(file))

    width, height = 1100, 620
    left, right, top, bottom = 95, 45, 90, 95
    chart_w = width - left - right
    chart_h = height - top - bottom
    days = [float(row["dia"]) for row in rows]
    prices = [float(row["precio_qchaucoin"]) for row in rows]
    min_p, max_p = min(prices), max(prices)

    def sx(day: float) -> float:
        return left + day / max(days) * chart_w

    def sy(price: float) -> float:
        return top + chart_h - (price - min_p) / (max_p - min_p) * chart_h

    points = " ".join(f"{sx(day):.2f},{sy(price):.2f}" for day, price in zip(days, prices))
    body = [
        text(width / 2, 45, "Dinamica diferencial del precio de QchauCoin", 26),
        f'<line x1="{left}" y1="{top + chart_h}" x2="{width - right}" y2="{top + chart_h}" stroke="#334155" />',
        f'<line x1="{left}" y1="{top}" x2="{left}" y2="{top + chart_h}" stroke="#334155" />',
        f'<polyline points="{points}" fill="none" stroke="#0ea5e9" stroke-width="4" />',
        text(width / 2, height - 35, "Dias simulados", 15),
        text(45, height / 2, "Precio", 15),
        text(left, top + chart_h + 24, "0", 12),
        text(width - right, top + chart_h + 24, f"{int(max(days))}", 12),
        text(left - 12, top + 6, f"{max_p:.3f}", 12, anchor="end"),
        text(left - 12, top + chart_h, f"{min_p:.3f}", 12, anchor="end"),
    ]

    (OUTPUT_DIR / "linea_dinamica_qchaucoin.svg").write_text(svg_page(width, height, "\n".join(body)), encoding="utf-8")


def radar_qchaucoin(rows: list[dict[str, str]]) -> None:
    qchau = next(row for row in rows if row["moneda"] == "QchauCoin")
    metrics = [
        ("Fiat", float(qchau["respaldo_fiat_pct"]) / 100),
        ("Liquidez", float(qchau["liquidez_score"]) / 100),
        ("Baja volatilidad", 1 - float(qchau["volatilidad_30d_pct"])),
        ("Bajo riesgo", 1 - float(qchau["riesgo_score"]) / 5),
        ("Volumen", min(float(qchau["volumen_24h_mdd"]) / 10, 1)),
    ]
    width, height = 760, 760
    cx, cy, radius = width / 2, height / 2 + 30, 230
    body = [text(width / 2, 55, "Perfil de QchauCoin", 26)]
    points = []

    for ring in range(1, 6):
        r = radius * ring / 5
        ring_points = []
        for i in range(len(metrics)):
            angle = -math.pi / 2 + i * 2 * math.pi / len(metrics)
            ring_points.append(f"{cx + math.cos(angle) * r:.2f},{cy + math.sin(angle) * r:.2f}")
        body.append(f'<polygon points="{" ".join(ring_points)}" fill="none" stroke="#cbd5e1" />')

    for i, (label, value) in enumerate(metrics):
        angle = -math.pi / 2 + i * 2 * math.pi / len(metrics)
        x = cx + math.cos(angle) * radius
        y = cy + math.sin(angle) * radius
        body.append(f'<line x1="{cx}" y1="{cy}" x2="{x:.2f}" y2="{y:.2f}" stroke="#cbd5e1" />')
        body.append(text(cx + math.cos(angle) * (radius + 45), cy + math.sin(angle) * (radius + 45), label, 13))
        points.append(f"{cx + math.cos(angle) * radius * value:.2f},{cy + math.sin(angle) * radius * value:.2f}")

    body.append(f'<polygon points="{" ".join(points)}" fill="#14b8a6" fill-opacity="0.35" stroke="#0f766e" stroke-width="3" />')
    (OUTPUT_DIR / "radar_qchaucoin.svg").write_text(svg_page(width, height, "\n".join(body)), encoding="utf-8")


def main() -> None:
    rows = read_stablecoins()
    bar_chart(rows, "capitalizacion_mdd", "Capitalizacion de mercado (millones USD)", "barras_capitalizacion.svg", "#2563eb")
    bar_chart(rows, "riesgo_score", "Score de riesgo por moneda", "barras_riesgo.svg", "#ef4444")
    bar_chart(rows, "liquidez_score", "Score de liquidez por moneda", "barras_liquidez.svg", "#10b981")
    scatter_chart(rows)
    correlation_heatmap(rows)
    line_chart_dynamics()
    radar_qchaucoin(rows)
    print(f"Graficas generadas en: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
