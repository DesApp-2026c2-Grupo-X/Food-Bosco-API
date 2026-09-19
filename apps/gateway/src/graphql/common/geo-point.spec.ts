import { GeoPoint, mapGeoPoint } from './geo-point'
import type { RawRecord } from './mappers'

describe('mapGeoPoint', () => {
  it.each<[RawRecord | null | undefined, GeoPoint | null]>([
    [null, null],
    [undefined, null],
    [{ latitude: -34.6, longitude: -58.4 }, { latitude: -34.6, longitude: -58.4 }],
    [{ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 0 }],
    [{}, { latitude: 0, longitude: 0 }],
    [{ latitude: null, longitude: undefined }, { latitude: 0, longitude: 0 }],
    [{ latitude: '12.5', longitude: '-7' }, { latitude: 12.5, longitude: -7 }],
  ])('mapea %p', (raw, expected) => {
    expect(mapGeoPoint(raw)).toEqual(expected)
  })

  it('devuelve una instancia plana con latitude/longitude numéricos', () => {
    const point = mapGeoPoint({ latitude: '1', longitude: '2' })

    expect(point).not.toBeNull()
    expect(Object.keys(point ?? {})).toEqual(['latitude', 'longitude'])
    expect(point?.latitude).toBe(1)
    expect(point?.longitude).toBe(2)
  })
})
