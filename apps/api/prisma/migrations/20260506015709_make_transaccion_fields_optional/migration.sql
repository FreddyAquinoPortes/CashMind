-- DropForeignKey
ALTER TABLE "Transaccion" DROP CONSTRAINT "Transaccion_subcategoriaId_fkey";

-- AlterTable
ALTER TABLE "Transaccion" ALTER COLUMN "categoriaId" DROP NOT NULL,
ALTER COLUMN "subcategoriaId" DROP NOT NULL,
ALTER COLUMN "frecuencia" SET DEFAULT 'UNICA';

-- AddForeignKey
ALTER TABLE "Transaccion" ADD CONSTRAINT "Transaccion_subcategoriaId_fkey" FOREIGN KEY ("subcategoriaId") REFERENCES "Subcategoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;
