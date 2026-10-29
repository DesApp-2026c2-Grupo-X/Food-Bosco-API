import { BadRequestException, ValidationPipe } from '@nestjs/common'
import type { ValidationError } from 'class-validator'
import { ERROR_CODES } from '../constants'

export interface FieldValidationError {
  field: string
  message: string
}

const FIELD_LABELS: Record<string, string> = {
  active: 'activo',
  activeOnly: 'solo activos',
  addressId: 'dirección',
  addressText: 'dirección',
  app: 'aplicación',
  available: 'disponibilidad',
  branchId: 'sucursal',
  brand: 'marca',
  categoryId: 'categoría',
  city: 'ciudad',
  closed: 'cerrado',
  closing: 'hora de cierre',
  code: 'código',
  dayOfWeek: 'día de la semana',
  deliveryAddress: 'dirección de entrega',
  delta: 'cantidad',
  description: 'descripción',
  email: 'correo electrónico',
  endDate: 'fecha de fin',
  endTime: 'hora de fin',
  extraPrice: 'precio adicional',
  firstName: 'nombre',
  from: 'fecha desde',
  groupBy: 'agrupación',
  hours: 'horarios',
  image: 'imagen',
  ingredientId: 'ingrediente',
  items: 'ítems',
  key: 'clave',
  label: 'etiqueta',
  lastName: 'apellido',
  lat: 'latitud',
  latitude: 'latitud',
  limit: 'límite',
  lng: 'longitud',
  longitude: 'longitud',
  max: 'máximo',
  min: 'mínimo',
  model: 'modelo',
  name: 'nombre',
  newPassword: 'nueva contraseña',
  observations: 'observaciones',
  offset: 'desplazamiento',
  online: 'disponibilidad en línea',
  opening: 'hora de apertura',
  optionAdjustments: 'ajustes de opciones',
  optionId: 'opción',
  optionIds: 'opciones',
  options: 'opciones',
  order: 'orden',
  password: 'contraseña',
  phone: 'teléfono',
  plate: 'patente',
  postalCode: 'código postal',
  price: 'precio',
  productId: 'producto',
  quantity: 'cantidad',
  radiusKm: 'radio en kilómetros',
  reason: 'motivo',
  refreshToken: 'token de sesión',
  required: 'requerido',
  role: 'rol',
  roles: 'roles',
  search: 'búsqueda',
  startDate: 'fecha de inicio',
  startTime: 'hora de inicio',
  status: 'estado',
  text: 'texto',
  to: 'fecha hasta',
  token: 'token',
  type: 'tipo',
  unit: 'unidad',
  value: 'valor',
  vehicle: 'vehículo',
}

const DEFAULT_MESSAGE =
  /should not be empty|must be a string|must be an integer number|must be a number|must not be less than|must not be greater than|must be shorter than or equal to|must be longer than or equal to|must be an email|must be a boolean value|must be an array|must be unique|must contain no more than|must contain at least|must be one of the following values|must match|must be a latitude|must be a longitude|must be a valid ISO 8601|must be a positive number|should not be equal to|should not be null or undefined|has failed the validation|must be a date string|must be a UUID|must be a mongodb id|must be an object|must be a non-empty object|must be a number string|must be a URL/i

const labelFor = (field: string): string => {
  const segments = field.split('.').filter((segment) => !/^\d+$/.test(segment))
  const last = segments[segments.length - 1] ?? field
  return FIELD_LABELS[last] ?? last
}

const valueFor = (message: string, pattern: RegExp): string | undefined =>
  message.match(pattern)?.[1]

