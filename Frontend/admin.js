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
        cargarEstilistas();
    }

    if (view === "inicio") {
        loadTodayCount();
        loadPendingCount();
        loadConfirmedMonthCount();
        loadSatisfaccion();
    }

    if (view === "proximas") {
        loadPendingAppointments();
    }
}

showAdminView("inicio");

let appointments = JSON.parse(localStorage.getItem("appointments")) || [];

/* ==========================
   PENDING + CONFIRMED APPOINTMENTS CON INFO DESPLEGABLE Y RANGO DE FECHAS
========================== */
async function loadPendingAppointments() {
    const pendingContainer = document.getElementById("pending-list");
    const confirmedContainer = document.getElementById("confirmed-list");

    pendingContainer.innerHTML = "<p>Cargando...</p>";
    confirmedContainer.innerHTML = "<p>Cargando...</p>";

    try {
        const response = await fetch(`${window.API_URL}/citas/pendientes`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const citas = await response.json();

        pendingContainer.innerHTML = "";
        confirmedContainer.innerHTML = "";

        if (!Array.isArray(citas) || citas.length === 0) {
            pendingContainer.innerHTML = "<p>No hay citas pendientes</p>";
            confirmedContainer.innerHTML = "<p>No hay citas confirmadas</p>";
            return;
        }

        // Filtrar solo fechas desde hoy en adelante
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        
        const citasFuturas = citas.filter(c => {
            const fechaCita = new Date(c.fecha);
            return fechaCita >= hoy;
        });

        const pendientes = citasFuturas.filter(c => c.estado === "Pendiente");
        const confirmadas = citasFuturas.filter(c => c.estado === "Confirmada");

        // ===== PENDIENTES CON TRIÁNGULO DESPLEGABLE =====
        const pendientesPorMes = {};
        pendientes.forEach(cita => {
            const fecha = new Date(cita.fecha);
            const monthKey = `${fecha.getFullYear()}-${(fecha.getMonth() + 1).toString().padStart(2, "0")}`;
            if (!pendientesPorMes[monthKey]) pendientesPorMes[monthKey] = [];
            pendientesPorMes[monthKey].push(cita);
        });

        Object.keys(pendientesPorMes).sort().forEach(month => {
            const monthHeader = document.createElement("h4");
            monthHeader.textContent = `Citas pendientes - ${month}`;
            monthHeader.style.marginTop = "20px";
            pendingContainer.appendChild(monthHeader);

            pendientesPorMes[month].forEach(cita => {
                const card = document.createElement("div");
                card.classList.add("appointment-card");
                card.style.cursor = "pointer";

                card.innerHTML = `
                    <div class="card-summary" style="display: flex; align-items: center; gap: 10px;">
                        <span class="triangle" style="font-size: 18px; transition: transform 0.3s;">▶</span>
                        <div>
                            <strong>${cita.servicio}</strong><br>
                            <span style="color: #666;">Cliente: ${cita.cliente} | Fecha: ${cita.fecha}</span>
                        </div>
                    </div>
                    <div class="card-details" style="display:none; margin-top: 15px; padding-top: 15px; border-top: 1px solid #eee;">
                        <p><strong>Estilista:</strong> ${cita.estilista}</p>
                        <p><strong>Hora:</strong> ${cita.hora}</p>
                        <p><strong>Teléfono:</strong> ${cita.telefono}</p>
                        <p><strong>Estado:</strong> ${cita.estado}</p>
                    </div>
                `;

                const summary = card.querySelector(".card-summary");
                const details = card.querySelector(".card-details");
                const triangle = card.querySelector(".triangle");

                summary.addEventListener("click", () => {
                    const isHidden = details.style.display === "none";
                    details.style.display = isHidden ? "block" : "none";
                    triangle.style.transform = isHidden ? "rotate(90deg)" : "rotate(0deg)";
                });

                const actions = document.createElement("div");
                actions.classList.add("card-actions");
                actions.style.marginTop = "15px";
                actions.style.display = "flex";
                actions.style.gap = "10px";

                const btnConfirmar = document.createElement("button");
                btnConfirmar.className = "btn-confirmar";
                btnConfirmar.textContent = "Confirmar";
                btnConfirmar.onclick = async () => await confirmarCita(cita.id);

                const btnRechazar = document.createElement("button");
                btnRechazar.className = "btn-rechazar";
                btnRechazar.textContent = "Rechazar";
                btnRechazar.onclick = async () => {
                    const reason = prompt("Motivo del rechazo:");
                    if (reason) await rechazarCita(cita.id, reason);
                };

                actions.appendChild(btnConfirmar);
                actions.appendChild(btnRechazar);
                card.appendChild(actions);

                pendingContainer.appendChild(card);
            });
        });

        // ===== CONFIRMADAS CON ORDEN, FILTRO Y RANGO DE FECHAS =====
        if (confirmadas.length > 0) {
            const controlsDiv = document.createElement("div");
            controlsDiv.style.marginBottom = "15px";
            controlsDiv.style.display = "flex";
            controlsDiv.style.flexDirection = "column";
            controlsDiv.style.gap = "15px";

            controlsDiv.innerHTML = `
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <button id="orden-fecha" class="btn-orden active-orden" style="padding: 8px 15px; border-radius: 8px; border: 1px solid #ddd; background: #ff4fa1; color: white; cursor: pointer;">
                        Por fecha y hora
                    </button>
                    <button id="orden-reciente" class="btn-orden" style="padding: 8px 15px; border-radius: 8px; border: 1px solid #ddd; background: white; color: #333; cursor: pointer;">
                        Última confirmada
                    </button>
                </div>
                <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                    <label style="font-weight: 600;">Filtrar por rango:</label>
                    <input type="date" id="fecha-desde" style="padding: 8px; border-radius: 6px; border: 1px solid #ddd;">
                    <span>a</span>
                    <input type="date" id="fecha-hasta" style="padding: 8px; border-radius: 6px; border: 1px solid #ddd;">
                    <button id="aplicar-filtro" style="padding: 8px 15px; background: #4CAF50; color: white; border: none; border-radius: 6px; cursor: pointer;">
                        Aplicar
                    </button>
                    <button id="limpiar-filtro" style="padding: 8px 15px; background: #999; color: white; border: none; border-radius: 6px; cursor: pointer;">
                        Limpiar
                    </button>
                </div>
            `;
            confirmedContainer.appendChild(controlsDiv);

            const listaConfirmadas = document.createElement("div");
            listaConfirmadas.id = "lista-confirmadas";
            confirmedContainer.appendChild(listaConfirmadas);

            let citasFiltradas = [...confirmadas];

            function renderConfirmadas(orden) {
                let citasOrdenadas = [...citasFiltradas];
                
                if (orden === "fecha") {
                    citasOrdenadas.sort((a, b) => {
                        const fechaA = new Date(a.fecha + " " + a.hora);
                        const fechaB = new Date(b.fecha + " " + b.hora);
                        return fechaA - fechaB;
                    });
                } else {
                    citasOrdenadas.reverse();
                }

                listaConfirmadas.innerHTML = "";
                
                if (citasOrdenadas.length === 0) {
                    listaConfirmadas.innerHTML = "<p>No hay citas en el rango seleccionado</p>";
                    return;
                }

                citasOrdenadas.forEach(cita => {
                    const card = document.createElement("div");
                    card.classList.add("appointment-card");
                    card.style.cursor = "pointer";

                    card.innerHTML = `
                        <div class="card-summary" style="display: flex; align-items: center; gap: 10px;">
                            <span class="triangle" style="font-size: 18px; transition: transform 0.3s;">▶</span>
                            <div style="flex: 1;">
                                <strong>${cita.servicio}</strong>
                                <span class="status confirmada" style="float: right;">Confirmada</span><br>
                                <span style="color: #666;">Cliente: ${cita.cliente} | Fecha: ${cita.fecha}</span>
                            </div>
                        </div>
                        <div class="card-details" style="display:none; margin-top: 15px; padding-top: 15px; border-top: 1px solid #eee;">
                            <p><strong>Teléfono:</strong> ${cita.telefono}</p>
                            <p><strong>Estilista:</strong> ${cita.estilista}</p>
                            <p><strong>Hora:</strong> ${cita.hora}</p>
                        </div>
                    `;

                    const summary = card.querySelector(".card-summary");
                    const details = card.querySelector(".card-details");
                    const triangle = card.querySelector(".triangle");

                    summary.addEventListener("click", () => {
                        const isHidden = details.style.display === "none";
                        details.style.display = isHidden ? "block" : "none";
                        triangle.style.transform = isHidden ? "rotate(90deg)" : "rotate(0deg)";
                    });

                    listaConfirmadas.appendChild(card);
                });
            }

            document.getElementById("orden-fecha").addEventListener("click", function() {
                renderConfirmadas("fecha");
                document.querySelectorAll(".btn-orden").forEach(b => {
                    b.style.background = "white";
                    b.style.color = "#333";
                });
                this.style.background = "#ff4fa1";
                this.style.color = "white";
            });

            document.getElementById("orden-reciente").addEventListener("click", function() {
                renderConfirmadas("reciente");
                document.querySelectorAll(".btn-orden").forEach(b => {
                    b.style.background = "white";
                    b.style.color = "#333";
                });
                this.style.background = "#ff4fa1";
                this.style.color = "white";
            });

            document.getElementById("aplicar-filtro").addEventListener("click", function() {
                const desde = document.getElementById("fecha-desde").value;
                const hasta = document.getElementById("fecha-hasta").value;

                if (!desde || !hasta) {
                    alert("Selecciona ambas fechas");
                    return;
                }

                const fechaDesde = new Date(desde);
                const fechaHasta = new Date(hasta);

                citasFiltradas = confirmadas.filter(c => {
                    const fechaCita = new Date(c.fecha);
                    return fechaCita >= fechaDesde && fechaCita <= fechaHasta;
                });

                renderConfirmadas("fecha");
            });

            document.getElementById("limpiar-filtro").addEventListener("click", function() {
                document.getElementById("fecha-desde").value = "";
                document.getElementById("fecha-hasta").value = "";
                citasFiltradas = [...confirmadas];
                renderConfirmadas("fecha");
            });

            renderConfirmadas("fecha");
        }

        if (pendingContainer.innerHTML === "") pendingContainer.innerHTML = "<p>No hay citas pendientes</p>";

    } catch (error) {
        console.error("ERROR AL CARGAR CITAS:", error);
        pendingContainer.innerHTML = `<p style="color:red;">Error al cargar citas: ${error.message}</p>`;
        confirmedContainer.innerHTML = "";
    }
}

async function confirmarCita(id) {
    try {
        const response = await fetch(`${window.API_URL}/citas/confirmar/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" }
        });

        const data = await response.json();

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
        const response = await fetch(`${window.API_URL}/citas/rechazar/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ razon: motivo })
        });

        const data = await response.json();

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
   ADD STYLIST CON SERVICIOS
