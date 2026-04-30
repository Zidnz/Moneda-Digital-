const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');

const app = express();
const port = process.env.PORT || 5000;

const JWT_SECRET = process.env.JWT_SECRET;
const mongoUri = process.env.MONGO_URI;
const dbName = process.env.MONGO_DB_NAME || 'Login';
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5500,http://127.0.0.1:5500')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

if (!JWT_SECRET || !mongoUri) {
    console.error('Faltan variables de entorno requeridas: JWT_SECRET y MONGO_URI.');
    process.exit(1);
}

app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error('Origen no permitido por CORS.'));
    },
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

function verificarFirma(mensaje, signatureHex, publicKeyPem) {
    try {
        const verify = crypto.createVerify('SHA256');
        verify.update(mensaje);
        verify.end();
        return verify.verify(publicKeyPem, signatureHex, 'hex');
    } catch (error) {
        return false;
    }
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
    }

    crearBloqueGenesis() {
        const genesisBloque = new Bloque(0, [], '0');
        this.cadena.push(genesisBloque);
        return genesisBloque;
    }

    getUltimoBloque() {
        return this.cadena[this.cadena.length - 1];
    }

    crearBloque(transacciones) {
        const ultimoBloque = this.getUltimoBloque();
        return new Bloque(ultimoBloque.indice + 1, transacciones, ultimoBloque.hashActual);
    }
}

const qchauCoinBlockchain = new Blockchain();

let db;
let mongoClient;

async function connectToMongo() {
    try {
        mongoClient = new MongoClient(mongoUri);
        await mongoClient.connect();
        db = mongoClient.db(dbName);

        const bloquesCollection = db.collection('bloques');
        const bloquesGuardados = await bloquesCollection.find({}).sort({ indice: 1 }).toArray();

        if (bloquesGuardados.length > 0) {
            qchauCoinBlockchain.cadena = bloquesGuardados.map(b => {
                const bloque = new Bloque(b.indice, b.transacciones, b.hashAnterior);
                bloque.timestamp = b.timestamp;
                bloque.hashActual = bloque.calcularHash();
                return bloque;
            });
        } else {
            const genesisBloque = qchauCoinBlockchain.crearBloqueGenesis();
            await bloquesCollection.insertOne(genesisBloque);
        }
    } catch (error) {
        console.error('ERROR CRITICO al conectar a MongoDB o al cargar/inicializar Blockchain:', error);
        process.exit(1);
    }
}

function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token no proporcionado.' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Token invalido o expirado.' });
        }
        req.user = user;
        next();
    });
}

app.post('/registro', async (req, res) => {
    const { nombre, email, password } = req.body;

    if (!nombre || !email || !password) {
        return res.status(400).json({ error: 'Todos los campos (nombre, email, password) son obligatorios.' });
    }

    try {
        if (!db) {
            throw new Error('No se pudo conectar a la base de datos. Intenta de nuevo mas tarde.');
        }

        const usuariosCollection = db.collection('usuarios');
        const usuarioExistente = await usuariosCollection.findOne({ email });

        if (usuarioExistente) {
            return res.status(409).json({ error: 'El correo electronico ya esta registrado.' });
        }

        const { publicKey, privateKey } = generarClavesRSA();
        const hashedPassword = await bcrypt.hash(password, 10);

        const nuevoUsuario = {
            nombre,
            email,
            password: hashedPassword,
            publicKey,
            publicKeyCleaned: cleanPemKey(publicKey),
            balance: 100,
            transacciones: []
        };

        const result = await usuariosCollection.insertOne(nuevoUsuario);
        const userId = result.insertedId.toString();
        const token = jwt.sign({ userId, publicKey, email }, JWT_SECRET, { expiresIn: '1h' });

        return res.status(201).json({
            msg: 'Usuario registrado exitosamente. Guarda tu clave privada ahora mismo. La necesitaras para firmar transacciones. No la compartas.',
            userId,
            publicKey,
            privateKey,
            balance: nuevoUsuario.balance,
            token
        });
    } catch (error) {
        console.error('ERROR CRITICO en la ruta /registro:', error);
        return res.status(500).json({ error: 'Error interno del servidor al registrar usuario. Intenta de nuevo mas tarde.' });
    }
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Todos los campos (email, password) son obligatorios.' });
    }

    try {
        if (!db) {
            throw new Error('No se pudo conectar a la base de datos. Intenta de nuevo mas tarde.');
        }

        const usuariosCollection = db.collection('usuarios');
        const usuario = await usuariosCollection.findOne({ email });

        if (!usuario) {
            return res.status(401).json({ error: 'Credenciales invalidas.' });
        }

        const isPasswordValid = await bcrypt.compare(password, usuario.password);

        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Credenciales invalidas.' });
        }

        const token = jwt.sign(
            { userId: usuario._id.toString(), publicKey: usuario.publicKey, email: usuario.email },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        return res.status(200).json({
            msg: 'Inicio de sesion exitoso.',
            userId: usuario._id.toString(),
            publicKey: usuario.publicKey,
            balance: usuario.balance,
            token
        });
    } catch (error) {
        console.error('ERROR CRITICO en la ruta /login:', error);
        return res.status(500).json({ error: 'Error interno del servidor al iniciar sesion.' });
    }
});

