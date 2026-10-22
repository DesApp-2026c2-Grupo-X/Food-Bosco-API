import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator'

export class AddCartItemDto {
  @IsString()
  @IsNotEmpty()
  productId!: string

  @IsInt()
  @Min(1)
  @Max(99)
  quantity!: number

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observations?: string

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  optionIds?: string[]
}
