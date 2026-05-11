-- Migration: presupuesto_lineas_ejecucion + tipo_atomico
-- Adds EstadoPresupuesto, TipoPresupuesto enums, extends Presupuesto,
-- creates LineaPresupuesto (with incluido) and EjecucionLinea

-- 1. Enums
CREATE TYPE "EstadoPresupuesto" AS ENUM ('BORRADOR', 'ACTIVO', 'CERRADO');
CREATE TYPE "TipoLineaPresupuesto" AS ENUM ('INGRESO', 'GASTO');
CREATE TYPE "TipoPresupuesto" AS ENUM ('NORMAL', 'ATOMICO');

-- 2. Extend Presupuesto
ALTER TABLE "Presupuesto"
  ADD COLUMN "tipo"      "TipoPresupuesto"   NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN "estado"    "EstadoPresupuesto"  NOT NULL DEFAULT 'BORRADOR',
  ADD COLUMN "notas"     TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 3. LineaPresupuesto
CREATE TABLE "LineaPresupuesto" (
  "id"             TEXT NOT NULL,
  "presupuestoId"  TEXT NOT NULL,
  "tipo"           "TipoLineaPresupuesto" NOT NULL,
  "concepto"       TEXT NOT NULL,
  "categoriaId"    TEXT,
  "subcategoriaId" TEXT,
  "montoPlaneado"  DECIMAL(15,2) NOT NULL,
  "notas"          TEXT,
  "orden"          INTEGER NOT NULL DEFAULT 0,
  "incluido"       BOOLEAN NOT NULL DEFAULT true,
  "eventoId"       TEXT,
  "deudaId"        TEXT,
  "rutaId"         TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LineaPresupuesto_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "LineaPresupuesto"
  ADD CONSTRAINT "LineaPresupuesto_presupuestoId_fkey"
    FOREIGN KEY ("presupuestoId") REFERENCES "Presupuesto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "LineaPresupuesto_presupuestoId_idx" ON "LineaPresupuesto"("presupuestoId");

-- 4. EjecucionLinea
CREATE TABLE "EjecucionLinea" (
  "id"             TEXT NOT NULL,
  "lineaId"        TEXT NOT NULL,
  "montoEjecutado" DECIMAL(15,2) NOT NULL,
  "fecha"          TIMESTAMP(3) NOT NULL,
  "notas"          TEXT,
  "eventoId"       TEXT,
  "transaccionId"  TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EjecucionLinea_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "EjecucionLinea"
  ADD CONSTRAINT "EjecucionLinea_lineaId_fkey"
    FOREIGN KEY ("lineaId") REFERENCES "LineaPresupuesto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "EjecucionLinea_lineaId_idx" ON "EjecucionLinea"("lineaId");
