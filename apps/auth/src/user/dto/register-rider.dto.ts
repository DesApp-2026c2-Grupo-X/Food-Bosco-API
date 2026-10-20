import { Transform } from 'class-transformer'
import { IsEmail, IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator'
import { normalizeEmail, PHONE_PATTERN } from '../../config/validation/normalize'

export class RegisterRiderDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName!: string

  @Transform(({ value }) => normalizeEmail(value))
  @IsEmail({}, { message: 'Ingresá un correo electrónico válido' })
  @MaxLength(254)
  email!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(PHONE_PATTERN, { message: 'Ingresá un teléfono válido' })
  phone!: string

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  vehicle!: string
}
