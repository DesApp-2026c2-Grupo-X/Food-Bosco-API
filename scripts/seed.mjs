/**
 * Seed completo de la plataforma.
 *
 * Llama a POST /seed del gateway: exactamente el mismo camino que Postman.
 * Requiere MongoDB y los 4 servicios levantados (`npm run dev`).
 *
 * Uso:
 *   npm run seed
 *   npm run seed -- --orders 300 --days 90 --seed 42
 *   npm run seed -- --reset
 *   npm run seed -- --no-demo
 */
const DEFAULT_URL = 'http://localhost:4000'
const DEFAULT_TOKEN = 'dev-internal-token'

const printHelp = () => {
  process.stdout.write(`
Uso: npm run seed [-- opciones]

Opciones:
  --orders <n>    Pedidos a generar en esta corrida (default 150)
  --days <n>      Ventana histórica en días (default 120)
  --customers <n> Clientes demo (default: bolsa curada de 24; máx. 500)
  --seed <n>      Semilla para reproducir el mismo lote
  --reset         Borra los lotes demo anteriores antes de generar
  --no-demo       Sólo datos maestros (sin clientes ni pedidos demo)
  --url <url>     URL del gateway (default ${DEFAULT_URL})
  --token <token> Token interno (default INTERNAL_API_TOKEN o ${DEFAULT_TOKEN})
  --help          Muestra esta ayuda

Ejemplos:
  npm run seed
  npm run seed -- --orders 300 --days 90 --seed 42
  npm run seed -- --customers 80
  npm run seed -- --reset
  npm run seed -- --no-demo

Para sólo datos maestros sin servicios: npm run seed:direct
`)
}

const parseArgs = (argv) => {
  const options = {
    url: process.env.SEED_GATEWAY_URL ?? DEFAULT_URL,
    token: process.env.INTERNAL_API_TOKEN ?? DEFAULT_TOKEN,
    body: {},
    help: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const [flag, inlineValue] = arg.split('=')
    const takeValue = () => {
      if (inlineValue !== undefined) return inlineValue
      index += 1
      return argv[index]
    }

    switch (flag) {
      case '--url':
        options.url = takeValue()
        break
      case '--token':
        options.token = takeValue()
        break
      case '--orders':
        options.body.orders = Number(takeValue())
        break
      case '--days':
        options.body.days = Number(takeValue())
        break
      case '--customers':
        options.body.clients = Number(takeValue())
        break
      case '--seed':
        options.body.seed = Number(takeValue())
        break
      case '--reset':
        options.body.reset = true
        break
      case '--demo':
        options.body.demo = true
        break
      case '--no-demo':
        options.body.demo = false
        break
      case '--help':
        options.help = true
        break
      default:
        if (flag.startsWith('--')) {
          throw new Error(`Opción desconocida: ${flag}. Usá --help para ver las opciones.`)
        }
    }
  }

  for (const key of ['orders', 'days', 'seed', 'clients']) {
    if (key in options.body && !Number.isFinite(options.body[key])) {
      throw new Error(`--${key} debe ser un número`)
    }
  }

  return options
}

const main = async () => {
  const options = parseArgs(process.argv.slice(2))

  if (options.help) {
    printHelp()
    return
  }

  const url = `${options.url.replace(/\/$/, '')}/seed`

  process.stdout.write(`\n[seed] POST ${url}\n`)
  if (Object.keys(options.body).length > 0) {
    process.stdout.write(`[seed] body ${JSON.stringify(options.body)}\n`)
  }

  let response

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'x-internal-token': options.token,
        'content-type': 'application/json',
      },
      body: JSON.stringify(options.body),
    })
  } catch {
    process.stderr.write(`\n[seed] ERROR: no pude conectarme al gateway en ${options.url}.\n`)
    process.stderr.write(
      '[seed] Levantá los servicios con `npm run dev` o usá `npm run seed:direct` para sólo maestros.\n',
    )
    process.exitCode = 1
    return
  }

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    process.stderr.write(`\n[seed] ERROR HTTP ${response.status}\n`)
    process.stderr.write(`${JSON.stringify(payload, null, 2)}\n`)
    process.exitCode = 1
    return
  }

  process.stdout.write('\n[seed] listo\n')

  const demo = payload?.demo
  if (demo) {
    process.stdout.write(
      `[seed] pedidos demo: ${demo.orders} · clientes: ${demo.customers} · lote: ${demo.batchId ?? '—'}` +
        `${demo.resetDeleted ? ` · lotes borrados: ${demo.resetDeleted}` : ''}\n`,
    )
  }

  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`)
}

main().catch((error) => {
  process.stderr.write(
    `\n[seed] ERROR: ${error instanceof Error ? error.message : String(error)}\n`,
  )
  process.exitCode = 1
})
