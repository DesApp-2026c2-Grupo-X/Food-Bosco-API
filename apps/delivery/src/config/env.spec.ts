jest.mock('dotenv/config', () => ({}))

type EnvModule = typeof import('./env')
type Env = EnvModule['env']

const MANAGED_KEYS = [
  'PORT',
  'NODE_ENV',
  'MONGODB_URI',
  'JWT_SECRET',
  'AUTH_SERVICE_URL',
  'COMMERCE_SERVICE_URL',
  'INTERNAL_API_TOKEN',
  'BROKER_URL',
  'RIDER_STALE_AFTER_MS',
  'OFFER_TTL_SECONDS',
  'SAME_RIDER_COOLDOWN_SECONDS',
  'EARNINGS_BASE',
  'EARNINGS_PER_KM',
  'EARNINGS_PER_ORDER',
  'MAX_MATCH_DISTANCE_KM',
  'AVG_SPEED_KMH',
  'MAX_ORDERS_PER_TRIP',
] as const

type ManagedKey = (typeof MANAGED_KEYS)[number]

const original: Partial<Record<ManagedKey, string | undefined>> = {}

const resetProcessEnv = (values: Partial<Record<ManagedKey, string>> = {}): void => {
  jest.resetModules()
  for (const key of MANAGED_KEYS) {
    delete process.env[key]
  }
  for (const [key, value] of Object.entries(values)) {
    process.env[key] = value
  }
}

const loadEnv = async (values: Partial<Record<ManagedKey, string>> = {}): Promise<Env> => {
  resetProcessEnv(values)
  let loaded: Env | undefined
  jest.isolateModules(() => {
    loaded = (jest.requireActual('./env') as EnvModule).env
  })
  if (!loaded) {
    throw new Error('No se pudo cargar el módulo env')
  }
  return loaded
}

const loadEnvError = (values: Partial<Record<ManagedKey, string>> = {}): Error => {
  resetProcessEnv(values)
  try {
    jest.isolateModules(() => {
      jest.requireActual('./env')
    })
  } catch (error) {
    return error as Error
  }
  throw new Error('Se esperaba un error al cargar env')
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

describe('env — defaults en desarrollo/test', () => {
  it('usa los valores por defecto sin exigir secretos de producción', async () => {
    const env = await loadEnv()

    expect(env.port).toBe(4203)
    expect(env.nodeEnv).toBe('development')
    expect(env.jwtSecret).toBe('dev-secret-change-me')
    expect(env.internalApiToken).toBe('dev-internal-token')
    expect(env.mongoUri).toBe('mongodb://localhost:27017/fastfood')
    expect(env.brokerUrl).toBe('')
  })

  it('en NODE_ENV=test mantiene los defaults de dev (no falla el arranque)', async () => {
    const env = await loadEnv({ NODE_ENV: 'test' })

    expect(env.nodeEnv).toBe('test')
    expect(env.jwtSecret).toBe('dev-secret-change-me')
    expect(env.internalApiToken).toBe('dev-internal-token')
  })

  it.each([
    { name: 'PORT', values: { PORT: '5000' }, pick: (env: Env) => env.port, expected: 5000 },
    {
      name: 'PORT no numérico usa fallback',
      values: { PORT: 'abc' },
      pick: (env: Env) => env.port,
      expected: 4203,
    },
    {
      name: 'OFFER_TTL_SECONDS',
      values: { OFFER_TTL_SECONDS: '90' },
      pick: (env: Env) => env.offer.ttlSeconds,
      expected: 90,
    },
    {
      name: 'RIDER_STALE_AFTER_MS',
      values: { RIDER_STALE_AFTER_MS: '1000' },
      pick: (env: Env) => env.rider.staleAfterMs,
      expected: 1000,
    },
  ])('parsea $name desde el entorno', async ({ values, pick, expected }) => {
    const env = await loadEnv(values)

    expect(pick(env)).toBe(expected)
  })
})

describe('seguridad — secretos inseguros en producción', () => {
  it.each([
    { name: 'ambos defaults', values: {}, missing: ['JWT_SECRET', 'INTERNAL_API_TOKEN'] },
    {
      name: 'JWT_SECRET default',
      values: { INTERNAL_API_TOKEN: 'prod-token' },
      missing: ['JWT_SECRET'],
    },
    {
      name: 'INTERNAL_API_TOKEN default',
      values: { JWT_SECRET: 'prod-secret' },
      missing: ['INTERNAL_API_TOKEN'],
    },
    {
      name: 'JWT_SECRET vacío',
      values: { JWT_SECRET: '', INTERNAL_API_TOKEN: 'prod-token' },
      missing: ['JWT_SECRET'],
    },
    {
      name: 'JWT_SECRET con sólo espacios',
      values: { JWT_SECRET: '   ', INTERNAL_API_TOKEN: 'prod-token' },
      missing: ['JWT_SECRET'],
    },
    {
      name: 'INTERNAL_API_TOKEN vacío',
      values: { JWT_SECRET: 'prod-secret', INTERNAL_API_TOKEN: '' },
      missing: ['INTERNAL_API_TOKEN'],
    },
    {
      name: 'INTERNAL_API_TOKEN con sólo espacios',
      values: { JWT_SECRET: 'prod-secret', INTERNAL_API_TOKEN: '   ' },
      missing: ['INTERNAL_API_TOKEN'],
    },
  ])('falla el arranque con $name', ({ values, missing }) => {
    const error = loadEnvError({ ...values, NODE_ENV: 'production' })

    expect(error).toBeInstanceOf(Error)
    expect(error.message).toContain('insegura en producción')
    for (const key of missing) {
      expect(error.message).toContain(key)
    }
  })

  it('arranca en producción con secretos propios', async () => {
    const env = await loadEnv({
      NODE_ENV: 'production',
      JWT_SECRET: 'prod-secret',
      INTERNAL_API_TOKEN: 'prod-token',
    })

    expect(env.nodeEnv).toBe('production')
    expect(env.jwtSecret).toBe('prod-secret')
    expect(env.internalApiToken).toBe('prod-token')
  })
})
