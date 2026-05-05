-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('ADMIN', 'CLIENTE');

-- CreateEnum
CREATE TYPE "TipoCuenta" AS ENUM ('CORRIENTE', 'AHORRO', 'INVERSION', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoCiclo" AS ENUM ('VIGENTE', 'PAGADO_MIN', 'PAGADO_TOTAL', 'EN_MORA');

-- CreateEnum
CREATE TYPE "Frecuencia" AS ENUM ('UNICA', 'DIARIA', 'SEMANAL', 'QUINCENAL', 'MENSUAL', 'BIMESTRAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL');

-- CreateEnum
CREATE TYPE "EstadoTransaccion" AS ENUM ('PENDIENTE', 'EJECUTADO', 'CANCELADO', 'PROYECTADO', 'PROGRAMADO');

-- CreateEnum
CREATE TYPE "TipoTransaccion" AS ENUM ('GASTO', 'INGRESO', 'TRANSFERENCIA', 'PAGO_DEUDA', 'AJUSTE');

-- CreateEnum
CREATE TYPE "TipoDeuda" AS ENUM ('BANCARIA', 'TARJETA', 'PERSONAL', 'COMERCIAL', 'OTRA');

-- CreateEnum
CREATE TYPE "TipoPlazo" AS ENUM ('FIJO', 'FLEXIBLE');

-- CreateEnum
CREATE TYPE "EstadoDeuda" AS ENUM ('ACTIVA', 'SALDADA', 'EN_MORA', 'RENEGOCIADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "EstadoEvento" AS ENUM ('PLANIFICADO', 'APARTADO', 'EJECUTADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "EstadoPlan" AS ENUM ('BORRADOR', 'ACTIVO', 'CERRADO', 'ARCHIVADO');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rol" "Rol" NOT NULL DEFAULT 'CLIENTE',
    "ultimoLogin" TIMESTAMP(3),
    "intentosFallidos" INTEGER NOT NULL DEFAULT 0,
    "bloqueadoHasta" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "monedaBase" TEXT NOT NULL DEFAULT 'DOP',
    "diaCorteCiclo" INTEGER,
    "configuracion" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CuentaBancaria" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "banco" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "alias" TEXT,
    "tipo" "TipoCuenta" NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'DOP',
    "saldo" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CuentaBancaria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TarjetaCredito" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "banco" TEXT NOT NULL,
    "alias" TEXT,
    "ultimosCuatro" TEXT NOT NULL,
    "limite" DECIMAL(15,2) NOT NULL,
    "saldoActual" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tasaInteres" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "tasaMora" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "diaCorte" INTEGER NOT NULL,
    "diaPago" INTEGER NOT NULL,
    "penalidadSobregiro" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "moneda" TEXT NOT NULL DEFAULT 'DOP',
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TarjetaCredito_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CicloTarjeta" (
    "id" TEXT NOT NULL,
    "tarjetaId" TEXT NOT NULL,
    "fechaCorte" TIMESTAMP(3) NOT NULL,
    "fechaPago" TIMESTAMP(3) NOT NULL,
    "saldoCorte" DECIMAL(15,2) NOT NULL,
    "sobregiro" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "penalidades" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "pagoMinimo" DECIMAL(15,2) NOT NULL,
    "pagoTotal" DECIMAL(15,2) NOT NULL,
    "pagado" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "estado" "EstadoCiclo" NOT NULL DEFAULT 'VIGENTE',

    CONSTRAINT "CicloTarjeta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Categoria" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT,
    "nombre" TEXT NOT NULL,
    "peso" INTEGER NOT NULL DEFAULT 5,
    "color" TEXT,
    "icono" TEXT,
    "esEsencial" BOOLEAN NOT NULL DEFAULT false,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Categoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subcategoria" (
    "id" TEXT NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "peso" INTEGER NOT NULL DEFAULT 5,
    "color" TEXT,
    "icono" TEXT,

    CONSTRAINT "Subcategoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Persona" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "relacion" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "notas" TEXT,

    CONSTRAINT "Persona_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaccion" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "concepto" TEXT NOT NULL,
    "monto" DECIMAL(15,2) NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'DOP',
    "detalle" TEXT,
    "comercio" TEXT,
    "tipo" "TipoTransaccion" NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "subcategoriaId" TEXT NOT NULL,
    "cuentaId" TEXT,
    "tarjetaId" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL,
    "frecuencia" "Frecuencia" NOT NULL,
    "valorRecurrente" DECIMAL(15,2),
    "diaRecurrencia" INTEGER,
    "estado" "EstadoTransaccion" NOT NULL,
    "notas" TEXT,
    "eventoId" TEXT,
    "pagadoPorId" TEXT,
    "porcentajePropio" DECIMAL(5,2) NOT NULL DEFAULT 100,
    "tags" TEXT[],
    "hashImportacion" TEXT,
    "referenciaExterna" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deuda" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "acreedorTexto" TEXT,
    "personaId" TEXT,
    "tipo" "TipoDeuda" NOT NULL,
    "montoOriginal" DECIMAL(15,2) NOT NULL,
    "saldoActual" DECIMAL(15,2) NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'DOP',
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3),
    "tasaInteres" DECIMAL(5,2),
    "tipoPlazo" "TipoPlazo" NOT NULL,
    "numeroCuotas" INTEGER,
    "diaCobro" INTEGER,
    "estado" "EstadoDeuda" NOT NULL DEFAULT 'ACTIVA',
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Deuda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PagoDeuda" (
    "id" TEXT NOT NULL,
    "deudaId" TEXT NOT NULL,
    "monto" DECIMAL(15,2) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoTransaccion" NOT NULL,
    "notas" TEXT,
    "transaccionId" TEXT,

    CONSTRAINT "PagoDeuda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evento" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "recurrente" BOOLEAN NOT NULL DEFAULT false,
    "tipoRecurrencia" TEXT,
    "presupuestoEstimado" DECIMAL(15,2) NOT NULL,
    "rangoMin" DECIMAL(15,2),
    "rangoMax" DECIMAL(15,2),
    "prioridad" INTEGER NOT NULL DEFAULT 3,
    "estado" "EstadoEvento" NOT NULL DEFAULT 'PLANIFICADO',
    "personaId" TEXT,
    "notas" TEXT,

    CONSTRAINT "Evento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehiculo" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "marca" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "mpgRealWorld" DECIMAL(5,2) NOT NULL,
    "margenConsumo" DECIMAL(5,2) NOT NULL DEFAULT 15,
    "fuenteMpg" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Vehiculo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ruta" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "vehiculoId" TEXT,
    "nombre" TEXT NOT NULL,
    "distanciaKm" DECIMAL(8,2) NOT NULL,
    "vecesPorSemana" INTEGER NOT NULL,
    "porcentajePropio" DECIMAL(5,2) NOT NULL DEFAULT 100,
    "activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Ruta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrecioCombustible" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "precio" DECIMAL(8,2) NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'DOP',
    "unidad" TEXT NOT NULL DEFAULT 'galon',
    "fecha" TIMESTAMP(3) NOT NULL,
    "fuente" TEXT,

    CONSTRAINT "PrecioCombustible_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Presupuesto" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Presupuesto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AsignacionPresupuesto" (
    "id" TEXT NOT NULL,
    "presupuestoId" TEXT NOT NULL,
    "subcategoriaId" TEXT NOT NULL,
    "montoAsignado" DECIMAL(15,2) NOT NULL,

    CONSTRAINT "AsignacionPresupuesto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanFinanciero" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT 'v1',
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,
    "proyeccionJson" JSONB NOT NULL,
    "estado" "EstadoPlan" NOT NULL,
    "scoreAdherencia" DECIMAL(5,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cerradoEn" TIMESTAMP(3),

    CONSTRAINT "PlanFinanciero_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TipoCambio" (
    "id" TEXT NOT NULL,
    "monedaBase" TEXT NOT NULL,
    "monedaDestino" TEXT NOT NULL,
    "tasa" DECIMAL(15,6) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "fuente" TEXT,

    CONSTRAINT "TipoCambio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReglaCategorizacion" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "patron" TEXT NOT NULL,
    "esRegex" BOOLEAN NOT NULL DEFAULT false,
    "categoriaId" TEXT NOT NULL,
    "subcategoriaId" TEXT NOT NULL,
    "prioridad" INTEGER NOT NULL DEFAULT 0,
    "activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ReglaCategorizacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Adjunto" (
    "id" TEXT NOT NULL,
    "transaccionId" TEXT,
    "nombreArchivo" TEXT NOT NULL,
    "rutaArchivo" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "tamanoBytes" INTEGER NOT NULL,
    "hash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Adjunto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "scopes" TEXT[],
    "ultimoUso" TIMESTAMP(3),
    "expiraEn" TIMESTAMP(3),
    "revocada" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notificacion" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Webhook" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "eventos" TEXT[],
    "secret" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Webhook_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "CuentaBancaria_clienteId_idx" ON "CuentaBancaria"("clienteId");

-- CreateIndex
CREATE INDEX "TarjetaCredito_clienteId_idx" ON "TarjetaCredito"("clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaccion_hashImportacion_key" ON "Transaccion"("hashImportacion");

-- CreateIndex
CREATE INDEX "Transaccion_clienteId_fecha_idx" ON "Transaccion"("clienteId", "fecha");

-- CreateIndex
CREATE INDEX "Transaccion_estado_idx" ON "Transaccion"("estado");

-- CreateIndex
CREATE INDEX "Transaccion_categoriaId_idx" ON "Transaccion"("categoriaId");

-- CreateIndex
CREATE INDEX "Transaccion_cuentaId_fecha_idx" ON "Transaccion"("cuentaId", "fecha");

-- CreateIndex
CREATE INDEX "Deuda_clienteId_idx" ON "Deuda"("clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "PagoDeuda_transaccionId_key" ON "PagoDeuda"("transaccionId");

-- CreateIndex
CREATE INDEX "PrecioCombustible_fecha_tipo_idx" ON "PrecioCombustible"("fecha", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "TipoCambio_monedaBase_monedaDestino_fecha_key" ON "TipoCambio"("monedaBase", "monedaDestino", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "Notificacion_clienteId_leida_idx" ON "Notificacion"("clienteId", "leida");

-- AddForeignKey
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuentaBancaria" ADD CONSTRAINT "CuentaBancaria_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TarjetaCredito" ADD CONSTRAINT "TarjetaCredito_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CicloTarjeta" ADD CONSTRAINT "CicloTarjeta_tarjetaId_fkey" FOREIGN KEY ("tarjetaId") REFERENCES "TarjetaCredito"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subcategoria" ADD CONSTRAINT "Subcategoria_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Persona" ADD CONSTRAINT "Persona_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaccion" ADD CONSTRAINT "Transaccion_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaccion" ADD CONSTRAINT "Transaccion_subcategoriaId_fkey" FOREIGN KEY ("subcategoriaId") REFERENCES "Subcategoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaccion" ADD CONSTRAINT "Transaccion_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "CuentaBancaria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaccion" ADD CONSTRAINT "Transaccion_tarjetaId_fkey" FOREIGN KEY ("tarjetaId") REFERENCES "TarjetaCredito"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaccion" ADD CONSTRAINT "Transaccion_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "Evento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaccion" ADD CONSTRAINT "Transaccion_pagadoPorId_fkey" FOREIGN KEY ("pagadoPorId") REFERENCES "Persona"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deuda" ADD CONSTRAINT "Deuda_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deuda" ADD CONSTRAINT "Deuda_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "Persona"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagoDeuda" ADD CONSTRAINT "PagoDeuda_deudaId_fkey" FOREIGN KEY ("deudaId") REFERENCES "Deuda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evento" ADD CONSTRAINT "Evento_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evento" ADD CONSTRAINT "Evento_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "Persona"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehiculo" ADD CONSTRAINT "Vehiculo_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ruta" ADD CONSTRAINT "Ruta_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ruta" ADD CONSTRAINT "Ruta_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "Vehiculo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Presupuesto" ADD CONSTRAINT "Presupuesto_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsignacionPresupuesto" ADD CONSTRAINT "AsignacionPresupuesto_presupuestoId_fkey" FOREIGN KEY ("presupuestoId") REFERENCES "Presupuesto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsignacionPresupuesto" ADD CONSTRAINT "AsignacionPresupuesto_subcategoriaId_fkey" FOREIGN KEY ("subcategoriaId") REFERENCES "Subcategoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanFinanciero" ADD CONSTRAINT "PlanFinanciero_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReglaCategorizacion" ADD CONSTRAINT "ReglaCategorizacion_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Adjunto" ADD CONSTRAINT "Adjunto_transaccionId_fkey" FOREIGN KEY ("transaccionId") REFERENCES "Transaccion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacion" ADD CONSTRAINT "Notificacion_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Webhook" ADD CONSTRAINT "Webhook_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
