import 'dotenv/config'

const DEFAULT_JWT_SECRET = 'dev-secret-change-me'
const DEFAULT_INTERNAL_API_TOKEN = 'dev-internal-token'

const toNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const nodeEnv = process.env.NODE_ENV ?? 'development'
const jwtSecret = process.env.JWT_SECRET ?? DEFAULT_JWT_SECRET
const internalApiToken = process.env.INTERNAL_API_TOKEN ?? DEFAULT_INTERNAL_API_TOKEN

const isInsecureSecret = (value: string, devDefault: string): boolean =>
  value.trim() === '' || value === devDefault

if (nodeEnv === 'production') {
  if (isInsecureSecret(jwtSecret, DEFAULT_JWT_SECRET)) {
    // eslint-disable-next-line no-console -- aviso de seguridad en el arranque (no debe romper el deploy)
    console.warn(
      '[env] JWT_SECRET should be set to a secure, non-default value when NODE_ENV=production',
    )
  }
  if (isInsecureSecret(internalApiToken, DEFAULT_INTERNAL_API_TOKEN)) {
    // eslint-disable-next-line no-console -- aviso de seguridad en el arranque (no debe romper el deploy)
    console.warn(
      '[env] INTERNAL_API_TOKEN should be set to a secure, non-default value when NODE_ENV=production',
    )
  }
}

export const env = {
  port: toNumber(process.env.PORT, 4000),
  nodeEnv,
  jwtSecret,
  internalApiToken,
  services: {
    auth: process.env.AUTH_SERVICE_URL ?? 'http://localhost:4201',
    commerce: process.env.COMMERCE_SERVICE_URL ?? 'http://localhost:4202',
    delivery: process.env.DELIVERY_SERVICE_URL ?? 'http://localhost:4203',
  },
  throttle: {
    ttlMs: toNumber(process.env.THROTTLE_TTL_MS, 60_000),
    limit: toNumber(process.env.THROTTLE_LIMIT, 100),
  },
  uploads: {
    maxSizeBytes: toNumber(process.env.UPLOAD_MAX_SIZE_BYTES, 5 * 1024 * 1024),
  },
}
