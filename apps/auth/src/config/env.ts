import 'dotenv/config'

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

export const env = {
  port: toNumber(process.env.PORT, 4201),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  mongoUri: process.env.MONGODB_URI ?? 'mongodb://localhost:27017/fastfood',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
  refreshTokenTtlMs: durationToMs(process.env.JWT_REFRESH_EXPIRES_IN ?? '7d'),
  passwordRecoveryTtlMs: durationToMs(process.env.PASSWORD_RECOVERY_EXPIRES_IN ?? '1h'),
  commerceServiceUrl: process.env.COMMERCE_SERVICE_URL ?? 'http://localhost:4202',
  internalApiToken: process.env.INTERNAL_API_TOKEN ?? 'dev-internal-token',
  seed: {
    superAdminEmail: process.env.SEED_SUPER_ADMIN_EMAIL ?? 'admin@foodbosco.local',
    superAdminPassword: process.env.SEED_SUPER_ADMIN_PASSWORD ?? 'Admin123!',
    superAdminFirstName: process.env.SEED_SUPER_ADMIN_FIRST_NAME ?? 'Super',
    superAdminLastName: process.env.SEED_SUPER_ADMIN_LAST_NAME ?? 'Admin',
    superAdminPhone: process.env.SEED_SUPER_ADMIN_PHONE ?? '0000000000',
    customerEmail: process.env.SEED_CUSTOMER_EMAIL ?? 'cliente@foodbosco.local',
    customerPassword: process.env.SEED_CUSTOMER_PASSWORD ?? 'Cliente123!',
    customerFirstName: process.env.SEED_CUSTOMER_FIRST_NAME ?? 'Cliente',
    customerLastName: process.env.SEED_CUSTOMER_LAST_NAME ?? 'Demo',
    customerPhone: process.env.SEED_CUSTOMER_PHONE ?? '1111111111',
    branchAdminEmail: process.env.SEED_BRANCH_ADMIN_EMAIL ?? 'sucursal@foodbosco.local',
    branchAdminPassword: process.env.SEED_BRANCH_ADMIN_PASSWORD ?? 'Sucursal123!',
    branchAdminFirstName: process.env.SEED_BRANCH_ADMIN_FIRST_NAME ?? 'Julián',
    branchAdminLastName: process.env.SEED_BRANCH_ADMIN_LAST_NAME ?? 'Sosa',
    branchAdminPhone: process.env.SEED_BRANCH_ADMIN_PHONE ?? '2222222222',
    riderEmail: process.env.SEED_RIDER_EMAIL ?? 'repartidor@foodbosco.local',
    riderPassword: process.env.SEED_RIDER_PASSWORD ?? 'Repartidor123!',
    riderFirstName: process.env.SEED_RIDER_FIRST_NAME ?? 'Marcos',
    riderLastName: process.env.SEED_RIDER_LAST_NAME ?? 'Peralta',
    riderPhone: process.env.SEED_RIDER_PHONE ?? '3333333333',
    riderVehicle: process.env.SEED_RIDER_VEHICLE ?? 'Moto Honda CG Titan',
  },
}
