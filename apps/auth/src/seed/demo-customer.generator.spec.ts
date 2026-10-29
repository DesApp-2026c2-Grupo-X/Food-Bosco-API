import {
  expandDemoCustomers,
  type DemoCustomerNames,
  type DemoCustomerSeed,
} from './demo-customer.generator'

const address = (label: string, latitude: number) => ({
  label,
  text: `Calle ${label}`,
  city: 'Hurlingham',
  postalCode: '1686',
  latitude,
  longitude: -58.63,
})

const curated = (): DemoCustomerSeed[] => [
  {
    firstName: 'Sofía',
    lastName: 'Ramírez',
    email: 'sofia.ramirez@foodbosco.local',
    phone: '1145550101',
    addresses: [address('Casa', -34.59), address('Trabajo', -34.61)],
  },
  {
    firstName: 'Mateo',
    lastName: 'Fernández',
    email: 'mateo.fernandez@foodbosco.local',
    phone: '1145550102',
    addresses: [address('Casa', -34.64)],
  },
]

const names: DemoCustomerNames = {
  firstNames: ['Ana', 'Bruno', 'Carla'],
  lastNames: ['Álvarez', 'Bianchi'],
}

describe('expandDemoCustomers', () => {
  it('devuelve sólo los curados si se pide menos o igual', () => {
    expect(expandDemoCustomers(curated(), 0, names)).toEqual([])
    expect(expandDemoCustomers(curated(), 1, names)).toEqual([curated()[0]])
    expect(expandDemoCustomers(curated(), 2, names)).toEqual(curated())
  })

  it('genera clientes nuevos hasta la cantidad pedida', () => {
    const result = expandDemoCustomers(curated(), 5, names)

    expect(result).toHaveLength(5)
    expect(result.slice(0, 2)).toEqual(curated())
    expect(result[2]).toMatchObject({
      email: 'cliente.demo.3@foodbosco.local',
      firstName: 'Carla',
      lastName: 'Álvarez',
    })
  })

  it('genera emails únicos y teléfonos únicos', () => {
    const result = expandDemoCustomers(curated(), 20, names)
    const emails = result.map((customer) => customer.email)
    const phones = result.map((customer) => customer.phone)

    expect(new Set(emails).size).toBe(result.length)
    expect(new Set(phones).size).toBe(result.length)
  })

  it('reutiliza las direcciones reales de la bolsa curada', () => {
    const result = expandDemoCustomers(curated(), 6, names)
    const pool = curated()
      .flatMap((customer) => customer.addresses)
      .map(({ text, latitude, longitude }) => ({ text, latitude, longitude }))

    for (const customer of result.slice(2)) {
      const address = customer.addresses[0]

      expect(pool).toContainEqual({
        text: address.text,
        latitude: address.latitude,
        longitude: address.longitude,
      })
      expect(address.label).toBe('Casa')
      expect(address.latitude).toBeGreaterThanOrEqual(-34.65)
    }
  })

  it('sin nombres disponibles devuelve sólo los curados', () => {
    expect(expandDemoCustomers(curated(), 5, { firstNames: [], lastNames: [] })).toEqual(curated())
  })

  it('sin direcciones en la bolsa devuelve sólo los curados', () => {
    const withoutAddresses = curated().map((customer) => ({ ...customer, addresses: [] }))

    expect(expandDemoCustomers(withoutAddresses, 5, names)).toEqual(withoutAddresses)
  })
})
