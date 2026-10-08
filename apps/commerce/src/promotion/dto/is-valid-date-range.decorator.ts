import { registerDecorator } from 'class-validator'
import type { ValidationArguments, ValidationOptions } from 'class-validator'

interface DateRangeShape {
  startDate?: string
  endDate?: string
}

/**
 * RQ-CAT-13 / COM-02: valida que `startDate <= endDate` a nivel de DTO.
 * Si falta alguna fecha o su formato es inválido, deja que `@IsDateString` lo reporte.
 */
export const IsValidDateRange =
  (options?: ValidationOptions) =>
  (object: object, propertyName: string): void => {
    registerDecorator({
      name: 'isValidDateRange',
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate: (_value: unknown, args: ValidationArguments): boolean => {
          const { startDate, endDate } = args.object as DateRangeShape
          if (startDate === undefined || endDate === undefined) return true
          const start = Date.parse(startDate)
          const end = Date.parse(endDate)
          if (Number.isNaN(start) || Number.isNaN(end)) return true
          return start <= end
        },
      },
    })
  }
