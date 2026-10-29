import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator'
import { PHONE_PATTERN } from '../../config/validation/normalize'

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName?: string

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName?: string

  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Matches(PHONE_PATTERN, { message: 'Ingresá un teléfono válido' })
  phone?: string

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  branchId?: string
}
