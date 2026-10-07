import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { BranchHourDto, UpdateBranchHoursDto } from './branch-hours.dto'
import { BranchQueryDto } from './branch-query.dto'
import { CreateBranchDto } from './create-branch.dto'
import { SetActiveDto } from './set-active.dto'
import { SetProductAvailabilityDto } from './set-product-availability.dto'
import { UpdateBranchDto } from './update-branch.dto'

const instantiate = <T extends object>(cls: new () => T, payload: Record<string, unknown>): T =>
  plainToInstance(cls, payload)

const hasPropertyError = (errors: Array<{ property: string }>, property: string): boolean =>
  errors.some((error) => error.property === property)

describe('CreateBranchDto (RQ-BRN-02)', () => {
  const valid = {
    name: 'Centro',
    addressText: 'Av 1',
    latitude: -34.6,
    longitude: -58.4,
  }

  it.each([
    { name: 'válido completo', payload: { ...valid, phone: '555', active: true }, valid: true },
    { name: 'válido mínimo (sin opcionales)', payload: valid, valid: true },
    {
      name: 'nombre de 100 caracteres (límite)',
      payload: { ...valid, name: 'x'.repeat(100) },
      valid: true,
    },
    {
      name: 'dirección de 200 caracteres (límite)',
      payload: { ...valid, addressText: 'x'.repeat(200) },
      valid: true,
    },
    { name: 'latitud 90 (límite)', payload: { ...valid, latitude: 90 }, valid: true },
    { name: 'latitud -90 (límite)', payload: { ...valid, latitude: -90 }, valid: true },
    { name: 'longitud 180 (límite)', payload: { ...valid, longitude: 180 }, valid: true },
    { name: 'longitud -180 (límite)', payload: { ...valid, longitude: -180 }, valid: true },
    { name: 'sin nombre', payload: { ...valid, name: undefined }, valid: false, property: 'name' },
    { name: 'nombre vacío', payload: { ...valid, name: '' }, valid: false, property: 'name' },
    {
      name: 'nombre de 101 caracteres',
      payload: { ...valid, name: 'x'.repeat(101) },
      valid: false,
      property: 'name',
    },
    {
      name: 'sin dirección',
      payload: { ...valid, addressText: undefined },
      valid: false,
      property: 'addressText',
    },
    {
      name: 'dirección de 201 caracteres',
      payload: { ...valid, addressText: 'x'.repeat(201) },
      valid: false,
      property: 'addressText',
    },
    {
      name: 'latitud mayor a 90',
      payload: { ...valid, latitude: 90.0001 },
      valid: false,
      property: 'latitude',
    },
    {
      name: 'latitud no numérica',
      payload: { ...valid, latitude: 'norte' },
      valid: false,
      property: 'latitude',
    },
    {
      name: 'longitud menor a -180',
      payload: { ...valid, longitude: -180.0001 },
      valid: false,
      property: 'longitude',
    },
    {
      name: 'teléfono de 51 caracteres',
      payload: { ...valid, phone: '1'.repeat(51) },
      valid: false,
      property: 'phone',
    },
    {
      name: 'active no booleano',
      payload: { ...valid, active: 'sí' },
      valid: false,
      property: 'active',
    },
  ])('$name', async ({ payload, valid: expectedValid, property }) => {
    const errors = await validate(instantiate(CreateBranchDto, payload))

    expect(errors.length > 0).toBe(!expectedValid)
    if (!expectedValid && property) {
      expect(hasPropertyError(errors, property)).toBe(true)
    }
  })

  it('whitelist elimina las propiedades no declaradas', async () => {
    const dto = instantiate(CreateBranchDto, { ...valid, hack: 'x' }) as CreateBranchDto & {
      hack?: string
    }

    await validate(dto, { whitelist: true })

    expect(dto.hack).toBeUndefined()
  })
})

