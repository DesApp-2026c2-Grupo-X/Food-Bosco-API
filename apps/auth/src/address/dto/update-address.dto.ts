import { IsLatitude, IsLongitude, IsOptional, IsString, MaxLength } from 'class-validator'

export class UpdateAddressDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string

  @IsOptional()
  @IsString()
  @MaxLength(300)
  text?: string

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string

  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string

  @IsOptional()
  @IsLatitude()
  latitude?: number

  @IsOptional()
  @IsLongitude()
  longitude?: number
}
