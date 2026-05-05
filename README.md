# CashMind

App de escritorio Windows para finanzas personales multi-cliente.  
Stack: Electron + React 18 + TypeScript + Vite + TailwindCSS + Express + PostgreSQL + Prisma.

## Requisitos previos

- Node.js >= 20
- PostgreSQL 15 corriendo en localhost:5432
- npm >= 10

## Inicio rapido

```bash
# 1. Instalar dependencias
npm install

# 2. Variables de entorno
copy apps\api\.env.example apps\api\.env

# 3. Migrar DB y poblar seed
npm run db:generate
npm run db:migrate
npm run db:seed

# 4. Arrancar API + Web
npm run dev
```

## Credenciales demo

- Email: `freddy@cashmind.local`
- Password: `CashMind2026!`

## Estructura

```
apps/api/     Express API + Prisma
apps/web/     React + Vite frontend
electron/     Electron shell
packages/shared/  Zod schemas + tipos compartidos
```

## Fases

- Fase 1 Fundacion: monorepo, tema verde dark, auth, layout
- Fase 2 CRUD: categorias, cuentas, tarjetas, transacciones
- Fase 3 Deudas, tarjetas, eventos
- Fase 4 Combustible, gastos compartidos
- Fase 5 Proyecciones financieras
- Fase 6 Dashboard charts, reportes PDF/DOCX
- Fase 7 Importacion PDF bancos (Banreservas)
- Fase 8 Multi-moneda, backup, webhooks
- Fase 9 Tests E2E, empaquetado .exe
