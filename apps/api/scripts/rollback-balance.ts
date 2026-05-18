/**
 * Rollback script — finds the last INGRESO/GASTO transaction for
 * ing.dev.aquino@gmail.com and reverts its account balance effect.
 *
 * Usage:  npx ts-node scripts/rollback-balance.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // 1. Find the user → cliente → accounts
  const usuario = await prisma.usuario.findUnique({
    where: { email: 'ing.dev.aquino@gmail.com' },
    include: { clientes: { include: { cuentas: true } } },
  })

  if (!usuario) {
    console.error('❌ Usuario not found')
    process.exit(1)
  }

  const cliente = usuario.clientes[0]
  if (!cliente) {
    console.error('❌ No cliente for this user')
    process.exit(1)
  }

  console.log(`✅ Cliente: ${cliente.id}`)
  console.log('Cuentas:')
  cliente.cuentas.forEach(c => console.log(`  ${c.id}  ${c.alias ?? c.banco}  saldo=${c.saldo}`))

  // 2. Find the last transaction that affected an account balance
  const lastTx = await prisma.transaccion.findFirst({
    where: {
      clienteId: cliente.id,
      cuentaId: { not: null },
      tipo: { in: ['INGRESO', 'GASTO'] },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (!lastTx) {
    console.error('❌ No qualifying transaction found')
    process.exit(1)
  }

  const revertDelta = lastTx.tipo === 'INGRESO' ? -Number(lastTx.monto) : Number(lastTx.monto)

  console.log(`\nLast tx: [${lastTx.tipo}] "${lastTx.concepto}" monto=${lastTx.monto}`)
  console.log(`Revert delta on cuenta ${lastTx.cuentaId}: ${revertDelta > 0 ? '+' : ''}${revertDelta}`)

  // 3. Show current saldo before revert
  const cuentaAntes = await prisma.cuentaBancaria.findUnique({ where: { id: lastTx.cuentaId! } })
  console.log(`\nSaldo ANTES: ${cuentaAntes?.saldo}`)

  // 4. Apply revert
  const cuentaDespues = await prisma.cuentaBancaria.update({
    where: { id: lastTx.cuentaId! },
    data: { saldo: { increment: revertDelta } },
  })

  console.log(`Saldo DESPUÉS: ${cuentaDespues.saldo}`)
  console.log('\n✅ Rollback aplicado. La transacción NO fue eliminada — solo se revirtió el saldo.')
  console.log('   Si quieres eliminarla también, hazlo manualmente o desde el UI.')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
