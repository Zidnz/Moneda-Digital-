document.addEventListener('DOMContentLoaded', () => {
    // --- Lógica existente de la barra lateral (sidebar) ---
    const openButton = document.getElementById('open-sidebar-button');
    const navbar = document.getElementById('navbar');

    const media = window.matchMedia("(width < 700px)");

    media.addEventListener('change', (e) => updateNavbar(e));

    function updateNavbar(e) {
        const isMobile = e.matches;
        console.log("Es móvil (navbar):", isMobile); // Agregado para depuración
        if (isMobile) {
            navbar.setAttribute('inert', '');
        } else {
            navbar.removeAttribute('inert');
        }
    }

    function openSidebar() {
        navbar.classList.add('show');
        openButton.setAttribute('aria-expanded', 'true');
        navbar.removeAttribute('inert');
    }

    function closeSidebar() {
        navbar.classList.remove('show');
        openButton.setAttribute('aria-expanded', 'false');
        navbar.setAttribute('inert', '');
    }

    const navLinks = document.querySelectorAll('nav a');
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            closeSidebar();
        });
    });

    updateNavbar(media);

    // --- Lógica existente del modo oscuro (dark mode) ---
    const toggleBtn = document.getElementById("modo-toggle");
    const body = document.body;

    if (toggleBtn && body) {
        const modoGuardado = localStorage.getItem("modo");
        if (modoGuardado === "oscuro") {
            body.classList.add("dark-mode");
            toggleBtn.textContent = "☀️";
        } else {
            toggleBtn.textContent = "🌙";
        }

        toggleBtn.addEventListener("click", () => {
            body.classList.toggle("dark-mode");
            const esOscuro = body.classList.contains("dark-mode");
            toggleBtn.textContent = esOscuro ? "☀️" : "🌙";
            localStorage.setItem("modo", esOscuro ? "oscuro" : "claro");
        });
    }

    // --- Lógica existente de scroll suave a anclas ---
    document.querySelectorAll('a[href^="#"]:not([href*=".html"])').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();

            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);

            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth'
                });

                if (navbar && navbar.classList.contains('show')) {
                    navbar.classList.remove('show');
                }

                const sidebarNav = document.querySelector('.legal-framework-section .sidebar-nav');
                if (sidebarNav && sidebarNav.classList.contains('show-mobile')) {
                    sidebarNav.classList.remove('show-mobile');
                }
            }
        });
    });

    // --- Lógica existente de Intersection Observer para navegación principal ---
    const mainSections = document.querySelectorAll('section[id]');
    const mainNavLinks = document.querySelectorAll('.navbar .nav-links .nav-link');

    const mainObserverOptions = {
        root: null,
        rootMargin: '0px 0px -50% 0px',
        threshold: 0
    };

    const mainObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                mainNavLinks.forEach(link => {
                    link.classList.remove('active');
                });
                const currentSectionId = entry.target.id;
                const correspondingLink = document.querySelector(`.navbar .nav-links .nav-link[href="#${currentSectionId}"]`);
                if (correspondingLink) {
                    correspondingLink.classList.add('active');
                }
            }
        });
    }, mainObserverOptions);

    mainSections.forEach(section => {
        mainObserver.observe(section);
    });

    // --- Lógica existente de la barra lateral legal (si aplica) ---
    const mobileMenuToggle = document.querySelector('.legal-framework-section .mobile-top-bar .mobile-menu-toggle');
    const sidebarNav = document.querySelector('.legal-framework-section .sidebar-nav');

    if (mobileMenuToggle && sidebarNav) {
        mobileMenuToggle.addEventListener('click', () => {
            sidebarNav.classList.toggle('show-mobile');
        });
    }

    const legalNavLinks = document.querySelectorAll('.legal-framework-section .sidebar-nav ul li a');
    const legalSections = document.querySelectorAll('.main-content-area h2[id], .main-content-area h3[id]');

    if (legalNavLinks.length > 0 && legalSections.length > 0) {
        const legalObserverOptions = {
            root: null,
            rootMargin: '0px 0px -50% 0px',
            threshold: 0
        };

        const legalObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const currentId = entry.target.id;
                    legalNavLinks.forEach(link => {
                        link.classList.remove('active');
                        if (link.getAttribute('href') === `#${currentId}`) {
                            link.classList.add('active');
                        }
                    });
                }
            });
        }, legalObserverOptions);

        legalSections.forEach(section => {
            legalObserver.observe(section);
        });
    }

    // --- Lógica del carrusel de inversión ---
    const cardRow = document.querySelector('.invest-section .card-row');
    if (!cardRow) {
        console.warn("Elemento .invest-section .card-row no encontrado. El carrusel no se inicializará.");
        return;
    }

    const slides = cardRow.querySelectorAll('.invest-section .card');
    const prevArrow = document.querySelector('.invest-section .invest-prev-arrow');
    const nextArrow = document.querySelector('.invest-section .invest-next-arrow');
    const dotsContainer = document.querySelector('.invest-section .invest-carousel-dots-container');
    const dots = [];

    let currentIndex = 0; // Índice de la tarjeta actual

    // Generar puntos de navegación dinámicamente
    if (dotsContainer) {
        // Limpiar puntos existentes antes de crearlos (útil en redimensionamientos)
        dotsContainer.innerHTML = '';
        dots.length = 0; // Vaciar el array de puntos

        slides.forEach((_, index) => {
            const dot = document.createElement('span');
            dot.classList.add('invest-dot');
            dot.dataset.slideIndex = index;
            dotsContainer.appendChild(dot);
            dots.push(dot);

            dot.addEventListener('click', () => {
                goToSlide(index);
            });
        });
    }

    // Función para actualizar la UI del carrusel (puntos activos, posición del scroll)
    function updateCarouselUI() {
        // Asegurarse de que haya slides antes de intentar calcular el ancho
        if (slides.length === 0) return;

        // slideWidth debe ser el ancho de una tarjeta tal como se renderiza en el carrusel
        // En móvil, con CSS, esto es el 100% del cardRow
        // Asegúrate de que .card-row tenga un ancho definido y que .card tenga min-width: 100%
        const slideWidth = slides[0].offsetWidth;

        // Desplaza el contenedor a la posición de la tarjeta actual
        // scrollLeft es la propiedad para desplazamiento horizontal.
        // Aquí usamos 'smooth' para que el scroll sea animado.
        cardRow.scrollTo({
            left: currentIndex * slideWidth,
            behavior: 'smooth'
        });

        // Actualiza la clase 'active' en los puntos de navegación
        dots.forEach((dot, index) => {
            if (index === currentIndex) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });

        // Opcional: Deshabilitar flechas en los extremos
        if (prevArrow) {
            prevArrow.style.opacity = currentIndex === 0 ? '0.5' : '1';
            prevArrow.style.pointerEvents = currentIndex === 0 ? 'none' : 'auto';
        }
        if (nextArrow) {
            nextArrow.style.opacity = currentIndex === slides.length - 1 ? '0.5' : '1';
            nextArrow.style.pointerEvents = currentIndex === slides.length - 1 ? 'none' : 'auto';
        }
    }

    // Función para ir a un slide específico
    function goToSlide(index) {
        if (index < 0) {
            // Ir al último slide si se va antes del primero (carrusel infinito)
            currentIndex = slides.length - 1;
        } else if (index >= slides.length) {
            // Ir al primer slide si se va después del último (carrusel infinito)
            currentIndex = 0;
        } else {
            currentIndex = index; // Establecer el índice directamente
        }
        updateCarouselUI(); // Actualizar la UI del carrusel
    }

    // Navegación con flechas
    if (prevArrow) {
        prevArrow.addEventListener('click', () => {
            goToSlide(currentIndex - 1);
        });
    }

    if (nextArrow) {
        nextArrow.addEventListener('click', () => {
            goToSlide(currentIndex + 1);
        });
    }

    // Actualizar el carrusel cuando el usuario desplaza manualmente (con el dedo)
    // Usamos un pequeño 'debounce' para no actualizar demasiado seguido
    let scrollTimeout;
    cardRow.addEventListener('scroll', () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            // Solo actualizamos si estamos en modo móvil (o con el carrusel activo)
            const isMobileView = window.matchMedia("(max-width: 768px)").matches;
            if (isMobileView && slides.length > 0) {
                const scrollLeft = cardRow.scrollLeft;
                const slideWidth = slides[0].offsetWidth;
                // Calcula el índice actual redondeando al slide más cercano
                currentIndex = Math.round(scrollLeft / slideWidth);
                updateCarouselUI(); // Actualiza los puntos
            }
        }, 100); // Pequeño retraso para evitar cálculos excesivos durante el scroll
    });

    // Media query para determinar si el carrusel debe estar activo
    const carouselMedia = window.matchMedia("(max-width: 768px)");

    // Función para manejar cambios en la media query del carrusel
    function handleCarouselMediaQuery(e) {
        if (e.matches) { // Si estamos en móvil (carrusel activo)
            console.log("Modo móvil detectado para carrusel.");
            currentIndex = 0; // Resetear a la primera tarjeta al entrar en modo móvil
            updateCarouselUI(); // Asegurarse de que el carrusel esté en el estado correcto al cargar o redimensionar
            // La visibilidad de flechas y puntos se maneja por CSS.
        } else { // Si estamos en escritorio (carrusel inactivo)
            console.log("Modo escritorio detectado para carrusel.");
            cardRow.scrollLeft = 0; // Resetear el scroll para que las 3 columnas se vean bien
            currentIndex = 0; // Resetear el índice
            updateCarouselUI(); // Asegurarse de que los puntos estén reseteados/desactivados
            // La visibilidad de flechas y puntos se maneja por CSS.
        }
    }

    // Listener para cambios en la media query del carrusel
    carouselMedia.addEventListener('change', handleCarouselMediaQuery);

    // Inicializar el carrusel al cargar la página
    handleCarouselMediaQuery(carouselMedia); // Llama a la función una vez al inicio
});