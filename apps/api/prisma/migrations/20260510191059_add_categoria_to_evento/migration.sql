-- AlterTable
ALTER TABLE "Evento" ADD COLUMN     "categoriaId" TEXT,
ADD COLUMN     "subcategoriaId" TEXT;

-- AddForeignKey
ALTER TABLE "Evento" ADD CONSTRAINT "Evento_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evento" ADD CONSTRAINT "Evento_subcategoriaId_fkey" FOREIGN KEY ("subcategoriaId") REFERENCES "Subcategoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;
