/* =========================================================
   BEAUTYWEB - APP.JS MEJORADO
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
   CARGAR SERVICIOS Y ESTILISTAS
============================================ */
const servicioSelect = document.getElementById("servicio1");
const estilistaSelect = document.getElementById("estilista");

async function cargarServicios() {
    const res = await fetch(`${window.API_URL}/servicios`);
    const servicios = await res.json();

    servicioSelect.innerHTML = "<option value=''>Selecciona un servicio...</option>";
    servicios.forEach(s => {
        servicioSelect.innerHTML += `<option value="${s.nombre}">${s.nombre}</option>`;
    });
}

// Cargar estilistas según servicio seleccionado
servicioSelect.addEventListener("change", async () => {
    const servicioElegido = servicioSelect.value.trim();

    estilistaSelect.innerHTML = "<option value=''>Selecciona...</option>";

    if (!servicioElegido) return;

    try {
        const res = await fetch(`${window.API_URL}/estilistas/por-servicio/${encodeURIComponent(servicioElegido)}`);
        const estilistas = await res.json();

        if (estilistas.length === 0) {
            estilistaSelect.innerHTML = "<option value=''>No hay estilistas disponibles</option>";
            return;
        }

        estilistas.forEach(e => {
            estilistaSelect.innerHTML += `<option value="${e.id}">${e.nombre}</option>`;
        });
    } catch (error) {
        console.error("Error cargando estilistas:", error);
    }
});

/* ============================================
   AGENDAR CITA CON VALIDACIONES
============================================ */
async function bookAppointment(event) {
    event.preventDefault();

    if (!currentUser) {
        alert("❌ Debes iniciar sesión para agendar");
        return;
    }

    const fecha = document.getElementById("book-date").value;
    const hora = document.getElementById("book-time").value;
    const estilista = document.getElementById("estilista").value;

    const fechaSeleccionada = new Date(fecha);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    if (fechaSeleccionada < hoy) {
        alert("❌ No puedes agendar citas en fechas pasadas");
        return;
    }

    const cita = {
        usuario_id: currentUser.id,
        servicio: document.getElementById("servicio1").value,
        estilista: estilista,
        fecha: fecha,
        hora: hora,
        notas: document.getElementById("book-notes").value,
    };

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
    showView("appointments");
    cargarCitas();
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

/* ============================================
   BLOQUEAR FECHAS Y CARGAR HORARIOS
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

async function cargarHorariosDisponibles() {
    const estilista = document.getElementById("estilista").value;
    const fecha = document.getElementById("book-date").value;
    const selectHora = document.getElementById("book-time");
    const inputFecha = document.getElementById("book-date");
    const mensajeBloqueado = document.getElementById("mensaje-bloqueado");

    if (!estilista || !fecha) {
        return;
    }

    try {
        // Obtener horarios bloqueados
        const resBloqueados = await fetch(`${window.API_URL}/horarios_bloqueados/${estilista}/${fecha}`);
        const bloqueados = await resBloqueados.json();

        // Verificar si el día está completamente bloqueado
        if (bloqueados.length > 0) {
            selectHora.innerHTML = '<option value="">Este día no está disponible</option>';
            selectHora.disabled = true;
            
            // Mostrar visualmente que está bloqueado
            inputFecha.classList.add("fecha-bloqueada");
            if (mensajeBloqueado) {
                mensajeBloqueado.classList.add("show");
            }
            
            return;
        } else {
            // Quitar indicadores de bloqueo
            inputFecha.classList.remove("fecha-bloqueada");
            if (mensajeBloqueado) {
                mensajeBloqueado.classList.remove("show");
            }
        }

        // Obtener horarios ocupados
        const resOcupados = await fetch(`${window.API_URL}/horarios_ocupados/${estilista}/${fecha}`);
        const ocupados = await resOcupados.json();

        const todosHorarios = [
            "09:00", "10:00", "11:00", "12:00", 
            "13:00", "14:00", "15:00", "16:00", 
            "17:00", "18:00"
        ];

        selectHora.innerHTML = '<option value="">Selecciona un horario</option>';
        selectHora.disabled = false;

        todosHorarios.forEach(hora => {
            const horaFormato12 = convertirA12Horas(hora);
            const estaOcupado = ocupados.includes(hora);
            
            const option = document.createElement("option");
            option.value = horaFormato12;
            option.textContent = horaFormato12 + (estaOcupado ? " (Ocupado)" : "");
            option.disabled = estaOcupado;
            
            selectHora.appendChild(option);
        });

    } catch (error) {
        console.error("Error cargando horarios:", error);
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
   EVENT LISTENERS
============================================ */
document.addEventListener("DOMContentLoaded", () => {
    establecerFechaMinima();

    // 🔹 Eventos para cargar horarios
    const estilistaSelectElem = document.getElementById("estilista");
    const fechaInput = document.getElementById("book-date");

    if (estilistaSelectElem) {
        estilistaSelectElem.addEventListener("change", cargarHorariosDisponibles);
    }

    if (fechaInput) {
        fechaInput.addEventListener("change", cargarHorariosDisponibles);
    }

    // 🔹 VALIDACIONES EN TIEMPO REAL (AGENDAR)
    const bookName = document.getElementById("book-name");
    if (bookName) {
        bookName.addEventListener("input", function () {
            this.value = this.value
                .replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñ\s]/g, "")
                .slice(0, 25);
        });
    }

    const bookPhone = document.getElementById("book-phone");
    if (bookPhone) {
        bookPhone.addEventListener("input", function () {
            this.value = this.value.replace(/\D/g, '').slice(0, 10);
        });
    }
});

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

