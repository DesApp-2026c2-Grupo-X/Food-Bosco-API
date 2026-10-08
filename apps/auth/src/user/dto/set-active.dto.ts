import { Transform } from 'class-transformer'
import { IsBoolean } from 'class-validator'

type BooleanInput = boolean | string | number

export class SetActiveDto {
  @Transform(({ obj, key }): BooleanInput => obj[key] as BooleanInput)
  @IsBoolean()
  active!: boolean
}
