# Analisis academico de QchauCoin

Esta carpeta agrega evidencia tecnica para materias que no estaban cubiertas directamente por el frontend/backend.

## Estadistica Multivariada

Archivo: `estadistica_multivariada.R`

Usa `data/stablecoins.csv` para:

- calcular matriz de correlacion entre variables financieras;
- ejecutar PCA con `prcomp`;
- agrupar monedas con `kmeans`;
- generar salidas CSV en `outputs/`.

No requiere paquetes externos de R.

## Inteligencia Artificial

Archivo: `ia_riesgo_volatilidad.py`

Usa TensorFlow/Keras para entrenar una red neuronal densa que clasifica el riesgo de una stablecoin con variables financieras simuladas/normalizadas.

Dependencia:

```bash
pip install -r requirements-ia.txt
```

## Ecuaciones Diferenciales Aplicadas

Archivo: `ecuaciones_diferenciales.py`

Simula la dinamica del precio de QchauCoin con un modelo diferencial discreto por metodo de Euler:

```text
dP/dt = alpha * (R - P) + beta * D(t) - gamma * I(t)
```

Donde:

- `P` es el precio estimado de QchauCoin.
- `R` es el precio objetivo por respaldo.
- `D(t)` representa presion de demanda.
- `I(t)` representa presion inflacionaria.

Genera `outputs/qchaucoin_dinamica.csv`.

## Visualizacion de red neuronal y graficas

Archivos:

- `visualizar_red_neuronal.py`
- `graficas_svg.py`

Estos scripts generan SVG sin dependencias externas:

- `red_neuronal_riesgo.svg`
- `barras_capitalizacion.svg`
- `barras_riesgo.svg`
- `barras_liquidez.svg`
- `dispersion_volatilidad_liquidez.svg`
- `heatmap_correlacion.svg`
- `linea_dinamica_qchaucoin.svg`
- `radar_qchaucoin.svg`

Ejecutar:

```bash
python analisis/visualizar_red_neuronal.py
python analisis/graficas_svg.py
```
