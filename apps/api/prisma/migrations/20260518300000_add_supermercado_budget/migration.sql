-- Add supermercado flag to Presupuesto
ALTER TABLE "Presupuesto" ADD COLUMN "esSupermercado" BOOLEAN NOT NULL DEFAULT false;

-- Add external product data to LineaPresupuesto (stores supermercadosrd.com product info)
ALTER TABLE "LineaPresupuesto" ADD COLUMN "productoExterno" JSONB;
