import 'dotenv/config'
import type { Role } from './constants'

const toNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const durationToMs = (value: string): number => {
  const match = /^(\d+)\s*(ms|s|m|h|d)?$/.exec(value.trim())
  if (!match) {
    return 0
  }

  const amount = Number(match[1])
  const unit = match[2] ?? 'ms'
  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  }

  return amount * (multipliers[unit] ?? 1)
}

const DEV_DEFAULTS = {
  jwtSecret: 'dev-secret-change-me',
  internalApiToken: 'dev-internal-token',
} as const

const nodeEnv = process.env.NODE_ENV ?? 'development'
const jwtSecret = process.env.JWT_SECRET ?? DEV_DEFAULTS.jwtSecret
const internalApiToken = process.env.INTERNAL_API_TOKEN ?? DEV_DEFAULTS.internalApiToken

const isInsecureSecret = (value: string, devDefault: string): boolean =>
  value.trim() === '' || value === devDefault

const assertSecureProductionSecrets = (): void => {
  if (nodeEnv !== 'production') {
    return
  }

  const insecureKeys = [
    isInsecureSecret(jwtSecret, DEV_DEFAULTS.jwtSecret) ? 'JWT_SECRET' : null,
    isInsecureSecret(internalApiToken, DEV_DEFAULTS.internalApiToken) ? 'INTERNAL_API_TOKEN' : null,
  ].filter((key): key is string => key !== null)

  if (insecureKeys.length > 0) {
    throw new Error(
      `Configuración insegura en producción: ${insecureKeys.join(' y ')} no puede(n) quedar vacío(s) ni usar el valor por defecto de desarrollo`,
    )
  }
}

assertSecureProductionSecrets()

export const env = {
  port: toNumber(process.env.PORT, 4201),
  nodeEnv,
  mongoUri: process.env.MONGODB_URI ?? 'mongodb://localhost:27017/fastfood',
  jwtSecret,
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
  refreshTokenTtlMs: durationToMs(process.env.JWT_REFRESH_EXPIRES_IN ?? '7d'),
  passwordRecoveryTtlMs: durationToMs(process.env.PASSWORD_RECOVERY_EXPIRES_IN ?? '1h'),
  passwordRecoveryMinIntervalMs: durationToMs(process.env.PASSWORD_RECOVERY_MIN_INTERVAL ?? '60s'),
  commerceServiceUrl: process.env.COMMERCE_SERVICE_URL ?? 'http://localhost:4202',
  internalApiToken,
  email: {
    provider: process.env.EMAIL_PROVIDER ?? 'log',
    from: process.env.EMAIL_FROM ?? 'Food Bosco <no-reply@foodbosco.local>',
    resendApiKey: process.env.RESEND_API_KEY ?? '',
    passwordResetPath: process.env.PASSWORD_RESET_PATH ?? '/reset-password',
    frontendUrls: {
      customer: process.env.STORE_URL ?? 'http://localhost:5173',
      super_admin: process.env.ADMIN_URL ?? 'http://localhost:5174',
      branch_admin: process.env.BRANCH_URL ?? 'http://localhost:5175',
      rider: process.env.RIDER_URL ?? 'http://localhost:5176',
    } satisfies Record<Role, string>,
  },
  seed: {
    superAdminPassword: process.env.SEED_SUPER_ADMIN_PASSWORD ?? 'Admin123!',
    customerPassword: process.env.SEED_CUSTOMER_PASSWORD ?? 'Cliente123!',
    branchAdminPassword: process.env.SEED_BRANCH_ADMIN_PASSWORD ?? 'Sucursal123!',
    riderPassword: process.env.SEED_RIDER_PASSWORD ?? 'Repartidor123!',
  },
}
