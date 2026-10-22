import { BadRequestException, ValidationPipe } from '@nestjs/common'
import type { ValidationError } from 'class-validator'
import { ERROR_CODES } from '../constants'

export interface FieldValidationError {
  field: string
  message: string
}

const translate = (field: string, message: string): string =>
  /should not exist/i.test(message) ? `El campo ${field} no está permitido` : message

const flatten = (errors: ValidationError[], parent = ''): FieldValidationError[] =>
  errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property
    const own = Object.values(error.constraints ?? {}).map((message) => ({
      field,
      message: translate(field, message),
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
