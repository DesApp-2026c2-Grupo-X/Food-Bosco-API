import {
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator'

export class UpdateBranchDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  addressText?: string

  @IsOptional()
  @IsLatitude()
  latitude?: number

  @IsOptional()
  @IsLongitude()
  longitude?: number

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string
}
