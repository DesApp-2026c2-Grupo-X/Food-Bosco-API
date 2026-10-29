import { BadRequestException } from '@nestjs/common'
import type { ArgumentMetadata } from '@nestjs/common'
import { TripQueryDto } from '../../offer/dto/trip-query.dto'
import { AvailabilityDto } from '../../rider/dto/availability.dto'
import { LocationDto } from '../../rider/dto/location.dto'
import { UpdateRiderProfileDto } from '../../rider/dto/update-rider-profile.dto'
import { UpdateVehicleDto } from '../../rider/dto/update-vehicle.dto'
import { CreateShiftDto } from '../../shift/dto/shift.dto'
import { CreateZoneDto } from '../../zone/dto/zone.dto'
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

describe('createValidationPipe (delivery)', () => {
  it('acepta un vehículo válido', async () => {
    await expect(fieldsFor(UpdateVehicleDto, { type: 'moto', brand: 'Honda' })).resolves.toEqual([])
  })

  it.each<{
    name: string
    metatype: new () => object
    payload: Record<string, unknown>
    expected: string[]
  }>([
    {
      name: 'tipo de vehículo inválido',
      metatype: UpdateVehicleDto,
      payload: { type: 'avion' },
      expected: ['El campo tipo tiene un valor no permitido.'],
    },
    {
      name: 'marca demasiado larga',
      metatype: UpdateVehicleDto,
      payload: { type: 'moto', brand: 'a'.repeat(51) },
      expected: ['El campo marca no puede superar los 50 caracteres.'],
    },
    {
      name: 'latitud inválida',
      metatype: LocationDto,
      payload: { lat: 100, lng: 0 },
      expected: ['La latitud no es válida.'],
    },
    {
      name: 'longitud inválida',
      metatype: LocationDto,
      payload: { lat: 0, lng: 200 },
      expected: ['La longitud no es válida.'],
    },
    {
      name: 'turno sin nombre',
      metatype: CreateShiftDto,
      payload: { name: '', startTime: '08:00', endTime: '16:00' },
      expected: ['El campo nombre es obligatorio.'],
    },
    {
      name: 'turno sin hora de inicio',
      metatype: CreateShiftDto,
      payload: { name: 'Mañana', startTime: '', endTime: '16:00' },
      expected: ['El campo hora de inicio es obligatorio.'],
    },
    {
      name: 'disponibilidad no booleana',
      metatype: AvailabilityDto,
      payload: { online: 'si' },
      expected: ['El campo disponibilidad en línea debe ser verdadero o falso.'],
    },
    {
      name: 'límite fuera de rango',
      metatype: TripQueryDto,
      payload: { limit: 101 },
      expected: ['El campo límite debe ser menor o igual a 100.'],
    },
    {
      name: 'hora de turno inválida',
      metatype: CreateShiftDto,
      payload: { name: 'Mañana', startTime: '25:00', endTime: '13:00' },
      expected: ['La hora de inicio debe tener formato HH:mm'],
    },
    {
      name: 'radio de zona negativo',
      metatype: CreateZoneDto,
      payload: {
        name: 'Centro',
        center: { latitude: -34.6, longitude: -58.4 },
        radiusKm: -1,
      },
      expected: ['El campo radio en kilómetros debe ser un número positivo.'],
    },
    {
      name: 'centro de zona fuera de rango',
      metatype: CreateZoneDto,
      payload: {
        name: 'Centro',
        center: { latitude: 100, longitude: -58.4 },
        radiusKm: 1,
      },
      expected: ['La latitud no es válida.'],
    },
    {
      name: 'teléfono de rider inválido',
      metatype: UpdateRiderProfileDto,
      payload: { phone: 'abc' },
      expected: ['Ingresá un teléfono válido'],
    },
  ])('$name → devuelve un mensaje claro en español', async ({ metatype, payload, expected }) => {
    const fields = await fieldsFor(metatype, payload)

    expect(fields.map((field) => field.message)).toEqual(expect.arrayContaining(expected))
  })

  it('devuelve el envelope VALIDATION_ERROR con detalles por campo', async () => {
    const response = await responseFor(LocationDto, { lat: 100, lng: 200 })

    expect(response?.code).toBe('VALIDATION_ERROR')
    expect(response?.message).toBe('La latitud no es válida.')
    expect(response?.details?.fields?.length).toBeGreaterThan(0)
  })

  it('no devuelve mensajes por defecto en inglés', async () => {
    const fields = await fieldsFor(UpdateVehicleDto, { type: 'avion', brand: 'a'.repeat(51) })

    expect(fields.map((field) => field.message).join(' ')).not.toMatch(
      /\b(must|should|failed|invalid)\b/i,
    )
  })
})
