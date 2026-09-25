import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import type { ValidatorOptions } from 'class-validator'
import { USER_ROLE_VALUES } from '../../config/constants'
import { CreateAdminDto } from './create-admin.dto'
import { CreateRiderDto } from './create-rider.dto'
import { CreateStaffDto } from './create-staff.dto'
import { LoginDto } from './login.dto'
import { RegisterRiderDto } from './register-rider.dto'
import { RegisterDto } from './register.dto'
import { SetActiveDto } from './set-active.dto'
import { UpdateProfileDto } from './update-profile.dto'
import { UpdateUserDto } from './update-user.dto'
import { UserQueryDto } from './user-query.dto'

type DtoClass = new () => object

const check = async (
  cls: DtoClass,
  payload: Record<string, unknown>,
  options: ValidatorOptions = {},
): Promise<{ instance: Record<string, unknown>; invalid: string[] }> => {
  const instance = plainToInstance(cls, payload)
  const errors = await validate(instance, options)
  return {
    instance: instance as unknown as Record<string, unknown>,
    invalid: errors.map((error) => error.property),
  }
}

const base = {
  firstName: 'Juan',
  lastName: 'Perez',
  email: 'cliente@example.com',
  phone: '11223344',
  password: 'secreto123',
}

describe('RegisterDto (RQ-AUTH-01)', () => {
  it.each<{ name: string; payload: Record<string, unknown>; valid: boolean }>([
    { name: 'payload válido', payload: { ...base }, valid: true },
    {
      name: 'contraseña de 8 caracteres (límite)',
      payload: { ...base, password: 'a'.repeat(8) },
      valid: true,
    },
    {
      name: 'contraseña de 128 caracteres (límite)',
      payload: { ...base, password: 'a'.repeat(128) },
      valid: true,
    },
    {
      name: 'nombre de 100 caracteres (límite)',
      payload: { ...base, firstName: 'a'.repeat(100) },
      valid: true,
    },
    { name: 'sin nombre', payload: { ...base, firstName: undefined }, valid: false },
    { name: 'nombre vacío', payload: { ...base, firstName: '' }, valid: false },
    {
      name: 'nombre de 101 caracteres',
      payload: { ...base, firstName: 'a'.repeat(101) },
      valid: false,
    },
    { name: 'correo inválido', payload: { ...base, email: 'no-valido' }, valid: false },
    { name: 'sin correo', payload: { ...base, email: undefined }, valid: false },
    {
      name: 'teléfono de 51 caracteres',
      payload: { ...base, phone: '1'.repeat(51) },
      valid: false,
    },
    {
      name: 'contraseña de 7 caracteres',
      payload: { ...base, password: 'a'.repeat(7) },
      valid: false,
    },
    {
      name: 'contraseña de 129 caracteres',
      payload: { ...base, password: 'a'.repeat(129) },
      valid: false,
    },
    { name: 'nombre numérico', payload: { ...base, firstName: 123 }, valid: false },
  ])('$name → válido=$valid', async ({ payload, valid }) => {
    const { invalid } = await check(RegisterDto, payload)
    expect(invalid.length === 0).toBe(valid)
  })

  it('con whitelist descarta campos extra sin reportar error', async () => {
    const { instance, invalid } = await check(
      RegisterDto,
      { ...base, role: 'super_admin', hacker: 'x' },
      { whitelist: true },
    )

    expect(invalid).toEqual([])
    expect(instance.role).toBeUndefined()
    expect(instance.hacker).toBeUndefined()
  })
})

describe('LoginDto (RQ-AUTH-04)', () => {
  it.each<{ name: string; payload: Record<string, unknown>; valid: boolean }>([
    { name: 'credenciales válidas', payload: { email: 'a@b.com', password: 'x' }, valid: true },
    { name: 'correo inválido', payload: { email: 'a@', password: 'x' }, valid: false },
    { name: 'sin correo', payload: { password: 'x' }, valid: false },
    { name: 'sin contraseña', payload: { email: 'a@b.com' }, valid: false },
    { name: 'contraseña vacía', payload: { email: 'a@b.com', password: '' }, valid: false },
    { name: 'contraseña numérica', payload: { email: 'a@b.com', password: 123 }, valid: false },
  ])('$name → válido=$valid', async ({ payload, valid }) => {
    const { invalid } = await check(LoginDto, payload)
    expect(invalid.length === 0).toBe(valid)
  })
})

