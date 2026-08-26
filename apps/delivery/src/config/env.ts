import 'dotenv/config'

const toNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export const env = {
  port: toNumber(process.env.PORT, 4203),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  mongoUri: process.env.MONGODB_URI ?? 'mongodb://localhost:27017/fastfood',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
  authServiceUrl: process.env.AUTH_SERVICE_URL ?? 'http://localhost:4201',
  commerceServiceUrl: process.env.COMMERCE_SERVICE_URL ?? 'http://localhost:4202',
  internalApiToken: process.env.INTERNAL_API_TOKEN ?? 'dev-internal-token',
  brokerUrl: process.env.BROKER_URL ?? '',
  offer: {
    ttlSeconds: toNumber(process.env.OFFER_TTL_SECONDS, 30),
    earningsBase: toNumber(process.env.EARNINGS_BASE, 500),
    earningsPerKm: toNumber(process.env.EARNINGS_PER_KM, 200),
    earningsPerOrder: toNumber(process.env.EARNINGS_PER_ORDER, 300),
    maxMatchDistanceKm: toNumber(process.env.MAX_MATCH_DISTANCE_KM, 8),
    avgSpeedKmh: toNumber(process.env.AVG_SPEED_KMH, 25),
    maxOrdersPerTrip: toNumber(process.env.MAX_ORDERS_PER_TRIP, 3),
  },
}
