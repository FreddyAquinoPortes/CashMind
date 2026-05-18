-- CreateEnum
CREATE TYPE "EstadoExtraCredito" AS ENUM ('ACTIVO', 'PAGADO', 'EN_MORA', 'CANCELADO');

-- AlterTable
ALTER TABLE "TarjetaCredito" ADD COLUMN     "tieneExtraCredito" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ExtraCredito" (
    "id" TEXT NOT NULL,
    "tarjetaId" TEXT NOT NULL,
    "descripcion" TEXT,
    "montoOriginal" DECIMAL(15,2) NOT NULL,
    "saldoPendiente" DECIMAL(15,2) NOT NULL,
    "tasaInteres" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "numeroCuotas" INTEGER NOT NULL,
    "cuotasPagadas" INTEGER NOT NULL DEFAULT 0,
    "montoCuota" DECIMAL(15,2) NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "diaPago" INTEGER NOT NULL,
    "estado" "EstadoExtraCredito" NOT NULL DEFAULT 'ACTIVO',
    "moneda" TEXT NOT NULL DEFAULT 'DOP',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtraCredito_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PagoExtraCredito" (
    "id" TEXT NOT NULL,
    "extraCreditoId" TEXT NOT NULL,
    "monto" DECIMAL(15,2) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PagoExtraCredito_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExtraCredito_tarjetaId_idx" ON "ExtraCredito"("tarjetaId");

-- AddForeignKey
ALTER TABLE "ExtraCredito" ADD CONSTRAINT "ExtraCredito_tarjetaId_fkey" FOREIGN KEY ("tarjetaId") REFERENCES "TarjetaCredito"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagoExtraCredito" ADD CONSTRAINT "PagoExtraCredito_extraCreditoId_fkey" FOREIGN KEY ("extraCreditoId") REFERENCES "ExtraCredito"("id") ON DELETE CASCADE ON UPDATE CASCADE;