describe('UpdateBranchDto (RQ-BRN-01)', () => {
  it.each([
    { name: 'vacío (todo opcional)', payload: {}, valid: true },
    { name: 'solo nombre', payload: { name: 'Nuevo' }, valid: true },
    { name: 'latitud 90 (límite)', payload: { latitude: 90 }, valid: true },
    { name: 'nombre vacío', payload: { name: '' }, valid: false, property: 'name' },
    {
      name: 'nombre de 101 caracteres',
      payload: { name: 'x'.repeat(101) },
      valid: false,
      property: 'name',
    },
    {
      name: 'latitud fuera de rango',
      payload: { latitude: -91 },
      valid: false,
      property: 'latitude',
    },
    {
      name: 'longitud fuera de rango',
      payload: { longitude: 181 },
      valid: false,
      property: 'longitude',
    },
    { name: 'active no booleano', payload: { active: 'no' }, valid: false, property: 'active' },
  ])('$name', async ({ payload, valid: expectedValid, property }) => {
    const errors = await validate(instantiate(UpdateBranchDto, payload))

    expect(errors.length > 0).toBe(!expectedValid)
    if (!expectedValid && property) {
      expect(hasPropertyError(errors, property)).toBe(true)
    }
  })
})

describe('BranchHourDto (RQ-BRN-03)', () => {
  const valid = { dayOfWeek: 1, opening: '08:00', closing: '20:00', closed: false }

  it.each([
    { name: 'válido', payload: valid, valid: true },
    { name: 'día 0 (domingo, límite inferior)', payload: { ...valid, dayOfWeek: 0 }, valid: true },
    { name: 'día 6 (sábado, límite superior)', payload: { ...valid, dayOfWeek: 6 }, valid: true },
    {
      name: 'cerrado sin apertura ni cierre',
      payload: { dayOfWeek: 1, closed: true },
      valid: true,
    },
    {
      name: 'apertura y cierre nulos (opcionales)',
      payload: { ...valid, opening: null, closing: null },
      valid: true,
    },
    { name: 'día -1', payload: { ...valid, dayOfWeek: -1 }, valid: false, property: 'dayOfWeek' },
    { name: 'día 7', payload: { ...valid, dayOfWeek: 7 }, valid: false, property: 'dayOfWeek' },
    {
      name: 'día no entero',
      payload: { ...valid, dayOfWeek: 1.5 },
      valid: false,
      property: 'dayOfWeek',
    },
    {
      name: 'día no numérico',
      payload: { ...valid, dayOfWeek: 'lunes' },
      valid: false,
      property: 'dayOfWeek',
    },
    {
      name: 'apertura con formato inválido',
      payload: { ...valid, opening: '8:00' },
      valid: false,
      property: 'opening',
    },
    {
      name: 'cierre con formato inválido',
      payload: { ...valid, closing: '20' },
      valid: false,
      property: 'closing',
    },
    {
      name: 'apertura no string',
      payload: { ...valid, opening: 800 },
      valid: false,
      property: 'opening',
    },
    {
      name: 'closed ausente',
      payload: { dayOfWeek: 1, opening: '08:00', closing: '20:00' },
      valid: false,
      property: 'closed',
    },
    {
      name: 'closed no booleano',
      payload: { ...valid, closed: 'sí' },
      valid: false,
      property: 'closed',
    },
  ])('$name', async ({ payload, valid: expectedValid, property }) => {
    const errors = await validate(instantiate(BranchHourDto, payload))

    expect(errors.length > 0).toBe(!expectedValid)
    if (!expectedValid && property) {
      expect(hasPropertyError(errors, property)).toBe(true)
    }
  })

  // KNOWN BUG: el regex `^\d{2}:\d{2}$` valida formato pero no rango, así que
  // horas como '99:99', '25:00' u '08:99' pasan la validación. `timeToMinutes`
  // las interpreta como minutos fuera de rango y el cálculo de apertura/cierre
  // queda incorrecto.
  it.each(['99:99', '25:00', '08:99'])(
    'acepta la hora fuera de rango %s (comportamiento actual)',
    async (opening) => {
      const errors = await validate(instantiate(BranchHourDto, { ...valid, opening }))

      expect(errors).toHaveLength(0)
    },
  )
})

