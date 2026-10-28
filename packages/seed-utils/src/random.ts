export interface WeightedEntry<T> {
  value: T
  weight: number
}

export interface SeededRandom {
  /** Número pseudoaleatorio en el rango [0, 1). */
  next: () => number
  /** Entero pseudoaleatorio en el rango inclusivo [min, max]. */
  int: (min: number, max: number) => number
  /** Elige un elemento al azar de la lista. */
  pick: <T>(items: readonly T[]) => T
  /** Elige un elemento respetando los pesos indicados. */
  weighted: <T>(entries: readonly WeightedEntry<T>[]) => T
  /** Verdadero con la probabilidad indicada (0 a 1). */
  chance: (probability: number) => boolean
}

const NORMALIZE_MODULUS = 0xffffffff

const normalizeSeed = (seed: number): number => {
  const truncated = Math.trunc(Math.abs(seed)) % NORMALIZE_MODULUS
  return truncated === 0 ? 1 : truncated
}

/**
 * Generador pseudoaleatorio determinista (mulberry32).
 *
 * Con la misma semilla devuelve siempre la misma secuencia, lo que permite
 * reproducir un lote de datos de demo. La semilla se normaliza para aceptar
 * cualquier número, incluidos negativos y cero.
 */
export const createSeededRandom = (seed: number): SeededRandom => {
  let state = normalizeSeed(seed)

  const next = (): number => {
    state = (state + 0x6d2b79f5) | 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }

  const int = (min: number, max: number): number => {
    const lower = Math.ceil(Math.min(min, max))
    const upper = Math.floor(Math.max(min, max))
    if (upper < lower) {
      throw new Error(`Rango aleatorio inválido: ${min}..${max}`)
    }
    return lower + Math.floor(next() * (upper - lower + 1))
  }

  const pick = <T>(items: readonly T[]): T => {
    if (items.length === 0) {
      throw new Error('No hay elementos para elegir')
    }
    return items[int(0, items.length - 1)]
  }

  const weighted = <T>(entries: readonly WeightedEntry<T>[]): T => {
    const usable = entries.filter((entry) => entry.weight > 0)
    if (usable.length === 0) {
      throw new Error('No hay elementos con peso positivo para elegir')
    }

    const total = usable.reduce((sum, entry) => sum + entry.weight, 0)
    let threshold = next() * total

    for (const entry of usable) {
      threshold -= entry.weight
      if (threshold <= 0) return entry.value
    }

    return usable[usable.length - 1].value
  }

  const chance = (probability: number): boolean => {
    if (probability <= 0) return false
    if (probability >= 1) return true
    return next() < probability
  }

  return { next, int, pick, weighted, chance }
}

/** Semilla nueva para una corrida de demo que no necesita ser reproducible. */
export const createRandomSeed = (): number => Math.floor(Math.random() * 0x7fffffff) + 1
