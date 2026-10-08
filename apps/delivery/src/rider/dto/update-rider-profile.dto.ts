import { IsNotEmpty, IsString, MaxLength, ValidateIf } from 'class-validator'

export class UpdateRiderProfileDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  phone?: string

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  firstName?: string

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  lastName?: string
}
