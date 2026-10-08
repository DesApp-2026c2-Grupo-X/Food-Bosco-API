import { Type } from 'class-transformer'
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  ValidateNested,
} from 'class-validator'

export class RecipeOptionAdjustmentDto {
  @IsString()
  @IsNotEmpty()
  optionId!: string

  @IsNumber()
  @IsPositive()
  quantity!: number
}

export class RecipeItemDto {
  @IsString()
  @IsNotEmpty()
  ingredientId!: string

  @IsNumber()
  @IsPositive()
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
