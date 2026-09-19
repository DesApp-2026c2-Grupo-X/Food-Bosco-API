import { Role } from '../common/role.enum'
import { mapAddress, mapUser } from './auth.types'

describe('mapUser', () => {
  it('mapea todos los campos de un usuario completo', () => {
    const result = mapUser({
      id: 'u1',
      email: 'cliente@example.com',
      firstName: 'Juan',
      lastName: 'Perez',
      phone: '11223344',
      role: 'customer',
      active: true,
      branchId: 'b1',
      vehicle: 'moto',
    })

    expect(result).toEqual({
      id: 'u1',
      email: 'cliente@example.com',
      firstName: 'Juan',
      lastName: 'Perez',
      phone: '11223344',
      role: Role.CUSTOMER,
      active: true,
      branchId: 'b1',
      vehicle: 'moto',
    })
  })

  it.each([
    { role: 'customer', expected: Role.CUSTOMER },
    { role: 'branch_admin', expected: Role.BRANCH_ADMIN },
    { role: 'super_admin', expected: Role.SUPER_ADMIN },
    { role: 'rider', expected: Role.RIDER },
  ])('mapea el rol $role', ({ role, expected }) => {
    expect(mapUser({ role }).role).toBe(expected)
  })

  it('usa _id cuando no viene id', () => {
    expect(mapUser({ _id: 'u9', role: 'customer' }).id).toBe('u9')
  })

  it('normaliza campos ausentes a vacío/false/null', () => {
    const result = mapUser({ id: 'u1', role: 'customer' })

    expect(result).toMatchObject({
      email: '',
      firstName: '',
      lastName: '',
      phone: null,
      active: false,
      branchId: null,
      vehicle: null,
    })
  })

  it('lanza error si falta el rol', () => {
    expect(() => mapUser({ id: 'u1' })).toThrow('Unknown role:')
  })

  it('convierte a null los campos opcionales nulos', () => {
    const result = mapUser({
      id: 'u1',
      phone: null,
      branchId: null,
      vehicle: null,
      role: 'rider',
    })

    expect(result.phone).toBeNull()
    expect(result.branchId).toBeNull()
    expect(result.vehicle).toBeNull()
  })

  it('lanza error para un rol desconocido', () => {
    expect(() => mapUser({ id: 'u1', role: 'admin_master' })).toThrow('Unknown role: admin_master')
  })
})

describe('mapAddress', () => {
  it('mapea todos los campos de una dirección completa', () => {
    const result = mapAddress({
      id: 'a1',
      label: 'Casa',
      text: 'Av. Siempre Viva 123',
      city: 'CABA',
      postalCode: '1000',
      latitude: -34.6,
      longitude: -58.4,
      active: true,
    })

    expect(result).toEqual({
      id: 'a1',
      label: 'Casa',
      text: 'Av. Siempre Viva 123',
      city: 'CABA',
      postalCode: '1000',
      latitude: -34.6,
      longitude: -58.4,
      active: true,
    })
  })

  it('usa _id cuando no viene id', () => {
    expect(mapAddress({ _id: 'a9', latitude: 0, longitude: 0 }).id).toBe('a9')
  })

  it('normaliza label/text a vacío y city/postalCode a null', () => {
    const result = mapAddress({ id: 'a1', latitude: 0, longitude: 0 })

    expect(result).toMatchObject({ label: '', text: '', city: null, postalCode: null, active: false })
  })

  it.each([
    { latitude: '34.6', longitude: '-58.4' },
    { latitude: 34.6, longitude: -58.4 },
  ])('convierte lat/lng a número ($latitude, $longitude)', ({ latitude, longitude }) => {
    const result = mapAddress({ id: 'a1', latitude, longitude })

    expect(result.latitude).toBe(34.6)
    expect(result.longitude).toBe(-58.4)
  })

  it('lat/lng ausentes producen NaN', () => {
    const result = mapAddress({ id: 'a1' })

    // KNOWN BUG (latente): mapAddress usa Number(raw.latitude) en vez de asNumber,
    // por lo que un dato ausente se mapea a NaN y GraphQL Float no puede serializarlo.
    expect(Number.isNaN(result.latitude)).toBe(true)
    expect(Number.isNaN(result.longitude)).toBe(true)
  })
})
