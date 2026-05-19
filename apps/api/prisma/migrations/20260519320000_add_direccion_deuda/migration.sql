-- CreateEnum
CREATE TYPE "DireccionDeuda" AS ENUM ('DEBO_YO', 'ME_DEBEN');

-- AlterTable: add direccion, cuentaOrigenId, tarjetaOrigenId to Deuda
ALTER TABLE "Deuda" ADD COLUMN "direccion" "DireccionDeuda" NOT NULL DEFAULT 'DEBO_YO';
ALTER TABLE "Deuda" ADD COLUMN "cuentaOrigenId" TEXT;
ALTER TABLE "Deuda" ADD COLUMN "tarjetaOrigenId" TEXT;
