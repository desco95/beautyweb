from flask import Flask, request, jsonify
from flask_cors import CORS
import psycopg2
import psycopg2.extras
import bcrypt
from datetime import date, datetime
import os

app = Flask(__name__)

CORS(app, resources={
    r"/*": {
        "origins": ["*"],
        "methods": ["GET", "POST", "PUT", "DELETE"],
        "allow_headers": ["Content-Type"]
    }
})

DATABASE_URL = os.environ.get('DATABASE_URL')

if DATABASE_URL and DATABASE_URL.startswith('postgres://'):
    DATABASE_URL = DATABASE_URL.replace('postgres://', 'postgresql://', 1)

def get_db():
    if DATABASE_URL:
        return psycopg2.connect(DATABASE_URL, sslmode='require')
    else:
        return psycopg2.connect(
            host="localhost",
            database="beautyweb",
            user="postgres",
            password="1234"
        )

# ==================================================
#   REGISTRO DE USUARIO CON VALIDACIONES
# ==================================================
@app.route("/registro", methods=["POST"])
def registro():
    data = request.json
    nombre = data.get("nombre", "").strip()
    telefono = data.get("telefono", "").strip()
    contrasena = data.get("contrasena", "").strip()

    # Validaciones
    if not nombre or not telefono or not contrasena:
        return jsonify({"error": "Todos los campos son obligatorios"}), 400
    
    # Validar nombre (solo letras y espacios, max 20 caracteres)
    if not nombre.replace(" ", "").isalpha() or len(nombre) > 20:
        return jsonify({"error": "Nombre inválido (solo letras, máx 20 caracteres)"}), 400
    
    # Validar teléfono (exactamente 10 dígitos numéricos)
    if not telefono.isdigit() or len(telefono) != 10:
        return jsonify({"error": "Teléfono inválido (debe ser 10 dígitos)"}), 400
    
    # Validar contraseña (mínimo 6 caracteres)
    if len(contrasena) < 6:
        return jsonify({"error": "La contraseña debe tener al menos 6 caracteres"}), 400

    try:
        conn = get_db()
        cur = conn.cursor()

        cur.execute("SELECT * FROM usuarios WHERE telefono = %s", (telefono,))
        if cur.fetchone():
            return jsonify({"error": "El número ya está registrado"}), 400

        hashed = bcrypt.hashpw(contrasena.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        
        cur.execute("""
            INSERT INTO usuarios (nombre, telefono, contrasena)
            VALUES (%s, %s, %s)
        """, (nombre, telefono, hashed))

        conn.commit()
        cur.close()
        conn.close()

        return jsonify({"mensaje": "Usuario registrado correctamente"})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ==================================================
#   LOGIN CON VALIDACIONES
# ==================================================
@app.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    telefono = data.get("telefono", "").strip()
    contrasena = data.get("contrasena", "").strip()

    # Validaciones
    if not telefono or not contrasena:
        return jsonify({"error": "Todos los campos son obligatorios"}), 400
    
    if not telefono.isdigit() or len(telefono) != 10:
        return jsonify({"error": "Teléfono inválido (debe ser 10 dígitos)"}), 400

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id, nombre, telefono, contrasena
        FROM usuarios
        WHERE telefono = %s
    """, (telefono,))

    usuario = cursor.fetchone()
    conn.close()

    if not usuario:
        return jsonify({"error": "Número no registrado"}), 400

    user_id, nombre, telefono_db, hashed_password = usuario

    if isinstance(hashed_password, memoryview):
        hashed_password = bytes(hashed_password)

    if not bcrypt.checkpw(contrasena.encode("utf-8"), hashed_password):
        return jsonify({"error": "Contraseña incorrecta"}), 400

    return jsonify({
        "id": user_id,
        "nombre": nombre,
        "telefono": telefono_db
    })

# ================================
#   OBTENER CITAS POR TELÉFONO
# ================================
@app.route('/citas_usuario/<telefono>', methods=['GET'])
def citas_usuario(telefono):
    conn = get_db()
    cur = conn.cursor()

    query = """
        SELECT c.id, c.servicio, e.nombre as estilista, c.fecha, c.hora, c.estado, c.notas
        FROM citas c
        JOIN usuarios u ON c.usuario_id = u.id
        LEFT JOIN estilistas e ON c.estilista = e.id
        WHERE u.telefono = %s
        ORDER BY c.fecha DESC, c.hora DESC;
    """

    cur.execute(query, (telefono,))
    rows = cur.fetchall()

    citas = []
    for r in rows:
        cita_data = {
            "id": r[0],
            "servicio": r[1],
            "estilista": r[2] if r[2] else "Sin asignar",
            "fecha": r[3].strftime("%Y-%m-%d"),
            "hora": r[4].strftime("%H:%M"),
            "estado": r[5]
        }
        
        if r[5] == "Cancelada" and r[6]:
            cita_data["motivo_rechazo"] = r[6]
            
        citas.append(cita_data)

    cur.close()
    conn.close()

    return jsonify(citas)


# ================================
#   OBTENER ESTILISTAS
# ================================
@app.route("/estilistas", methods=["GET"])
def obtener_estilistas():
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

    cur.execute("SELECT * FROM estilistas ORDER BY nombre")
    data = cur.fetchall()

    cur.close()
    conn.close()

    return jsonify([dict(row) for row in data])


# =================================
#   OBTENER SERVICIOS
# =================================
@app.route("/servicios", methods=["GET"])
def obtener_servicios():
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

    cur.execute("SELECT * FROM servicios ORDER BY nombre")
    data = cur.fetchall()

    cur.close()
    conn.close()

    return jsonify([dict(row) for row in data])


# ================================
#   HORARIOS BLOQUEADOS
# ================================
@app.route("/horarios_bloqueados/<int:id_estilista>/<fecha>", methods=["GET"])
def obtener_bloqueados(id_estilista, fecha):
    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        SELECT hora 
        FROM horarios_bloqueados
        WHERE id_estilista = %s AND fecha = %s
    """, (id_estilista, fecha))

    bloqueados = [str(r[0]) for r in cur.fetchall()]

    cur.close()
    conn.close()

    return jsonify(bloqueados)


