/* =========================================================
   BEAUTYWEB - APP.JS COMPLETO FUNCIONAL SIN MODALES
========================================================= */
/* ============================================
   LOCALSTORAGE Y VARIABLES GLOBALES
============================================ */
localStorage.removeItem("currentUser"); // Borra sesión al cargar la página

let currentUser = null;
let users = JSON.parse(localStorage.getItem("users")) || [];
let appointments = JSON.parse(localStorage.getItem("appointments")) || [];

/* ============================================
   ELEMENTOS DEL DOM
============================================ */
const avatar = document.getElementById("avatar");
const userLabel = document.getElementById("user-label");
const userDisplay = document.getElementById("user-display");

// Creamos botones de login y registro dinámicamente
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

// Agregamos botones al contenedor de usuario
userDisplay.innerHTML = "";
userDisplay.appendChild(avatar);
userDisplay.appendChild(userLabel);
userDisplay.appendChild(loginBtn);
userDisplay.appendChild(registerBtn);
userDisplay.appendChild(logoutBtn);

/* ============================================
   ACTUALIZAR INTERFAZ DE USUARIO
============================================ */
function updateUserUI() {
    if (currentUser) {
        userLabel.textContent = currentUser.name;
        avatar.src = "imagenes/avatar.png"; // imagen por defecto
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
   FUNCIONALIDAD LOGIN / REGISTRO CON MODALES
============================================ */

// referenciar modales
const loginModal = document.getElementById("login-modal");
const registerModal = document.getElementById("register-modal");

// inputs login
const loginEmail = document.getElementById("login-email");
const loginPass = document.getElementById("login-pass");

// inputs registro
const registerName = document.getElementById("register-name");
const registerEmail = document.getElementById("register-email");
const registerPass = document.getElementById("register-pass");

// botones submit
const loginSubmit = document.getElementById("login-submit");
const registerSubmit = document.getElementById("register-submit");

// abrir modales
loginBtn.addEventListener("click", () => {
    loginModal.classList.add("show");
});

registerBtn.addEventListener("click", () => {
    registerModal.classList.add("show");
});

// cerrar modal haciendo clic afuera
document.addEventListener("click", (e) => {
    if (e.target === loginModal) loginModal.classList.remove("show");
    if (e.target === registerModal) registerModal.classList.remove("show");
});

// LOGIN
loginSubmit.addEventListener("click", () => {
    const telefono = loginEmail.value.trim();
    const contrasena = loginPass.value.trim();

    if (!telefono || !contrasena) {
        alert("Completa todos los campos");
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
                alert(data.error);
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


            loginEmail.value = "";
            loginPass.value = "";
        })
        .catch(err => alert("Error de conexión con el servidor"));
});


// REGISTRO
registerSubmit.addEventListener("click", () => {
    const nombre = registerName.value.trim();
    const telefono = registerEmail.value.trim();
    const contrasena = registerPass.value.trim();

    if (!nombre || !telefono || !contrasena) {
        alert("Completa todos los campos");
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
                alert(data.error);
                return;
            }

            alert("Registro exitoso");

            currentUser = {
                name: nombre,
                phone: telefono
            };

            updateUserUI();
            registerModal.classList.remove("show");

            registerName.value = "";
            registerEmail.value = "";
            registerPass.value = "";
        })
        .catch(err => alert("Error de conexión con el servidor"));
});


