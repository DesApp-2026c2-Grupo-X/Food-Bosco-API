import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator'

export class UpdateCartItemDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99)
  quantity?: number

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