# ================================
#   CREAR CITA CON VALIDACIONES
# ================================
@app.route("/agendar", methods=["POST"])
def agendar():
    data = request.get_json()

    usuario_id = data.get("usuario_id")
    servicio = data.get("servicio")
    estilista_id = data.get("estilista")
    fecha = data.get("fecha")
    hora = data.get("hora")
    notas = data.get("notas")

    conn = get_db()
    cur = conn.cursor()

    try:
        fecha_cita = datetime.strptime(fecha, "%Y-%m-%d").date()
        if fecha_cita < date.today():
            return jsonify({"error": "No puedes agendar citas en fechas pasadas"}), 400

        cur.execute("""
            SELECT id FROM horarios_bloqueados
            WHERE id_estilista = %s AND fecha = %s
        """, (estilista_id, fecha))
        
        if cur.fetchone():
            return jsonify({"error": "El estilista no está disponible en esta fecha"}), 400

        cur.execute("""
            SELECT id FROM citas
            WHERE estilista = %s 
            AND fecha = %s 
            AND hora = %s 
            AND estado IN ('Pendiente', 'Confirmada')
        """, (estilista_id, fecha, hora))
        
        if cur.fetchone():
            return jsonify({"error": "Este horario ya está ocupado para este estilista"}), 400

        cur.execute("SELECT nombre FROM estilistas WHERE id = %s", (estilista_id,))
        estilista_nombre = cur.fetchone()
        
        if not estilista_nombre:
            return jsonify({"error": "Estilista no encontrado"}), 400

        cur.execute("""
            INSERT INTO citas (usuario_id, servicio, estilista, fecha, hora, notas)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id;
        """, (usuario_id, servicio, estilista_id, fecha, hora, notas))

        new_id = cur.fetchone()[0]

        conn.commit()
        return jsonify({"mensaje": "Cita agendada", "id": new_id})

    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# ================================
