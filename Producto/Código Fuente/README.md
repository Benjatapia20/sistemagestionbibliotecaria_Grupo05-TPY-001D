# 📚 Sistema de Gestión Bibliotecaria Resiliente (Guía de Instalación en Windows)

Este sistema está diseñado para funcionar tanto en la nube (Supabase) como de forma local (Docker), garantizando que la biblioteca nunca deje de operar aunque se caiga el internet.

## 🛠️ Requisitos Previos

Antes de empezar, debes instalar las siguientes herramientas en Windows:

1.  **Node.js (Versión 18 o superior)**: [Descargar aquí](https://nodejs.org/)
2.  **Docker Desktop**: [Descargar aquí](https://www.docker.com/products/docker-desktop/) (Asegúrate de que esté abierto y corriendo).

---

## 🚀 Pasos para la Instalación

### 1. Clonar el proyecto e instalar dependencias
Abre una terminal (PowerShell o CMD) en la carpeta donde quieras el proyecto:

```bash
# Entrar a la carpeta del código fuente
cd "Producto/Código Fuente"

# Instalar dependencias (Usamos --force por compatibilidad de versiones)
npm install --force
```

### 2. Levantar el Servidor Local (Docker)
El sistema necesita una base de datos y un servidor de imágenes local.
1.  Abre otra terminal y navega a: `Producto/Base de Datos/biblio-server`
2.  Ejecuta el siguiente comando para levantar los contenedores:
    ```bash
    docker compose up -d
    ```
    *Esto activará Postgres (DB), PostgREST (API), Adminer (Gestión) e Imágenes.*

### 3. Configurar la Base de Datos
Una vez que Docker esté corriendo:
1.  Entra a **Adminer** desde tu navegador: `http://localhost:8080`
2.  Loguéate con estos datos:
    *   **Sistema**: PostgreSQL
    *   **Servidor**: `db`
    *   **Usuario**: `admin`
    *   **Contraseña**: `pwa_password`
    *   **Base de Datos**: `biblioteca`
3.  Haz clic en **"Comando SQL"** y pega el siguiente código para crear la tabla y dar permisos:

```sql
-- 1. Crear el rol web_anon si no existe
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'web_anon') THEN
    CREATE ROLE web_anon NOLOGIN;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO web_anon;

-- 2. Crear Tabla de Libros
CREATE TABLE IF NOT EXISTS libros (
    id SERIAL PRIMARY KEY,
    titulo TEXT NOT NULL,
    autor TEXT,
    isbn TEXT,
    genero TEXT,
    stock INTEGER DEFAULT 0,
    caratula TEXT,        -- Guarda rutas relativas (/caratulas/...)
    caratula_url TEXT     -- Guarda URLs de Supabase
);

-- 3. Dar Permisos
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE libros TO web_anon;
GRANT USAGE, SELECT ON SEQUENCE libros_id_seq TO web_anon;
```

### 4. Configurar Variables de Entorno (.env)
En la carpeta `Producto/Código Fuente`, crea un archivo `.env` con el siguiente contenido:

```env
VITE_SUPABASE_URL=tu_url_de_supabase
VITE_SUPABASE_ANON_KEY=tu_llave_anon_de_supabase

# Configuración Local (Si entras desde otro PC, usa tu IP en lugar de localhost)
VITE_LOCAL_API_URL=http://localhost:3000
VITE_IMAGES_URL=http://localhost:3001
```

---

## 💻 Ejecución

Para iniciar el sistema en modo desarrollo:
```bash
npm run dev
```
El sistema será accesible en `http://localhost:5173`.

---

## 📱 Instalación como App (PWA)
Para que aparezca el botón "Instalar" en el navegador:
1.  Debes acceder a través de `localhost` o usar una conexión **HTTPS**.
2.  Si accedes por la IP desde otro computador o móvil, el navegador podría no mostrar el botón de instalar por políticas de seguridad (requiere HTTPS), pero el sistema será funcional desde el navegador.
