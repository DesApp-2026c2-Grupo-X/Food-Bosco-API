jest.mock('dotenv/config', () => ({}))

type Env = (typeof import('./env'))['env']

const MANAGED_KEYS = [
  'PORT',
  'NODE_ENV',
  'JWT_SECRET',
  'INTERNAL_API_TOKEN',
  'AUTH_SERVICE_URL',
  'COMMERCE_SERVICE_URL',
  'DELIVERY_SERVICE_URL',
  'THROTTLE_TTL_MS',
  'THROTTLE_LIMIT',
  'UPLOAD_MAX_SIZE_BYTES',
] as const

type EnvKey = (typeof MANAGED_KEYS)[number]

const loadEnv = (overrides: Partial<Record<EnvKey, string>> = {}): Env => {
  const snapshot = new Map<EnvKey, string | undefined>()

  for (const key of MANAGED_KEYS) {
    snapshot.set(key, process.env[key])
    delete process.env[key]
  }
  Object.assign(process.env, overrides)

  let loaded: Env | undefined
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- recarga aislada para evaluar los defaults de env
    loaded = (require('./env') as typeof import('./env')).env
  })

  for (const key of MANAGED_KEYS) {
    const previous = snapshot.get(key)
    if (previous === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = previous
    }
  }

  return loaded as Env
}

describe('env', () => {
  it('usa los valores por defecto sin variables de entorno', () => {
    const loaded = loadEnv()

    expect(loaded.port).toBe(4000)
    expect(loaded.nodeEnv).toBe('development')
    expect(loaded.jwtSecret).toBe('dev-secret-change-me')
    expect(loaded.internalApiToken).toBe('dev-internal-token')
    expect(loaded.services).toEqual({
      auth: 'http://localhost:4201',
      commerce: 'http://localhost:4202',
      delivery: 'http://localhost:4203',
    })
    expect(loaded.throttle).toEqual({ ttlMs: 60_000, limit: 100 })
    expect(loaded.uploads).toEqual({ maxSizeBytes: 5 * 1024 * 1024 })
  })

  it('toma los valores provistos por el entorno', () => {
    const loaded = loadEnv({
      PORT: '5123',
      NODE_ENV: 'production',
      JWT_SECRET: 'secreto-prod',
      INTERNAL_API_TOKEN: 'token-interno',
      AUTH_SERVICE_URL: 'http://auth:4201',
      COMMERCE_SERVICE_URL: 'http://commerce:4202',
      DELIVERY_SERVICE_URL: 'http://delivery:4203',
      THROTTLE_TTL_MS: '1000',
      THROTTLE_LIMIT: '7',
      UPLOAD_MAX_SIZE_BYTES: '2048',
    })

    expect(loaded.port).toBe(5123)
    expect(loaded.nodeEnv).toBe('production')
    expect(loaded.jwtSecret).toBe('secreto-prod')
    expect(loaded.internalApiToken).toBe('token-interno')
    expect(loaded.services).toEqual({
      auth: 'http://auth:4201',
      commerce: 'http://commerce:4202',
      delivery: 'http://delivery:4203',
    })
    expect(loaded.throttle).toEqual({ ttlMs: 1000, limit: 7 })
    expect(loaded.uploads).toEqual({ maxSizeBytes: 2048 })
  })

  const numericCases: Array<{
    name: string
    override: Partial<Record<EnvKey, string>>
    select: (loaded: Env) => number
    expected: number
  }> = [
    {
      name: 'PORT no numérico → 4000',
      override: { PORT: 'abc' },
      select: (loaded) => loaded.port,
      expected: 4000,
    },
    {
      name: 'PORT vacío → 0 (Number("") === 0)',
      override: { PORT: '' },
      select: (loaded) => loaded.port,
      expected: 0,
    },
    {
      name: 'THROTTLE_LIMIT no numérico → 100',
      override: { THROTTLE_LIMIT: 'NaN' },
      select: (loaded) => loaded.throttle.limit,
      expected: 100,
    },
    {
      name: 'THROTTLE_TTL_MS infinito → 60000',
      override: { THROTTLE_TTL_MS: 'Infinity' },
      select: (loaded) => loaded.throttle.ttlMs,
      expected: 60_000,
    },
    {
      name: 'UPLOAD_MAX_SIZE_BYTES no numérico → 5 MiB',
      override: { UPLOAD_MAX_SIZE_BYTES: 'nope' },
      select: (loaded) => loaded.uploads.maxSizeBytes,
      expected: 5 * 1024 * 1024,
    },
    {
      name: 'THROTTLE_LIMIT negativo se conserva tal cual',
      override: { THROTTLE_LIMIT: '-5' },
      select: (loaded) => loaded.throttle.limit,
      expected: -5,
    },
  ]

  it.each(numericCases)('$name', ({ override, select, expected }) => {
    expect(select(loadEnv(override))).toBe(expected)
  })
})
