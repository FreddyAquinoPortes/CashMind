ALTER TABLE "ExtraCredito" ADD COLUMN "categoriaId" TEXT;
ALTER TABLE "ExtraCredito" ADD COLUMN "subcategoriaId" TEXT;
ALTER TABLE "PagoExtraCredito" ADD COLUMN "cuentaId" TEXT;
ALTER TABLE "PagoExtraCredito" ADD COLUMN "transaccionId" TEXT;
ALTER TABLE "Evento" ADD COLUMN "extraCreditoId" TEXT;
ALTER TABLE "Evento" ADD COLUMN "numeroCuota" INTEGER;
CREATE UNIQUE INDEX "PagoExtraCredito_transaccionId_key" ON "PagoExtraCredito"("transaccionId");
