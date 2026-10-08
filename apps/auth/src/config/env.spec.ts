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
  'PASSWORD_RECOVERY_MIN_INTERVAL',
  'COMMERCE_SERVICE_URL',
  'INTERNAL_API_TOKEN',
  'EMAIL_PROVIDER',
  'EMAIL_FROM',
  'RESEND_API_KEY',
  'STORE_URL',
  'ADMIN_URL',
  'BRANCH_URL',
  'RIDER_URL',
  'PASSWORD_RESET_PATH',
  'SEED_SUPER_ADMIN_PASSWORD',
  'SEED_CUSTOMER_PASSWORD',
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
    { name: '30s', value: '30s', expected: 30_000 },
    { name: '2m', value: '2m', expected: 120_000 },
    { name: 'inválido cae a 0', value: 'nope', expected: 0 },
  ])('PASSWORD_RECOVERY_MIN_INTERVAL $name → $expected ms', async ({ value, expected }) => {
    const env = await loadEnv({ PASSWORD_RECOVERY_MIN_INTERVAL: value })

    expect(env.passwordRecoveryMinIntervalMs).toBe(expected)
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
      values: {
        NODE_ENV: 'production',
        JWT_SECRET: 'prod-secret',
        INTERNAL_API_TOKEN: 'prod-internal-token',
      },
      pick: (env: Env) => env.nodeEnv,
      expected: 'production',
    },
  ])('$name respeta el valor del entorno', async ({ values, pick, expected }) => {
    const env = await loadEnv(values)

    expect(pick(env)).toBe(expected)
  })

  it('expone las contraseñas de seed por defecto', async () => {
    const env = await loadEnv()

    expect(env.seed.superAdminPassword).toBe('Admin123!')
    expect(env.seed.customerPassword).toBe('Cliente123!')
  })

  it('permite override de una contraseña de seed sin afectar al resto', async () => {
    const env = await loadEnv({ SEED_SUPER_ADMIN_PASSWORD: 'Root123!' })

    expect(env.seed.superAdminPassword).toBe('Root123!')
    expect(env.seed.customerPassword).toBe('Cliente123!')
  })
})

describe('env — configuración de email', () => {
  it('usa el proveedor "log" por defecto (sin envíos reales)', async () => {
    const env = await loadEnv()

    expect(env.email.provider).toBe('log')
    expect(env.email.resendApiKey).toBe('')
    expect(env.email.from).toBe('Food Bosco <no-reply@foodbosco.local>')
    expect(env.email.frontendUrls).toEqual({
      customer: 'http://localhost:5173',
      super_admin: 'http://localhost:5174',
      branch_admin: 'http://localhost:5175',
      rider: 'http://localhost:5176',
    })
    expect(env.email.passwordResetPath).toBe('/reset-password')
  })

  it('usa 60s como intervalo mínimo por defecto', async () => {
    const env = await loadEnv()

    expect(env.passwordRecoveryMinIntervalMs).toBe(60_000)
  })

  it('respeta la configuración provista por entorno', async () => {
    const env = await loadEnv({
      EMAIL_PROVIDER: 'resend',
      EMAIL_FROM: 'No Reply <no-reply@foodbosco.com>',
      RESEND_API_KEY: 'sk_test',
      STORE_URL: 'https://foodbosco.com',
      ADMIN_URL: 'https://admin.foodbosco.com',
      BRANCH_URL: 'https://sucursal.foodbosco.com',
      RIDER_URL: 'https://rider.foodbosco.com',
      PASSWORD_RESET_PATH: '/auth/reset',
      PASSWORD_RECOVERY_MIN_INTERVAL: '30s',
    })

    expect(env.email.provider).toBe('resend')
    expect(env.email.from).toBe('No Reply <no-reply@foodbosco.com>')
    expect(env.email.resendApiKey).toBe('sk_test')
    expect(env.email.frontendUrls).toEqual({
      customer: 'https://foodbosco.com',
      super_admin: 'https://admin.foodbosco.com',
      branch_admin: 'https://sucursal.foodbosco.com',
      rider: 'https://rider.foodbosco.com',
    })
    expect(env.email.passwordResetPath).toBe('/auth/reset')
    expect(env.passwordRecoveryMinIntervalMs).toBe(30_000)
  })
})

