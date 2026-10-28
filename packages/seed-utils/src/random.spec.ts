import { createRandomSeed, createSeededRandom } from './random'

const take = (seed: number, count: number): number[] => {
  const random = createSeededRandom(seed)
  return Array.from({ length: count }, () => random.next())
}

describe('createSeededRandom', () => {
  it('es determinista: la misma semilla produce la misma secuencia', () => {
    expect(take(1234, 5)).toEqual(take(1234, 5))
  })

  it('semillas distintas producen secuencias distintas', () => {
    expect(take(1, 5)).not.toEqual(take(2, 5))
  })

  it('normaliza semillas negativas y cero', () => {
    expect(createSeededRandom(-5).next()).toBeGreaterThanOrEqual(0)
    expect(createSeededRandom(0).next()).toBeGreaterThanOrEqual(0)
    expect(createSeededRandom(-5).next()).toBeLessThan(1)
  })

  it.each([
    { min: 0, max: 0 },
    { min: 1, max: 3 },
    { min: 5, max: 9 },
    { min: -4, max: -1 },
  ])('int respeta el rango [$min, $max]', ({ min, max }) => {
    const random = createSeededRandom(42)

    for (let index = 0; index < 200; index += 1) {
      const value = random.int(min, max)
      expect(Number.isInteger(value)).toBe(true)
      expect(value).toBeGreaterThanOrEqual(min)
      expect(value).toBeLessThanOrEqual(max)
    }
  })

  it('int invierte los límites si se pasan al revés', () => {
    const random = createSeededRandom(7)
    const value = random.int(9, 5)

    expect(value).toBeGreaterThanOrEqual(5)
    expect(value).toBeLessThanOrEqual(9)
  })

  it('pick elige siempre un elemento de la lista', () => {
    const random = createSeededRandom(3)
    const items = ['a', 'b', 'c']

    for (let index = 0; index < 50; index += 1) {
      expect(items).toContain(random.pick(items))
    }
  })

  it('pick falla con una lista vacía', () => {
    expect(() => createSeededRandom(1).pick([])).toThrow('No hay elementos para elegir')
  })

  it('weighted ignora los pesos no positivos y siempre devuelve un valor válido', () => {
    const random = createSeededRandom(11)
    const entries = [
      { value: 'nunca', weight: 0 },
      { value: 'rara', weight: 1 },
      { value: 'comun', weight: 50 },
    ]

    const results = Array.from({ length: 300 }, () => random.weighted(entries))

    expect(results).not.toContain('nunca')
    expect(results.filter((value) => value === 'comun').length).toBeGreaterThan(
      results.filter((value) => value === 'rara').length,
    )
  })

  it('weighted falla si no hay pesos positivos', () => {
    expect(() => createSeededRandom(1).weighted([{ value: 'x', weight: 0 }])).toThrow(
      'No hay elementos con peso positivo para elegir',
    )
  })

  it('chance respeta los extremos', () => {
    const random = createSeededRandom(5)

    expect(random.chance(0)).toBe(false)
    expect(random.chance(1)).toBe(true)
  })
})

describe('createRandomSeed', () => {
  it('devuelve un entero positivo', () => {
    const seed = createRandomSeed()

    expect(Number.isInteger(seed)).toBe(true)
    expect(seed).toBeGreaterThan(0)
  })
})
