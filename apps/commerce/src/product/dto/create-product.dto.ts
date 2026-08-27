import { IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator'

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  categoryId!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description!: string

  @IsNumber()
  @Min(0)
  price!: number

  @IsOptional()
  @IsString()
  @MaxLength(500)
  image?: string
}
