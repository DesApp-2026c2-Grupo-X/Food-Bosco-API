import { IsBoolean, IsNotEmpty, IsString } from 'class-validator'
import { Transform } from 'class-transformer'

type BooleanInput = boolean | string | number

export class CreateShiftDto {
  @IsString()
  @IsNotEmpty()
  name!: string

  @IsString()
  @IsNotEmpty()
  startTime!: string

  @IsString()
  @IsNotEmpty()
  endTime!: string
}

export class SetActiveDto {
  @Transform(({ obj, key }): BooleanInput => obj[key] as BooleanInput)
  @IsBoolean()
  active!: boolean
}