describe('UpdateBranchHoursDto (RQ-BRN-03)', () => {
  const validHour = { dayOfWeek: 1, opening: '08:00', closing: '20:00', closed: false }

  it.each([
    { name: 'lista con un horario válido', payload: { hours: [validHour] }, valid: true },
    { name: 'lista vacía', payload: { hours: [] }, valid: true },
    { name: 'hours ausente', payload: {}, valid: false, property: 'hours' },
    { name: 'hours no es arreglo', payload: { hours: 'x' }, valid: false, property: 'hours' },
    {
      name: 'elemento anidado inválido',
      payload: { hours: [{ ...validHour, dayOfWeek: 9 }] },
      valid: false,
      property: 'hours',
    },
  ])('$name', async ({ payload, valid: expectedValid, property }) => {
    const errors = await validate(instantiate(UpdateBranchHoursDto, payload))

    expect(errors.length > 0).toBe(!expectedValid)
    if (!expectedValid && property) {
      expect(hasPropertyError(errors, property)).toBe(true)
    }
  })
})

describe('BranchQueryDto (RQ-BRN-01)', () => {
  it.each([
    { name: '"true" → true', payload: { active: 'true' }, expected: true },
    { name: 'true → true', payload: { active: true }, expected: true },
    { name: '"false" → false', payload: { active: 'false' }, expected: false },
    { name: 'false → false', payload: { active: false }, expected: false },
    {
      name: 'valor no booleano → false (transform actual)',
      payload: { active: 'otro' },
      expected: false,
    },
  ])('transforma active: $name', async ({ payload, expected }) => {
    const dto = instantiate(BranchQueryDto, payload)

    expect(dto.active).toBe(expected)
    await expect(validate(dto)).resolves.toHaveLength(0)
  })

  it.each([
    { name: 'limit "5" → 5', payload: { limit: '5' }, expected: 5 },
    { name: 'limit 1 (límite inferior)', payload: { limit: 1 }, expected: 1 },
    { name: 'limit 100 (límite superior)', payload: { limit: 100 }, expected: 100 },
  ])('acepta y convierte $name', async ({ payload, expected }) => {
    const dto = instantiate(BranchQueryDto, payload)

    expect(dto.limit).toBe(expected)
    await expect(validate(dto)).resolves.toHaveLength(0)
  })

  it.each([
    { name: 'limit 0', payload: { limit: 0 }, property: 'limit' },
    { name: 'limit 101', payload: { limit: 101 }, property: 'limit' },
    { name: 'limit no entero', payload: { limit: 2.5 }, property: 'limit' },
    { name: 'limit no numérico', payload: { limit: 'abc' }, property: 'limit' },
    { name: 'offset -1', payload: { offset: -1 }, property: 'offset' },
    { name: 'offset no entero', payload: { offset: 1.5 }, property: 'offset' },
    { name: 'search de 101 caracteres', payload: { search: 'x'.repeat(101) }, property: 'search' },
    { name: 'search no string', payload: { search: 123 }, property: 'search' },
  ])('rechaza $name', async ({ payload, property }) => {
    const errors = await validate(instantiate(BranchQueryDto, payload))

    expect(errors.length > 0).toBe(true)
    expect(hasPropertyError(errors, property)).toBe(true)
  })

  it.each([
    { name: 'vacío', payload: {} },
    { name: 'offset "0"', payload: { offset: '0' } },
    { name: 'search válido', payload: { search: 'centro' } },
    { name: 'search de 100 caracteres (límite)', payload: { search: 'x'.repeat(100) } },
  ])('acepta $name', async ({ payload }) => {
    await expect(validate(instantiate(BranchQueryDto, payload))).resolves.toHaveLength(0)
  })
})

describe('SetActiveDto (RQ-BRN-01)', () => {
  it.each([
    { name: 'true', payload: { active: true }, valid: true },
    { name: 'false', payload: { active: false }, valid: true },
    { name: 'ausente', payload: {}, valid: false },
    { name: 'string', payload: { active: 'true' }, valid: false },
  ])('$name', async ({ payload, valid: expectedValid }) => {
    const errors = await validate(instantiate(SetActiveDto, payload))

    expect(errors.length > 0).toBe(!expectedValid)
  })
})

describe('SetProductAvailabilityDto (RQ-CAT-16)', () => {
  it.each([
    { name: 'true', payload: { available: true }, valid: true },
    { name: 'false', payload: { available: false }, valid: true },
    { name: 'ausente', payload: {}, valid: false },
    { name: 'string', payload: { available: 'true' }, valid: false },
  ])('$name', async ({ payload, valid: expectedValid }) => {
    const errors = await validate(instantiate(SetProductAvailabilityDto, payload))

    expect(errors.length > 0).toBe(!expectedValid)
  })
})
