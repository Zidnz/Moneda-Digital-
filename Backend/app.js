const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');

const app = express();
const port = 5000;

const JWT_SECRET = process.env.JWT_SECRET || 'mi_clave_secreta_super_segura_12345';

const mongoUri = 'mongodb+srv://grindfull08:jAfLOfUwwnhxJVDR@dataset.mlkrnud.mongodb.net/';
const dbName = 'Login';

app.use(cors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
}));
app.use(bodyParser.json());

function cleanPemKey(pem) {
    if (!pem || typeof pem !== 'string') return '';
    return pem
        .replace(/-----BEGIN (RSA )?PUBLIC KEY-----/, '')
        .replace(/-----END (RSA )?PUBLIC KEY-----/, '')
        .replace(/-----BEGIN (RSA )?PRIVATE KEY-----/, '')
        .replace(/-----END (RSA )?PRIVATE KEY-----/, '')
        .replace(/\r?\n|\r/g, '')
        .trim();
}

function generarClavesRSA() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
            type: 'spki',
            format: 'pem'
        },
        privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem'
        }
    });
    return { publicKey, privateKey };
}

function firmarTransaccion(mensaje, privateKeyPem) {
    const sign = crypto.createSign('SHA256');
    sign.update(mensaje);
    sign.end();
    return sign.sign(privateKeyPem, 'hex');
}

function verificarFirma(mensaje, signatureHex, publicKeyPem) {
    const verify = crypto.createVerify('SHA256');
    verify.update(mensaje);
    verify.end();
    return verify.verify(publicKeyPem, signatureHex, 'hex');
}

class Bloque {
    constructor(indice, transacciones, hashAnterior) {
        this.indice = indice;
        this.timestamp = Date.now();
        this.transacciones = transacciones;
        this.hashAnterior = hashAnterior;
        this.hashActual = this.calcularHash();
    }

    calcularHash() {
        const bloqueString = JSON.stringify({
            indice: this.indice,
            timestamp: this.timestamp,
            transacciones: this.transacciones,
            hashAnterior: this.hashAnterior
        }).toString();
        return crypto.createHash('sha256').update(bloqueString).digest('hex');
    }
}

class Blockchain {
    constructor() {
        this.cadena = [];
        this.transaccionesPendientes = [];
    }

    crearBloqueGenesis() {
        const genesisBloque = new Bloque(0, [], "0");
        this.cadena.push(genesisBloque);
        return genesisBloque;
    }

    getUltimoBloque() {
        return this.cadena[this.cadena.length - 1];
    }

    async minarBloque() {
        if (this.transaccionesPendientes.length === 0) {
            return null;
        }

        const ultimoBloque = this.getUltimoBloque();
        const nuevoBloque = new Bloque(ultimoBloque.indice + 1, this.transaccionesPendientes, ultimoBloque.hashAnterior);
        this.cadena.push(nuevoBloque);
        this.transaccionesPendientes = [];

        try {
            await db.collection('bloques').insertOne(nuevoBloque);
        } catch (error) {
            console.error("ERROR: No se pudo guardar el bloque en MongoDB:", error);
        }

        return nuevoBloque;
    }

    agregarTransaccion(transaccion) {
        this.transaccionesPendientes.push(transaccion);
    }
}

const qchauCoinBlockchain = new Blockchain();

let db;

async function connectToMongo() {
    try {
        const client = new MongoClient(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
        await client.connect();
        db = client.db(dbName);

        const bloquesCollection = db.collection('bloques');
        const bloquesGuardados = await bloquesCollection.find({}).sort({ indice: 1 }).toArray();

        if (bloquesGuardados.length > 0) {
            qchauCoinBlockchain.cadena = bloquesGuardados.map(b => new Bloque(b.indice, b.transacciones, b.hashAnterior));
            qchauCoinBlockchain.cadena.forEach(bloque => {
                bloque.hashActual = bloque.calcularHash();
            });
        } else {
            const genesisBloque = qchauCoinBlockchain.crearBloqueGenesis();
            await bloquesCollection.insertOne(genesisBloque);
        }

    } catch (error) {
        console.error("ERROR CRÍTICO al conectar a MongoDB o al cargar/inicializar Blockchain:", error);
        process.exit(1);
    }
}

connectToMongo();

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        return res.status(401).json({ error: 'Token no proporcionado.' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Token inválido o expirado.' });
        }
        req.user = user;
        next();
    });
}

