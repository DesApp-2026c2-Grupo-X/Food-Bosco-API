import 'dotenv/config'

const toNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export const env = {
  port: toNumber(process.env.PORT, 4202),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  mongoUri: process.env.MONGODB_URI ?? 'mongodb://localhost:27017/fastfood',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
  internalApiToken: process.env.INTERNAL_API_TOKEN ?? 'dev-internal-token',
  brokerUrl: process.env.BROKER_URL ?? '',
  seed: {
    maxDistanceKm: toNumber(process.env.SEED_PARAM_MAX_DISTANCE_KM, 10),
    basePrepMin: toNumber(process.env.SEED_PARAM_BASE_PREP_MIN, 15),
    avgSpeedKmh: toNumber(process.env.SEED_PARAM_AVG_SPEED_KMH, 25),
  },
}
