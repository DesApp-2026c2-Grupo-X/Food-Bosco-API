import { IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator'

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  categoryId?: string

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description?: string

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number

  @IsOptional()
  @IsString()
  @MaxLength(500)
  image?: string
}
