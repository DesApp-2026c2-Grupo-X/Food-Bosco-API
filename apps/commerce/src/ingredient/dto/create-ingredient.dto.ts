import { IsNotEmpty, IsString, MaxLength } from 'class-validator'

export class CreateIngredientDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  unit!: string
}
