import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator'

export class UpdateConfigOptionDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string

  @IsOptional()
  @IsNumber()
  extraPrice?: number

  @IsOptional()
  @IsBoolean()
  available?: boolean
}
