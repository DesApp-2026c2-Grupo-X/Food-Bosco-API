import { Type } from 'class-transformer'
import { IsLatitude, IsLongitude, IsOptional } from 'class-validator'

export class PromotionCatalogQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  lat?: number

  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  lng?: number
}
