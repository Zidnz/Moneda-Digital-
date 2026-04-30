# Backend

Backend activo de QchauCoin. El servidor soportado es `app.js`.

## Configuracion

Crear variables de entorno antes de iniciar:

```bash
PORT=5000
MONGO_URI=mongodb+srv://usuario:password@cluster.mongodb.net/
MONGO_DB_NAME=Login
JWT_SECRET=usa-un-secreto-largo-y-aleatorio
CORS_ORIGIN=http://localhost:5500,http://127.0.0.1:5500
```

La URI de MongoDB anterior que estaba hardcodeada fue removida del codigo. Rota esa credencial en MongoDB Atlas si ya estuvo publicada en GitHub.

## Ejecutar

```bash
npm install
npm start
```

`app.py` y `blockchain.py` fueron removidos porque duplicaban logica, usaban credenciales hardcodeadas y no eran consumidos por el frontend actual.
