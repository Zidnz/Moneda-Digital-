from __future__ import annotations

from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = BASE_DIR / "outputs"
OUTPUT_DIR.mkdir(exist_ok=True)


def circle(cx: float, cy: float, r: float, fill: str, stroke: str = "#1f2937") -> str:
    return f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{fill}" stroke="{stroke}" stroke-width="2" />'


def line(x1: float, y1: float, x2: float, y2: float, color: str = "#94a3b8", width: float = 1.5) -> str:
    return f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{color}" stroke-width="{width}" opacity="0.55" />'


def text(x: float, y: float, value: str, size: int = 16, anchor: str = "middle", color: str = "#0f172a") -> str:
    return (
        f'<text x="{x}" y="{y}" text-anchor="{anchor}" font-family="Segoe UI, Arial" '
        f'font-size="{size}" fill="{color}">{value}</text>'
    )


def neural_network_svg() -> str:
    width, height = 1100, 700
    layers = [
        ("Entrada", 7, "#38bdf8"),
        ("Densa ReLU", 16, "#22c55e"),
        ("Densa ReLU", 8, "#f59e0b"),
        ("Salida Sigmoid", 1, "#ef4444"),
    ]
    x_positions = [120, 420, 720, 980]
    max_nodes_to_draw = [7, 10, 8, 1]
    node_radius = 16
    nodes: list[list[tuple[float, float]]] = []

    svg: list[str] = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
        '<rect width="100%" height="100%" fill="#f8fafc" />',
        '<rect x="35" y="35" width="1030" height="630" rx="28" fill="#ffffff" stroke="#cbd5e1" />',
        text(width / 2, 78, "Red neuronal para clasificacion de riesgo de stablecoins", 28, color="#0f172a"),
        text(width / 2, 112, "Modelo grafico basado en ia_riesgo_volatilidad.py", 15, color="#475569"),
    ]

    for layer_index, ((label, real_count, color), x, draw_count) in enumerate(zip(layers, x_positions, max_nodes_to_draw)):
        spacing = min(54, 430 / max(draw_count - 1, 1))
        start_y = 210 if draw_count == 1 else 350 - spacing * (draw_count - 1) / 2
        layer_nodes: list[tuple[float, float]] = []

        svg.append(text(x, 165, label, 18, color="#0f172a"))
        svg.append(text(x, 188, f"{real_count} neuronas", 13, color="#64748b"))

        for i in range(draw_count):
            y = start_y + i * spacing
            layer_nodes.append((x, y))
            svg.append(circle(x, y, node_radius, color))

        if real_count > draw_count:
            svg.append(text(x, start_y + draw_count * spacing + 10, "...", 24, color="#64748b"))

        nodes.append(layer_nodes)

    for current_layer, next_layer in zip(nodes, nodes[1:]):
        for x1, y1 in current_layer:
            for x2, y2 in next_layer:
                svg.append(line(x1 + node_radius, y1, x2 - node_radius, y2))

    feature_labels = [
        "capitalizacion",
        "volumen",
        "respaldo fiat",
        "respaldo crypto",
        "respaldo metales",
        "volatilidad",
        "liquidez",
    ]
    for (x, y), label in zip(nodes[0], feature_labels):
        svg.append(text(x - 34, y + 5, label, 12, anchor="end", color="#334155"))

    svg.append(text(980, 410, "Probabilidad", 13, color="#334155"))
    svg.append(text(980, 430, "riesgo alto", 13, color="#334155"))
    svg.append(text(width / 2, 620, "Entrada financiera -> capas densas -> clasificacion binaria de riesgo", 16, color="#334155"))
    svg.append("</svg>")
    return "\n".join(svg)


def main() -> None:
    output = OUTPUT_DIR / "red_neuronal_riesgo.svg"
    output.write_text(neural_network_svg(), encoding="utf-8")
    print(f"Diagrama generado: {output}")


if __name__ == "__main__":
    main()