app.post('/registro', async (req, res) => {
    const { nombre, email, password } = req.body;

    if (!nombre || !email || !password) {
        return res.status(400).json({ error: "Todos los campos (nombre, email, contraseña) son obligatorios." });
    }

    try {
        if (!db) {
            throw new Error("No se pudo conectar a la base de datos. Intenta de nuevo más tarde.");
        }
        const usuariosCollection = db.collection('usuarios');

        const usuarioExistente = await usuariosCollection.findOne({ email });
        if (usuarioExistente) {
            return res.status(409).json({ error: "El correo electrónico ya está registrado." });
        }

        const { publicKey, privateKey } = generarClavesRSA();

        const hashedPassword = await bcrypt.hash(password, 10);

        const nuevoUsuario = {
            nombre,
            email,
            password: hashedPassword,
            publicKey: publicKey,
            publicKeyCleaned: cleanPemKey(publicKey),
            balance: 100,
            transacciones: []
        };

        const result = await usuariosCollection.insertOne(nuevoUsuario);

        const userId = result.insertedId.toString();
        const token = jwt.sign({ userId: userId, publicKey: publicKey, email: email }, JWT_SECRET, { expiresIn: '1h' });

        res.status(201).json({
            msg: "🎉 ¡Usuario registrado exitosamente! ¡GUARDA TU CLAVE PRIVADA AHORA MISMO! La necesitarás para firmar transacciones. No la compartas.",
            userId: userId,
            publicKey: publicKey,
            privateKey: privateKey,
            balance: nuevoUsuario.balance,
            token: token
        });

    } catch (error) {
        console.error("❌ ERROR CRÍTICO en la ruta /registro:", error);
        res.status(500).json({ error: "Error interno del servidor al registrar usuario. Intenta de nuevo más tarde." });
    }
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: "Todos los campos (email, contraseña) son obligatorios." });
    }

    try {
        if (!db) {
            throw new Error("No se pudo conectar a la base de datos. Intenta de nuevo más tarde.");
        }
        const usuariosCollection = db.collection('usuarios');
        const usuario = await usuariosCollection.findOne({ email });

        if (!usuario) {
            return res.status(401).json({ error: "Credenciales inválidas." });
        }

        const isPasswordValid = await bcrypt.compare(password, usuario.password);

        if (!isPasswordValid) {
            return res.status(401).json({ error: "Credenciales inválidas." });
        }

        const token = jwt.sign({ userId: usuario._id.toString(), publicKey: usuario.publicKey, email: usuario.email }, JWT_SECRET, { expiresIn: '1h' });

        res.status(200).json({
            msg: "¡Inicio de sesión exitoso!",
            userId: usuario._id.toString(),
            publicKey: usuario.publicKey,
            balance: usuario.balance,
            token: token
        });

    } catch (error) {
        console.error("❌ ERROR CRÍTICO en la ruta /login:", error);
        res.status(500).json({ error: "Error interno del servidor al iniciar sesión." });
    }
});

app.get('/usuario/:userId', authenticateToken, async (req, res) => {
    const { userId } = req.params;

    if (req.user && req.user.userId !== userId) {
        return res.status(403).json({ error: "Acceso no autorizado a los datos de este usuario." });
    }

    try {
        if (!db) {
            throw new Error("No se pudo conectar a la base de datos.");
        }
        const usuariosCollection = db.collection('usuarios');

        if (!ObjectId.isValid(userId)) {
            return res.status(400).json({ error: "Formato de ID de usuario inválido." });
        }

        const usuario = await usuariosCollection.findOne({ _id: new ObjectId(userId) });

        if (!usuario) {
            return res.status(404).json({ error: "Usuario no encontrado." });
        }

        res.status(200).json({
            userId: usuario._id,
            publicKey: usuario.publicKey,
            balance: usuario.balance,
            nombre: usuario.nombre,
            email: usuario.email
        });

    } catch (error) {
        console.error("❌ ERROR CRÍTICO en la ruta /usuario/:userId:", error);
        res.status(500).json({ error: "Error interno del servidor al obtener datos del usuario." });
    }
});

