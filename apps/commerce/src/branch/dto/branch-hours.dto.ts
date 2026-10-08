import { Type } from 'class-transformer'
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsString,
  Matches,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
  ValidatorConstraint,
  registerDecorator,
} from 'class-validator'
import type { ValidationOptions, ValidatorConstraintInterface } from 'class-validator'
import { ToBoolean } from '../../config/validation/is-boolean-value.decorator'

@ValidatorConstraint({ name: 'uniqueDayOfWeek', async: false })
export class UniqueDayOfWeekConstraint implements ValidatorConstraintInterface {
  validate(hours: unknown): boolean {
    if (!Array.isArray(hours)) return true
    const days = hours.map((hour) => (hour as BranchHourDto | null | undefined)?.dayOfWeek)
    return new Set(days).size === days.length
  }

  defaultMessage(): string {
    return 'No se puede repetir el día de la semana'
  }
}

export const IsUniqueDayOfWeek =
  (validationOptions?: ValidationOptions) =>
  (object: object, propertyName: string): void => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: UniqueDayOfWeekConstraint,
    })
  }

export class BranchHourDto {
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number

  // Un día abierto (`closed:false`) exige una ventana de atención completa.
  // Un día cerrado (`closed:true`) puede omitirla, pero si declara una hora
  // igualmente se valida su formato/rango.
  @ValidateIf((dto: BranchHourDto, value?: string | null) => dto.closed === false || value != null)
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  opening?: string

  @ValidateIf((dto: BranchHourDto, value?: string | null) => dto.closed === false || value != null)
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  closing?: string

  @ToBoolean()
  closed!: boolean
}

export class UpdateBranchHoursDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUniqueDayOfWeek()
  @ValidateNested({ each: true })
  @Type(() => BranchHourDto)
  hours!: BranchHourDto[]
}
