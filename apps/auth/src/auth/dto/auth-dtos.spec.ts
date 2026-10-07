import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import type { ValidatorOptions } from 'class-validator'
import { LoginDto } from '../../user/dto/login.dto'
import { RegisterDto } from '../../user/dto/register.dto'
import { RefreshDto } from './refresh.dto'
import { RequestPasswordRecoveryDto } from './request-password-recovery.dto'
import { ResetPasswordDto } from './reset-password.dto'

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

const validRegister = {
  firstName: 'Juan',
  lastName: 'Perez',
  email: 'cliente@example.com',
  phone: '11223344',
  password: 'secreto123',
}

describe('RefreshDto (RQ-AUTH-07)', () => {
  it.each([
    { name: 'token válido', payload: { refreshToken: 'abc' }, valid: true },
    { name: 'token largo sin límite', payload: { refreshToken: 'a'.repeat(512) }, valid: true },
    { name: 'token vacío', payload: { refreshToken: '' }, valid: false },
    { name: 'sin token', payload: {}, valid: false },
    { name: 'token no string', payload: { refreshToken: 123 }, valid: false },
    { name: 'token null', payload: { refreshToken: null }, valid: false },
  ])('$name → válido=$valid', async ({ payload, valid }) => {
    const { invalid } = await check(RefreshDto, payload)
    expect(invalid.length === 0).toBe(valid)
  })

  it('con whitelist descarta campos extra', async () => {
    const { instance, invalid } = await check(
      RefreshDto,
      { refreshToken: 'abc', injected: true },
      { whitelist: true },
    )

    expect(invalid).toEqual([])
    expect(instance.injected).toBeUndefined()
  })
})

describe('RequestPasswordRecoveryDto (RQ-AUTH-09)', () => {
  it.each([
    { name: 'correo simple', payload: { email: 'a@b.com' }, valid: true },
    { name: 'correo con subdominio', payload: { email: 'user@sub.dominio.co' }, valid: true },
    { name: 'correo con + alias', payload: { email: 'a.b+c@dominio.co' }, valid: true },
    { name: 'sin arroba', payload: { email: 'no-email' }, valid: false },
    { name: 'sin dominio', payload: { email: 'a@' }, valid: false },
    { name: 'vacío', payload: { email: '' }, valid: false },
    { name: 'sin email', payload: {}, valid: false },
    { name: 'no string', payload: { email: 123 }, valid: false },
  ])('$name → válido=$valid', async ({ payload, valid }) => {
    const { invalid } = await check(RequestPasswordRecoveryDto, payload)
    expect(invalid.length === 0).toBe(valid)
  })

  it('con whitelist descarta campos extra', async () => {
    const { instance, invalid } = await check(
      RequestPasswordRecoveryDto,
      { email: 'a@b.com', injected: true },
      { whitelist: true },
    )

    expect(invalid).toEqual([])
    expect(instance.injected).toBeUndefined()
  })
})

describe('ResetPasswordDto (RQ-AUTH-10)', () => {
  it.each([
    {
      name: 'token y password de 8 (mínimo)',
      payload: { token: 'tok', newPassword: 'a'.repeat(8) },
      valid: true,
    },
    {
      name: 'password de 128 (máximo)',
      payload: { token: 'tok', newPassword: 'a'.repeat(128) },
      valid: true,
    },
    {
      name: 'password de 7 (bajo el mínimo)',
      payload: { token: 'tok', newPassword: 'a'.repeat(7) },
      valid: false,
    },
    {
      name: 'password de 129 (sobre el máximo)',
      payload: { token: 'tok', newPassword: 'a'.repeat(129) },
      valid: false,
    },
    { name: 'token vacío', payload: { token: '', newPassword: 'a'.repeat(8) }, valid: false },
    { name: 'sin token', payload: { newPassword: 'a'.repeat(8) }, valid: false },
    { name: 'sin password', payload: { token: 'tok' }, valid: false },
    { name: 'password no string', payload: { token: 'tok', newPassword: 123 }, valid: false },
  ])('$name → válido=$valid', async ({ payload, valid }) => {
    const { invalid } = await check(ResetPasswordDto, payload)
    expect(invalid.length === 0).toBe(valid)
  })

  it('con whitelist descarta campos extra', async () => {
    const { instance, invalid } = await check(
      ResetPasswordDto,
      { token: 'tok', newPassword: 'a'.repeat(8), injected: true },
      { whitelist: true },
    )

    expect(invalid).toEqual([])
    expect(instance.injected).toBeUndefined()
  })
})

