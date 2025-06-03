document.addEventListener('DOMContentLoaded', (event) => {

    const container = document.getElementById('container');
    const registerBtn = document.getElementById('register');
    const loginBtn = document.getElementById('login');

    if (registerBtn && container) {
        registerBtn.addEventListener("click", () => {
            container.classList.add("active");
        });
    }

    if (loginBtn && container) {
        loginBtn.addEventListener("click", () => {
            container.classList.remove("active");
        });
    }

    const BACKEND_URL = 'http://localhost:5000';

    async function registrarUsuario() {
        const signupNameInput = document.getElementById("signup-name");
        const signupEmailInput = document.getElementById("signup-email");
        const signupPasswordInput = document.getElementById("signup-password");

        if (!signupNameInput || !signupEmailInput || !signupPasswordInput) {
            alert("Error: No se encontraron todos los campos del formulario de registro.");
            return;
        }

        const data = {
            nombre: signupNameInput.value,
            email: signupEmailInput.value,
            password: signupPasswordInput.value,
        };

        try {
            const res = await fetch(`${BACKEND_URL}/registro`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || `Error HTTP: ${res.status}`);
            }

            const result = await res.json();

            if (result.msg && result.publicKey && result.privateKey && result.userId && result.token) {
                const cleanedPublicKey = result.publicKey
                    .replace('-----BEGIN PUBLIC KEY-----', '')
                    .replace('-----END PUBLIC KEY-----', '')
                    .replace(/\r?\n|\r/g, '')
                    .trim();

                const cleanedPrivateKey = result.privateKey
                    .replace('-----BEGIN PRIVATE KEY-----', '')
                    .replace('-----END PRIVATE KEY-----', '')
                    .replace(/\r?\n|\r/g, '')
                    .trim();

                alert(result.msg + "\n\n¡IMPORTANTE! Guarda tu CLAVE PRIVADA:\n\n" + cleanedPrivateKey + "\n\n¡No la compartas! La necesitarás para firmar transacciones." + "\n\nTu CLAVE PÚBLICA es:\n\n" + cleanedPublicKey);

                const blob = new Blob([result.privateKey], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'qchaucoin_private_key.pem';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                sessionStorage.setItem('jwtToken', result.token);
                sessionStorage.setItem('loggedInUserId', result.userId);
                sessionStorage.setItem('loggedInUserPublicKey', result.publicKey);
                sessionStorage.setItem('loggedInUserBalance', result.balance || 0);

                window.location.href = 'wallets.html';

            } else {
                alert(result.msg || "Registro exitoso, pero no se recibieron las claves o datos esenciales (ID de usuario, token). Contacta a soporte.");
            }

        } catch (error) {
            alert(`Error al registrar usuario: ${error.message}`);
        }
    }

    window.registrarUsuario = registrarUsuario;

    async function iniciarSesion() {
        const loginEmailInput = document.getElementById("login-email");
        const loginPasswordInput = document.getElementById("login-password");

        if (!loginEmailInput || !loginPasswordInput) {
            alert("Error: No se encontraron todos los campos del formulario de inicio de sesión.");
            return;
        }

        const data = {
            email: loginEmailInput.value,
            password: loginPasswordInput.value
        };

        try {
            const res = await fetch(`${BACKEND_URL}/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || `Error HTTP: ${res.status}`);
            }

            const result = await res.json();
            alert(result.msg || "Inicio de sesión exitoso!");

            if (result.userId && result.publicKey && result.balance !== undefined && result.token) {
                sessionStorage.setItem('jwtToken', result.token);
                sessionStorage.setItem('loggedInUserId', result.userId);
                sessionStorage.setItem('loggedInUserPublicKey', result.publicKey);
                sessionStorage.setItem('loggedInUserBalance', result.balance);
            } else {
                console.warn("Inicio de sesión exitoso, pero faltan datos esenciales (userId, publicKey, balance, token) en la respuesta del backend.");
            }

            window.location.href = 'wallets.html';

        } catch (error) {
            alert(`Error al iniciar sesión: ${error.message}`);
        }
    }

    window.iniciarSesion = iniciarSesion;

    function openSidebar() {
        const navbar = document.getElementById('navbar');
        const overlay = document.getElementById('overlay');
        const openButton = document.getElementById('open-sidebar-button');

        if (navbar) {
            navbar.classList.add('active');
        }
        if (overlay) {
            overlay.classList.add('active');
            overlay.setAttribute('aria-hidden', 'false');
        }
        if (openButton) {
            openButton.setAttribute('aria-expanded', 'true');
        }
    }
    window.openSidebar = openSidebar;

    function closeSidebar() {
        const navbar = document.getElementById('navbar');
        const overlay = document.getElementById('overlay');
        const openButton = document.getElementById('open-sidebar-button');

        if (navbar) {
            navbar.classList.remove('active');
        }
        if (overlay) {
            overlay.classList.remove('active');
            overlay.setAttribute('aria-hidden', 'true');
        }
        if (openButton) {
            openButton.setAttribute('aria-expanded', 'false');
        }
    }
    window.closeSidebar = closeSidebar;

});