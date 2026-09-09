import { Type } from 'class-transformer'
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator'

export class RecipeOptionAdjustmentDto {
  @IsString()
  @IsNotEmpty()
  optionId!: string

  @IsNumber()
  @Min(0)
  quantity!: number
}

export class RecipeItemDto {
  @IsString()
  @IsNotEmpty()
  ingredientId!: string

  @IsNumber()
  @Min(0)
  quantity!: number

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipeOptionAdjustmentDto)
  optionAdjustments?: RecipeOptionAdjustmentDto[]
}

export class SetRecipeDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipeItemDto)
  items!: RecipeItemDto[]
}
