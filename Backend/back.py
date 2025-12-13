from flask import Flask, request, jsonify
from flask_cors import CORS
import psycopg2
import psycopg2.extras
import bcrypt
from datetime import date, datetime
from datetime import date
import os

app = Flask(__name__)

# CORS configurado para permitir el frontend
CORS(app, resources={
    r"/*": {
        "origins": ["*"],
        "methods": ["GET", "POST", "PUT", "DELETE"],
        "allow_headers": ["Content-Type"]
    }
})

# CONFIG BD - Usa variable de entorno en producción
DATABASE_URL = os.environ.get('DATABASE_URL')

if DATABASE_URL and DATABASE_URL.startswith('postgres://'):
    DATABASE_URL = DATABASE_URL.replace('postgres://', 'postgresql://', 1)

def get_db():
    if DATABASE_URL:
        # Producción (Render)
        return psycopg2.connect(DATABASE_URL, sslmode='require')
    else:
        # Local
        return psycopg2.connect(
            host="localhost",
            database="beautyweb",
            user="postgres",
            password="1234"
        )

# ==================================================
#   REGISTRO DE USUARIO
# ==================================================
@app.route("/registro", methods=["POST"])
def registro():
    data = request.json
    nombre = data["nombre"]
    telefono = data["telefono"]
    contrasena = data["contrasena"]

    try:
        conn = get_db()
        cur = conn.cursor()

        cur.execute("SELECT * FROM usuarios WHERE telefono = %s", (telefono,))
        if cur.fetchone():
            return jsonify({"error": "El número ya está registrado"})

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
        return jsonify({"error": str(e)})


# ==================================================
#   LOGIN DE USUARIO
# ==================================================
@app.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    telefono = data.get("telefono")
    contrasena = data.get("contrasena")

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
#   OBTENER CITAS POR TELÉFONO (CON NOMBRE DE ESTILISTA)
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
        
        # Agregar motivo de rechazo si existe
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
#   OBTENER CITAS
# ================================
@app.route("/citas", methods=["GET"])
def obtener_citas():
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

    cur.execute("""
        SELECT citas.*, estilistas.nombre AS estilista
        FROM citas
        LEFT JOIN estilistas ON citas.id_estilista = estilistas.id
        ORDER BY fecha, hora
    """)

    data = cur.fetchall()
    cur.close()
    conn.close()

    return jsonify([dict(row) for row in data])


# ================================
#   CREAR CITA CON VALIDACIONES
# ================================
@app.route("/agendar", methods=["POST"])
def agendar():
    data = request.get_json()

    usuario_id = data.get("usuario_id")
    servicio = data.get("servicio")
    estilista_id = data.get("estilista")  # Ahora es el ID
    fecha = data.get("fecha")
    hora = data.get("hora")
    notas = data.get("notas")

    conn = get_db()
    cur = conn.cursor()

    try:
        # 1. Verificar que la fecha no sea pasada
        fecha_cita = datetime.strptime(fecha, "%Y-%m-%d").date()
        if fecha_cita < date.today():
            return jsonify({"error": "No puedes agendar citas en fechas pasadas"}), 400

        # 2. Verificar si el estilista está bloqueado ese día
        cur.execute("""
            SELECT id FROM horarios_bloqueados
            WHERE id_estilista = %s AND fecha = %s
        """, (estilista_id, fecha))
        
        if cur.fetchone():
            return jsonify({"error": "El estilista no está disponible en esta fecha"}), 400

        # 3. Verificar si ya hay una cita confirmada en ese horario para ese estilista
        cur.execute("""
            SELECT id FROM citas
            WHERE estilista = %s 
            AND fecha = %s 
            AND hora = %s 
            AND estado IN ('Pendiente', 'Confirmada')
        """, (estilista_id, fecha, hora))
        
        if cur.fetchone():
            return jsonify({"error": "Este horario ya está ocupado para este estilista"}), 400

        # 4. Obtener el nombre del estilista
        cur.execute("SELECT nombre FROM estilistas WHERE id = %s", (estilista_id,))
        estilista_nombre = cur.fetchone()
        
        if not estilista_nombre:
            return jsonify({"error": "Estilista no encontrado"}), 400

        # 5. Insertar la cita con el ID del estilista
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
        return jsonify({"error": str(e)})
    
@app.route("/admin/stylists/add", methods=["POST"])
def add_stylist():
    data = request.json
    nombre = data.get("nombre")

    if not nombre:
        return jsonify({"error": "Nombre requerido"}), 400

    conn = get_db()
    cur = conn.cursor()

    cur.execute("INSERT INTO estilistas (nombre) VALUES (%s) RETURNING id", (nombre,))
    new_id = cur.fetchone()[0]
    conn.commit()

    cur.close()
    conn.close()

    return jsonify({"message": "Estilista agregado", "id": new_id})

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
#   OBTENER CITAS PENDIENTES (CON NOMBRE)
# ================================
@app.route('/citas/pendientes', methods=['GET'])
def citas_pendientes():
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT c.id, c.servicio, e.nombre as estilista, c.fecha, c.hora, c.estado,
               u.nombre AS cliente
        FROM citas c
        JOIN usuarios u ON c.usuario_id = u.id
        LEFT JOIN estilistas e ON c.estilista = e.id
        WHERE c.estado IN ('Pendiente', 'Confirmada')
        ORDER BY c.fecha DESC, c.hora DESC;
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
            "cliente": row[6]
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

    ocupados = [str(r[0])[:-3] for r in cur.fetchall()]  # Formato HH:MM

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


# Ruta de salud para Render
@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"}), 200

# dias bloqueados por estilista
@app.route("/dias_bloqueados/<int:id_estilista>", methods=["GET"])
def obtener_dias_bloqueados(id_estilista):
    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        SELECT fecha
        FROM bloqueos
        WHERE id_estilista = %s
    """, (id_estilista,))

    dias = [r[0].strftime("%Y-%m-%d") for r in cur.fetchall()]

    cur.close()
    conn.close()

    return jsonify(dias)


# ==================================================
#   INICIO DEL SERVIDOR
# ==================================================
if __name__ == "__main__":
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
