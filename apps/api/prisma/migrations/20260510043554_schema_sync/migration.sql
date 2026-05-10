-- AlterTable
ALTER TABLE "Evento" ADD COLUMN     "moneda" TEXT NOT NULL DEFAULT 'DOP',
ADD COLUMN     "tipo" TEXT NOT NULL DEFAULT 'PAGO_PROGRAMADO',
ALTER COLUMN "presupuestoEstimado" SET DEFAULT 0;

-- CreateIndex
CREATE INDEX "Evento_clienteId_fecha_idx" ON "Evento"("clienteId", "fecha");
