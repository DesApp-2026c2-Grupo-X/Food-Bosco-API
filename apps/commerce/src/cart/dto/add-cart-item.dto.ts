import { IsArray, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator'

export class AddCartItemDto {
  @IsString()
  @IsNotEmpty()
  productId!: string

  @IsInt()
  @Min(1)
  quantity!: number

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observations?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  optionIds?: string[]
}
