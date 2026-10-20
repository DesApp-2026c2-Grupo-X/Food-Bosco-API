import { Transform } from 'class-transformer'
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator'
import { normalizeEmail } from '../../config/validation/normalize'

export class LoginDto {
  @Transform(({ value }) => normalizeEmail(value))
  @IsEmail({}, { message: 'Ingresá un correo electrónico válido' })
  @MaxLength(254)
  email!: string

  @IsString()
  @IsNotEmpty()
  password!: string
}
