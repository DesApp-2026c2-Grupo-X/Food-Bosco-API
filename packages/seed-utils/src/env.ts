const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on'])

export const envString = (name: string, fallback: string): string => {
  const raw = process.env[name]
  return raw === undefined || raw.trim() === '' ? fallback : raw
}

export const envNumber = (name: string, fallback: number): number => {
  const raw = process.env[name]
  if (raw === undefined || raw.trim() === '') {
    return fallback
  }

  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

export const envBoolean = (name: string, fallback: boolean): boolean => {
  const raw = process.env[name]
  if (raw === undefined || raw.trim() === '') {
    return fallback
  }

  return TRUE_VALUES.has(raw.toLowerCase())
}

export const envJson = <T>(name: string, fallback: T): T => {
  const raw = process.env[name]
  if (!raw || raw.trim() === '') {
    return fallback
  }

  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}