const translate = (field: string, constraint: string, message: string): string => {
  const label = labelFor(field)

  if (/should not exist/i.test(message)) {
    return `El campo ${label} no está permitido.`
  }

  if (!DEFAULT_MESSAGE.test(message)) {
    return message
  }

  switch (constraint) {
    case 'isNotEmpty':
    case 'isDefined':
      return `El campo ${label} es obligatorio.`
    case 'isString':
      return `El campo ${label} debe ser texto.`
    case 'isInt':
      return `El campo ${label} debe ser un número entero.`
    case 'isNumber':
    case 'isNumberString':
      return `El campo ${label} debe ser un número.`
    case 'min': {
      const min = valueFor(message, /must not be less than (-?[\d.]+)/)
      return min
        ? `El campo ${label} debe ser mayor o igual a ${min}.`
        : `El campo ${label} no cumple el valor mínimo permitido.`
    }
    case 'max': {
      const max = valueFor(message, /must not be greater than (-?[\d.]+)/)
      return max
        ? `El campo ${label} debe ser menor o igual a ${max}.`
        : `El campo ${label} no cumple el valor máximo permitido.`
    }
    case 'maxLength': {
      const max = valueFor(message, /equal to (\d+) characters/)
      return max
        ? `El campo ${label} no puede superar los ${max} caracteres.`
        : `El campo ${label} es demasiado largo.`
    }
    case 'minLength': {
      const min = valueFor(message, /equal to (\d+) characters/)
      return min
        ? `El campo ${label} debe tener al menos ${min} caracteres.`
        : `El campo ${label} es demasiado corto.`
    }
    case 'arrayMaxSize': {
      const max = valueFor(message, /more than (\d+) elements/)
      return max
        ? `El campo ${label} no puede tener más de ${max} elementos.`
        : `El campo ${label} tiene demasiados elementos.`
    }
    case 'arrayMinSize': {
      const min = valueFor(message, /at least (\d+) elements/)
      return min
        ? `El campo ${label} debe tener al menos ${min} elementos.`
        : `El campo ${label} tiene demasiados pocos elementos.`
    }
    case 'arrayUnique':
      return `El campo ${label} no puede tener valores repetidos.`
    case 'arrayNotEmpty':
      return `El campo ${label} debe tener al menos un elemento.`
    case 'isEmail':
      return 'Ingresá un correo electrónico válido.'
    case 'isBoolean':
      return `El campo ${label} debe ser verdadero o falso.`
    case 'isArray':
      return `El campo ${label} debe ser una lista.`
    case 'isIn':
    case 'isEnum': {
      const values = valueFor(message, /following values: (.+)$/)
      return values
        ? `El campo ${label} debe ser uno de: ${values}.`
        : `El campo ${label} tiene un valor no permitido.`
    }
    case 'matches':
      return `El campo ${label} tiene un formato inválido.`
    case 'isLatitude':
      return 'La latitud no es válida.'
    case 'isLongitude':
      return 'La longitud no es válida.'
    case 'isISO8601':
    case 'isDateString':
      return `El campo ${label} debe ser una fecha válida.`
    case 'isPositive':
      return `El campo ${label} debe ser un número positivo.`
    case 'notEquals': {
      const value = valueFor(message, /should not be equal to (.+)$/)
      return value
        ? `El campo ${label} no puede ser igual a ${value}.`
        : `El campo ${label} tiene un valor no permitido.`
    }
    case 'isMongoId':
    case 'isUUID':
      return `El campo ${label} no es un identificador válido.`
    case 'isCoherentConfigGroup':
      return 'La configuración del grupo no es válida.'
    default:
      return `El campo ${label} no es válido.`
  }
}

const flatten = (errors: ValidationError[], parent = ''): FieldValidationError[] =>
  errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property
    const own = Object.entries(error.constraints ?? {}).map(([constraint, message]) => ({
      field,
      message: translate(field, constraint, message),
    }))
    const children = error.children?.length ? flatten(error.children, field) : []
    return [...own, ...children]
  })

export const createValidationPipe = (): ValidationPipe =>
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
    stopAtFirstError: false,
    exceptionFactory: (errors) => {
      const fields = flatten(errors)
      return new BadRequestException({
        code: ERROR_CODES.validationError,
        message: fields[0]?.message ?? 'Revisá los datos ingresados.',
        details: { fields },
      })
    },
  })
