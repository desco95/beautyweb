-- Database: beautyweb

	CREATE TABLE estilistas (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL
);

CREATE TABLE citas (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios(id),
    servicio VARCHAR(100) NOT NULL,
    estilista int NOT NULL,
    fecha DATE NOT NULL,
    hora TIME NOT NULL,
    notas TEXT,
    estado VARCHAR(20) DEFAULT 'Pendiente'
);

CREATE TABLE servicios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    precio NUMERIC(10,2)
);


INSERT INTO estilistas (nombre) VALUES
('Alejandra Oñate'),
('Jessica - Manicurista'),
('Maribel - Alaciados y pestañas'),
('Lorena - Faciales y pedicura');

INSERT INTO servicios (nombre, precio) VALUES
('Corte de cabello', 150),
('Maquillaje y peinado social', 450),
('Extensiones de pestaña', 200),
('Extensiones de cabello', 200),
('Laminado de ceja', 200),
('Lifting de pestañas', 200),
('Depilación facial (ceja, bozo)', 200),
('Faciales', 200),
('Botox curly ', 200),
('Alaciados progresivos ', 200),
('Acripie', 200),
('Baño de acrílico', 200),
('Gelish', 200),
('Uñas acrílicas', 350),
('Manicure', 180),
('Pedicure', 200);

CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100),
    telefono VARCHAR(20) UNIQUE,
    contrasena BYTEA
);

CREATE TABLE horarios_bloqueados (
    id SERIAL PRIMARY KEY,
    id_estilista INTEGER NOT NULL REFERENCES estilistas(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    motivo TEXT
);


ALTER USER postgres WITH PASSWORD '1234';