app.get('/usuario/:userId', authenticateToken, async (req, res) => {
    const { userId } = req.params;

    if (req.user && req.user.userId !== userId) {
        return res.status(403).json({ error: 'Acceso no autorizado a los datos de este usuario.' });
    }

    try {
        if (!db) {
            throw new Error('No se pudo conectar a la base de datos.');
        }

        if (!ObjectId.isValid(userId)) {
            return res.status(400).json({ error: 'Formato de ID de usuario invalido.' });
        }

        const usuariosCollection = db.collection('usuarios');
        const usuario = await usuariosCollection.findOne({ _id: new ObjectId(userId) });

        if (!usuario) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }

        return res.status(200).json({
            userId: usuario._id,
            publicKey: usuario.publicKey,
            balance: usuario.balance,
            nombre: usuario.nombre,
            email: usuario.email
        });
    } catch (error) {
        console.error('ERROR CRITICO en la ruta /usuario/:userId:', error);
        return res.status(500).json({ error: 'Error interno del servidor al obtener datos del usuario.' });
    }
});

app.post('/transaccion', authenticateToken, async (req, res) => {
    const { remitentePublicKey, destinatarioPublicKey, monto, signature } = req.body;

    if (!remitentePublicKey || !destinatarioPublicKey || !monto || !signature) {
        return res.status(400).json({ error: 'Faltan datos de la transaccion (remitente, destinatario, monto, firma).' });
    }

    const parsedMonto = parseFloat(monto);
    if (!Number.isFinite(parsedMonto) || parsedMonto <= 0) {
        return res.status(400).json({ error: 'El monto debe ser un numero positivo.' });
    }

    if (req.user && cleanPemKey(req.user.publicKey) !== cleanPemKey(remitentePublicKey)) {
        return res.status(403).json({ error: 'No autorizado para firmar transacciones de esta clave publica.' });
    }

    const messageToVerify = JSON.stringify({
        remitente: remitentePublicKey,
        destinatario: destinatarioPublicKey,
        monto: parsedMonto
    });

    const isValidSignature = verificarFirma(messageToVerify, signature, remitentePublicKey);
    if (!isValidSignature) {
        return res.status(403).json({ error: 'Firma de transaccion invalida. Transaccion rechazada.' });
    }

    const cleanedRemitentePublicKey = cleanPemKey(remitentePublicKey);
    const cleanedDestinatarioPublicKey = cleanPemKey(destinatarioPublicKey);

    const nuevaTransaccion = {
        remitente: remitentePublicKey,
        destinatario: destinatarioPublicKey,
        monto: parsedMonto,
        signature,
        timestamp: Date.now()
    };

    let session;
    let nuevoBloque;

    try {
        if (!db || !mongoClient) {
            throw new Error('No se pudo conectar a la base de datos. Intenta de nuevo mas tarde.');
        }

        session = mongoClient.startSession();
        const usuariosCollection = db.collection('usuarios');
        const bloquesCollection = db.collection('bloques');

        await session.withTransaction(async () => {
            const remitente = await usuariosCollection.findOne(
                { publicKeyCleaned: cleanedRemitentePublicKey },
                { session }
            );

            if (!remitente) {
                const error = new Error('Remitente no encontrado en la base de datos.');
                error.statusCode = 404;
                throw error;
            }

            const destinatario = await usuariosCollection.findOne(
                { publicKeyCleaned: cleanedDestinatarioPublicKey },
                { session }
            );

            if (!destinatario) {
                const error = new Error('Destinatario no encontrado en la base de datos.');
                error.statusCode = 404;
                throw error;
            }

            const debitResult = await usuariosCollection.updateOne(
                { publicKeyCleaned: cleanedRemitentePublicKey, balance: { $gte: parsedMonto } },
                {
                    $inc: { balance: -parsedMonto },
                    $push: { transacciones: nuevaTransaccion }
                },
                { session }
            );

            if (debitResult.modifiedCount !== 1) {
                const error = new Error('Saldo insuficiente para completar la transaccion.');
                error.statusCode = 400;
                throw error;
            }

            await usuariosCollection.updateOne(
                { publicKeyCleaned: cleanedDestinatarioPublicKey },
                {
                    $inc: { balance: parsedMonto },
                    $push: { transacciones: nuevaTransaccion }
                },
                { session }
            );

            nuevoBloque = qchauCoinBlockchain.crearBloque([nuevaTransaccion]);
            await bloquesCollection.insertOne(nuevoBloque, { session });
        });

        if (nuevoBloque) {
            qchauCoinBlockchain.cadena.push(nuevoBloque);
        }

        return res.status(200).json({ msg: 'Transaccion recibida, validada y minada en un bloque.' });
    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({ error: error.message });
        }
        console.error('ERROR CRITICO al procesar transaccion en /transaccion:', error);
        return res.status(500).json({ error: 'Error interno del servidor al procesar la transaccion.' });
    } finally {
        if (session) {
            await session.endSession();
        }
    }
});

app.get('/transacciones/:publicKey', authenticateToken, async (req, res) => {
    const { publicKey } = req.params;
    const userPublicKeyFromToken = req.user ? cleanPemKey(req.user.publicKey) : '';

    if (req.user && userPublicKeyFromToken !== cleanPemKey(publicKey)) {
        return res.status(403).json({ error: 'No autorizado para ver las transacciones de esta clave publica.' });
    }

    try {
        if (!db) {
            throw new Error('No se pudo conectar a la base de datos.');
        }

        const usuariosCollection = db.collection('usuarios');
        const foundUser = await usuariosCollection.findOne({ publicKeyCleaned: cleanPemKey(publicKey) });

        if (!foundUser) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }

        return res.status(200).json(foundUser.transacciones);
    } catch (error) {
        console.error('ERROR CRITICO en la ruta /transacciones/:publicKey:', error);
        return res.status(500).json({ error: 'Error interno del servidor al obtener transacciones.' });
    }
});

app.get('/blockchain', (req, res) => {
    return res.json(qchauCoinBlockchain.cadena);
});

connectToMongo().then(() => {
    app.listen(port, () => {
        console.log(`Servidor escuchando en http://localhost:${port}`);
    });
});
