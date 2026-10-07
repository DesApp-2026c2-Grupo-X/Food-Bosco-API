import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { ORDER_STATUS_VALUES } from '../../config/constants'
import { ChangeStatusDto } from './change-status.dto'
import { CreateOrderDto, DeliveryAddressDto } from './create-order.dto'
import { OrderQueryDto } from './order-query.dto'

type DtoClass = new () => object

const check = async (cls: DtoClass, payload: Record<string, unknown>): Promise<string[]> => {
  const errors = await validate(plainToInstance(cls, payload))
  return errors.map((error) => error.property)
}

const validAddress = { text: 'Av 1', latitude: 0, longitude: 0 }

describe('CreateOrderDto (RQ-ORD-02/05)', () => {
  const cases: Array<{ name: string; payload: Record<string, unknown>; valid: boolean }> = [
    {
      name: 'dirección válida',
      payload: { addressId: 'a1', deliveryAddress: validAddress },
      valid: true,
    },
    {
      name: 'latitud 90 (límite)',
      payload: { addressId: 'a1', deliveryAddress: { ...validAddress, latitude: 90 } },
      valid: true,
    },
    {
      name: 'latitud -90 (límite)',
      payload: { addressId: 'a1', deliveryAddress: { ...validAddress, latitude: -90 } },
      valid: true,
    },
    {
      name: 'longitud 180 (límite)',
      payload: { addressId: 'a1', deliveryAddress: { ...validAddress, longitude: 180 } },
      valid: true,
    },
    {
      name: 'longitud -180 (límite)',
      payload: { addressId: 'a1', deliveryAddress: { ...validAddress, longitude: -180 } },
      valid: true,
    },
    {
      name: 'texto de 200 caracteres (límite)',
      payload: { addressId: 'a1', deliveryAddress: { ...validAddress, text: 'a'.repeat(200) } },
      valid: true,
    },
    { name: 'sin addressId', payload: { deliveryAddress: validAddress }, valid: false },
    {
      name: 'addressId vacío',
      payload: { addressId: '', deliveryAddress: validAddress },
      valid: false,
    },
    {
      name: 'texto de la dirección vacío',
      payload: { addressId: 'a1', deliveryAddress: { ...validAddress, text: '' } },
      valid: false,
    },
    {
      name: 'texto de 201 caracteres',
      payload: { addressId: 'a1', deliveryAddress: { ...validAddress, text: 'a'.repeat(201) } },
      valid: false,
    },
    {
      name: 'latitud fuera de rango',
      payload: { addressId: 'a1', deliveryAddress: { ...validAddress, latitude: 91 } },
      valid: false,
    },
    {
      name: 'longitud fuera de rango',
      payload: { addressId: 'a1', deliveryAddress: { ...validAddress, longitude: 181 } },
      valid: false,
    },
    {
      name: 'sin latitud',
      payload: { addressId: 'a1', deliveryAddress: { text: 'Av 1', longitude: 0 } },
      valid: false,
    },
    {
      name: 'sin longitud',
      payload: { addressId: 'a1', deliveryAddress: { text: 'Av 1', latitude: 0 } },
      valid: false,
    },
  ]

  it.each(cases)('$name → $valid', async ({ payload, valid }) => {
    const invalid = await check(CreateOrderDto, payload)

    expect(invalid.length === 0).toBe(valid)
  })

  // KNOWN BUG: RQ-ORD-05 exige la dirección de entrega (snapshot). El DTO no marca
  // `deliveryAddress` con @IsNotEmpty ni @ValidateIf, y @ValidateNested omite los valores
  // undefined, por lo que un pedido sin dirección pasa la validación y el orchestrator
  // falla más tarde con un TypeError (500) al leer `deliveryAddress.latitude`.
  it('KNOWN BUG: acepta el pedido sin deliveryAddress', async () => {
    expect(await check(CreateOrderDto, { addressId: 'a1' })).toEqual([])
  })
})

describe('DeliveryAddressDto (RQ-ORD-05)', () => {
  it.each([
    { name: 'coordenadas en 0', payload: validAddress, valid: true },
    {
      name: 'coordenadas límite',
      payload: { text: 'Av', latitude: -90, longitude: 180 },
      valid: true,
    },
    { name: 'texto vacío', payload: { text: '', latitude: 0, longitude: 0 }, valid: false },
    { name: 'sin texto', payload: { latitude: 0, longitude: 0 }, valid: false },
    {
      name: 'latitud 90.0001',
      payload: { text: 'Av', latitude: 90.0001, longitude: 0 },
      valid: false,
    },
    {
      name: 'longitud -180.0001',
      payload: { text: 'Av', latitude: 0, longitude: -180.0001 },
      valid: false,
    },
  ])('$name → $valid', async ({ payload, valid }) => {
    const invalid = await check(DeliveryAddressDto, payload)

    expect(invalid.length === 0).toBe(valid)
  })
})

describe('ChangeStatusDto (RQ-ORD-14)', () => {
  it.each(ORDER_STATUS_VALUES.map((status) => ({ status })))(
    'estado válido $status → válido',
    async ({ status }) => {
      expect(await check(ChangeStatusDto, { status })).toEqual([])
    },
  )

  it.each([
    { name: 'estado desconocido', payload: { status: 'shipped' } },
    { name: 'estado vacío', payload: { status: '' } },
    { name: 'sin estado', payload: {} },
    { name: 'estado numérico', payload: { status: 1 } },
  ])('$name → inválido en status', async ({ payload }) => {
    expect(await check(ChangeStatusDto, payload)).toContain('status')
  })
})

describe('OrderQueryDto (RQ-ORD-11/19)', () => {
  const cases: Array<{ name: string; payload: Record<string, unknown>; valid: boolean }> = [
    { name: 'vacío', payload: {}, valid: true },
    { name: 'estado válido', payload: { status: 'pending' }, valid: true },
    { name: 'sucursal', payload: { branchId: 'b1' }, valid: true },
    {
      name: 'search de 100 caracteres (límite)',
      payload: { search: 'a'.repeat(100) },
      valid: true,
    },
    { name: 'limit 1 (mínimo)', payload: { limit: 1 }, valid: true },
    { name: 'limit 100 (máximo)', payload: { limit: 100 }, valid: true },
    { name: 'offset 0', payload: { offset: 0 }, valid: true },
    { name: 'estado inválido', payload: { status: 'shipped' }, valid: false },
    { name: 'search de 101 caracteres', payload: { search: 'a'.repeat(101) }, valid: false },
    { name: 'search numérico', payload: { search: 10 }, valid: false },
    { name: 'limit 0', payload: { limit: 0 }, valid: false },
    { name: 'limit 101', payload: { limit: 101 }, valid: false },
    { name: 'limit decimal', payload: { limit: 1.5 }, valid: false },
    { name: 'limit no numérico', payload: { limit: 'abc' }, valid: false },
    { name: 'offset negativo', payload: { offset: -1 }, valid: false },
    { name: 'branchId numérico', payload: { branchId: 1 }, valid: false },
  ]

  it.each(cases)('$name → $valid', async ({ payload, valid }) => {
    const invalid = await check(OrderQueryDto, payload)

    expect(invalid.length === 0).toBe(valid)
  })

  it('convierte limit y offset string a número por @Type', async () => {
    const instance = plainToInstance(OrderQueryDto, { limit: '5', offset: '10' })

    expect(await validate(instance)).toEqual([])
    expect(instance.limit).toBe(5)
    expect(instance.offset).toBe(10)
  })
})
