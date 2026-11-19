import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export class SetPromotionCodeDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  code!: string | null
}
