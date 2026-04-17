# Sistema de Gestión Bibliotecaria Resiliente

Este es un proyecto en fase de **desarrollo activo**. Se trata de un sistema moderno para la gestión de bibliotecas con un enfoque principal en la **resiliencia**.

El objetivo de este sistema es garantizar la continuidad operativa completa: si la conexión a internet falla, el sistema seguirá funcionando localmente sin interrupciones, sincronizando los datos una vez que se restablezca la conexión.

## 🚀 Tecnologías Utilizadas

### Frontend
- **React 19:** Biblioteca principal para la construcción de interfaces de usuario.
- **TypeScript:** Para un tipado estricto y un código más seguro.
- **Vite:** Herramienta de construcción y entorno de desarrollo de alta velocidad.
- **Tailwind CSS v4:** Framework de CSS basado en utilidades para un diseño rápido, responsivo y moderno.
- **Lucide React:** Colección de iconos limpios y consistentes.
- **PWA (Progressive Web App):** Configurado a través de `vite-plugin-pwa` para permitir la instalación de la app y el soporte offline en el cliente.

### Backend y Base de Datos
- **Supabase:** Plataforma Backend-as-a-Service (BaaS) utilizada como base de datos principal en la nube y para la gestión de autenticación.
- **PostgreSQL (Local / Docker):** Se utilizará un servidor de PostgreSQL levantado mediante contenedores de Docker para garantizar la persistencia de datos y el funcionamiento del sistema en redes locales cuando no haya conexión a internet.

## 🏗️ Estado Actual del Proyecto

El proyecto se encuentra en sus etapas iniciales de desarrollo. Hasta la fecha, se han implementado las siguientes características principales de infraestructura y UI:

- Configuración inicial del stack (React + TypeScript + Vite + Tailwind).
- Integración del cliente de Supabase.
- Creación de un sistema de autenticación de base.
- Implementación del soporte para modo Oscuro/Claro.
- Maquetado base del Panel de Control (Dashboard), que actualmente incluye marcadores para estadísticas en tiempo real (Libros disponibles, Préstamos activos) y un indicador de estado de conexión (Online/Offline).

**Próximas fases de desarrollo:**
1. Configuración de la base de datos local en Docker (PostgreSQL).
2. Lógica de sincronización bidireccional entre Supabase en la nube y la base de datos local.
3. Desarrollo de los módulos del catálogo de libros (CRUD).
4. Desarrollo de la lógica de préstamos y devoluciones.

## 💻 Desarrollo

Para levantar este proyecto de manera local, asegúrate de tener instaladas las dependencias:

```bash
npm install
```

Luego, puedes inicializar el servidor de desarrollo en la dirección local:

```bash
npm run dev
```

*(Nota: Posteriormente se requerirán comandos adicionales para desplegar el contenedor de Docker con la BD local).*
