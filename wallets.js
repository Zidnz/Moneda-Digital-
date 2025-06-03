const BACKEND_URL = 'http://localhost:5000';

let currentUser = null;
let currentPublicKey = null;
let currentBalance = 0;

const VALOR_DOLAR_MXN = 17.10;
const QCHAUCOIN_VALOR_MXN_APROX = 1.00;

function copyToClipboard(elementId) {
    const element = document.getElementById(elementId);
    const textToCopy = element.textContent || element.innerText;
    navigator.clipboard.writeText(textToCopy)
        .then(() => {
            displayMessage('success', '¡Copiado al portapapeles!');
        })
        .catch(err => {
            console.error('Error al copiar: ', err);
            displayMessage('error', 'Error al copiar. Inténtalo manualmente.');
        });
}

function parsePem(pem) {
    if (!pem || typeof pem !== 'string') return '';
    return pem
        .replace(/-----BEGIN (.*)-----/, '')
        .replace(/-----END (.*)-----/, '')
        .replace(/\s/g, '')
        .trim();
}

function b64ToUint8Array(b64str) {
    return Uint8Array.from(atob(b64str), c => c.charCodeAt(0));
}

async function signMessage(message, privateKeyPem) {
    try {
        const privateKey = await crypto.subtle.importKey(
            "pkcs8",
            b64ToUint8Array(parsePem(privateKeyPem)),
            {
                name: "RSASSA-PKCS1-V1_5",
                hash: "SHA-256",
            },
            false,
            ["sign"]
        );

        const encoder = new TextEncoder();
        const data = encoder.encode(message);

        const signatureBuffer = await crypto.subtle.sign(
            { name: "RSASSA-PKCS1-V1_5" },
            privateKey,
            data
        );

        const signatureArray = Array.from(new Uint8Array(signatureBuffer));
        const hexSignature = signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hexSignature;

    } catch (e) {
        throw new Error(`No se pudo firmar la transacción. Asegúrate de que la clave privada es correcta y completa (PEM válido). Error: ${e.message}`);
    }
}

function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
    });
}

function displayMessage(type, text) {
    const transactionMessage = document.getElementById('transactionMessage');
    if (transactionMessage) {
        transactionMessage.textContent = text;
        transactionMessage.className = `message ${type}`;
    }
}

