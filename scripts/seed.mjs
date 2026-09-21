import { spawn } from 'node:child_process'

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
//  2. auth    (usuarios: super_admin, cliente, repartidor, sucursal)
//  3. delivery(zonas, turnos y perfil del rider, enlazado al usuario de auth)
// El gateway orquesta online vía POST /seed cuando los servicios están levantados.
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
    process.stdout.write(`\n[seed] ${step.name}...\n`)
    await run(step.command, step.args)
  }

  process.stdout.write('\n[seed] semillas completadas\n')
}

runAll().catch((error) => {
  process.stderr.write(
    `\n[seed] ERROR: ${error instanceof Error ? error.message : String(error)}\n`,
  )
  process.exitCode = 1
})
