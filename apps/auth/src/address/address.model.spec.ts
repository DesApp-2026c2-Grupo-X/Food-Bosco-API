import { AddressDocument, AddressSchema, serializeAddress } from './address.model'

const buildDoc = (overrides: Partial<Record<string, unknown>> = {}): AddressDocument =>
  ({
    _id: { toString: () => 'a1' },
    userId: 'u1',
    label: 'Casa',
    text: 'Av. Siempre Viva 123',
    city: 'CABA',
    postalCode: '1000',
    latitude: -34.6,
    longitude: -58.4,
    active: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  }) as unknown as AddressDocument

describe('serializeAddress (RQ-AUTH-22)', () => {
  it('serializa el id como string y copia los campos públicos', () => {
    const result = serializeAddress(buildDoc())

    expect(result.id).toBe('a1')
    expect(typeof result.id).toBe('string')
    expect(result).toMatchObject({
      label: 'Casa',
      text: 'Av. Siempre Viva 123',
      latitude: -34.6,
      longitude: -58.4,
      active: true,
    })
  })

  it('no expone userId ni timestamps internos', () => {
    const result = serializeAddress(buildDoc())

    const keys = Object.keys(result)
    expect(keys).not.toContain('userId')
    expect(keys).not.toContain('createdAt')
    expect(keys).not.toContain('updatedAt')
  })

  it.each([
    { name: 'sin ciudad ni código postal', city: undefined, postalCode: undefined },
    { name: 'con ciudad y sin código postal', city: 'Córdoba', postalCode: undefined },
    { name: 'con ambos', city: 'Córdoba', postalCode: '5000' },
  ])('normaliza los opcionales a null: $name', ({ city, postalCode }) => {
    const result = serializeAddress(buildDoc({ city, postalCode }))

    expect(result.city).toBe(city ?? null)
    expect(result.postalCode).toBe(postalCode ?? null)
  })

  it('conserva latitud y longitud negativas dentro del rango', () => {
    const result = serializeAddress(buildDoc({ latitude: -90, longitude: 180 }))

    expect(result.latitude).toBe(-90)
    expect(result.longitude).toBe(180)
  })

  it('no muta el documento original', () => {
    const doc = buildDoc()
    const originalLabel = doc.label

    serializeAddress(doc)

    expect(doc.label).toBe(originalLabel)
    expect(doc.userId).toBe('u1')
  })
})

describe('AddressSchema (invariantes de persistencia)', () => {
  it('indexa userId y lo requiere', () => {
    const userIdPath = AddressSchema.path('userId') as unknown as {
      options: Record<string, unknown>
    }

    expect(userIdPath.options.required).toBe(true)
    expect(userIdPath.options.index).toBe(true)
  })

  it('requiere label, text, latitude y longitude (RQ-AUTH-22)', () => {
    const schema = AddressSchema as unknown as {
      path(name: string): { options: Record<string, unknown> }
    }

    for (const field of ['label', 'text', 'latitude', 'longitude'] as const) {
      expect(schema.path(field).options.required).toBe(true)
    }
  })

  it('aplica trim a label, text, city y postalCode', () => {
    const schema = AddressSchema as unknown as {
      path(name: string): { options: Record<string, unknown> }
    }

    for (const field of ['label', 'text', 'city', 'postalCode'] as const) {
      expect(schema.path(field).options.trim).toBe(true)
    }
  })

  it('define active por defecto y timestamps de creación y actualización', () => {
    const schema = AddressSchema as unknown as {
      path(name: string): { options: Record<string, unknown> }
    }

    expect(schema.path('active').options.default).toBe(true)
    expect(AddressSchema.get('collection')).toBe('addresses')
    expect(AddressSchema.get('timestamps')).toEqual({ createdAt: true, updatedAt: true })
  })
})
