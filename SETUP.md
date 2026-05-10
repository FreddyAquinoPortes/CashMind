# CashMind — Guía de Configuración

Guía completa para replicar el entorno de desarrollo en una nueva máquina.

## Requisitos previos

| Herramienta | Versión mínima | Notas |
|---|---|---|
| Node.js | >= 20.0.0 | Recomendado: 20 LTS via [nvm](https://github.com/nvm-sh/nvm) |
| npm | >= 10.0.0 | Incluido con Node 20 |
| PostgreSQL | >= 15.0 | Ver instalación abajo |
| Git | cualquiera | |

## 1. Clonar y dependencias

```bash
git clone https://github.com/FreddyAquinoPortes/CashMind
cd CashMind
npm install
```

## 2. Instalar PostgreSQL

### Windows (recomendado: winget)

```powershell
winget install --id PostgreSQL.PostgreSQL.16 --accept-source-agreements --accept-package-agreements
```

El instalador de winget crea automáticamente el servicio de Windows y arranca PostgreSQL en el puerto 5432.

**Contraseña del superusuario postgres:** la que ingresas durante la instalación (el instalador winget usa `postgres` por defecto).

### macOS

```bash
brew install postgresql@16
brew services start postgresql@16
```

### Linux (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install postgresql-16
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

## 3. Crear base de datos y usuario

Conéctate como superusuario `postgres` y ejecuta:

```sql
-- Conectar: psql -U postgres -h localhost
CREATE DATABASE cashmind ENCODING 'UTF8';
CREATE USER cashmind WITH PASSWORD 'cashmind123';
GRANT ALL PRIVILEGES ON DATABASE cashmind TO cashmind;
ALTER DATABASE cashmind OWNER TO cashmind;
ALTER USER cashmind CREATEDB;   -- necesario para shadow DB de Prisma
```

**Script SQL directo (guarda como `init_db.sql` y ejecuta):**

```bash
psql -U postgres -h localhost -f init_db.sql
```

Contenido de `init_db.sql`:

```sql
CREATE DATABASE cashmind ENCODING 'UTF8';
CREATE USER cashmind WITH PASSWORD 'cashmind123' CREATEDB;
GRANT ALL PRIVILEGES ON DATABASE cashmind TO cashmind;
ALTER DATABASE cashmind OWNER TO cashmind;
```

## 4. Variables de entorno

```bash
copy apps\api\.env.example apps\api\.env   # Windows
cp apps/api/.env.example apps/api/.env     # macOS/Linux
```

El archivo `.env` de la API (`apps/api/.env`) debe contener:

```env
DATABASE_URL="postgresql://cashmind:cashmind123@localhost:5432/cashmind"
JWT_SECRET="cashmind-jwt-secret-dev-2026-min-32-chars"
JWT_REFRESH_SECRET="cashmind-refresh-secret-dev-2026-min-32-chars"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"
API_PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

> ⚠️ En producción cambia `JWT_SECRET` y `JWT_REFRESH_SECRET` por strings aleatorios de 64+ caracteres.

## 5. Migraciones y seed

```bash
# 1. Generar cliente Prisma
npm run db:generate

# 2. Aplicar migraciones (crea las 25 tablas)
cd apps/api
npx prisma migrate dev --name init
cd ../..

# 3. Poblar datos iniciales (categorías + usuario demo + datos de prueba)
npm run db:seed
```

### Migraciones existentes (orden de aplicación)

| Migración | Descripción |
|---|---|
| `20260505214350_initial_schema` | Schema base completo (25 tablas) |
| `20260506004151_add_tarjeta_franquicia_persona_tipo` | Campos franquicia en TarjetaCredito y tipo en Persona |
| `20260506015709_make_transaccion_fields_optional` | Campos opcionales en Transaccion |
| `20260506030631_add_deuda_concepto` | Campo concepto en Deuda |
| `20260510043554_schema_sync` | Sincronización de schema con ajustes finales |

Si quieres aplicar solo las migraciones existentes sin generar nuevas (recomendado en CI/producción):

```bash
cd apps/api
npx prisma migrate deploy
```

## 6. Build del paquete compartido

```bash
npm run build --workspace=packages/shared
```

Esto compila los schemas Zod compartidos entre frontend y backend.

## 7. Arrancar servidores de desarrollo

```bash
# Terminal 1: API (puerto 3001)
cd apps/api && npm run dev

# Terminal 2: Frontend (puerto 5173)
cd apps/web && npm run dev
```

O desde la raíz del monorepo (levanta ambos con concurrently):

```bash
npm run dev
```

## 8. Verificar instalación

```bash
# API health
curl http://localhost:3001/api/health

# Login de prueba
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"freddy@cashmind.local","password":"CashMind2026!"}'
```

Respuesta esperada del health:
```json
{"status":"ok","timestamp":"...","version":"0.1.0"}
```

## Credenciales demo

| Campo | Valor |
|---|---|
| Email | `freddy@cashmind.local` |
| Contraseña | `CashMind2026!` |
| Rol | ADMIN |
| Cliente | Freddy Alejandro Aquino Portes (DOP) |

## Estructura de la base de datos (resumen)

25 tablas en el schema `public`:

```
Usuario            — Usuarios del sistema (auth)
Cliente            — Perfiles de cliente por usuario
CuentaBancaria     — Cuentas bancarias
TarjetaCredito     — Tarjetas de crédito
CicloTarjeta       — Ciclos de corte de tarjetas
Categoria          — Categorías globales (seed) y personalizadas
Subcategoria       — Subcategorías anidadas
Persona            — Personas/entidades vinculadas al cliente
Transaccion        — Registro de movimientos financieros
Deuda              — Deudas bancarias y personales
PagoDeuda          — Historial de pagos de deudas
Evento             — Eventos especiales y compromisos
Vehiculo           — Vehículos para calculadora de combustible
Ruta               — Rutas recurrentes del vehículo
PrecioCombustible  — Historial de precios de gasolina
Presupuesto        — Presupuestos por período
AsignacionPresupuesto — Asignaciones por categoría
PlanFinanciero     — Planes guardados
TipoCambio         — Tasas de cambio
ReglaCategorizacion — Reglas de categorización automática
Adjunto            — Archivos adjuntos
ApiKey             — Claves de API
Notificacion       — Centro de notificaciones
Webhook            — Webhooks de integración
_prisma_migrations — Control de versiones de migraciones
```

## Solución de problemas

### Error: `Cannot find module '@cashmind/shared/dist/index.js'`
```bash
npm run build --workspace=packages/shared
```

### Error: `P3014 — shadow database permission`
```sql
ALTER USER cashmind CREATEDB;
```

### Error: `FATAL: could not create any TCP/IP sockets`
Otro proceso ocupa el puerto 5432. En Windows:
```powershell
netstat -ano | findstr "5432"
# El PID que aparece es el proceso. Si es otro PostgreSQL, usar ese.
```

### PostgreSQL no está en el PATH (Windows)
```powershell
$env:PATH += ";C:\Program Files\PostgreSQL\16\bin"
```

Agregar permanentemente: Panel de control → Variables de entorno → PATH → agregar `C:\Program Files\PostgreSQL\16\bin`

## Comandos útiles

```bash
npm run db:generate     # Regenerar cliente Prisma
npm run db:migrate      # Crear + aplicar nueva migración
npm run db:seed         # Repoblar datos iniciales
npm run db:studio       # Abrir Prisma Studio (GUI de DB)
npm run lint            # Verificar código
npm run format          # Formatear con Prettier
npm run build           # Build de producción (shared + api + web)
```
