import { IsLatitude, IsLongitude, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator'

export class CreateAddressDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  label!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  text!: string

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string

  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string

  @IsLatitude()
  latitude!: number

  @IsLongitude()
  longitude!: number
}
