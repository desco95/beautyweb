/* =========================================================
   BEAUTYWEB - APP.JS SIMPLIFICADO Y FUNCIONAL
========================================================= */

localStorage.removeItem("currentUser");

let currentUser = null;
let users = JSON.parse(localStorage.getItem("users")) || [];
let appointments = JSON.parse(localStorage.getItem("appointments")) || [];

/* ============================================
   ELEMENTOS DEL DOM
============================================ */
const avatar = document.getElementById("avatar");
const userLabel = document.getElementById("user-label");
const userDisplay = document.getElementById("user-display");

const loginBtn = document.createElement("button");
loginBtn.textContent = "Iniciar sesión";
loginBtn.className = "nav-btn";

const registerBtn = document.createElement("button");
registerBtn.textContent = "Registrarse";
registerBtn.className = "nav-btn";

const logoutBtn = document.createElement("button");
logoutBtn.textContent = "Cerrar sesión";
logoutBtn.className = "nav-btn";
logoutBtn.style.display = "none";

userDisplay.innerHTML = "";
userDisplay.appendChild(avatar);
userDisplay.appendChild(userLabel);
userDisplay.appendChild(loginBtn);
userDisplay.appendChild(registerBtn);
userDisplay.appendChild(logoutBtn);

/* ============================================
   VALIDACIONES
============================================ */
function validarTelefono(telefono) {
    return /^\d{10}$/.test(telefono);
}

function validarNombre(nombre) {
    return /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]{1,25}$/.test(nombre);
}

function validarContrasena(contrasena) {
    return contrasena.length >= 6;
}

/* ============================================
   ACTUALIZAR INTERFAZ DE USUARIO
============================================ */
function updateUserUI() {
    if (currentUser) {
        userLabel.textContent = currentUser.name;
        avatar.src = "imagenes/avatar.png";
        loginBtn.style.display = "none";
        registerBtn.style.display = "none";
        logoutBtn.style.display = "inline-block";
    } else {
        userLabel.textContent = "";
        avatar.src = "imagenes/avatar.png";
        loginBtn.style.display = "inline-block";
        registerBtn.style.display = "inline-block";
        logoutBtn.style.display = "none";
    }
}

/* ============================================
   MODALES
============================================ */
const loginModal = document.getElementById("login-modal");
const registerModal = document.getElementById("register-modal");

const loginEmail = document.getElementById("login-email");
const loginPass = document.getElementById("login-pass");

const registerName = document.getElementById("register-name");
const registerEmail = document.getElementById("register-email");
const registerPass = document.getElementById("register-pass");

const loginSubmit = document.getElementById("login-submit");
const registerSubmit = document.getElementById("register-submit");

loginBtn.addEventListener("click", () => {
    loginModal.classList.add("show");
});

registerBtn.addEventListener("click", () => {
    registerModal.classList.add("show");
});

document.addEventListener("click", (e) => {
    if (e.target === loginModal) loginModal.classList.remove("show");
    if (e.target === registerModal) registerModal.classList.remove("show");
});

