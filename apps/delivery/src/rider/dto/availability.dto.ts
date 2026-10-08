import { Transform } from 'class-transformer'
import { IsBoolean } from 'class-validator'

type BooleanInput = boolean | string | number

export class AvailabilityDto {
  @Transform(({ obj, key }): BooleanInput => obj[key] as BooleanInput)
  @IsBoolean()
  online!: boolean
}