#   BLOQUEAR HORARIO
# ================================
@app.route("/bloquear", methods=["POST"])
def bloquear_horario():
    try:
        data = request.json

        fecha = data.get("fecha")
        estilista = int(data.get("id_estilista"))
        motivo = data.get("motivo")

        conn = get_db()
        cur = conn.cursor()

        cur.execute("""
            INSERT INTO horarios_bloqueados (fecha, id_estilista, motivo)
            VALUES (%s, %s, %s)
        """, (fecha, estilista, motivo))

        conn.commit()
        cur.close()
        conn.close()

        return jsonify({"mensaje": "Horario bloqueado"}), 201
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ================================
#   VER BLOQUEOS DE ESTILISTA
# ================================
@app.route("/bloqueos/<int:id_estilista>", methods=["GET"])
def ver_bloqueos(id_estilista):
    try:
        conn = get_db()
        cur = conn.cursor()

        cur.execute("""
            SELECT id, fecha, motivo
            FROM horarios_bloqueados
            WHERE id_estilista = %s
            ORDER BY fecha DESC
        """, (id_estilista,))

        rows = cur.fetchall()
        bloqueos = []
        
        for row in rows:
            bloqueos.append({
                "id": row[0],
                "fecha": row[1].strftime("%Y-%m-%d"),
                "motivo": row[2]
            })

        cur.close()
        conn.close()

        return jsonify(bloqueos)

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ================================
#   ELIMINAR BLOQUEO
# ================================
@app.route("/bloqueos/<int:id_bloqueo>", methods=["DELETE"])
def eliminar_bloqueo(id_bloqueo):
    try:
        conn = get_db()
        cur = conn.cursor()

        cur.execute("DELETE FROM horarios_bloqueados WHERE id = %s", (id_bloqueo,))
        conn.commit()

        cur.close()
        conn.close()

        return jsonify({"mensaje": "Bloqueo eliminado correctamente"})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ================================
#   ELIMINAR CITA
# ================================
@app.route("/citas/<int:id>", methods=["DELETE"])
def eliminar_cita(id):
    conn = get_db()
    cur = conn.cursor()

    cur.execute("DELETE FROM citas WHERE id = %s", (id,))
    conn.commit()

    cur.close()
    conn.close()

    return jsonify({"mensaje": "Cita eliminada correctamente"})


@app.route("/admin/staff", methods=["GET"])
def obtener_staff():
    try:
        today = date.today()

        query = """
            SELECT e.id,
                   e.nombre,
                   COUNT(c.id) AS citas_hoy
            FROM estilistas e
            LEFT JOIN citas c
                ON c.estilista = e.id
               AND c.fecha = %s
            GROUP BY e.id
            ORDER BY e.nombre;
        """
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(query, (today,))
        rows = cursor.fetchall()

        staff = []
        for row in rows:
            staff.append({
                "id_estilista": row[0],
                "nombre": row[1],
                "citas_hoy": row[2]
            })

        return jsonify(staff)

    except Exception as e:
        return jsonify({"error": str(e)})
    
@app.route("/admin/stylists/add", methods=["POST"])
def add_stylist():
    data = request.json
    nombre = data.get("nombre")
    servicios = data.get("servicios", [])  # Lista de IDs de servicios

    if not nombre:
        return jsonify({"error": "Nombre requerido"}), 400

    conn = get_db()
    cur = conn.cursor()

    try:
        # Insertar estilista
        cur.execute("INSERT INTO estilistas (nombre) VALUES (%s) RETURNING id", (nombre,))
        new_id = cur.fetchone()[0]
        
        # Asociar servicios
        for servicio_id in servicios:
            cur.execute("""
                INSERT INTO estilista_servicios (estilista_id, servicio_id)
                VALUES (%s, %s)
            """, (new_id, servicio_id))
        
        conn.commit()
        cur.close()
        conn.close()

        return jsonify({"message": "Estilista agregado", "id": new_id})
    
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500

@app.route("/admin/stylists/delete", methods=["POST"])
def delete_stylist():
    data = request.json
    estilista_id = data.get("id")

    if not estilista_id:
        return jsonify({"error": "ID requerido"}), 400

    conn = get_db()
    cur = conn.cursor()

    cur.execute("DELETE FROM estilistas WHERE id = %s", (estilista_id,))
    conn.commit()

    cur.close()
    conn.close()

    return jsonify({"message": "Estilista eliminado"})


