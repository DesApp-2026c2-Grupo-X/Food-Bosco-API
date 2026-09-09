const toNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export const env = {
  port: toNumber(process.env.PORT, 4000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
  internalApiToken: process.env.INTERNAL_API_TOKEN ?? 'dev-internal-token',
  services: {
    auth: process.env.AUTH_SERVICE_URL ?? 'http://localhost:4201',
    commerce: process.env.COMMERCE_SERVICE_URL ?? 'http://localhost:4202',
    delivery: process.env.DELIVERY_SERVICE_URL ?? 'http://localhost:4203',
  },
  throttle: {
    ttlMs: toNumber(process.env.THROTTLE_TTL_MS, 60_000),
    limit: toNumber(process.env.THROTTLE_LIMIT, 100),
  },
}
