from flask import Flask, request, jsonify
from flask_cors import CORS
import psycopg2
import psycopg2.extras
import bcrypt
from datetime import date, datetime
import os
import re

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

# Validaciones
def validar_telefono(telefono):
    """Valida que el teléfono tenga exactamente 10 dígitos"""
    return bool(re.match(r'^\d{10}$', telefono))

def validar_nombre(nombre):
    """Valida que el nombre solo contenga letras y espacios, máx 20 caracteres"""
    return bool(re.match(r'^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]{1,20}$', nombre))

def validar_contrasena(contrasena):
    """Valida que la contraseña tenga al menos 6 caracteres"""
    return len(contrasena) >= 6

# ==================================================
#   REGISTRO DE USUARIO
# ==================================================
@app.route("/registro", methods=["POST"])
def registro():
    data = request.json
    nombre = data.get("nombre", "").strip()
    telefono = data.get("telefono", "").strip()
    contrasena = data.get("contrasena", "")

    # Validaciones
    if not validar_nombre(nombre):
        return jsonify({"error": "El nombre solo debe contener letras y espacios (máx 20 caracteres)"}), 400
    
    if not validar_telefono(telefono):
        return jsonify({"error": "El teléfono debe tener exactamente 10 dígitos"}), 400
    
    if not validar_contrasena(contrasena):
        return jsonify({"error": "La contraseña debe tener al menos 6 caracteres"}), 400

    try:
        conn = get_db()
        cur = conn.cursor()

        cur.execute("SELECT * FROM usuarios WHERE telefono = %s", (telefono,))
        if cur.fetchone():
            return jsonify({"error": "Este número ya está registrado"}), 400

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
#   LOGIN DE USUARIO
# ==================================================
@app.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    telefono = data.get("telefono", "").strip()
    contrasena = data.get("contrasena", "")

    if not validar_telefono(telefono):
        return jsonify({"error": "El teléfono debe tener exactamente 10 dígitos"}), 400

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
#   OBTENER CITAS POR TELÉFONO (CON DATOS DEL CLIENTE)
# ================================
@app.route('/citas_usuario/<telefono>', methods=['GET'])
def citas_usuario(telefono):
    conn = get_db()
    cur = conn.cursor()

    query = """
        SELECT c.id, c.servicio, e.nombre as estilista, c.fecha, c.hora, 
               c.estado, c.notas, u.nombre as cliente, u.telefono as cliente_telefono
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
            "estado": r[5],
            "cliente": r[7],
            "telefono": r[8]
        }
        
        if r[5] == "Cancelada" and r[6]:
            cita_data["motivo_rechazo"] = r[6]
            
        citas.append(cita_data)

    cur.close()
    conn.close()

    return jsonify(citas)


# ================================
#   OBTENER ESTILISTAS CON SERVICIOS
# ================================
@app.route("/estilistas", methods=["GET"])
def obtener_estilistas():
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

    cur.execute("""
        SELECT e.id, e.nombre, 
               COALESCE(array_agg(es.servicio_id) FILTER (WHERE es.servicio_id IS NOT NULL), ARRAY[]::integer[]) as servicios
        FROM estilistas e
        LEFT JOIN estilista_servicios es ON e.id = es.estilista_id
        GROUP BY e.id, e.nombre
        ORDER BY e.nombre
    """)
    data = cur.fetchall()

    cur.close()
    conn.close()

    return jsonify([dict(row) for row in data])


# ================================
#   OBTENER ESTILISTAS POR SERVICIO
# ================================
@app.route("/estilistas/por-servicio/<servicio_nombre>", methods=["GET"])
def obtener_estilistas_por_servicio(servicio_nombre):
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
#   LISTAR BLOQUEOS DE UN ESTILISTA
# ================================
@app.route("/bloqueos/<int:id_estilista>", methods=["GET"])
def listar_bloqueos(id_estilista):
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

    cur.execute("""
        SELECT id, fecha, motivo
        FROM horarios_bloqueados
        WHERE id_estilista = %s
        ORDER BY fecha DESC
    """, (id_estilista,))

    bloqueos = cur.fetchall()
    cur.close()
    conn.close()

    return jsonify([dict(row) for row in bloqueos])


# ================================
#   ELIMINAR BLOQUEO
# ================================
@app.route("/bloqueos/<int:bloqueo_id>", methods=["DELETE"])
def eliminar_bloqueo(bloqueo_id):
    try:
        conn = get_db()
        cur = conn.cursor()

        cur.execute("DELETE FROM horarios_bloqueados WHERE id = %s", (bloqueo_id,))
        conn.commit()
        cur.close()
        conn.close()

        return jsonify({"mensaje": "Bloqueo eliminado correctamente"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


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

        # Verificar bloqueos
        cur.execute("""
            SELECT id FROM horarios_bloqueados
            WHERE id_estilista = %s AND fecha = %s
        """, (estilista_id, fecha))
        
        if cur.fetchone():
            return jsonify({"error": "El estilista no está disponible en esta fecha"}), 400

        # Verificar disponibilidad
        cur.execute("""
            SELECT id FROM citas
            WHERE estilista = %s 
            AND fecha = %s 
            AND hora = %s 
            AND estado IN ('Pendiente', 'Confirmada')
        """, (estilista_id, fecha, hora))
        
        if cur.fetchone():
            return jsonify({"error": "Este horario ya está ocupado"}), 400

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
        return jsonify({"error": str(e)}), 500

    
@app.route("/admin/stylists/add", methods=["POST"])
def add_stylist():
    data = request.json
    nombre = data.get("nombre")
    servicios = data.get("servicios", [])  # Array de IDs de servicios

    if not nombre:
        return jsonify({"error": "Nombre requerido"}), 400

    conn = get_db()
    cur = conn.cursor()

    try:
        cur.execute("INSERT INTO estilistas (nombre) VALUES (%s) RETURNING id", (nombre,))
        new_id = cur.fetchone()[0]

        # Insertar servicios
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

    # Primero eliminar relaciones
    cur.execute("DELETE FROM estilista_servicios WHERE estilista_id = %s", (estilista_id,))
    cur.execute("DELETE FROM estilistas WHERE id = %s", (estilista_id,))
    conn.commit()

    cur.close()
    conn.close()

    return jsonify({"message": "Estilista eliminado"})


# ================================
#   OBTENER CITAS PENDIENTES Y CONFIRMADAS
# ================================
@app.route('/citas/pendientes', methods=['GET'])
def citas_pendientes():
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT c.id, c.servicio, e.nombre as estilista, c.fecha, c.hora, c.estado,
               u.nombre AS cliente, u.telefono AS telefono
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
        return jsonify({"error": str(e)}), 500

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
        return jsonify({"error": str(e)}), 500
    
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
        return jsonify({"error": str(e)}), 500
    
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
#   OBTENER HORARIOS OCUPADOS POR ESTILISTA Y FECHA
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
# CONTAR CITAS CONFIRMADAS DEL MES ACTUAL
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
# ESTADÍSTICA DE SATISFACCIÓN
# ================================
@app.route("/estadisticas/satisfaccion", methods=["GET"])
def estadistica_satisfaccion():
    try:
        conn = get_db()
        cur = conn.cursor()

        # Calcular satisfacción basada en citas confirmadas vs canceladas
        cur.execute("""
            SELECT 
                COUNT(*) FILTER (WHERE estado = 'Confirmada') as confirmadas,
                COUNT(*) FILTER (WHERE estado = 'Cancelada') as canceladas,
                COUNT(*) as total
            FROM citas
            WHERE fecha >= CURRENT_DATE - INTERVAL '30 days'
        """)

        resultado = cur.fetchone()
        cur.close()
        conn.close()

        if resultado[2] > 0:
            satisfaccion = round((resultado[0] / resultado[2]) * 100, 1)
        else:
            satisfaccion = 100.0

        return jsonify({"satisfaccion": satisfaccion})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"}), 200

if __name__ == "__main__":
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