async function fetchUserData() {
    const jwtToken = sessionStorage.getItem('jwtToken');
    const userId = sessionStorage.getItem('loggedInUserId');
    let publicKeyFromStorage = sessionStorage.getItem('loggedInUserPublicKey');

    const userBalanceElement = document.getElementById('userBalance');
    const userBalanceMXNElement = document.getElementById('userBalanceMXN');
    const userBalanceUSDElement = document.getElementById('userBalanceUSD');
    const walletPublicKeyElement = document.getElementById('walletPublicKey');
    const qccValueMXNElement = document.getElementById('qccValueMXN');
    const qccValueUSDElement = document.getElementById('qccValueUSD');

    if (!userId || !publicKeyFromStorage || !jwtToken) {
        if (userBalanceElement) userBalanceElement.textContent = '0.00';
        if (userBalanceMXNElement) userBalanceMXNElement.textContent = '0.00';
        if (userBalanceUSDElement) userBalanceUSDElement.textContent = '0.00';
        if (walletPublicKeyElement) walletPublicKeyElement.textContent = 'Inicia sesión para ver tu dirección';
        return;
    }

    currentUser = { userId: userId };
    
    // Asegurarse de que la clave pública esté en formato PEM completo para mostrarla
    let displayPublicKeyFullPem = publicKeyFromStorage;
    if (!publicKeyFromStorage.startsWith('-----BEGIN PUBLIC KEY-----')) {
        displayPublicKeyFullPem = `-----BEGIN PUBLIC KEY-----\n${publicKeyFromStorage}\n-----END PUBLIC KEY-----`;
    }

    if (walletPublicKeyElement) walletPublicKeyElement.textContent = displayPublicKeyFullPem;

    try {
        const response = await fetch(`${BACKEND_URL}/usuario/${userId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${jwtToken}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error al obtener datos del usuario.');
        }

        const userData = await response.json();
        currentBalance = userData.balance;
        currentPublicKey = userData.publicKey; // Esta ya debería venir en formato PEM completo si tu backend la envía así

        if (userBalanceElement) userBalanceElement.textContent = currentBalance.toFixed(2);
        if (walletPublicKeyElement) walletPublicKeyElement.textContent = currentPublicKey; // Asegurarse que es PEM completo

        if (qccValueMXNElement) qccValueMXNElement.textContent = `${QCHAUCOIN_VALOR_MXN_APROX.toFixed(2)} MXN`;
        if (qccValueUSDElement) qccValueUSDElement.textContent = `${(QCHAUCOIN_VALOR_MXN_APROX / VALOR_DOLAR_MXN).toFixed(4)} USD`;

        if (userBalanceMXNElement) userBalanceMXNElement.textContent = (currentBalance * QCHAUCOIN_VALOR_MXN_APROX).toFixed(2);
        if (userBalanceUSDElement) userBalanceUSDElement.textContent = (currentBalance * (QCHAUCOIN_VALOR_MXN_APROX / VALOR_DOLAR_MXN)).toFixed(2);

    } catch (error) {
        displayMessage('error', `No se pudieron cargar tus datos: ${error.message}. Asegúrate de haber iniciado sesión.`);
    }
}

async function sendTransaction() {
    const jwtToken = sessionStorage.getItem('jwtToken');

    if (!currentUser || !currentPublicKey || !jwtToken) {
        displayMessage("error", "Debes iniciar sesión para enviar QchauCoins.");
        return;
    }

    // Usar 'destinatarioPublicKeyFile' directamente ya que ahora es un input file
    const recipientPublicKeyFileInput = document.getElementById('destinatarioPublicKeyFile');
    const sendAmountInput = document.getElementById('cantidadEnviar');
    const privateKeyFileInput = document.getElementById('privateKeyFile');
    // Si tienes un textarea para la clave privada manual, úsalo también
    // const privateKeyTextInput = document.getElementById('privateKeyInput'); 
    
    displayMessage('info', ''); // Limpiar mensajes previos

    let recipientPublicKey = '';
    // Leer el archivo de clave pública del destinatario
    if (recipientPublicKeyFileInput && recipientPublicKeyFileInput.files.length > 0) {
        const file = recipientPublicKeyFileInput.files[0];
        try {
            displayMessage('info', 'Leyendo archivo de clave pública del destinatario...');
            recipientPublicKey = await readFileAsText(file);
        } catch (error) {
            displayMessage('error', `Error al leer el archivo de clave pública del destinatario: ${error.message}`);
            return;
        }
    } else {
        displayMessage('error', 'Por favor, selecciona un archivo de clave pública del destinatario.');
        return;
    }


    const sendAmount = sendAmountInput ? parseFloat(sendAmountInput.value) : 0;
    
    let privateKeyForSigning = '';

    if (privateKeyFileInput && privateKeyFileInput.files.length > 0) {
        const file = privateKeyFileInput.files[0];
        try {
            displayMessage('info', 'Leyendo archivo de clave privada...');
            privateKeyForSigning = await readFileAsText(file);
        } catch (error) {
            displayMessage('error', `Error al leer el archivo de clave privada: ${error.message}`);
            return;
        }
    } 
    // else if (privateKeyTextInput && privateKeyTextInput.value.trim() !== '') {
    //    privateKeyForSigning = privateKeyTextInput.value.trim();
    // }

    if (!recipientPublicKey || isNaN(sendAmount) || sendAmount <= 0 || !privateKeyForSigning) {
        displayMessage('error', 'Por favor, completa todos los campos (archivo de dirección, cantidad, archivo de clave privada) y asegúrate de que la cantidad sea positiva.');
        return;
    }

    if (sendAmount > currentBalance) {
        displayMessage('error', 'Saldo insuficiente para esta transacción.');
        return;
    }

    // Asegurarse de que la clave pública del destinatario esté en formato PEM completo
    if (!recipientPublicKey.startsWith('-----BEGIN PUBLIC KEY-----')) {
        recipientPublicKey = `-----BEGIN PUBLIC KEY-----\n${recipientPublicKey}\n-----END PUBLIC KEY-----`;
    }

    const transactionDataToSign = JSON.stringify({
        remitente: currentPublicKey, // currentPublicKey ya debe ser PEM completo
        destinatario: recipientPublicKey,
        monto: sendAmount
    });

    try {
        displayMessage('info', 'Firmando transacción...');

        const signature = await signMessage(transactionDataToSign, privateKeyForSigning);

        displayMessage('info', 'Enviando transacción al blockchain...');

        const response = await fetch(`${BACKEND_URL}/transaccion`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${jwtToken}`
            },
            body: JSON.stringify({
                remitentePublicKey: currentPublicKey,
                destinatarioPublicKey: recipientPublicKey,
                monto: sendAmount,
                signature: signature
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Error al procesar la transacción.');
        }

        displayMessage('success', `Transacción exitosa: ${data.msg}`);

        if (sendAmountInput) sendAmountInput.value = '';
        if (recipientPublicKeyFileInput) recipientPublicKeyFileInput.value = ''; // Limpiar el input file
        if (privateKeyFileInput) privateKeyFileInput.value = ''; // Limpiar el input file
        // if (privateKeyTextInput) privateKeyTextInput.value = ''; // Limpiar el textarea si lo usas
        
        await fetchUserData();
        await loadTransactionHistory();

    } catch (error) {
        displayMessage('error', `Error: ${error.message}`);
    }
}

/**
 * Añade una transacción al display del historial en el DOM.
 * @param {object} transaction - Objeto con los detalles de la transacción (type, amount, description, date).
 */
function addTransactionToDisplay(transaction) {
    const transactionsList = document.getElementById('transactionsList');
    if (!transactionsList) return; // Salir si el elemento no existe

    const listItem = document.createElement('li');
    listItem.className = `transaction-item ${transaction.type}`;

    // Formatea el monto con el signo y dos decimales
    const formattedAmount = `${transaction.type === 'received' ? '+' : '-'}${transaction.amount.toFixed(2)} QchauCoin`;

    listItem.innerHTML = `
        <span>${transaction.description}</span>
        <span class="amount">${formattedAmount}</span>
        <span>${transaction.date}</span>
    `;
    transactionsList.appendChild(listItem);

    // Asegurarse de remover el "No hay transacciones recientes" si está presente
    const noTransactionsItem = transactionsList.querySelector('.no-transactions');
    if (noTransactionsItem) {
        noTransactionsItem.remove();
    }
}

/**
 * Carga y muestra el historial de transacciones, incluyendo el saldo inicial.
 * Esta función es llamada al cargar la página y cuando se presiona "Actualizar Historial".
 */
async function loadTransactionHistory() {
    const jwtToken = sessionStorage.getItem('jwtToken');
    const publicKey = sessionStorage.getItem('loggedInUserPublicKey'); // Esta es la clave pública del usuario loggeado

    const transactionsList = document.getElementById('transactionsList');
    if (!transactionsList) {
        console.warn('Elemento #transactionsList no encontrado.');
        return;
    }

    // Limpia la lista actual para evitar duplicados al recargar
    transactionsList.innerHTML = '';

    // Si no hay un usuario loggeado, muestra un mensaje y no intentes cargar del backend
    if (!publicKey || !jwtToken) {
        transactionsList.innerHTML = '<li class="no-transactions">Inicia sesión para ver tu historial de transacciones.</li>';
        return;
    }

    // --- AGREGA LA TRANSACCIÓN INICIAL DE 100 QCHAUCOINS ---
    // Esta transacción simula el saldo inicial al crear la cuenta.
    const initialBalanceTransaction = {
        type: 'received', // Es una transacción que el usuario 'recibió'
        amount: 100.00,
        description: 'Saldo inicial de la cuenta (Bienvenida)',
        // Usamos una fecha y hora fija o de creación de la cuenta si la tuvieras
        // Para este ejemplo, una fecha "antigua" o la fecha actual del día 1 es buena
        date: new Date('2024-01-01T10:00:00').toLocaleString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) 
    };
    addTransactionToDisplay(initialBalanceTransaction);
    // --------------------------------------------------------

    // Muestra "Cargando historial..." solo después de agregar la transacción inicial
    // para que el usuario siempre vea algo. Puedes ajustar esto.
    // transactionsList.innerHTML += '<li class="no-transactions">Cargando historial...</li>'; // Ya no es necesario si la inicial está allí


    try {
        // Parsear la clave pública del usuario para comparar con las transacciones del backend
        const cleanedCurrentUserPublicKey = parsePem(publicKey);

        const response = await fetch(`${BACKEND_URL}/transacciones/${encodeURIComponent(cleanedCurrentUserPublicKey)}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${jwtToken}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error al obtener historial de transacciones.');
        }

        const userTransactions = await response.json();

        // Elimina el posible mensaje de "Cargando historial..." si lo habías puesto
        // const loadingMessage = transactionsList.querySelector('.no-transactions');
        // if (loadingMessage && loadingMessage.textContent.includes('Cargando')) {
        //     loadingMessage.remove();
        // }


        if (userTransactions.length === 0) {
            // Si el backend no devuelve transacciones, y ya tenemos la inicial, no hacemos nada extra.
            // Si quieres un mensaje específico cuando solo está la inicial, puedes ponerlo aquí.
            // Por ejemplo: if (transactionsList.children.length === 1 && transactionsList.children[0].textContent.includes('Saldo inicial')) { ... }
        } else {
            // Recorrer las transacciones del backend y agregarlas
            userTransactions.forEach(tx => {
                // Asegúrate de limpiar las claves públicas de la transacción para la comparación
                const isSent = parsePem(tx.remitente) === cleanedCurrentUserPublicKey;
                
                // Si la transacción del backend es la de "saldo inicial" y ya la agregamos, la saltamos.
                // Esto es crucial para evitar duplicados si tu backend también registra el saldo inicial.
                if (tx.monto === 100 && parsePem(tx.destinatario) === cleanedCurrentUserPublicKey && tx.remitente === "system_or_initial_address") { // Ajusta la condición si tu backend tiene un remitente específico para saldos iniciales
                    return; // Saltar esta transacción para evitar duplicados
                }

                const counterpartyPublicKeyCleaned = isSent ? parsePem(tx.destinatario) : parsePem(tx.remitente);
                const directionText = isSent ? `Enviado a: ${counterpartyPublicKeyCleaned.substring(0, 8)}...` : `Recibido de: ${counterpartyPublicKeyCleaned.substring(0, 8)}...`;
                const amountText = `${isSent ? '-' : '+'}${tx.monto.toFixed(2)} QchauCoin`;
                const date = new Date(tx.timestamp).toLocaleString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

                const li = document.createElement('li');
                li.classList.add('transaction-item', isSent ? 'sent' : 'received');
                li.innerHTML = `
                    <span>${directionText}</span>
                    <span class="amount">${amountText}</span>
                    <span>${date}</span>
                `;
                transactionsList.appendChild(li);
            });
        }

        // Si después de todo, la lista sigue vacía (lo cual no debería pasar con la inicial),
        // podrías agregar un mensaje de "no hay transacciones".
        if (transactionsList.children.length === 0) {
            transactionsList.innerHTML = '<li class="no-transactions">No hay transacciones registradas para esta cuenta.</li>';
        }

    } catch (error) {
        displayMessage('error', `Error al cargar historial: ${error.message}`);
        // Si ocurre un error, y no hay transacciones visibles, muestra el mensaje de error en la lista
        if (transactionsList.children.length === 0) {
            transactionsList.innerHTML = `<li class="no-transactions error-message">Error al cargar historial: ${error.message}</li>`;
        }
    }
}


function handleLoginSuccess(userData) {
    currentUser = {
        userId: userData.userId,
    };
    sessionStorage.setItem('loggedInUserPublicKey', userData.publicKey); // Asegúrate que userData.publicKey viene en PEM completo
    sessionStorage.setItem('jwtToken', userData.jwtToken || 'fake-jwt-token');
    sessionStorage.setItem('loggedInUserId', userData.userId);
    
    // Una vez que el login es exitoso, actualiza los datos y el historial
    fetchUserData();
    loadTransactionHistory();
}

document.addEventListener('DOMContentLoaded', async () => {
    // Intenta cargar datos y historial al inicio si ya hay sesión
    const storedUserId = sessionStorage.getItem('loggedInUserId');
    const storedPublicKey = sessionStorage.getItem('loggedInUserPublicKey');
    const storedJwtToken = sessionStorage.getItem('jwtToken');

    if (storedUserId && storedPublicKey && storedJwtToken) {
        currentUser = { userId: storedUserId };
    }
    
    await fetchUserData();
    await loadTransactionHistory();

    // Event listeners para los botones de copiar y descargar
    const copyButton = document.getElementById('copyPublicKeyBtn');
    if (copyButton) {
        copyButton.addEventListener('click', () => copyToClipboard('walletPublicKey'));
    }

    const downloadPublicKeyButton = document.getElementById('downloadPublicKeyBtn');
    if (downloadPublicKeyButton) {
        downloadPublicKeyButton.addEventListener('click', () => {
            const publicKeyContent = document.getElementById('walletPublicKey').textContent;
            if (publicKeyContent && publicKeyContent !== "Cargando..." && publicKeyContent !== "Inicia sesión para ver tu dirección") {
                const blob = new Blob([publicKeyContent], { type: 'application/x-pem-file' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'qchaucoin_public_key.pem';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                displayMessage("success", "Clave pública descargada como qchaucoin_public_key.pem");
            } else {
                displayMessage("error", "No hay clave pública para descargar.");
            }
        });
    }

    // Event listener para el botón de enviar transacción
    const sendTransactionButton = document.getElementById('sendQchauCoinBtn');
    if (sendTransactionButton) {
        sendTransactionButton.addEventListener('click', sendTransaction);
    }

    // Event listeners para la carga de archivo de clave privada
    const privateKeyFileInput = document.getElementById('privateKeyFile');
    // const privateKeyTextInput = document.getElementById('privateKeyInput'); // Si usas un textarea para entrada manual

    if (privateKeyFileInput) {
        privateKeyFileInput.addEventListener('change', async (event) => {
            const file = event.target.files[0];
            if (file) {
                try {
                    displayMessage('info', 'Cargando archivo de clave privada...');
                    const fileContent = await readFileAsText(file);
                    // if (privateKeyTextInput) privateKeyTextInput.value = fileContent; // Rellena el textarea
                    displayMessage("success", "Clave privada cargada desde el archivo.");
                } catch (error) {
                    displayMessage("error", "Error al leer el archivo de clave privada: " + error.message);
                }
            }
        });
    }

    // Event listener para la carga de archivo de clave pública del destinatario
    const destinatarioPublicKeyFileInput = document.getElementById('destinatarioPublicKeyFile');
    if (destinatarioPublicKeyFileInput) {
        destinatarioPublicKeyFileInput.addEventListener('change', async (event) => {
            const file = event.target.files[0];
            if (file) {
                try {
                    displayMessage('info', 'Cargando archivo de clave pública del destinatario...');
                    const fileContent = await readFileAsText(file);
                    // Aquí podrías guardar el contenido del archivo en alguna variable
                    // o directamente para usarlo en sendTransaction. No es necesario mostrarlo en un input.
                    console.log('Clave pública del destinatario leída.');
                    displayMessage("success", "Archivo de clave pública del destinatario cargado.");
                } catch (error) {
                    displayMessage("error", "Error al leer el archivo de clave pública del destinatario: " + error.message);
                }
            }
        });
    }

    // Event listeners para la navegación lateral (sidebar)
    const openSidebarButton = document.getElementById('open-sidebar-button');
    if (openSidebarButton) {
        openSidebarButton.addEventListener('click', openSidebar);
    }

    const closeSidebarButton = document.getElementById('close-sidebar-button');
    if (closeSidebarButton) {
        closeSidebarButton.addEventListener('click', closeSidebar);
    }

    const overlay = document.getElementById('overlay');
    if (overlay) {
        overlay.addEventListener('click', closeSidebar);
    }
});

function openSidebar() {
    const navbar = document.querySelector("header nav"); // Asumiendo que "header nav" es tu sidebar
    const overlay = document.getElementById("overlay");
    if (navbar) navbar.classList.add("active");
    if (overlay) overlay.style.display = 'block'; // O usar classList.add("active") y manejarlo en CSS
    document.body.style.overflow = 'hidden';
}

function closeSidebar() {
    const navbar = document.querySelector("header nav"); // Asumiendo que "header nav" es tu sidebar
    const overlay = document.getElementById("overlay");
    if (navbar) navbar.classList.remove("active");
    if (overlay) overlay.style.display = 'none'; // O usar classList.remove("active")
    document.body.style.overflow = '';
}