describe('CreateStaffDto (RQ-AUTH-13)', () => {
  const staff = { ...base, branchId: 'branch-1' }

  it.each<{ name: string; payload: Record<string, unknown>; valid: boolean }>([
    { name: 'payload válido con branchId', payload: staff, valid: true },
    {
      name: 'branchId en el límite permitido',
      payload: { ...staff, branchId: 'b'.repeat(50) },
      valid: true,
    },
    { name: 'sin branchId', payload: { ...staff, branchId: undefined }, valid: false },
    { name: 'branchId vacío', payload: { ...staff, branchId: '' }, valid: false },
    { name: 'branchId numérico', payload: { ...staff, branchId: 123 }, valid: false },
    { name: 'correo inválido', payload: { ...staff, email: 'no-valido' }, valid: false },
  ])('$name → válido=$valid', async ({ payload, valid }) => {
    const { invalid } = await check(CreateStaffDto, payload)
    expect(invalid.length === 0).toBe(valid)
  })

  it('con whitelist no acepta role ni vehicle inyectados', async () => {
    const { instance, invalid } = await check(
      CreateStaffDto,
      { ...staff, role: 'super_admin', vehicle: 'Moto' },
      { whitelist: true },
    )

    expect(invalid).toEqual([])
    expect(instance.role).toBeUndefined()
    expect(instance.vehicle).toBeUndefined()
  })
})

describe('CreateAdminDto (RQ-AUTH-14)', () => {
  it.each<{ name: string; payload: Record<string, unknown>; valid: boolean }>([
    { name: 'payload válido', payload: { ...base }, valid: true },
    { name: 'sin contraseña', payload: { ...base, password: undefined }, valid: false },
    {
      name: 'contraseña de 7 caracteres',
      payload: { ...base, password: 'a'.repeat(7) },
      valid: false,
    },
    { name: 'correo inválido', payload: { ...base, email: 'admin' }, valid: false },
  ])('$name → válido=$valid', async ({ payload, valid }) => {
    const { invalid } = await check(CreateAdminDto, payload)
    expect(invalid.length === 0).toBe(valid)
  })
})

describe('CreateRiderDto / RegisterRiderDto (RQ-AUTH-15)', () => {
  const rider = { ...base, vehicle: 'Moto' }

  it.each<{ name: string; payload: Record<string, unknown>; valid: boolean }>([
    { name: 'payload válido con vehículo', payload: rider, valid: true },
    { name: 'sin vehículo', payload: { ...rider, vehicle: undefined }, valid: false },
    { name: 'vehículo vacío', payload: { ...rider, vehicle: '' }, valid: false },
    { name: 'vehículo numérico', payload: { ...rider, vehicle: 1 }, valid: false },
  ])('CreateRiderDto: $name → válido=$valid', async ({ payload, valid }) => {
    const { invalid } = await check(CreateRiderDto, payload)
    expect(invalid.length === 0).toBe(valid)
  })

  it.each<{ name: string; payload: Record<string, unknown>; valid: boolean }>([
    { name: 'payload válido con vehículo', payload: rider, valid: true },
    { name: 'sin vehículo', payload: { ...rider, vehicle: undefined }, valid: false },
    { name: 'sin teléfono', payload: { ...rider, phone: undefined }, valid: false },
    {
      name: 'contraseña de 7 caracteres',
      payload: { ...rider, password: 'a'.repeat(7) },
      valid: false,
    },
  ])('RegisterRiderDto: $name → válido=$valid', async ({ payload, valid }) => {
    const { invalid } = await check(RegisterRiderDto, payload)
    expect(invalid.length === 0).toBe(valid)
  })
})

describe('UpdateProfileDto (RQ-AUTH-11)', () => {
  it.each<{ name: string; payload: Record<string, unknown>; valid: boolean }>([
    {
      name: 'payload válido',
      payload: { firstName: 'Ana', lastName: 'Gomez', phone: '999' },
      valid: true,
    },
    {
      name: 'nombre de 100 caracteres (límite)',
      payload: { firstName: 'a'.repeat(100), lastName: 'G', phone: '1' },
      valid: true,
    },
    { name: 'sin teléfono', payload: { firstName: 'Ana', lastName: 'Gomez' }, valid: false },
    {
      name: 'teléfono vacío',
      payload: { firstName: 'Ana', lastName: 'Gomez', phone: '' },
      valid: false,
    },
    {
      name: 'apellido de 101 caracteres',
      payload: { firstName: 'Ana', lastName: 'a'.repeat(101), phone: '1' },
      valid: false,
    },
  ])('$name → válido=$valid', async ({ payload, valid }) => {
    const { invalid } = await check(UpdateProfileDto, payload)
    expect(invalid.length === 0).toBe(valid)
  })
})

