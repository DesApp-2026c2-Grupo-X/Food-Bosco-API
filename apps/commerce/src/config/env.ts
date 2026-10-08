import 'dotenv/config'

const toNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export const DEV_JWT_SECRET = 'dev-secret-change-me'
export const DEV_INTERNAL_API_TOKEN = 'dev-internal-token'

export interface SecretConfig {
  nodeEnv: string
  jwtSecret: string
  internalApiToken: string
}

const isInsecureSecret = (value: string, devDefault: string): boolean =>
  value.trim() === '' || value === devDefault

export const assertProductionSecrets = ({
  nodeEnv,
  jwtSecret,
  internalApiToken,
}: SecretConfig): void => {
  if (nodeEnv !== 'production') return

  const insecure = [
    isInsecureSecret(jwtSecret, DEV_JWT_SECRET) ? 'JWT_SECRET' : null,
    isInsecureSecret(internalApiToken, DEV_INTERNAL_API_TOKEN) ? 'INTERNAL_API_TOKEN' : null,
  ].filter((name): name is string => name !== null)

  if (insecure.length > 0) {
    // eslint-disable-next-line no-console -- aviso de seguridad en el arranque (no debe romper el deploy)
    console.warn(
      `[env] Configuración insegura en producción: ${insecure.join(' y ')} no puede(n) quedar vacío(s) ni ` +
        `usar el valor por defecto de desarrollo. Definí un secreto propio en el entorno.`,
    )
  }
}

const nodeEnv = process.env.NODE_ENV ?? 'development'
const jwtSecret = process.env.JWT_SECRET ?? DEV_JWT_SECRET
const internalApiToken = process.env.INTERNAL_API_TOKEN ?? DEV_INTERNAL_API_TOKEN

assertProductionSecrets({ nodeEnv, jwtSecret, internalApiToken })

export const env = {
  port: toNumber(process.env.PORT, 4202),
  nodeEnv,
  mongoUri: process.env.MONGODB_URI ?? 'mongodb://localhost:27017/fastfood',
  jwtSecret,
  internalApiToken,
  brokerUrl: process.env.BROKER_URL ?? '',
  uploads: {
    maxSizeBytes: toNumber(process.env.UPLOAD_MAX_SIZE_BYTES, 5 * 1024 * 1024),
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? '',
    apiKey: process.env.CLOUDINARY_API_KEY ?? '',
    apiSecret: process.env.CLOUDINARY_API_SECRET ?? '',
    folder: process.env.CLOUDINARY_FOLDER ?? 'fastfood/products',
  },
  seed: {
    maxDistanceKm: toNumber(process.env.SEED_PARAM_MAX_DISTANCE_KM, 10),
    basePrepMin: toNumber(process.env.SEED_PARAM_BASE_PREP_MIN, 15),
    avgSpeedKmh: toNumber(process.env.SEED_PARAM_AVG_SPEED_KMH, 25),
  },
}