app.post('/transaccion', authenticateToken, async (req, res) => {
    const { remitentePublicKey, destinatarioPublicKey, monto, signature } = req.body;

    if (!remitentePublicKey || !destinatarioPublicKey || !monto || !signature) {
        return res.status(400).json({ error: "Faltan datos de la transacción (remitente, destinatario, monto, firma)." });
    }

    const parsedMonto = parseFloat(monto);
    if (isNaN(parsedMonto) || parsedMonto <= 0) {
        return res.status(400).json({ error: "El monto debe ser un número positivo." });
    }

    if (req.user && cleanPemKey(req.user.publicKey) !== cleanPemKey(remitentePublicKey)) {
        return res.status(403).json({ error: "No autorizado para firmar transacciones de esta clave pública." });
    }

    const messageToVerify = JSON.stringify({
        remitente: remitentePublicKey,
        destinatario: destinatarioPublicKey,
        monto: parsedMonto
    });

    try {
        if (!db) {
            throw new Error("No se pudo conectar a la base de datos. Intenta de nuevo más tarde.");
        }
        const usuariosCollection = db.collection('usuarios');

        const isValidSignature = verificarFirma(messageToVerify, signature, remitentePublicKey);

        if (!isValidSignature) {
            return res.status(403).json({ error: "Firma de transacción inválida. Transacción rechazada." });
        }

        const cleanedRemitentePublicKey = cleanPemKey(remitentePublicKey);
        const cleanedDestinatarioPublicKey = cleanPemKey(destinatarioPublicKey);

        const remitente = await usuariosCollection.findOne({ publicKeyCleaned: cleanedRemitentePublicKey });

        if (!remitente) {
            return res.status(404).json({ error: "Remitente no encontrado en la base de datos." });
        }
        if (remitente.balance < parsedMonto) {
            return res.status(400).json({ error: "Saldo insuficiente para completar la transacción." });
        }

        const destinatario = await usuariosCollection.findOne({ publicKeyCleaned: cleanedDestinatarioPublicKey });
        if (!destinatario) {
            return res.status(404).json({ error: "Destinatario no encontrado en la base de datos." });
        }

        const nuevaTransaccion = {
            remitente: remitentePublicKey,
            destinatario: destinatarioPublicKey,
            monto: parsedMonto,
            signature: signature,
            timestamp: Date.now()
        };
        qchauCoinBlockchain.agregarTransaccion(nuevaTransaccion);

        if (qchauCoinBlockchain.transaccionesPendientes.length >= 1) {
            const nuevoBloque = await qchauCoinBlockchain.minarBloque();
            if (nuevoBloque) {
                await usuariosCollection.updateOne(
                    { publicKeyCleaned: cleanedRemitentePublicKey },
                    { $inc: { balance: -parsedMonto } }
                );

                await usuariosCollection.updateOne(
                    { publicKeyCleaned: cleanedDestinatarioPublicKey },
                    { $inc: { balance: parsedMonto } }
                );

                await usuariosCollection.updateOne(
                    { publicKeyCleaned: cleanedRemitentePublicKey },
                    { $push: { transacciones: nuevaTransaccion } }
                );
                await usuariosCollection.updateOne(
                    { publicKeyCleaned: cleanedDestinatarioPublicKey },
                    { $push: { transacciones: nuevaTransaccion } }
                );
            }
        }

        res.status(200).json({ msg: "Transacción recibida y validada. Pendiente de ser minada en un bloque (o ya minada)." });

    } catch (error) {
        console.error("❌ ERROR CRÍTICO al procesar transacción en /transaccion:", error);
        res.status(500).json({ error: "Error interno del servidor al procesar la transacción." });
    }
});

app.get('/transacciones/:publicKey', authenticateToken, async (req, res) => {
    let { publicKey } = req.params;

    const userPublicKeyFromToken = req.user ? cleanPemKey(req.user.publicKey) : '';

    if (req.user && userPublicKeyFromToken !== cleanPemKey(publicKey)) {
        return res.status(403).json({ error: "No autorizado para ver las transacciones de esta clave pública." });
    }

    try {
        if (!db) {
            throw new Error("No se pudo conectar a la base de datos.");
        }

        const usuariosCollection = db.collection('usuarios');

        const foundUser = await usuariosCollection.findOne({ publicKeyCleaned: cleanPemKey(publicKey) });

        if (!foundUser) {
            return res.status(404).json({ error: "Usuario no encontrado." });
        }

        res.status(200).json(foundUser.transacciones);

    } catch (error) {
        console.error("❌ ERROR CRÍTICO en la ruta /transacciones/:publicKey:", error);
        res.status(500).json({ error: "Error interno del servidor al obtener transacciones." });
    }
});

app.get('/blockchain', (req, res) => {
    res.json(qchauCoinBlockchain.cadena);
});

app.listen(port, () => {
    console.log(`Servidor escuchando en http://localhost:${port}`);
});