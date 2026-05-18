-- Migration: add categoriaId/subcategoriaId to Deuda + VehiculoCatalogo model

-- Add optional category fields to Deuda
ALTER TABLE "Deuda" ADD COLUMN "categoriaId" TEXT;
ALTER TABLE "Deuda" ADD COLUMN "subcategoriaId" TEXT;

-- VehiculoCatalogo: global read-only catalog for common vehicles
CREATE TABLE "VehiculoCatalogo" (
    "id"           TEXT NOT NULL,
    "marca"        TEXT NOT NULL,
    "modelo"       TEXT NOT NULL,
    "anoDesde"     INTEGER NOT NULL,
    "anoHasta"     INTEGER,
    "motor"        TEXT,
    "transmision"  TEXT,
    "combustible"  TEXT NOT NULL DEFAULT 'Regular',
    "mpgCiudad"    DECIMAL(5,2) NOT NULL,
    "mpgCarretera" DECIMAL(5,2) NOT NULL,
    "mpgCombinado" DECIMAL(5,2) NOT NULL,
    "fuente"       TEXT,
    CONSTRAINT "VehiculoCatalogo_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VehiculoCatalogo_marca_modelo_idx" ON "VehiculoCatalogo"("marca", "modelo");

-- Add catalogoId to Vehiculo (optional FK to catalog)
ALTER TABLE "Vehiculo" ADD COLUMN "catalogoId" TEXT;

ALTER TABLE "Vehiculo"
    ADD CONSTRAINT "Vehiculo_catalogoId_fkey"
    FOREIGN KEY ("catalogoId") REFERENCES "VehiculoCatalogo"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
