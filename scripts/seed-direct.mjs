import { spawn } from 'node:child_process'

/**
 * Seed directo a Mongo: sólo datos maestros, sin pedidos ni clientes demo.
 * No requiere los servicios levantados, pero NO es equivalente a POST /seed.
 * Para el seed completo usá `npm run seed`.
 */
const run = (command, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', shell: true })
    child.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`${command} ${args.join(' ')} salió con código ${code}`))
      }
    })
  })

// Orden correcto de dependencias:
//  1. commerce (categorías, ingredientes, sucursales, productos, parámetros)
//  2. auth    (usuarios: super_admin, cliente, repartidor)
//  3. delivery(zonas, turnos y perfil del rider, enlazado al usuario de auth)
const steps = [
  {
    name: 'seed-utils (build)',
    command: 'npm',
    args: ['run', 'build', '--workspace', '@repo/seed-utils'],
  },
  { name: 'commerce', command: 'npm', args: ['run', 'seed', '--workspace', '@repo/commerce'] },
  { name: 'auth', command: 'npm', args: ['run', 'seed', '--workspace', '@repo/auth'] },
  { name: 'delivery', command: 'npm', args: ['run', 'seed', '--workspace', '@repo/delivery'] },
]

const runAll = async () => {
  for (const step of steps) {
    process.stdout.write(`\n[seed:direct] ${step.name}...\n`)
    await run(step.command, step.args)
  }

  process.stdout.write('\n[seed:direct] semillas maestras completadas\n')
}

runAll().catch((error) => {
  process.stderr.write(
    `\n[seed:direct] ERROR: ${error instanceof Error ? error.message : String(error)}\n`,
  )
  process.exitCode = 1
})
