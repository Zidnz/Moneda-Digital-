<div align="center">

<img src="Imagenes/IconoQchau.png" alt="QchauCoin" width="140" />

# QchauCoin

**Proyecto académico de stablecoin mexicana** — backend con blockchain simple, frontend de wallet y análisis cuantitativo en R y Python.

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.21-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-6.x-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![R](https://img.shields.io/badge/R-4.x-276DC3?logo=r&logoColor=white)](https://www.r-project.org/)
[![Status](https://img.shields.io/badge/status-academic%20demo-orange)](#)
[![License](https://img.shields.io/badge/license-none-lightgrey)](#licencia)

</div>

> [!WARNING]
> Este es un proyecto **académico**, no una moneda real. No lo uses para mover dinero ni lo despliegues en producción.

---

## Tabla de contenidos

- [Características](#características)
- [Estructura del repositorio](#estructura-del-repositorio)
- [Requisitos](#requisitos)
- [Configuración](#configuración)
- [Cómo correrlo](#cómo-correrlo)
- [API del backend](#api-del-backend)
- [Frontend](#frontend)
- [Análisis cuantitativo](#análisis-cuantitativo)
- [Seguridad y limitaciones](#seguridad-y-limitaciones)
- [Contribuir](#contribuir)
- [Licencia](#licencia)

---

## Características

- 🔐 Registro y login con `bcrypt` + JWT.
- ✍️ Firma de transacciones con RSA 2048 (clave del usuario).
- ⛓️ Blockchain minimalista persistida en MongoDB.
- 💸 Transferencias atómicas con transacciones de MongoDB (débito + crédito + minado de bloque en una sola operación).
- 📊 Análisis cuantitativo: PCA, k-means, red neuronal (Keras) y simulación por ecuaciones diferenciales.
- 🖼️ Gráficas SVG generadas sin dependencias externas.

## Estructura del repositorio

```
Moneda-Digital-/
├── Backend/        # API REST (Express + MongoDB + JWT + RSA + blockchain)
│   ├── app.js
│   └── README.md
├── frontend/       # HTML/CSS/JS estático
│   ├── index.html
│   ├── login.html
│   ├── wallets.html
│   ├── walletInfo.html
│   ├── Volatilidad.html
│   ├── marcolegal.html
│   ├── security.html
│   ├── css/
│   └── js/
├── Imagenes/       # Recursos gráficos
├── analisis/       # Análisis académico (R, Python, SVGs)
│   ├── estadistica_multivariada.R
│   ├── ia_riesgo_volatilidad.py
│   ├── ecuaciones_diferenciales.py
│   ├── graficas_svg.py
│   ├── visualizar_red_neuronal.py
│   ├── data/
│   ├── outputs/
│   └── README.md
├── package.json
└── .env.example
```

## Requisitos

| Herramienta | Versión | Para qué |
|---|---|---|
| Node.js | 18+ | Backend |
| npm | 9+ | Gestión de dependencias |
| MongoDB | 6.x (local o Atlas) | Base de datos |
| Python | 3.10+ | Scripts de `analisis/` |
| R | 4.x | `estadistica_multivariada.R` |

## Configuración

Copia el archivo de ejemplo y edítalo:

```bash
cp .env.example .env
```

Variables esperadas:

| Variable | Descripción | Default |
|---|---|---|
| `PORT` | Puerto del backend | `5000` |
| `MONGO_URI` | Cadena de conexión a MongoDB | — (requerida) |
| `MONGO_DB_NAME` | Nombre de la base | `Login` |
| `JWT_SECRET` | Secreto largo y aleatorio para JWT | — (requerida) |
| `CORS_ORIGIN` | Orígenes permitidos, separados por coma | `http://localhost:5500,http://127.0.0.1:5500` |

> [!IMPORTANT]
> El backend termina el proceso si `JWT_SECRET` o `MONGO_URI` no están definidas.

## Cómo correrlo

### Backend

```bash
npm install
npm start
```

Se levanta en `http://localhost:5000`. Al conectar a MongoDB carga (o crea) el bloque génesis en la colección `bloques`.

### Frontend

Son archivos estáticos. Sírvelos desde `http://localhost:5500` o `http://127.0.0.1:5500` (los orígenes del `CORS_ORIGIN` por defecto):

```bash
npx serve frontend -l 5500
```

Entrada: [`frontend/index.html`](frontend/index.html).

## API del backend

Todos los endpoints autenticados requieren el header `Authorization: Bearer <token>`.

| Método | Ruta | Auth | Descripción |
|---|---|:---:|---|
| `POST` | `/registro` | ❌ | Crea usuario, genera par RSA y devuelve la clave privada **una sola vez**. |
| `POST` | `/login` | ❌ | Devuelve JWT y datos básicos del usuario. |
| `GET` | `/usuario/:userId` | ✅ | Datos del usuario (solo el propio). |
| `POST` | `/transaccion` | ✅ | Envía un monto firmado; valida firma, descuenta saldo y mina un bloque. |
| `GET` | `/transacciones/:publicKey` | ✅ | Historial de transacciones del usuario (solo el propio). |
| `GET` | `/blockchain` | ❌ | Devuelve la cadena completa. |

<details>
<summary><strong>Cómo se firma una transacción</strong></summary>

El cliente arma el mensaje:

```js
const mensaje = JSON.stringify({
  remitente: remitentePublicKey,
  destinatario: destinatarioPublicKey,
  monto: parsedMonto,
});
```

Luego lo firma con la clave privada RSA (SHA-256) recibida en `/registro`. El backend reconstruye el mismo mensaje y lo verifica con la clave pública del remitente, además de comparar esa clave con la embebida en el JWT.

</details>

<details>
<summary><strong>Ejemplo de registro (cURL)</strong></summary>

```bash
curl -X POST http://localhost:5000/registro \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Omar","email":"omar@example.com","password":"secreto123"}'
```

Respuesta (resumen):

```json
{
  "msg": "Usuario registrado exitosamente...",
  "userId": "...",
  "publicKey": "-----BEGIN PUBLIC KEY-----\n...",
  "privateKey": "-----BEGIN PRIVATE KEY-----\n...",
  "balance": 100,
  "token": "eyJhbGciOi..."
}
```

Guarda la `privateKey` de inmediato: no se vuelve a entregar.

</details>

## Frontend

| Página | Propósito |
|---|---|
| `index.html` | Landing principal |
| `login.html` | Registro e inicio de sesión |
| `wallets.html` | Wallet del usuario |
| `walletInfo.html` | Detalle / información de wallet |
| `Volatilidad.html` | Contenido sobre estabilidad |
| `marcolegal.html` | Marco legal (Ley Fintech MX) |
| `security.html` | Seguridad y privacidad |

Los scripts que consumen la API (`js/script_login.js`, `js/script_send_money.js`, `js/wallets.js`) apuntan por defecto a `http://localhost:5000`.

## Análisis cuantitativo

Detalle completo en [`analisis/README.md`](analisis/README.md). Resumen:

| Script | Stack | Qué hace |
|---|---|---|
| `estadistica_multivariada.R` | R (base) | Correlación, PCA y k-means sobre `data/stablecoins.csv` |
| `ecuaciones_diferenciales.py` | Python | Dinámica de precio por método de Euler |
| `ia_riesgo_volatilidad.py` | TensorFlow/Keras | Red neuronal densa que clasifica riesgo |
| `visualizar_red_neuronal.py` | Python (stdlib) | SVG de la arquitectura de la red |
| `graficas_svg.py` | Python (stdlib) | Barras, dispersión, heatmap, radar, líneas |

Instalación de dependencias de IA:

```bash
pip install -r analisis/requirements-ia.txt
```

Ejecutar las visualizaciones:

```bash
python analisis/visualizar_red_neuronal.py
python analisis/graficas_svg.py
```

Salidas en `analisis/outputs/`.

## Seguridad y limitaciones

**Lo que hace bien:**

- Hash de contraseñas con `bcrypt` (cost 10).
- JWT con expiración de 1 hora.
- CORS restringido por allowlist.
- Transferencias atómicas vía `session.withTransaction` (débito, crédito y minado en una sola transacción).
- Verificación de firma RSA y chequeo cruzado contra la clave pública del JWT.

**Limitaciones asumidas (es un demo académico):**

> [!CAUTION]
> La clave privada se entrega al usuario en el body de `/registro`. En una wallet real, la clave privada **nunca** debería tocar el servidor.

- La "blockchain" es in-memory + persistida en MongoDB, sin consenso ni proof-of-work.
- No hay rate limiting ni protección anti-replay de firmas.
- Si en algún momento hubo credenciales de MongoDB Atlas hardcodeadas en el repo, rótalas.

## Contribuir

Este es un proyecto académico, pero si quieres proponer mejoras:

1. Haz fork del repo.
2. Crea una rama: `git checkout -b feature/mi-mejora`.
3. Commit y push: `git commit -m "feat: ..."` / `git push origin feature/mi-mejora`.
4. Abre un Pull Request describiendo el cambio.

## Licencia

Sin licencia definida. Uso con fines educativos.
