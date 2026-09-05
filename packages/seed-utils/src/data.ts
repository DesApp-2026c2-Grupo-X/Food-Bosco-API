import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const mergeDeep = (
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> => {
  const result: Record<string, unknown> = { ...base }

  for (const [key, value] of Object.entries(override)) {
    const current = result[key]
    if (isPlainObject(value) && isPlainObject(current)) {
      result[key] = mergeDeep(current, value)
    } else {
      result[key] = value
    }
  }

  return result
}

export interface LoadSeedDataOptions {
  baseDir: string
  env?: string
}

/**
 * Carga un archivo de datos de seed en JSON con soporte de override por entorno.
 *
 * - Base: `<baseDir>/<name>.json` (obligatorio).
 * - Override: `<baseDir>/<name>.<env>.json` (opcional, se fusiona en profundidad).
 *
 * El entorno se resuelve como `options.env` → `SEED_ENV` → `NODE_ENV` → `development`.
 */
export const loadSeedData = <T>(name: string, options: LoadSeedDataOptions): T => {
  const env = options.env ?? process.env.SEED_ENV ?? process.env.NODE_ENV ?? 'development'

  const basePath = join(options.baseDir, `${name}.json`)
  if (!existsSync(basePath)) {
    throw new Error(`Seed data file not found: ${basePath}`)
  }

  const base = JSON.parse(readFileSync(basePath, 'utf8')) as unknown

  const overridePath = join(options.baseDir, `${name}.${env}.json`)
  if (!existsSync(overridePath)) {
    return base as T
  }

  const override = JSON.parse(readFileSync(overridePath, 'utf8')) as unknown

  if (isPlainObject(base) && isPlainObject(override)) {
    return mergeDeep(base, override) as T
  }

  return override as T
}
