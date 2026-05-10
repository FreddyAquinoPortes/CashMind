-- AlterTable
ALTER TABLE "Ruta" ADD COLUMN     "tipoCombustible" TEXT NOT NULL DEFAULT 'Regular';

-- CreateTable
CREATE TABLE "VehiculoRendimiento" (
    "id" TEXT NOT NULL,
    "vehiculoId" TEXT NOT NULL,
    "tipoCombustible" TEXT NOT NULL,
    "rendimiento" DECIMAL(6,2) NOT NULL,
    "unidad" TEXT NOT NULL DEFAULT 'mpg',
    "margenConsumo" DECIMAL(5,2) NOT NULL DEFAULT 15,
    "fuente" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehiculoRendimiento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VehiculoRendimiento_vehiculoId_idx" ON "VehiculoRendimiento"("vehiculoId");

-- CreateIndex
CREATE UNIQUE INDEX "VehiculoRendimiento_vehiculoId_tipoCombustible_key" ON "VehiculoRendimiento"("vehiculoId", "tipoCombustible");

-- AddForeignKey
ALTER TABLE "VehiculoRendimiento" ADD CONSTRAINT "VehiculoRendimiento_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "Vehiculo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
