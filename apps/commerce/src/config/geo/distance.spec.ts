import { estimateMinutes, haversineDistanceKm } from './distance'

describe('haversineDistanceKm', () => {
  it('devuelve 0 para el mismo punto', () => {
    const point = { latitude: -34.6, longitude: -58.4 }
    expect(haversineDistanceKm(point, point)).toBeCloseTo(0, 10)
  })

  it('mide ~111.19 km por cada grado de latitud', () => {
    const a = { latitude: 0, longitude: 0 }
    const b = { latitude: 1, longitude: 0 }
    expect(haversineDistanceKm(a, b)).toBeCloseTo(111.19, 1)
  })

  it('es simétrica', () => {
    const a = { latitude: -34.6, longitude: -58.4 }
    const b = { latitude: -34.7, longitude: -58.5 }
    expect(haversineDistanceKm(a, b)).toBeCloseTo(haversineDistanceKm(b, a), 10)
  })
})

describe('estimateMinutes', () => {
  it.each([
    { distanceKm: 25, speedKmh: 25, expected: 60 },
    { distanceKm: 12.5, speedKmh: 25, expected: 30 },
    { distanceKm: 0, speedKmh: 25, expected: 0 },
  ])('$distanceKm km a $speedKmh km/h → $expected min', ({ distanceKm, speedKmh, expected }) => {
    expect(estimateMinutes(distanceKm, speedKmh)).toBe(expected)
  })

  it('evita dividir por cero (velocidad 0 → 0)', () => {
    expect(estimateMinutes(10, 0)).toBe(0)
  })
})
