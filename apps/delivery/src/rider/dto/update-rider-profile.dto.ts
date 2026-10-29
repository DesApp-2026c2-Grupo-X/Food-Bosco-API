import { IsNotEmpty, IsString, Matches, MaxLength, ValidateIf } from 'class-validator'

const PHONE_PATTERN = /^\+?[\d\s().-]{7,50}$/

export class UpdateRiderProfileDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(PHONE_PATTERN, { message: 'Ingresá un teléfono válido' })
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