describe('env — secretos en producción (Security)', () => {
  let warn: jest.SpyInstance

  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warn.mockRestore()
  })

  it('advierte si JWT_SECRET e INTERNAL_API_TOKEN usan los defaults de desarrollo', async () => {
    const env = await loadEnv({ NODE_ENV: 'production' })

    expect(env.nodeEnv).toBe('production')
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/JWT_SECRET y INTERNAL_API_TOKEN/))
  })

  it('advierte si sólo INTERNAL_API_TOKEN conserva el default', async () => {
    await loadEnv({ NODE_ENV: 'production', JWT_SECRET: 'prod-secret' })

    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/INTERNAL_API_TOKEN/))
  })

  it('advierte si sólo JWT_SECRET conserva el default', async () => {
    await loadEnv({ NODE_ENV: 'production', INTERNAL_API_TOKEN: 'prod-internal-token' })

    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/JWT_SECRET/))
  })

  it('permite el arranque en producción con secretos propios', async () => {
    const env = await loadEnv({
      NODE_ENV: 'production',
      JWT_SECRET: 'prod-secret',
      INTERNAL_API_TOKEN: 'prod-internal-token',
    })

    expect(env.nodeEnv).toBe('production')
    expect(env.jwtSecret).toBe('prod-secret')
    expect(env.internalApiToken).toBe('prod-internal-token')
    expect(warn).not.toHaveBeenCalled()
  })

  it.each([
    {
      name: 'JWT_SECRET vacío',
      values: {
        NODE_ENV: 'production',
        JWT_SECRET: '',
        INTERNAL_API_TOKEN: 'prod-internal-token',
      },
      expected: /JWT_SECRET/,
    },
    {
      name: 'JWT_SECRET con sólo espacios',
      values: {
        NODE_ENV: 'production',
        JWT_SECRET: '   ',
        INTERNAL_API_TOKEN: 'prod-internal-token',
      },
      expected: /JWT_SECRET/,
    },
    {
      name: 'INTERNAL_API_TOKEN vacío',
      values: {
        NODE_ENV: 'production',
        JWT_SECRET: 'prod-secret',
        INTERNAL_API_TOKEN: '',
      },
      expected: /INTERNAL_API_TOKEN/,
    },
    {
      name: 'INTERNAL_API_TOKEN con sólo espacios',
      values: {
        NODE_ENV: 'production',
        JWT_SECRET: 'prod-secret',
        INTERNAL_API_TOKEN: '   ',
      },
      expected: /INTERNAL_API_TOKEN/,
    },
  ])('advierte en producción con $name', async ({ values, expected }) => {
    await loadEnv(values)

    expect(warn).toHaveBeenCalledWith(expect.stringMatching(expected))
  })

  it.each(['development', 'test'])(
    'no falla con secretos vacíos en NODE_ENV=%s',
    async (nodeEnv) => {
      const env = await loadEnv({
        NODE_ENV: nodeEnv,
        JWT_SECRET: '',
        INTERNAL_API_TOKEN: '   ',
      })

      expect(env.jwtSecret).toBe('')
      expect(env.internalApiToken).toBe('   ')
    },
  )

  it('mantiene los defaults en desarrollo', async () => {
    const env = await loadEnv({ NODE_ENV: 'development' })

    expect(env.jwtSecret).toBe('dev-secret-change-me')
    expect(env.internalApiToken).toBe('dev-internal-token')
  })

  it('mantiene los defaults en test', async () => {
    const env = await loadEnv({ NODE_ENV: 'test' })

    expect(env.jwtSecret).toBe('dev-secret-change-me')
    expect(env.internalApiToken).toBe('dev-internal-token')
  })
})
