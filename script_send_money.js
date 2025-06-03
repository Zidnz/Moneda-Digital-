document.addEventListener('DOMContentLoaded', async () => {
    const myPublicKeySpan = document.getElementById('myPublicKey');
    const myBalanceSpan = document.getElementById('myBalance');
    const recipientPublicKeyInput = document.getElementById('recipient-public-key');
    const amountInput = document.getElementById('amount');
    const privateKeyInput = document.getElementById('private-key-input');
    const sendTransactionButton = document.getElementById('send-transaction-button');

    // --- Cargar clave pública y balance del usuario desde localStorage ---
    const userPublicKey = localStorage.getItem('userPublicKey');
    
    // Si no hay clave pública, redirigir al login
    if (!userPublicKey) {
        alert("No has iniciado sesión o tu clave pública no está disponible. Por favor, inicia sesión.");
        window.location.href = 'login.html';
        return;
    }

    myPublicKeySpan.textContent = userPublicKey; // Muestra la clave pública del usuario

    // --- Función para obtener y mostrar el balance más reciente del usuario ---
    async function getLatestBalance() {
        try {
            const res = await fetch(`http://localhost:5000/balance?publicKey=${userPublicKey}`);
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || `Error HTTP: ${res.status}`);
            }
            const data = await res.json();
            if (data.balance !== undefined) {
                const currentBalance = parseFloat(data.balance);
                localStorage.setItem('userBalance', currentBalance.toFixed(2)); // Actualiza localStorage
                myBalanceSpan.textContent = currentBalance.toFixed(2); // Actualiza la UI
                console.log("Balance actualizado:", currentBalance);
            } else {
                console.warn("Balance no recibido del backend.");
                myBalanceSpan.textContent = 'Error al cargar';
            }
        } catch (error) {
            console.error("Error al obtener balance actualizado:", error);
            alert(`Error al cargar tu balance: ${error.message}`);
            myBalanceSpan.textContent = 'Error al cargar';
        }
    }

    // Llama a la función para cargar el balance inicial al cargar la página
    await getLatestBalance();


    // --- Función para firmar con Web Crypto API (JavaScript) ---
    // Esta función es crucial. Genera la firma en el cliente.
    async function signMessage(message, privateKeyPem) {
        try {
            // Convertir el PEM de la clave privada a ArrayBuffer para importKey
            const privateKeyBuffer = new TextEncoder().encode(privateKeyPem);

            // Importar la clave privada PEM en formato CryptoKey
            const privateKey = await crypto.subtle.importKey(
                "pkcs8", // Formato de la clave privada (PKCS#8)
                privateKeyBuffer,
                {
                    name: "RSASSA-PKCS1-V1_5", // Algoritmo de firma
                    hash: { name: "SHA-256" }, // Algoritmo de hash
                },
                false, // 'false' porque la clave no se exportará después de importarla
                ["sign"] // Solo se usará para firmar
            );

            // Firmar los datos (el mensaje)
            const signature = await crypto.subtle.sign(
                { name: "RSASSA-PKCS1-V1_5", hash: { name: "SHA-256" } },
                privateKey,
                new TextEncoder().encode(message) // Datos a firmar (el JSON stringificado de la transacción)
            );

            // Convertir la firma de ArrayBuffer a una cadena Base64 (más común y fácil de transmitir)
            return btoa(String.fromCharCode(...new Uint8Array(signature)));

        } catch (error) {
            console.error("Error al firmar el mensaje:", error);
            alert("Error al firmar la transacción. Asegúrate de que la clave privada es correcta y el entorno es seguro (HTTPS/localhost). Detalles: " + error.message);
            throw error; // Re-lanza el error para que el catch del event listener lo maneje
        }
    }

    // --- Event Listener para el botón de enviar transacción ---
    sendTransactionButton.addEventListener('click', async () => {
        const recipient = recipientPublicKeyInput.value.trim();
        const amount = parseFloat(amountInput.value);
        const privateKeyPem = privateKeyInput.value.trim(); // La clave privada que el usuario pega

        // --- Validaciones ---
        if (!recipient || isNaN(amount) || amount <= 0 || !privateKeyPem) {
            alert("Por favor, rellena todos los campos correctamente (clave del destinatario, monto, y tu clave privada).");
            return;
        }

        const currentBalance = parseFloat(myBalanceSpan.textContent); // Usar el balance actual en la UI
        if (currentBalance < amount) {
            alert(`Saldo insuficiente. Tu balance actual es ${currentBalance.toFixed(2)} QchauCoins.`);
            return;
        }
        if (recipient === userPublicKey) {
            alert('No puedes enviarte QchauCoins a ti mismo.');
            return;
        }

        // Crear el mensaje de la transacción que será firmado (debe ser consistente con lo que el backend verifica)
        // El orden de las propiedades importa para la consistencia del hash/firma
        const transactionObjectForSigning = {
            remitente: userPublicKey,
            destinatario: recipient,
            monto: amount
            // No incluir 'signature' o 'timestamp' aquí, porque son parte del resultado o se añaden después.
        };
        const transactionMessage = JSON.stringify(transactionObjectForSigning);


        try {
            // Firmar la transacción con la clave privada del usuario
            const signature = await signMessage(transactionMessage, privateKeyPem);
            console.log("Transacción firmada. Firma:", signature);

            // Preparar los datos para enviar al backend (AHORA INCLUYE LA FIRMA, NO LA CLAVE PRIVADA)
            const transactionData = {
                remitente: userPublicKey, // Renombré de remitentePublicKey a remitente para consistencia con backend
                destinatario: recipient,    // Renombré de destinatarioPublicKey a destinatario
                monto: amount,
                signature: signature // ¡La firma generada en el frontend!
            };

            console.log("Enviando transacción al backend:", transactionData);

            // Enviar la transacción firmada al backend
            const res = await fetch("http://localhost:5000/transaccion", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(transactionData)
            });

            if (!res.ok) { // Si la respuesta no es 2xx (ej. 400, 403, 404, 500)
                const errorData = await res.json();
                throw new Error(errorData.error || `Error HTTP: ${res.status} - ${res.statusText}`);
            }

            const result = await res.json();
            alert(result.msg);
            console.log("Respuesta del backend:", result);

            await getLatestBalance();

            // Limpiar campos después de una transacción exitosa
            recipientPublicKeyInput.value = '';
            amountInput.value = '';
            privateKeyInput.value = '';

        } catch (error) {
            console.error("Error al enviar transacción:", error);
            alert(`Error al enviar transacción: ${error.message}`);
        }
    });
});