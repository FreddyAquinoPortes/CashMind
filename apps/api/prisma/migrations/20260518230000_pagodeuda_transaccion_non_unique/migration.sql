-- Drop the unique constraint on PagoDeuda.transaccionId so one transaction
-- can pay multiple debts (multi-debt payment distribution feature)

DROP INDEX IF EXISTS "PagoDeuda_transaccionId_key";

-- Create a regular index for query performance
CREATE INDEX IF NOT EXISTS "PagoDeuda_transaccionId_idx" ON "PagoDeuda"("transaccionId");
