-- CreateTable
CREATE TABLE "ProyeccionItem" (
    "id"           TEXT NOT NULL,
    "clienteId"    TEXT NOT NULL,
    "nombre"       TEXT NOT NULL,
    "monto"        DECIMAL(15,2) NOT NULL,
    "tipo"         TEXT NOT NULL DEFAULT 'GASTO',
    "moneda"       TEXT NOT NULL DEFAULT 'DOP',
    "periodicidad" TEXT,
    "categoriaId"  TEXT,
    "notas"        TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProyeccionItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProyeccionItem_clienteId_idx" ON "ProyeccionItem"("clienteId");

-- AddForeignKey
ALTER TABLE "ProyeccionItem"
    ADD CONSTRAINT "ProyeccionItem_clienteId_fkey"
    FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
