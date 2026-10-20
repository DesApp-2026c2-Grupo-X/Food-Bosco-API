import { Transform } from 'class-transformer'
import { IsEmail, MaxLength } from 'class-validator'
import { normalizeEmail } from '../../config/validation/normalize'

export class RequestPasswordRecoveryDto {
  @Transform(({ value }) => normalizeEmail(value))
  @IsEmail({}, { message: 'Ingresá un correo electrónico válido' })
  @MaxLength(254)
  email!: string
}
