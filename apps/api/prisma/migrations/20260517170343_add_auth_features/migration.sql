-- DropForeignKey
ALTER TABLE "AsignacionPresupuesto" DROP CONSTRAINT "AsignacionPresupuesto_presupuestoId_fkey";

-- AlterTable
ALTER TABLE "Presupuesto" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "emailVerificado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mfaBackupCodes" TEXT[],
ADD COLUMN     "mfaHabilitado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mfaSecret" TEXT;

-- CreateTable
CREATE TABLE "TokenVerificacion" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiraEn" TIMESTAMP(3) NOT NULL,
    "usado" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TokenVerificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SesionActiva" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "dispositivo" TEXT,
    "ip" TEXT,
    "ultimaActividad" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SesionActiva_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CuentaOAuth" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "proveedor" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "email" TEXT,
    "nombre" TEXT,
    "avatar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CuentaOAuth_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TokenVerificacion_token_key" ON "TokenVerificacion"("token");

-- CreateIndex
CREATE INDEX "TokenVerificacion_token_idx" ON "TokenVerificacion"("token");

-- CreateIndex
CREATE INDEX "TokenVerificacion_usuarioId_tipo_idx" ON "TokenVerificacion"("usuarioId", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "SesionActiva_refreshToken_key" ON "SesionActiva"("refreshToken");

-- CreateIndex
CREATE INDEX "SesionActiva_usuarioId_idx" ON "SesionActiva"("usuarioId");

-- CreateIndex
CREATE INDEX "CuentaOAuth_usuarioId_idx" ON "CuentaOAuth"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "CuentaOAuth_proveedor_proveedorId_key" ON "CuentaOAuth"("proveedor", "proveedorId");

-- CreateIndex
CREATE INDEX "Presupuesto_clienteId_idx" ON "Presupuesto"("clienteId");

-- AddForeignKey
ALTER TABLE "TokenVerificacion" ADD CONSTRAINT "TokenVerificacion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SesionActiva" ADD CONSTRAINT "SesionActiva_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuentaOAuth" ADD CONSTRAINT "CuentaOAuth_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
