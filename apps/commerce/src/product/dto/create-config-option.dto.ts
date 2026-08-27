import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator'

export class CreateConfigOptionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string

  @IsNumber()
  extraPrice!: number

  @IsOptional()
  @IsBoolean()
  available?: boolean
}
