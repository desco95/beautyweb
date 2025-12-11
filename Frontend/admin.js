/* ==========================
   NAVIGATION
========================== */
function showAdminView(view) {
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    document.getElementById(view).classList.add("active");

    document.querySelectorAll(".nav-btn").forEach(v => v.classList.remove("active"));
    document.getElementById("btn-" + view).classList.add("active");

    if (view === "personal") {
        loadStaff();
    }

    if (view === "horarios") {
        loadBlockStylists();
    }

    if (view === "inicio") {
        loadTodayCount();
        loadPendingCount();
        loadConfirmedMonthCount();
    }

    if (view === "proximas") {
        loadPendingAppointments();
    }
}

showAdminView("inicio");

/* ==========================
   LOAD DATA (localStorage backup)
========================== */
let appointments = JSON.parse(localStorage.getItem("appointments")) || [];

/* ==========================
   PENDING + CONFIRMED APPOINTMENTS
========================== */
async function loadPendingAppointments() {
    const pending = document.getElementById("pending-list");
    const confirmed = document.getElementById("confirmed-list");

    pending.innerHTML = "<p>Cargando...</p>";
    confirmed.innerHTML = "<p>Cargando...</p>";

    try {
        const response = await fetch(`${window.API_URL}/citas/pendientes`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const citas = await response.json();

        console.log("Citas recibidas:", citas); // Para debug

        pending.innerHTML = "";
        confirmed.innerHTML = "";

        if (!Array.isArray(citas) || citas.length === 0) {
            pending.innerHTML = "<p>No hay citas pendientes</p>";
            confirmed.innerHTML = "<p>No hay citas confirmadas</p>";
            return;
        }

        citas.forEach(cita => {
            const card = document.createElement("div");
            card.classList.add("appointment-card");

            card.innerHTML = `
                <div class="card-header">
                    <h3>${cita.servicio}</h3>
                    <span class="status ${cita.estado.toLowerCase()}">${cita.estado}</span>
                </div>

                <div class="card-body">
                    <p><strong>Cliente:</strong> ${cita.cliente}</p>
                    <p><strong>Estilista:</strong> ${cita.estilista}</p>
                    <p><strong>Fecha:</strong> ${cita.fecha}</p>
                    <p><strong>Hora:</strong> ${cita.hora}</p>
                </div>
            `;

            if (cita.estado === "Pendiente") {
                const actions = document.createElement("div");
                actions.classList.add("card-actions");

                const btnConfirmar = document.createElement("button");
                btnConfirmar.className = "btn-confirmar";
                btnConfirmar.textContent = "Confirmar";
                btnConfirmar.onclick = async () => {
                    console.log("Confirmando cita ID:", cita.id);
                    await confirmarCita(cita.id);
                };

                const btnRechazar = document.createElement("button");
                btnRechazar.className = "btn-rechazar";
                btnRechazar.textContent = "Rechazar";
                btnRechazar.onclick = async () => {
                    const reason = prompt("Motivo del rechazo:");
                    if (reason) {
                        console.log("Rechazando cita ID:", cita.id);
                        await rechazarCita(cita.id, reason);
                    }
                };

                actions.appendChild(btnConfirmar);
                actions.appendChild(btnRechazar);
                card.appendChild(actions);
                pending.appendChild(card);
            }

            if (cita.estado === "Confirmada") {
                confirmed.appendChild(card);
            }
        });

        if (pending.innerHTML === "") {
            pending.innerHTML = "<p>No hay citas pendientes</p>";
        }
        
        if (confirmed.innerHTML === "") {
            confirmed.innerHTML = "<p>No hay citas confirmadas</p>";
        }

    } catch (error) {
        console.error("ERROR AL CARGAR CITAS:", error);
        pending.innerHTML = `<p style="color: red;">Error al cargar citas: ${error.message}</p>`;
        confirmed.innerHTML = "";
    }
}

async function confirmarCita(id) {
    try {
        console.log("Enviando confirmación para cita ID:", id);
        
        const response = await fetch(`${window.API_URL}/citas/confirmar/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" }
        });

        const data = await response.json();
        console.log("Respuesta del servidor:", data);

        if (response.ok) {
            alert("✓ Cita confirmada");
            loadPendingAppointments();
            loadPendingCount();
            loadTodayCount();
            loadConfirmedMonthCount();
        } else {
            alert("Error: " + (data.error || "No se pudo confirmar"));
        }

    } catch (error) {
        console.error("Error al confirmar:", error);
        alert("Error de conexión: " + error.message);
    }
}

async function rechazarCita(id, motivo) {
    try {
        console.log("Enviando rechazo para cita ID:", id);
        
        const response = await fetch(`${window.API_URL}/citas/rechazar/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ razon: motivo })
        });

        const data = await response.json();
        console.log("Respuesta del servidor:", data);

        if (response.ok) {
            alert("✓ Cita rechazada");
            loadPendingAppointments();
            loadPendingCount();
        } else {
            alert("Error: " + (data.error || "No se pudo rechazar"));
        }

    } catch (error) {
        console.error("Error al rechazar:", error);
        alert("Error de conexión: " + error.message);
    }
}

