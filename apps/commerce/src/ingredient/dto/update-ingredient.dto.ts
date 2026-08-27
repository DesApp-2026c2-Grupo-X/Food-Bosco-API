import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator'

export class UpdateIngredientDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  unit?: string
}