document.addEventListener("DOMContentLoaded", initCarousel);

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

createShapes();

cargarServicios();

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

// Validación de formulario de agendar
document.getElementById("book-form").addEventListener("submit", function (e) {
    const telefono = document.getElementById("book-phone")?.value.trim() || "";
    const nombre = document.getElementById("book-name")?.value.trim() || "";

    if (nombre && !validarNombre(nombre)) {
        e.preventDefault();
        alert("❌ El nombre solo puede contener letras y máximo 20 caracteres.");
        return;
    }

    if (telefono && !validarTelefono(telefono)) {
        e.preventDefault();
        alert("❌ El teléfono debe contener EXACTAMENTE 10 números.");
        return;
    }
});

// Solo números en teléfono
document.getElementById("login-email").addEventListener("input", function() {
    this.value = this.value.replace(/\D/g, '').slice(0, 10);
});

document.getElementById("register-email").addEventListener("input", function() {
    this.value = this.value.replace(/\D/g, '').slice(0, 10);
});

// Solo letras en nombre
document.getElementById("register-name").addEventListener("input", function () {
    this.value = this.value
        .replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñ\s]/g, "")
        .slice(0, 20);
});

const vistaBook = document.getElementById("book");

const observer = new MutationObserver(() => {
    const visible = vistaBook.classList.contains("active") ||
                    vistaBook.style.display === "block";

    if (!visible) {
        limpiarVistaAgendar();
    }
});

observer.observe(vistaBook, {
    attributes: true,
    attributeFilter: ["class", "style"]
});

function limpiarVistaAgendar() {
    const vista = document.getElementById("book");
    if (!vista) return;

    vista.querySelectorAll(
        "input[type='text'], input[type='tel'], input[type='date'], input[type='time'], textarea"
    ).forEach(campo => campo.value = "");

    vista.querySelectorAll("select").forEach(select => {
        select.selectedIndex = 0;
    });

    vista.querySelectorAll("input[type='radio'], input[type='checkbox']")
        .forEach(c => c.checked = false);

    vista.querySelectorAll(".active, .selected, .error, .success")
        .forEach(el => el.classList.remove("active", "selected", "error", "success"));
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

window.onload = () => {
    updateUserUI();
};