/* ==========================
   STAFF LIST
========================== */
async function loadStaff() {
    try {
        const response = await fetch(`${window.API_URL}/admin/staff`);

        if (!response.ok) throw new Error("Error en backend");

        const staff = await response.json();
        const contenedor = document.getElementById("staffListado");

        contenedor.innerHTML = "";

        staff.forEach(s => {
            const citasHoy = s.citas_hoy !== null ? parseInt(s.citas_hoy) : 0;

            const card = document.createElement("div");
            card.classList.add("staff-card");

            card.innerHTML = `
                <h3>${s.nombre}</h3>
                <p>ID: ${s.id_estilista}</p>
                <p>Citas hoy: <strong>${citasHoy}</strong></p>
            `;

            contenedor.appendChild(card);
        });

    } catch (error) {
        console.error("Error cargando staff:", error);
    }
}

/* ==========================
   ADD STYLIST
========================== */
async function addStylist() {
    const name = document.getElementById("new-stylist-name").value.trim();

    if (name === "") return alert("Ingresa un nombre válido");

    try {
        const response = await fetch(`${window.API_URL}/admin/stylists/add`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nombre: name })
        });

        const data = await response.json();

        if (!response.ok) return alert(data.error);

        alert("Estilista agregado ✓");
        document.getElementById("new-stylist-name").value = "";
        loadStaff();

    } catch (error) {
        console.error("Error añadiendo estilista:", error);
    }
}

/* ==========================
   DELETE STYLIST
========================== */
async function deleteStylist() {
    const id = document.getElementById("delete-stylist-id").value.trim();

    if (id === "") return alert("Ingresa un ID válido");

    try {
        const response = await fetch(`${window.API_URL}/admin/stylists/delete`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: parseInt(id) })
        });

        const data = await response.json();

        if (!response.ok) return alert(data.error);

        alert("Estilista eliminado ✓");
        document.getElementById("delete-stylist-id").value = "";
        loadStaff();

    } catch (error) {
        console.error("Error eliminando estilista:", error);
    }
}

/* ===================================================
   CARGAR ESTILISTAS SOLO PARA BLOQUEOS
=================================================== */
async function loadBlockStylists() {
    try {
        const response = await fetch(`${window.API_URL}/admin/staff`);
        const staff = await response.json();
        generateBlockCards(staff);
    } catch (error) {
        console.error("Error cargando estilistas para bloqueo:", error);
    }
}

/* ===================================================
   CLICK EN BOTÓN BLOQUEAR HORARIO
=================================================== */
document.addEventListener("click", async (e) => {
    if (!e.target.classList.contains("btn-block")) return;

    const boton = e.target;
    const estilistaId = boton.dataset.id;
    const card = boton.closest(".block-card");

    if (!card) return alert("No se encontró la card del estilista");

    const day = card.querySelector(".single-day").value;
    const from = card.querySelector(".range-start").value;
    const to = card.querySelector(".range-end").value;
    const reason = card.querySelector(".reason").value || null;

    if (!day && (!from || !to)) {
        return alert("Selecciona un día o rango válido");
    }

    boton.disabled = true;
    boton.textContent = "Guardando...";

    try {
        if (day) {
            await fetch(`${window.API_URL}/bloquear`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id_estilista: parseInt(estilistaId),
                    fecha: day,
                    motivo: reason
                })
            });
        }

        if (from && to) {
            const d1 = new Date(from);
            const d2 = new Date(to);

            for (let d = new Date(d1); d <= d2; d.setDate(d.getDate() + 1)) {
                const fecha = d.toISOString().split("T")[0];
                await fetch(`${window.API_URL}/bloquear`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        id_estilista: parseInt(estilistaId),
                        fecha,
                        motivo: reason
                    })
                });
            }
        }

        alert("Bloqueo guardado ✓");

    } catch (err) {
        console.error(err);
        alert("Error al guardar bloqueo.");
    }

    boton.disabled = false;
    boton.textContent = "Bloquear";
});

/* ===================================================
   GENERAR TARJETAS DE BLOQUEO
=================================================== */
function generateBlockCards(stylists) {
    const container = document.getElementById("block-stylists-container");

    if (!container) {
        console.error("No existe el contenedor block-stylists-container");
        return;
    }

    container.innerHTML = "";

    stylists.forEach(est => {
        const card = document.createElement("div");
        card.classList.add("block-card");

        card.innerHTML = `
            <h3>${est.nombre}</h3>

            <label>Día único:</label>
            <input type="date" class="single-day">

            <label>Rango:</label>
            <div class="range-box">
                <input type="date" class="range-start">
                <input type="date" class="range-end">
            </div>

            <label>Motivo:</label>
            <input type="text" class="reason" placeholder="Motivo">

            <button class="btn-block" data-id="${est.id_estilista}">Bloquear</button>
        `;

        container.appendChild(card);
    });
}

loadTodayCount();

async function loadTodayCount() {
    try {
        const res = await fetch(`${window.API_URL}/citas/hoy/count`);
        const data = await res.json();

        const box = document.getElementById("today-count");

        if (!box) {
            console.error("No existe el contenedor #today-count");
            return;
        }

        box.textContent = data.total;

    } catch (err) {
        console.error("Error al cargar el total de citas hoy:", err);
    }
}

function loadPendingCount() {
    fetch(`${window.API_URL}/citas/pendientes/count`)
        .then(response => response.json())
        .then(data => {
            document.getElementById("pendientes-count").textContent = data.total_pendientes;
        })
        .catch(err => console.error("Error al cargar citas pendientes:", err));
}

async function loadConfirmedMonthCount() {
    try {
        const res = await fetch(`${window.API_URL}/citas/confirmadas/mes/count`);
        const data = await res.json();
        document.getElementById("month-confirmed-count").textContent = data.total_confirmadas_mes;
    } catch (err) {
        console.error("Error al cargar citas confirmadas del mes:", err);
    }
}


