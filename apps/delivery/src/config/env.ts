import 'dotenv/config'

const toNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const DEV_JWT_SECRET = 'dev-secret-change-me'
const DEV_INTERNAL_API_TOKEN = 'dev-internal-token'

const nodeEnv = process.env.NODE_ENV ?? 'development'
const jwtSecret = process.env.JWT_SECRET ?? DEV_JWT_SECRET
const internalApiToken = process.env.INTERNAL_API_TOKEN ?? DEV_INTERNAL_API_TOKEN

const isInsecureSecret = (value: string, devDefault: string): boolean =>
  value.trim() === '' || value === devDefault

const assertProductionSecrets = (): void => {
  if (nodeEnv !== 'production') {
    return
  }

  const insecure = [
    ...(isInsecureSecret(jwtSecret, DEV_JWT_SECRET) ? ['JWT_SECRET'] : []),
    ...(isInsecureSecret(internalApiToken, DEV_INTERNAL_API_TOKEN) ? ['INTERNAL_API_TOKEN'] : []),
  ]

  if (insecure.length > 0) {
    // eslint-disable-next-line no-console -- aviso de seguridad en el arranque (no debe romper el deploy)
    console.warn(
      `[env] Configuración insegura en producción: definí ${insecure.join(' y ')} con valores propios (no los defaults de desarrollo ni vacíos).`,
    )
  }
}

assertProductionSecrets()

export const env = {
  port: toNumber(process.env.PORT, 4203),
  nodeEnv,
  mongoUri: process.env.MONGODB_URI ?? 'mongodb://localhost:27017/fastfood',
  jwtSecret,
  authServiceUrl: process.env.AUTH_SERVICE_URL ?? 'http://localhost:4201',
  commerceServiceUrl: process.env.COMMERCE_SERVICE_URL ?? 'http://localhost:4202',
  internalApiToken,
  brokerUrl: process.env.BROKER_URL ?? '',
  rider: {
    staleAfterMs: toNumber(process.env.RIDER_STALE_AFTER_MS, 300_000),
  },
  offer: {
    ttlSeconds: toNumber(process.env.OFFER_TTL_SECONDS, 30),
    sameRiderCooldownSeconds: toNumber(process.env.SAME_RIDER_COOLDOWN_SECONDS, 45),
    earningsBase: toNumber(process.env.EARNINGS_BASE, 500),
    earningsPerKm: toNumber(process.env.EARNINGS_PER_KM, 200),
    earningsPerOrder: toNumber(process.env.EARNINGS_PER_ORDER, 300),
    maxMatchDistanceKm: toNumber(process.env.MAX_MATCH_DISTANCE_KM, 8),
    avgSpeedKmh: toNumber(process.env.AVG_SPEED_KMH, 25),
    maxOrdersPerTrip: toNumber(process.env.MAX_ORDERS_PER_TRIP, 3),
  },
}
