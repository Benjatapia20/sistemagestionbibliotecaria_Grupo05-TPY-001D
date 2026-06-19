# Sistema Bibliotecario Resiliente

Plataforma web para la gestión completa de una biblioteca. Permite buscar y reservar libros, administrar préstamos, pagar multas en línea, escanear códigos QR y recibir recomendaciones de un chat con inteligencia artificial.

---

## Versión en línea

El sistema está desplegado y se puede probar sin necesidad de instalar nada:

**[proyectogestionbiblioteca.netlify.app](https://proyectogestionbiblioteca.netlify.app/)**

Esta versión funciona con Supabase como base de datos en la nube y está alojada en Netlify. El chat de asistencia usa GPT-4o-mini a través de GitHub Models.

---

## ¿Qué se necesita para levantar el proyecto?

Se necesita tener instalado en la computadora:

- **Docker Desktop** (o Docker Engine + Docker Compose)
- **Node.js** (versión 22 o superior)

---

## Pasos para correr el proyecto por primera vez

### 1. Clonar el repositorio

```bash
git clone https://github.com/Benjatapia20/sistemagestionbibliotecaria_Grupo05-TPY-001D.git
cd sistemagestionbibliotecaria_Grupo05-TPY-001D\Producto\Código` Fuente\
```

### 2. Instalar las dependencias

```bash
npm install
cd server
npm install
cd ..
```

### 3. Levantar los servicios con Docker

Esto arranca la base de datos, la API, el servidor de archivos y un visor de base de datos:

```bash
docker compose up -d --build
```

La primera vez tarda un poco porque descarga las imágenes y crea la base de datos con datos de prueba. Cuando termine, quedan corriendo estos servicios:

| Servicio         | Dirección              | ¿Para qué sirve?                        |
| ---------------- | ---------------------- | --------------------------------------- |
| Aplicación       | http://localhost:5173  | El sistema en sí (frontend)             |
| API              | http://localhost:3000  | Conexión con la base de datos           |
| Servidor interno | http://localhost:4000  | Archivos, pagos, PDFs y chat            |
| Visor de BD      | http://localhost:8081  | Para ver y editar la base de datos      |

### 4. Arrancar la aplicación en modo desarrollo

```bash
npm run dev
```

Abrir http://localhost:5173 en el navegador y listo.

---

## Usuarios de prueba

El sistema ya viene con tres usuarios cargados para probar:

| Usuario       | Contraseña    | Rol            |
| ------------- | ------------- | -------------- |
| `jperez`      | `password123` | Administrador  |
| `mgonzalez`   | `password123` | Usuario normal |
| `biblio`      | `password123` | Bibliotecario  |

---

## Limpiar la base de datos y volver a empezar

Para borrar todos los datos y dejar la base de datos como nueva:

```bash
npm run db:reset
```

Esto elimina la base de datos, la vuelve a crear y la llena con los datos de prueba.

---

## Servicios extra

### Chat con IA

El chat de asistencia está en el menú lateral.

- **Versión local:** usa **Ollama** con el modelo `qwen2.5:14b`. Se necesita tener Ollama instalado y corriendo. Si no se tiene, el chat no responderá, pero el resto del sistema funciona igual.
- **Versión en línea:** usa **GPT-4o-mini** de OpenAI a través de GitHub Models.

### Pagos con Flow

El sistema usa Flow (pasarela de pagos chilena) en modo sandbox. Para probar los pagos se puede usar la tarjeta de prueba:

- **Número:** 4051885600446623
- **CVV:** 123
- **Fecha de vencimiento:** cualquiera futura

---

## ¿Problemas?

Si algo no arranca:

1. Verificar que Docker esté corriendo.
2. Revisar que los puertos 3000, 4000, 5173 y 5432 no estén ocupados por otra aplicación.
3. Ejecutar `npm run db:reset` para reconstruir todo desde cero.

---

## Estructura resumida del proyecto

```
├── src/                  # Código de la interfaz (React + TypeScript)
│   ├── pages/            # Cada página del sistema
│   ├── components/       # Componentes reutilizables
│   ├── contexts/         # Estados globales (carrito, sesión, etc.)
│   └── lib/              # Conexión con la API y utilidades
├── server/               # Servidor interno (Express)
├── docker/               # Configuración de la base de datos
├── netlify/functions/    # Funciones para producción en Netlify
└── docker-compose.yml    # Orquestación de servicios
```