describe('UpdateUserDto (RQ-AUTH-16)', () => {
  it.each<{ name: string; payload: Record<string, unknown>; valid: boolean }>([
    { name: 'payload vacío (todo opcional)', payload: {}, valid: true },
    { name: 'solo firstName', payload: { firstName: 'Ana' }, valid: true },
    { name: 'solo branchId', payload: { branchId: 'branch-2' }, valid: true },
    { name: 'firstName de 101 caracteres', payload: { firstName: 'a'.repeat(101) }, valid: false },
    { name: 'phone de 51 caracteres', payload: { phone: '1'.repeat(51) }, valid: false },
    { name: 'branchId numérico', payload: { branchId: 123 }, valid: false },
  ])('$name → válido=$valid', async ({ payload, valid }) => {
    const { invalid } = await check(UpdateUserDto, payload)
    expect(invalid.length === 0).toBe(valid)
  })

  it('acepta firstName vacío porque no tiene @IsNotEmpty', async () => {
    const { invalid } = await check(UpdateUserDto, { firstName: '' })
    expect(invalid).toEqual([])
  })

  it('acepta branchId null porque @IsOptional ignora null', async () => {
    const { invalid } = await check(UpdateUserDto, { branchId: null })
    expect(invalid).toEqual([])
  })
})

describe('SetActiveDto (RQ-AUTH-16)', () => {
  it.each<{ name: string; payload: Record<string, unknown>; valid: boolean }>([
    { name: 'active true', payload: { active: true }, valid: true },
    { name: 'active false', payload: { active: false }, valid: true },
    { name: 'sin active', payload: {}, valid: false },
    { name: 'active string', payload: { active: 'true' }, valid: false },
    { name: 'active numérico', payload: { active: 1 }, valid: false },
  ])('$name → válido=$valid', async ({ payload, valid }) => {
    const { invalid } = await check(SetActiveDto, payload)
    expect(invalid.length === 0).toBe(valid)
  })
})

describe('UserQueryDto (listado con filtros)', () => {
  it.each<{ name: string; payload: Record<string, unknown>; valid: boolean }>([
    { name: 'vacío (todos opcionales)', payload: {}, valid: true },
    ...USER_ROLE_VALUES.map((role) => ({
      name: `rol válido ${role}`,
      payload: { role },
      valid: true,
    })),
    { name: 'rol inválido', payload: { role: 'vendedor' }, valid: false },
    { name: 'active true', payload: { active: true }, valid: true },
    { name: 'active false', payload: { active: false }, valid: true },
    {
      name: 'search de 100 caracteres (límite)',
      payload: { search: 'a'.repeat(100) },
      valid: true,
    },
    { name: 'search de 101 caracteres', payload: { search: 'a'.repeat(101) }, valid: false },
    { name: 'search numérico', payload: { search: 10 }, valid: false },
    { name: 'limit mínimo 1', payload: { limit: 1 }, valid: true },
    { name: 'limit máximo 100', payload: { limit: 100 }, valid: true },
    { name: 'offset 0', payload: { offset: 0 }, valid: true },
    { name: 'limit 0', payload: { limit: 0 }, valid: false },
    { name: 'limit 101', payload: { limit: 101 }, valid: false },
    { name: 'limit decimal', payload: { limit: 1.5 }, valid: false },
    { name: 'limit no numérico', payload: { limit: 'abc' }, valid: false },
    { name: 'offset negativo', payload: { offset: -1 }, valid: false },
  ])('$name → válido=$valid', async ({ payload, valid }) => {
    const { invalid } = await check(UserQueryDto, payload)
    expect(invalid.length === 0).toBe(valid)
  })

  it('convierte limit string a número por @Type', async () => {
    const { instance, invalid } = await check(UserQueryDto, { limit: '5' })
    expect(invalid).toEqual([])
    expect(instance.limit).toBe(5)
  })

  it.each([
    { name: '"true" se transforma a true', input: 'true', expected: true },
    { name: '"false" se transforma a false', input: 'false', expected: false },
    { name: 'true booleano se mantiene', input: true, expected: true },
    { name: 'false booleano se mantiene', input: false, expected: false },
    {
      name: 'un valor inesperado se coacciona a false (transform sin validación estricta)',
      input: 'yes',
      expected: false,
    },
  ])('active: $name', async ({ input, expected }) => {
    const { instance, invalid } = await check(UserQueryDto, { active: input })
    expect(invalid).toEqual([])
    expect(instance.active).toBe(expected)
  })

  it('con whitelist descarta parámetros desconocidos', async () => {
    const { instance, invalid } = await check(
      UserQueryDto,
      { limit: 5, unexpected: 'x' },
      { whitelist: true },
    )
    expect(invalid).toEqual([])
    expect(instance.unexpected).toBeUndefined()
  })
})