describe('LoginDto (RQ-AUTH-04)', () => {
  it.each([
    { name: 'email y password válidos', payload: validRegister, valid: true },
    { name: 'password de una letra', payload: { email: 'a@b.com', password: 'x' }, valid: true },
    {
      name: 'email inválido',
      payload: { email: 'no-email', password: 'secreto123' },
      valid: false,
    },
    { name: 'email vacío', payload: { email: '', password: 'secreto123' }, valid: false },
    { name: 'password vacío', payload: { email: 'a@b.com', password: '' }, valid: false },
    { name: 'sin password', payload: { email: 'a@b.com' }, valid: false },
    { name: 'sin email', payload: { password: 'secreto123' }, valid: false },
    { name: 'password no string', payload: { email: 'a@b.com', password: 123 }, valid: false },
  ])('$name → válido=$valid', async ({ payload, valid }) => {
    const { invalid } = await check(LoginDto, payload)
    expect(invalid.length === 0).toBe(valid)
  })

  it('con whitelist descarta campos extra', async () => {
    const { instance, invalid } = await check(
      LoginDto,
      { email: 'a@b.com', password: 'secreto123', injected: true },
      { whitelist: true },
    )

    expect(invalid).toEqual([])
    expect(instance.injected).toBeUndefined()
  })
})

describe('RegisterDto (RQ-AUTH-01)', () => {
  it.each([
    { name: 'payload completo válido', payload: validRegister, valid: true },
    {
      name: 'firstName de 100 (límite)',
      payload: { ...validRegister, firstName: 'a'.repeat(100) },
      valid: true,
    },
    {
      name: 'lastName de 100 (límite)',
      payload: { ...validRegister, lastName: 'a'.repeat(100) },
      valid: true,
    },
    {
      name: 'phone de 50 (límite)',
      payload: { ...validRegister, phone: '1'.repeat(50) },
      valid: true,
    },
    {
      name: 'password de 8 (límite)',
      payload: { ...validRegister, password: 'a'.repeat(8) },
      valid: true,
    },
    {
      name: 'password de 128 (límite)',
      payload: { ...validRegister, password: 'a'.repeat(128) },
      valid: true,
    },
    {
      name: 'firstName de 101',
      payload: { ...validRegister, firstName: 'a'.repeat(101) },
      valid: false,
    },
    {
      name: 'lastName de 101',
      payload: { ...validRegister, lastName: 'a'.repeat(101) },
      valid: false,
    },
    { name: 'phone de 51', payload: { ...validRegister, phone: '1'.repeat(51) }, valid: false },
    { name: 'password de 7', payload: { ...validRegister, password: 'a'.repeat(7) }, valid: false },
    {
      name: 'password de 129',
      payload: { ...validRegister, password: 'a'.repeat(129) },
      valid: false,
    },
    { name: 'email inválido', payload: { ...validRegister, email: 'no-email' }, valid: false },
    { name: 'firstName vacío', payload: { ...validRegister, firstName: '' }, valid: false },
    { name: 'phone vacío', payload: { ...validRegister, phone: '' }, valid: false },
    { name: 'sin email', payload: { ...validRegister, email: undefined }, valid: false },
    { name: 'sin password', payload: { ...validRegister, password: undefined }, valid: false },
  ])('$name → válido=$valid', async ({ payload, valid }) => {
    const { invalid } = await check(RegisterDto, payload)
    expect(invalid.length === 0).toBe(valid)
  })

  it('rechaza un teléfono no numérico sólo si el contrato lo exige (hoy acepta cualquier string)', async () => {
    const { invalid } = await check(RegisterDto, { ...validRegister, phone: 'no-es-telefono' })

    expect(invalid).toEqual([])
  })

  it('con whitelist descarta campos extra', async () => {
    const { instance, invalid } = await check(
      RegisterDto,
      { ...validRegister, role: 'super_admin' },
      { whitelist: true },
    )

    expect(invalid).toEqual([])
    expect(instance.injected).toBeUndefined()
    expect(instance.role).toBeUndefined()
  })
})
