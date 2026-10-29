import { BadRequestException } from '@nestjs/common'
import type { ArgumentMetadata } from '@nestjs/common'
import { RegisterDto } from '../../user/dto/register.dto'
import { createValidationPipe } from './validation.pipe'
import type { FieldValidationError } from './validation.pipe'

interface ValidationResponse {
  code?: string
  message?: string
  details?: { fields?: FieldValidationError[] }
}

const metadata = (metatype: new () => object): ArgumentMetadata => ({ type: 'body', metatype })

const responseFor = async (
  metatype: new () => object,
  payload: unknown,
): Promise<ValidationResponse | undefined> => {
  try {
    await createValidationPipe().transform(payload, metadata(metatype))
    return undefined
  } catch (error) {
    if (error instanceof BadRequestException) {
      return error.getResponse() as ValidationResponse
    }
    throw error
  }
}

const fieldsFor = async (
  metatype: new () => object,
  payload: unknown,
): Promise<FieldValidationError[]> => (await responseFor(metatype, payload))?.details?.fields ?? []

const base: Record<string, unknown> = {
  firstName: 'Juan',
  lastName: 'Perez',
  email: 'cliente@example.com',
  phone: '11223344',
  password: 'secreto123',
  app: 'store',
}

describe('createValidationPipe (auth)', () => {
  it('acepta un registro válido', async () => {
    await expect(fieldsFor(RegisterDto, base)).resolves.toEqual([])
  })

  it.each<{ name: string; payload: Record<string, unknown>; expected: string[] }>([
    {
      name: 'nombre vacío',
      payload: { ...base, firstName: '' },
      expected: ['El campo nombre es obligatorio.'],
    },
    {
      name: 'email inválido',
      payload: { ...base, email: 'no-es-email' },
      expected: ['Ingresá un correo electrónico válido'],
    },
    {
      name: 'teléfono inválido',
      payload: { ...base, phone: 'abc' },
      expected: ['Ingresá un teléfono válido'],
    },
    {
      name: 'contraseña corta',
      payload: { ...base, password: 'corta' },
      expected: ['El campo contraseña debe tener al menos 8 caracteres.'],
    },
    {
      name: 'aplicación inválida',
      payload: { ...base, app: 'otra' },
      expected: ['La aplicación indicada no es válida'],
    },
    {
      name: 'campo no permitido',
      payload: { ...base, hacker: 'x' },
      expected: ['El campo hacker no está permitido.'],
    },
  ])('$name → devuelve un mensaje claro en español', async ({ payload, expected }) => {
    const fields = await fieldsFor(RegisterDto, payload)

    expect(fields.map((field) => field.message)).toEqual(expect.arrayContaining(expected))
  })

  it('devuelve el envelope VALIDATION_ERROR con detalles por campo', async () => {
    const response = await responseFor(RegisterDto, { ...base, firstName: '' })

    expect(response?.code).toBe('VALIDATION_ERROR')
    expect(response?.message).toBe('El campo nombre es obligatorio.')
    expect(response?.details?.fields?.length).toBeGreaterThan(0)
  })

  it('no devuelve mensajes por defecto en inglés', async () => {
    const fields = await fieldsFor(RegisterDto, {
      firstName: '',
      lastName: '',
      email: 'no-es-email',
      phone: 'x',
      password: 'x',
      app: 'otra',
    })

    expect(fields.map((field) => field.message).join(' ')).not.toMatch(
      /\b(must|should|failed|invalid)\b/i,
    )
  })
})
