import { IsNotEmpty, IsNumber, Min } from 'class-validator'

export class UpdateParameterDto {
  @IsNumber()
  @Min(0.0001)
  value!: number
}

export class CreateParameterDto {
  @IsNotEmpty()
  key!: string

  @IsNumber()
  @Min(0.0001)
  value!: number

  @IsNotEmpty()
  unit!: string
}