# ================================
#   OBTENER CITAS PENDIENTES CON INFORMACIÓN COMPLETA
# ================================
@app.route('/citas/pendientes', methods=['GET'])
def citas_pendientes():
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT c.id, c.servicio, e.nombre as estilista, c.fecha, c.hora, c.estado,
               u.nombre AS cliente, u.telefono
        FROM citas c
        JOIN usuarios u ON c.usuario_id = u.id
        LEFT JOIN estilistas e ON c.estilista = e.id
        WHERE c.estado IN ('Pendiente', 'Confirmada')
        ORDER BY c.fecha ASC, c.hora ASC;
    """)

    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    citas = []
    for row in rows:
        citas.append({
            "id": row[0],
            "servicio": row[1],
            "estilista": row[2] if row[2] else "Sin asignar",
            "fecha": str(row[3]),
            "hora": row[4].strftime("%H:%M"),
            "estado": row[5],
            "cliente": row[6],
            "telefono": row[7]
        })

    return jsonify(citas)
    

# ================================
#   CONFIRMAR CITA
# ================================
@app.route("/citas/confirmar/<int:id>", methods=["PUT"])
def confirmar_cita(id):
    try:
        conn = get_db()
        cur = conn.cursor()

        cur.execute("""
            UPDATE citas
            SET estado = 'Confirmada'
            WHERE id = %s
        """, (id,))

        conn.commit()
        cur.close()
        conn.close()

        return jsonify({"mensaje": "Cita confirmada"})

    except Exception as e:
        return jsonify({"error": str(e)})

# ================================
#   RECHAZAR CITA
# ================================
@app.route("/citas/rechazar/<int:id>", methods=["PUT"])
def rechazar_cita(id):
    try:
        data = request.get_json()
        razon = data.get("razon", "Sin especificar")

        conn = get_db()
        cur = conn.cursor()

        cur.execute("""
            UPDATE citas
            SET estado = 'Cancelada',
                notas = %s
            WHERE id = %s
        """, (razon, id))

        conn.commit()
        cur.close()
        conn.close()

        return jsonify({"mensaje": "Cita cancelada"})

    except Exception as e:
        return jsonify({"error": str(e)})
    
@app.route("/citas/hoy/count", methods=["GET"])
def total_citas_hoy():
    try:
        hoy = date.today()

        conn = get_db()
        cur = conn.cursor()

        cur.execute("""
            SELECT COUNT(*) 
            FROM citas
            WHERE fecha = %s AND estado = 'Confirmada'
        """, (hoy,))

        total = cur.fetchone()[0]

        cur.close()
        conn.close()

        return jsonify({"total": total})

    except Exception as e:
        return jsonify({"error": str(e)})
    
@app.route("/citas/pendientes/count", methods=["GET"])
def count_citas_pendientes():
    try:
        conn = get_db()
        cursor = conn.cursor()

        query = "SELECT COUNT(*) FROM citas WHERE estado = 'Pendiente'"
        cursor.execute(query)
        total = cursor.fetchone()

        if total is None:
            return jsonify({"total_pendientes": 0}), 200

        return jsonify({"total_pendientes": total[0]}), 200

    except Exception as e:
        return jsonify({"error": "Error interno en el servidor"}), 500

# ================================
#   OBTENER HORARIOS OCUPADOS
# ================================
@app.route("/horarios_ocupados/<int:id_estilista>/<fecha>", methods=["GET"])
def obtener_horarios_ocupados(id_estilista, fecha):
    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        SELECT hora 
        FROM citas
        WHERE estilista = %s 
        AND fecha = %s 
        AND estado IN ('Pendiente', 'Confirmada')
    """, (id_estilista, fecha))

    ocupados = [str(r[0])[:-3] for r in cur.fetchall()]

    cur.close()
    conn.close()

    return jsonify(ocupados)

# ================================
#   CONTAR CITAS CONFIRMADAS DEL MES
# ================================
@app.route("/citas/confirmadas/mes/count", methods=["GET"])
def count_confirmed_month():
    try:
        conn = get_db()
        cur = conn.cursor()

        today = date.today()
        first_day = today.replace(day=1)
        if today.month == 12:
            next_month = today.replace(year=today.year+1, month=1, day=1)
        else:
            next_month = today.replace(month=today.month+1, day=1)

        query = """
            SELECT COUNT(*) 
            FROM citas
            WHERE estado = 'Confirmada'
              AND fecha >= %s
              AND fecha < %s
        """

        cur.execute(query, (first_day, next_month))
        total = cur.fetchone()[0]

        cur.close()
        conn.close()

        return jsonify({"total_confirmadas_mes": total})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ================================
#   OBTENER ESTILISTAS POR SERVICIO
# ================================
@app.route("/estilistas/servicio/<servicio_nombre>", methods=["GET"])
def estilistas_por_servicio(servicio_nombre):
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

        cur.execute("""
            SELECT DISTINCT e.id, e.nombre
            FROM estilistas e
            JOIN estilista_servicios es ON e.id = es.estilista_id
            JOIN servicios s ON es.servicio_id = s.id
            WHERE s.nombre = %s
            ORDER BY e.nombre
        """, (servicio_nombre,))

        data = cur.fetchall()
        cur.close()
        conn.close()

        return jsonify([dict(row) for row in data])

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# Ruta de salud para Render
@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"}), 200

if __name__ == "__main__":
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
