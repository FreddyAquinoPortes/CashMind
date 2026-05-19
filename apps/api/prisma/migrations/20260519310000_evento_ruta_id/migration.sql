-- Add rutaId to Evento so events created from a route can be linked back
ALTER TABLE "Evento" ADD COLUMN "rutaId" TEXT;

ALTER TABLE "Evento" ADD CONSTRAINT "Evento_rutaId_fkey"
  FOREIGN KEY ("rutaId") REFERENCES "Ruta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Evento_rutaId_idx" ON "Evento"("rutaId");