/* ============================================
   LOGIN CON VALIDACIONES
============================================ */
loginSubmit.addEventListener("click", () => {
    const telefono = loginEmail.value.trim();
    const contrasena = loginPass.value.trim();

    if (!telefono || !contrasena) {
        alert("❌ Completa todos los campos");
        return;
    }

    if (!validarTelefono(telefono)) {
        alert("❌ El teléfono debe tener exactamente 10 dígitos");
        loginEmail.focus();
        return;
    }

    fetch(`${window.API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telefono, contrasena })
    })
    .then(res => res.json())
    .then(data => {
        if (data.error) {
            alert("❌ " + data.error);
            return;
        }

        currentUser = {
            id: data.id,
            name: data.nombre,
            phone: data.telefono
        };

        updateUserUI();
        loginModal.classList.remove("show");
        cargarCitas();
        toggleAdminNavbar(telefono);

        loginEmail.value = "";
        loginPass.value = "";

        alert("✅ Sesión iniciada correctamente");
    })
    .catch(() => alert("❌ Error de conexión con el servidor"));
});

/* ============================================
   REGISTRO CON VALIDACIONES
============================================ */
registerSubmit.addEventListener("click", () => {
    const nombre = registerName.value.trim();
    const telefono = registerEmail.value.trim();
    const contrasena = registerPass.value.trim();

    if (!nombre || !telefono || !contrasena) {
        alert("❌ Completa todos los campos");
        return;
    }

    if (!validarNombre(nombre)) {
        alert("❌ El nombre solo debe contener letras y espacios (máximo 20 caracteres)");
        registerName.focus();
        return;
    }

    if (!validarTelefono(telefono)) {
        alert("❌ El teléfono debe tener exactamente 10 dígitos numéricos");
        registerEmail.focus();
        return;
    }

    if (!validarContrasena(contrasena)) {
        alert("❌ La contraseña debe tener al menos 6 caracteres");
        registerPass.focus();
        return;
    }

    fetch(`${window.API_URL}/registro`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, telefono, contrasena })
    })
    .then(res => res.json())
    .then(data => {
        if (data.error) {
            alert("❌ " + data.error);
            return;
        }

        alert("✅ Registro exitoso. Ahora puedes iniciar sesión.");

        registerModal.classList.remove("show");
        loginModal.classList.add("show");

        registerName.value = "";
        registerEmail.value = "";
        registerPass.value = "";
    })
    .catch(() => alert("❌ Error de conexión con el servidor"));
});

logoutBtn.addEventListener("click", () => {
    currentUser = null;
    updateUserUI();
    document.getElementById("admin-btn").style.display = "none";
    alert("✅ Sesión cerrada");
});

/* ============================================
   FUNCIONES DE VISTAS
============================================ */
function showView(id) {
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    document.getElementById(id).classList.add("active");

    const map = { inicio: 0, book: 1, appointments: 2, history: 3, admin: 4 };
    const buttons = document.querySelectorAll(".nav-content button");
    buttons.forEach(b => b.classList.remove("active"));
    if (map[id] !== undefined) buttons[map[id]].classList.add("active");

    if (id === "appointments") cargarCitas();
}

/* ============================================
   🔥 CARGAR SERVICIOS Y ESTILISTAS (SIMPLIFICADO)
============================================ */
async function cargarServicios() {
    try {
        const res = await fetch(`${window.API_URL}/servicios`);
        const servicios = await res.json();

        const servicioSelect = document.getElementById("servicio1");
        servicioSelect.innerHTML = "<option value=''>Selecciona un servicio...</option>";
        servicios.forEach(s => {
            servicioSelect.innerHTML += `<option value="${s.nombre}">${s.nombre}</option>`;
        });
    } catch (error) {
        console.error("Error cargando servicios:", error);
    }
}

async function cargarEstilistas() {
    try {
        const res = await fetch(`${window.API_URL}/admin/staff`);
        const estilistas = await res.json();

        const estilistaSelect = document.getElementById("estilista");
        estilistaSelect.innerHTML = "<option value=''>Selecciona un estilista...</option>";
        estilistas.forEach(e => {
            estilistaSelect.innerHTML += `<option value="${e.id_estilista}">${e.nombre}</option>`;
        });
    } catch (error) {
        console.error("Error cargando estilistas:", error);
    }
}

/* ============================================
   🔥 CARGAR HORARIOS CUANDO CAMBIEN ESTILISTA O FECHA
============================================ */
async function cargarHorariosDisponibles() {
    const estilistaSelect = document.getElementById("estilista");
    const fechaInput = document.getElementById("book-date");
    const horaSelect = document.getElementById("book-time");

    const estilista = estilistaSelect.value;
    const fecha = fechaInput.value;

    console.log("🔍 Cargando horarios para:", { estilista, fecha });

    // Resetear el select
    horaSelect.innerHTML = '<option value="">Selecciona un horario</option>';
    
    if (!estilista || !fecha) {
        horaSelect.innerHTML = '<option value="">Primero selecciona estilista y fecha</option>';
        return;
    }

    try {
        // Verificar si el día está bloqueado
        const resBloqueados = await fetch(`${window.API_URL}/horarios_bloqueados/${estilista}/${fecha}`);
        const bloqueados = await resBloqueados.json();

        console.log("🚫 Días bloqueados:", bloqueados);

        if (Array.isArray(bloqueados) && bloqueados.length > 0) {
            horaSelect.innerHTML = '<option value="">Este día no está disponible</option>';
            alert("⚠️ Este día no está disponible para este estilista");
            return;
        }

        // Obtener horarios ocupados
        const resOcupados = await fetch(`${window.API_URL}/horarios_ocupados/${estilista}/${fecha}`);
        const ocupados = await resOcupados.json();

        console.log("📋 Horarios ocupados:", ocupados);

        const todosHorarios = [
            "09:00", "10:00", "11:00", "12:00", 
            "13:00", "14:00", "15:00", "16:00", 
            "17:00", "18:00"
        ];

        let disponibles = 0;

        todosHorarios.forEach(hora24 => {
            const hora12 = convertirA12Horas(hora24);
            const estaOcupado = ocupados.some(h => h.startsWith(hora24));
            
            const option = document.createElement("option");
            option.value = hora24;
            option.textContent = hora12 + (estaOcupado ? " (Ocupado)" : "");
            option.disabled = estaOcupado;
            
            if (!estaOcupado) disponibles++;
            
            horaSelect.appendChild(option);
        });

        console.log(`✅ ${disponibles} horarios disponibles de ${todosHorarios.length}`);

        if (disponibles === 0) {
            horaSelect.innerHTML = '<option value="">No hay horarios disponibles este día</option>';
        }

    } catch (error) {
        console.error("❌ Error cargando horarios:", error);
        horaSelect.innerHTML = '<option value="">Error al cargar horarios</option>';
        alert("Error al cargar horarios disponibles. Intenta de nuevo.");
    }
}

function convertirA12Horas(hora24) {
    const [horas, minutos] = hora24.split(':');
    let h = parseInt(horas);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${String(h).padStart(2, '0')}:${minutos} ${ampm}`;
}

/* ============================================
   AGENDAR CITA
============================================ */
async function bookAppointment(event) {
    event.preventDefault();

    if (!currentUser) {
        alert("❌ Debes iniciar sesión para agendar");
        return;
    }

    const nombre = document.getElementById("book-name").value.trim();
    const telefono = document.getElementById("book-phone").value.trim();
    const servicio = document.getElementById("servicio1").value;
    const estilista = document.getElementById("estilista").value;
    const fecha = document.getElementById("book-date").value;
    const hora = document.getElementById("book-time").value;

    // Validaciones
    if (!servicio) {
        alert("❌ Selecciona un servicio");
        return;
    }

    if (!estilista) {
        alert("❌ Selecciona un estilista");
        return;
    }

    if (!fecha) {
        alert("❌ Selecciona una fecha");
        return;
    }

    if (!hora) {
        alert("❌ Selecciona un horario");
        return;
    }

    if (!validarNombre(nombre)) {
        alert("❌ El nombre solo debe contener letras y espacios");
        return;
    }

    if (!validarTelefono(telefono)) {
        alert("❌ El teléfono debe tener exactamente 10 dígitos");
        return;
    }

    const cita = {
        usuario_id: currentUser.id,
        servicio: servicio,
        estilista: parseInt(estilista),
        fecha: fecha,
        hora: hora,
        notas: document.getElementById("book-notes").value
    };

    console.log("🚀 Enviando cita:", cita);

    try {
        const res = await fetch(`${window.API_URL}/agendar`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(cita)
        });

        const data = await res.json();

        if (data.error) {
            alert("❌ " + data.error);
            return;
        }

        alert("✅ Cita agendada correctamente. Espera confirmación del salón.");
        
        document.getElementById("book-form").reset();
        showView("appointments");
        cargarCitas();
    } catch (error) {
        console.error("❌ Error al agendar:", error);
        alert("❌ Error de conexión con el servidor");
    }
}

/* ============================================
   RENDERIZAR CITAS
============================================ */
function renderAppointments(telefono, appointments) {
    const container = document.getElementById("appointments-list");
    container.innerHTML = "";

    if (!Array.isArray(appointments) || appointments.length === 0) {
        container.innerHTML = "<p>No tienes citas agendadas.</p>";
        return;
    }

    appointments.forEach(cita => {
        const card = document.createElement("div");
        card.classList.add("appointment-card");

        let motivoHtml = "";
        if (cita.estado === "Cancelada" && cita.motivo_rechazo) {
            motivoHtml = `<p><strong>Motivo de cancelación:</strong> ${cita.motivo_rechazo}</p>`;
        }

        card.innerHTML = `
            <h3>${cita.servicio}</h3>
            <p><strong>Estilista:</strong> ${cita.estilista}</p>
            <p><strong>Fecha:</strong> ${cita.fecha}</p>
            <p><strong>Hora:</strong> ${cita.hora}</p>
            <p><strong>Estado:</strong> ${cita.estado}</p>
            ${motivoHtml}
        `;

        container.appendChild(card);
    });
}

async function cargarCitas() {
    if (!currentUser || !currentUser.phone) {
        console.warn("No hay usuario logeado");
        return;
    }
    
    const telefono = currentUser.phone;
    
    try {
        const resp = await fetch(`${window.API_URL}/citas_usuario/${telefono}`);
        const data = await resp.json();
        
        if (!Array.isArray(data)) {
            console.error("Error cargando citas:", data);
            return;
        }
        
        renderAppointments(telefono, data);
    } catch (err) {
        console.error("Error cargando citas:", err);
    }
}

/* ============================================
   ESTABLECER FECHA MÍNIMA
============================================ */
function establecerFechaMinima() {
    const inputFecha = document.getElementById("book-date");
    if (inputFecha) {
        const hoy = new Date();
        const manana = new Date(hoy);
        manana.setDate(manana.getDate() + 1);
        
        const yyyy = manana.getFullYear();
        const mm = String(manana.getMonth() + 1).padStart(2, '0');
        const dd = String(manana.getDate()).padStart(2, '0');
        
        inputFecha.min = `${yyyy}-${mm}-${dd}`;
    }
}

/* ============================================
   ADMIN
============================================ */
function verifyAdmin() {
    const pass = document.getElementById("admin-pass").value;
    const realPass = "12345";

    if (pass === realPass) {
        document.body.style.opacity = "0";
        setTimeout(() => {
            window.location.href = "admin.html";
        }, 300);
    } else {
        document.getElementById("admin-error").style.display = "block";
    }
}

/* ============================
   CARRUSEL DE FOTOS
============================= */
let slideIndex = 0;

function initCarousel() {
    const carousel = document.querySelector(".carousel");
    const slides = document.querySelectorAll(".carousel img");

    if (!carousel || slides.length === 0) return;

    slides.forEach(img => {
        img.style.flex = "0 0 100%";
    });

    function showSlide(index) {
        if (index >= slides.length) slideIndex = 0;
        else if (index < 0) slideIndex = slides.length - 1;
        else slideIndex = index;

        carousel.style.transform = `translateX(-${slideIndex * 100}%)`;
    }

    window.moveSlide = function (direction) {
        showSlide(slideIndex + direction);
        resetAutoSlide();
    };

    let autoSlide = setInterval(() => moveSlide(1), 6000);

    function resetAutoSlide() {
        clearInterval(autoSlide);
        autoSlide = setInterval(() => moveSlide(1), 6000);
    }

    showSlide(slideIndex);
}

/* ============================
   VER MÁS / VER MENOS SERVICIOS
============================ */
const btn = document.getElementById("toggle-services-btn");
const box = document.getElementById("servicios-container");

btn.addEventListener("click", () => {
    box.classList.toggle("expanded");

    if (box.classList.contains("expanded")) {
        btn.textContent = "Ver menos";
    } else {
        btn.textContent = "Ver más";
    }
});

// Shapes
function createShapes() {
    const container = document.querySelector(".floating-shapes");
    if (!container) return;

    container.innerHTML = "";

    const totalShapes = 70;

    for (let i = 0; i < totalShapes; i++) {
        const shape = document.createElement("div");
        shape.classList.add("shape");

        shape.style.left = Math.random() * 100 + "vw";
        shape.style.top = Math.random() * 200 + "vh";

        const size = 50 + Math.random() * 80;
        shape.style.width = size + "px";
        shape.style.height = size + "px";

        const duration = 20 + Math.random() * 20;
        shape.style.animationDuration = duration + "s";

        container.appendChild(shape);
    }
}

const ADMIN_PHONE = "4775556666";

function toggleAdminNavbar(phone) {
    const adminBtn = document.getElementById("admin-btn");

    if (phone === ADMIN_PHONE) {
        adminBtn.style.display = "inline-flex";
    } else {
        adminBtn.style.display = "none";
    }
}

/* ============================================
   🔥 INICIALIZACIÓN AL CARGAR LA PÁGINA
============================================ */
document.addEventListener("DOMContentLoaded", () => {
    console.log("🚀 Iniciando BeautyWeb...");
    
    // Configurar fecha mínima
    establecerFechaMinima();
    
    // Cargar servicios y estilistas
    cargarServicios();
    cargarEstilistas();
    
    // Validaciones en tiempo real
    const loginEmailInput = document.getElementById("login-email");
    if (loginEmailInput) {
        loginEmailInput.addEventListener("input", function() {
            this.value = this.value.replace(/\D/g, '').slice(0, 10);
        });
    }

    const registerEmailInput = document.getElementById("register-email");
    if (registerEmailInput) {
        registerEmailInput.addEventListener("input", function() {
            this.value = this.value.replace(/\D/g, '').slice(0, 10);
        });
    }

    const registerNameInput = document.getElementById("register-name");
    if (registerNameInput) {
        registerNameInput.addEventListener("input", function() {
            this.value = this.value.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñ\s]/g, "").slice(0, 25);
        });
    }

    const bookNameInput = document.getElementById("book-name");
    if (bookNameInput) {
        bookNameInput.addEventListener("input", function() {
            this.value = this.value.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñ\s]/g, "").slice(0, 25);
        });
    }

    const bookPhoneInput = document.getElementById("book-phone");
    if (bookPhoneInput) {
        bookPhoneInput.addEventListener("input", function() {
            this.value = this.value.replace(/\D/g, '').slice(0, 10);
        });
    }

    // 🔥 LISTENERS PARA CARGAR HORARIOS
    const estilistaSelect = document.getElementById("estilista");
    const fechaInput = document.getElementById("book-date");

    if (estilistaSelect) {
        estilistaSelect.addEventListener("change", cargarHorariosDisponibles);
    }

    if (fechaInput) {
        fechaInput.addEventListener("change", cargarHorariosDisponibles);
    }

    // Inicializar carrusel y shapes
    initCarousel();
    createShapes();
    
    // Actualizar UI del usuario
    updateUserUI();
    
    console.log("✅ BeautyWeb iniciado correctamente");
});
