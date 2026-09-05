import { IsBoolean, IsNotEmpty, IsString } from 'class-validator'

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
  @IsBoolean()
  active!: boolean
}
