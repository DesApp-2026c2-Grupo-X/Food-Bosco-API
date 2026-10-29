import { IsBoolean, IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator'
import { Transform } from 'class-transformer'

type BooleanInput = boolean | string | number

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

export class CreateShiftDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string

  @IsString()
  @IsNotEmpty()
  @Matches(TIME_PATTERN, { message: 'La hora de inicio debe tener formato HH:mm' })
  startTime!: string

  @IsString()
  @IsNotEmpty()
  @Matches(TIME_PATTERN, { message: 'La hora de fin debe tener formato HH:mm' })
  endTime!: string
}

export class SetActiveDto {
  @Transform(({ obj, key }): BooleanInput => obj[key] as BooleanInput)
  @IsBoolean()
  active!: boolean
}