========================== */
async function addStylist() {
    const name = document.getElementById("new-stylist-name").value.trim();
    const serviciosCheckboxes = document.querySelectorAll('input[name="servicios"]:checked');
    const servicios = Array.from(serviciosCheckboxes).map(cb => parseInt(cb.value));

    if (name === "") return alert("Ingresa un nombre válido");
    if (servicios.length === 0) return alert("Selecciona al menos un servicio");

    try {
        const response = await fetch(`${window.API_URL}/admin/stylists/add`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nombre: name, servicios: servicios })
        });

        const data = await response.json();

        if (!response.ok) return alert(data.error);

        alert("Estilista agregado ✓");
        document.getElementById("new-stylist-name").value = "";
        serviciosCheckboxes.forEach(cb => cb.checked = false);
        loadStaff();

    } catch (error) {
        console.error("Error añadiendo estilista:", error);
    }
}

/* ==========================
   DELETE STYLIST
========================== */
async function cargarEstilistas() {
    try {
        const response = await fetch(`${window.API_URL}/admin/staff`);
        if (!response.ok) throw new Error("Error en backend");

        const staff = await response.json();
        const select = document.getElementById("delete-estilista-select");

        if (!select) {
            console.error("No existe el select delete-estilista-select");
            return;
        }

        select.innerHTML = "<option value=''>Selecciona un estilista...</option>";

        staff.forEach(s => {
            select.innerHTML += `
                <option value="${s.id_estilista}">
                    ${s.nombre} (ID: ${s.id_estilista})
                </option>
            `;
        });

    } catch (error) {
        console.error("Error cargando estilistas:", error);
    }
}

