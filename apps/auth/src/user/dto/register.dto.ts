import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator'

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName!: string

  @IsEmail()
  email!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  phone!: string

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string
}
