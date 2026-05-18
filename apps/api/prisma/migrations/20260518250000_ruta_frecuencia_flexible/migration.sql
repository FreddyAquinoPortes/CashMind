-- Replace vecesPorSemana with flexible frequency fields on Ruta
ALTER TABLE "Ruta" ADD COLUMN "frecuenciaValor" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "Ruta" ADD COLUMN "frecuenciaUnidad" TEXT NOT NULL DEFAULT 'semana';
-- Migrate existing data
UPDATE "Ruta" SET "frecuenciaValor" = "vecesPorSemana", "frecuenciaUnidad" = 'semana';
ALTER TABLE "Ruta" DROP COLUMN "vecesPorSemana";
-- Add optional manual rendimiento (for routes without an assigned vehicle)
ALTER TABLE "Ruta" ADD COLUMN "rendimientoManual" DECIMAL(8,2);
ALTER TABLE "Ruta" ADD COLUMN "unidadRendimiento" TEXT NOT NULL DEFAULT 'mpg';
-- Add fechaFin to Evento for bounded recurrence
ALTER TABLE "Evento" ADD COLUMN "fechaFin" TIMESTAMP(3);
