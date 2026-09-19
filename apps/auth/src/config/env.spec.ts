jest.mock('dotenv/config', () => ({}))

type EnvModule = typeof import('./env')
type Env = EnvModule['env']

const MANAGED_KEYS = [
  'PORT',
  'NODE_ENV',
  'MONGODB_URI',
  'JWT_SECRET',
  'JWT_ACCESS_EXPIRES_IN',
  'JWT_REFRESH_EXPIRES_IN',
  'PASSWORD_RECOVERY_EXPIRES_IN',
  'COMMERCE_SERVICE_URL',
  'INTERNAL_API_TOKEN',
  'SEED_SUPER_ADMIN_EMAIL',
  'SEED_CUSTOMER_EMAIL',
] as const

type ManagedKey = (typeof MANAGED_KEYS)[number]

const original: Partial<Record<ManagedKey, string | undefined>> = {}

const loadEnv = async (values: Partial<Record<ManagedKey, string>> = {}): Promise<Env> => {
  jest.resetModules()
  for (const key of MANAGED_KEYS) {
    delete process.env[key]
  }
  for (const [key, value] of Object.entries(values)) {
    process.env[key] = value
  }
  let loaded: Env | undefined
  jest.isolateModules(() => {
    loaded = (jest.requireActual('./env') as EnvModule).env
  })
  if (!loaded) {
    throw new Error('No se pudo cargar el módulo env')
  }
  return loaded
}

beforeAll(() => {
  for (const key of MANAGED_KEYS) {
    original[key] = process.env[key]
  }
})

afterAll(() => {
  for (const key of MANAGED_KEYS) {
    const value = original[key]
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
})

describe('env — puerto y parseo numérico', () => {
  it.each([
    { name: 'número entero', value: '5000', expected: 5000 },
    { name: 'número con espacios', value: ' 4205 ', expected: 4205 },
    { name: 'número decimal', value: '4201.5', expected: 4201.5 },
    { name: 'valor no numérico usa fallback', value: 'abc', expected: 4201 },
    { name: 'vacío se interpreta como 0', value: '', expected: 0 },
  ])('PORT $name → $expected', async ({ value, expected }) => {
    const env = await loadEnv({ PORT: value })

    expect(env.port).toBe(expected)
  })

  it('usa 4201 cuando PORT no está definido', async () => {
    const env = await loadEnv()

    expect(env.port).toBe(4201)
  })
})

describe('env — duraciones (durationToMs)', () => {
  it.each([
    { name: '500ms', value: '500ms', expected: 500 },
    { name: '45s', value: '45s', expected: 45_000 },
    { name: '30m', value: '30m', expected: 1_800_000 },
    { name: '2h', value: '2h', expected: 7_200_000 },
    { name: '7d', value: '7d', expected: 604_800_000 },
    { name: 'sin unidad asume ms', value: '10', expected: 10 },
    { name: 'con espacios alrededor', value: ' 1h ', expected: 3_600_000 },
    { name: 'cero', value: '0s', expected: 0 },
    { name: 'decimal no soportado cae a 0', value: '1.5h', expected: 0 },
    { name: 'unidad desconocida cae a 0', value: '10w', expected: 0 },
    { name: 'negativo cae a 0', value: '-5m', expected: 0 },
    { name: 'vacío cae a 0', value: '', expected: 0 },
    { name: 'texto cae a 0', value: 'abc', expected: 0 },
  ])('$name → $expected ms', async ({ value, expected }) => {
    const env = await loadEnv({ JWT_REFRESH_EXPIRES_IN: value })

    expect(env.refreshTokenTtlMs).toBe(expected)
  })

  it.each([
    { name: '15m', value: '15m', expected: 900_000 },
    { name: '1h', value: '1h', expected: 3_600_000 },
    { name: '2d', value: '2d', expected: 172_800_000 },
    { name: 'inválido cae a 0', value: 'nope', expected: 0 },
  ])('PASSWORD_RECOVERY_EXPIRES_IN $name → $expected ms', async ({ value, expected }) => {
    const env = await loadEnv({ PASSWORD_RECOVERY_EXPIRES_IN: value })

    expect(env.passwordRecoveryTtlMs).toBe(expected)
  })

  it.each([
    { name: 'refreshTokenTtlMs', pick: (env: Env) => env.refreshTokenTtlMs, expected: 604_800_000 },
    {
      name: 'passwordRecoveryTtlMs',
      pick: (env: Env) => env.passwordRecoveryTtlMs,
      expected: 3_600_000,
    },
  ])('$name usa el TTL por defecto', async ({ pick, expected }) => {
    const env = await loadEnv()

    expect(pick(env)).toBe(expected)
  })
})

describe('env — valores por defecto y override', () => {
  it.each([
    { name: 'jwtSecret', pick: (env: Env) => env.jwtSecret, expected: 'dev-secret-change-me' },
    {
      name: 'mongoUri',
      pick: (env: Env) => env.mongoUri,
      expected: 'mongodb://localhost:27017/fastfood',
    },
    {
      name: 'commerceServiceUrl',
      pick: (env: Env) => env.commerceServiceUrl,
      expected: 'http://localhost:4202',
    },
    {
      name: 'internalApiToken',
      pick: (env: Env) => env.internalApiToken,
      expected: 'dev-internal-token',
    },
    { name: 'nodeEnv', pick: (env: Env) => env.nodeEnv, expected: 'development' },
    {
      name: 'jwtAccessExpiresIn',
      pick: (env: Env) => env.jwtAccessExpiresIn,
      expected: '15m',
    },
  ])('$name usa el valor por defecto', async ({ pick, expected }) => {
    const env = await loadEnv()

    expect(pick(env)).toBe(expected)
  })

  it.each([
    {
      name: 'jwtSecret',
      values: { JWT_SECRET: 'prod-secret' },
      pick: (env: Env) => env.jwtSecret,
      expected: 'prod-secret',
    },
    {
      name: 'mongoUri',
      values: { MONGODB_URI: 'mongodb://db:27017/x' },
      pick: (env: Env) => env.mongoUri,
      expected: 'mongodb://db:27017/x',
    },
    {
      name: 'nodeEnv',
      values: { NODE_ENV: 'production' },
      pick: (env: Env) => env.nodeEnv,
      expected: 'production',
    },
  ])('$name respeta el valor del entorno', async ({ values, pick, expected }) => {
    const env = await loadEnv(values)

    expect(pick(env)).toBe(expected)
  })

  it('expone los seeds por defecto del super_admin y del cliente', async () => {
    const env = await loadEnv()

    expect(env.seed.superAdminEmail).toBe('admin@foodbosco.local')
    expect(env.seed.customerEmail).toBe('cliente@foodbosco.local')
  })

  it('permite override de un seed sin afectar al resto', async () => {
    const env = await loadEnv({ SEED_SUPER_ADMIN_EMAIL: 'root@test.local' })

    expect(env.seed.superAdminEmail).toBe('root@test.local')
    expect(env.seed.customerEmail).toBe('cliente@foodbosco.local')
  })
})
