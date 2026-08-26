import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator'

export class UpdateRiderProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  vehicle?: string

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  phone?: string
}
