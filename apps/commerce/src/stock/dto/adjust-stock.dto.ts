import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator'

export class AdjustStockDto {
  @IsString()
  @IsNotEmpty()
  branchId!: string

  @IsString()
  @IsNotEmpty()
  ingredientId!: string

  @IsNumber()
  delta!: number

  @IsOptional()
  @IsString()
  reason?: string
}
