import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, NotEquals } from 'class-validator'

export class AdjustStockDto {
  @IsString()
  @IsNotEmpty()
  branchId!: string

  @IsString()
  @IsNotEmpty()
  ingredientId!: string

  @IsInt({ message: 'La cantidad a ajustar debe ser un número entero' })
  @NotEquals(0, { message: 'El ajuste de stock no puede ser cero' })
  delta!: number

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string
}
