import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator'
import { PHONE_PATTERN } from '../../config/validation/normalize'

export class UpdateProfileDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(PHONE_PATTERN, { message: 'Ingresá un teléfono válido' })
  phone!: string
}
