# Instrucciones de Migración y Despliegue

## Paso 1: Reiniciar base de datos local (Docker)

### Opción A: Base de datos nueva (recomendado para desarrollo)

```bash
# Detener Docker
docker compose down

# Eliminar volumen de datos (¡CUIDADO: borra todos los datos!)
docker volume rm codigo_fuente_postgres_data

# Reiniciar
docker compose up -d

# Esperar 10 segundos a que PostgreSQL inicie
sleep 10

# El esquema se carga automáticamente al iniciar
```

### Opción B: Migrar datos existentes

```bash
# 1. Abrir Adminer (http://localhost:8080)
# 2. Conectar a la base de datos local
# 3. Ejecutar el script: sql/migrar_a_usuarios.sql
```

## Paso 2: Reiniciar PostgREST

```bash
docker compose restart api
```

## Paso 3: Verificar base de datos local

Abrir Adminer (http://localhost:8080) y verificar:

1. La tabla `usuarios` existe
2. El usuario admin existe:
   ```sql
   SELECT * FROM usuarios WHERE username = 'admin';
   ```
3. La función `login_local` existe:
   ```sql
   SELECT * FROM login_local('admin', '$2b$10$iB2jJLSMw9Bk228GEYtBP.ZaNZAvuMLquOW8WrGf4kvxSE/5gkkoe');
   ```

## Paso 4: Actualizar Supabase (si usas nube)

1. Abrir Supabase Dashboard → SQL Editor
2. Ejecutar: `sql/esquema_supabase_completo.sql`
3. Si ya tienes datos, ejecutar primero:
   ```sql
   -- Migrar profiles a usuarios
   INSERT INTO public.usuarios (id, email, rol, tipo_auth, auth_ref_id)
   SELECT p.id, u.email, p.rol, 'supabase', p.id::text
   FROM public.profiles p
   LEFT JOIN auth.users u ON u.id = p.id
   WHERE p.id NOT IN (SELECT id FROM public.usuarios);
   ```

## Paso 5: Probar la aplicación

### Login local (admin)
- Usuario: `admin`
- Contraseña: `admin123`

### Registro local
1. Ir a Login → "¿No tienes cuenta? Regístrate aquí"
2. Ingresar nombre de usuario (sin @)
3. Ingresar contraseña
4. Iniciar sesión con las credenciales creadas

### Verificar detección de rol
1. Iniciar sesión como admin
2. Ir a Settings
3. Debe mostrar "Admin" en verde
4. Deben aparecer los botones de sincronización y "Nuevo Libro"

### Verificar préstamos
1. Ir a Catálogo
2. Solicitar préstamo de un libro
3. Como admin, ir a Préstamos y aprobar/rechazar

### Verificar favoritos
1. Ir a Catálogo
2. Agregar libros a favoritos
3. Ir a Favoritos y verificar que aparecen

## Solución de problemas

### Error: "Usuario no encontrado"
- Verificar que la tabla `usuarios` tenga datos
- Ejecutar en Adminer: `SELECT * FROM usuarios;`

### Error: "infinite recursion detected in policy for relation profiles"
- Ejecutar en Supabase: `ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;`

### Error: "new row violates row-level security policy"
- Verificar que el usuario tenga sesión de Supabase activa
- Para sync, el usuario debe estar verificado con email

### Error: PostgREST no responde
- Reiniciar: `docker compose restart api`
- Verificar logs: `docker compose logs api`

## Estructura de la base de datos

```
usuarios (tabla principal)
├── id (UUID) ← fuente primaria para FKs
├── username
├── email
├── password (solo local)
├── rol (admin/usuario)
├── tipo_auth (local/supabase)
└── auth_ref_id (referencia a Supabase)

favoritos
└── usuario_id → usuarios.id (UUID)

prestamos
└── usuario_id → usuarios.id (UUID)

cuentas_temporales (legacy)
└── usuario_id → usuarios.id (UUID)

profiles (legacy, RLS deshabilitado)
└── usuario_id → usuarios.id (UUID)
```