async function deleteStylist() {
    const select = document.getElementById("delete-estilista-select");
    const id = select.value;

    if (!id) {
        alert("Selecciona un estilista");
        return;
    }

    if (!confirm("¿Seguro que deseas eliminar este estilista?")) return;

    try {
        const response = await fetch(`${window.API_URL}/admin/stylists/delete`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: parseInt(id) })
        });

        const data = await response.json();
        if (!response.ok) return alert(data.error);

        alert("Estilista eliminado ✓");
        cargarEstilistas();
        loadStaff();

    } catch (error) {
        console.error("Error eliminando estilista:", error);
    }
}

/* ===================================================
   CARGAR ESTILISTAS PARA BLOQUEOS CON VISUALIZACIÓN
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
   GENERAR TARJETAS DE BLOQUEO CON VER BLOQUEOS
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
            <select class="reason">
                <option value="Vacaciones">Vacaciones</option>
                <option value="Día libre">Día libre</option>
                <option value="Incapacidad">Incapacidad</option>
                <option value="Evento personal">Evento personal</option>
            </select>

            <button class="btn-block" data-id="${est.id_estilista}">Bloquear</button>
            <button class="btn-ver-bloqueos" data-id="${est.id_estilista}" style="margin-top: 10px; background: #555;">Ver bloqueos</button>
            
            <div class="bloqueos-list" style="margin-top: 15px; display: none;"></div>
        `;

        container.appendChild(card);
    });

    // Event listener para ver bloqueos
    document.querySelectorAll(".btn-ver-bloqueos").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            const estilistaId = e.target.dataset.id;
            const card = e.target.closest(".block-card");
            const bloqueosList = card.querySelector(".bloqueos-list");

            if (bloqueosList.style.display === "none") {
                await mostrarBloqueos(estilistaId, bloqueosList);
                bloqueosList.style.display = "block";
                e.target.textContent = "Ocultar bloqueos";
            } else {
                bloqueosList.style.display = "none";
                e.target.textContent = "Ver bloqueos";
            }
        });
    });
}

async function mostrarBloqueos(estilistaId, container) {
    try {
        const response = await fetch(`${window.API_URL}/bloqueos/${estilistaId}`);
        const bloqueos = await response.json();

        container.innerHTML = "";

        if (bloqueos.length === 0) {
            container.innerHTML = "<p style='color: #666;'>No hay bloqueos registrados</p>";
            return;
        }

        bloqueos.forEach(bloqueo => {
            const item = document.createElement("div");
            item.style.padding = "10px";
            item.style.background = "#f9f9f9";
            item.style.borderRadius = "8px";
            item.style.marginBottom = "8px";
            item.style.display = "flex";
            item.style.justifyContent = "space-between";
            item.style.alignItems = "center";

            item.innerHTML = `
                <div>
                    <strong>${bloqueo.fecha}</strong><br>
                    <span style="color: #666; font-size: 14px;">${bloqueo.motivo}</span>
                </div>
                <button class="btn-eliminar-bloqueo" data-id="${bloqueo.id}" style="background: #e74a3b; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer;">
                    Eliminar
                </button>
            `;

            container.appendChild(item);
        });

        // Event listeners para eliminar bloqueos
        container.querySelectorAll(".btn-eliminar-bloqueo").forEach(btn => {
            btn.addEventListener("click", async (e) => {
                const bloqueoId = e.target.dataset.id;
                if (confirm("¿Eliminar este bloqueo?")) {
                    await eliminarBloqueo(bloqueoId, estilistaId, container);
                }
            });
        });

    } catch (error) {
        console.error("Error cargando bloqueos:", error);
        container.innerHTML = "<p style='color: red;'>Error cargando bloqueos</p>";
    }
}

async function eliminarBloqueo(bloqueoId, estilistaId, container) {
    try {
        const response = await fetch(`${window.API_URL}/bloqueos/${bloqueoId}`, {
            method: "DELETE"
        });

        if (response.ok) {
            alert("✓ Bloqueo eliminado");
            await mostrarBloqueos(estilistaId, container);
        } else {
            alert("Error al eliminar bloqueo");
        }
    } catch (error) {
        console.error("Error eliminando bloqueo:", error);
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

async function loadSatisfaccion() {
    try {
        const res = await fetch(`${window.API_URL}/estadisticas/satisfaccion`);
        const data = await res.json();
        document.getElementById("stat-sat").textContent = data.satisfaccion + "%";
    } catch (err) {
        console.error("Error al cargar satisfacción:", err);
    }
}

/* ==========================
   CARGAR SERVICIOS PARA AÑADIR ESTILISTA
========================== */
async function cargarServiciosParaEstilista() {
    try {
        const response = await fetch(`${window.API_URL}/servicios`);
        const servicios = await response.json();

        const container = document.getElementById("servicios-estilista");
        if (!container) return;

        container.innerHTML = "";

        servicios.forEach(servicio => {
            const label = document.createElement("label");
            label.style.display = "block";
            label.style.marginBottom = "8px";
            
            label.innerHTML = `
                <input type="checkbox" name="servicios" value="${servicio.id}">
                ${servicio.nombre}
            `;

            container.appendChild(label);
        });

    } catch (error) {
        console.error("Error cargando servicios:", error);
    }
}

// Cargar servicios cuando se carga la página
document.addEventListener("DOMContentLoaded", () => {
    cargarServiciosParaEstilista();
});
