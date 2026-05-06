-- AlterTable
ALTER TABLE "Persona" ADD COLUMN     "apellido" TEXT,
ADD COLUMN     "tipo" TEXT NOT NULL DEFAULT 'persona';

-- AlterTable
ALTER TABLE "TarjetaCredito" ADD COLUMN     "categoriaTarjeta" TEXT,
ADD COLUMN     "franquicia" TEXT,
ADD COLUMN     "tipoTarjeta" TEXT;
