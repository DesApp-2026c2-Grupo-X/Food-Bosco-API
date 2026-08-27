import { IsArray, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator'

export class UpdateCartItemDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observations?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  optionIds?: string[]
}
