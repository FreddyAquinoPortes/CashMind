-- AlterTable
ALTER TABLE "TarjetaCredito" ADD COLUMN     "dobleBalance" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "limiteSecundario" DECIMAL(15,2),
ADD COLUMN     "monedaSecundaria" TEXT,
ADD COLUMN     "saldoSecundario" DECIMAL(15,2);