logoutBtn.addEventListener("click", () => {
    currentUser = null;
    updateUserUI();
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

async function bookAppointment(event) {
    event.preventDefault();

    if (!currentUser) {
        alert("Debes iniciar sesión para agendar");
        return;
    }

    const fecha = document.getElementById("book-date").value;
    const hora = document.getElementById("book-time").value;
    const estilista = document.getElementById("estilista").value;

    // Validar que la fecha no sea pasada
    const fechaSeleccionada = new Date(fecha);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    if (fechaSeleccionada < hoy) {
        alert("No puedes agendar citas en fechas pasadas");
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
        alert(data.error);
        return;
    }

    alert("Cita agendada correctamente. Espera confirmación del salón.");
    showView("appointments");
    cargarCitas();
}


function renderAppointments(telefono, appointments) {
    console.log("Render appointments recibió:", appointments);

    if (!Array.isArray(appointments)) {
        console.error("ERROR: appointments no es un array", appointments);
        return;
    }

    const container = document.getElementById("appointments-list");
    container.innerHTML = "";

    if (appointments.length === 0) {
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

// Función para bloquear fechas pasadas
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

// Función para cargar horarios disponibles
async function cargarHorariosDisponibles() {
    const estilista = document.getElementById("estilista").value;
    const fecha = document.getElementById("book-date").value;
    const selectHora = document.getElementById("book-time");

    if (!estilista || !fecha) {
        return;
    }

    try {
        // Obtener horarios bloqueados
        const resBloqueados = await fetch(`${window.API_URL}/horarios_bloqueados/${estilista}/${fecha}`);
        const bloqueados = await resBloqueados.json();

        // Obtener horarios ocupados
        const resOcupados = await fetch(`${window.API_URL}/horarios_ocupados/${estilista}/${fecha}`);
        const ocupados = await resOcupados.json();

        // Verificar si el día está completamente bloqueado
        if (bloqueados.length > 0) {
            selectHora.innerHTML = '<option value="">Este día no está disponible</option>';
            selectHora.disabled = true;
            return;
        }

        // Horarios disponibles
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

// Función auxiliar para convertir formato de hora
function convertirA12Horas(hora24) {
    const [horas, minutos] = hora24.split(':');
    let h = parseInt(horas);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${String(h).padStart(2, '0')}:${minutos} ${ampm}`;
}

// Agregar event listeners
document.addEventListener("DOMContentLoaded", () => {
    establecerFechaMinima();
    
    const estilistaSelect = document.getElementById("estilista");
    const fechaInput = document.getElementById("book-date");
    
    if (estilistaSelect) {
        estilistaSelect.addEventListener("change", cargarHorariosDisponibles);
    }
    
    if (fechaInput) {
        fechaInput.addEventListener("change", cargarHorariosDisponibles);
    }
});

/* ============================================
   INICIALIZAR
============================================ */
window.onload = () => {
    updateUserUI();
};


/* ============================================================
   ADMIN
============================================================ */

// acceso directo a admin.html
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

function updateAdminStats() {
    const today = new Date().toISOString().split("T")[0];

    const todayAppointments = appointments.filter(a => a.date === today);
    const pending = appointments.filter(a => a.status === "Pendiente");
    const monthAppointments = appointments.filter(a => a.date.startsWith(today.slice(0, 7)));

    document.getElementById("stat-today").textContent = todayAppointments.length;
    document.getElementById("stat-pending").textContent = pending.length;
    document.getElementById("stat-month").textContent = monthAppointments.length;
    document.getElementById("stat-sat").textContent = "95%";
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

async function cargarServicios() {
    const res = await fetch(`${window.API_URL}/servicios`);
    const servicios = await res.json();

    const select = document.getElementById("servicio1");
    select.innerHTML = "<option value=''>Selecciona un servicio...</option>";

    servicios.forEach(s => {
        select.innerHTML += `
            <option value="${s.nombre}">${s.nombre} - $${s.precio}</option>
        `;
    });
}

cargarServicios();

async function cargarEstilistas() {
    const res = await fetch(`${window.API_URL}/estilistas`);
    const estilistas = await res.json();

    const select = document.getElementById("estilista");
    select.innerHTML = "<option value=''>Selecciona...</option>";

    estilistas.forEach(e => {
        select.innerHTML += `<option value="${e.id}">${e.nombre}</option>`;
    });
}

cargarEstilistas();

async function cargarCitas() {
    if (!currentUser || !currentUser.phone) {
        console.warn("No hay usuario logeado");
        return;
}
const telefono = currentUser.phone;
try {
    const resp = await fetch(`${window.API_URL}/citas_usuario/${telefono}`);
    const data = await resp.json();
    console.log("Data recibida: ", data);
    if (!Array.isArray(data)) {
        console.error("Error cargando citas:", data);
        return;
    }
    renderAppointments(telefono, data);
    } catch (err) {
    console.error("Error cargando citas:", err);
}
}



/* ============================================================
FIN
============================================================ */
