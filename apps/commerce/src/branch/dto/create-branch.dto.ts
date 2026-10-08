import {
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator'
import { ToBoolean } from '../../config/validation/is-boolean-value.decorator'

export class CreateBranchDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  addressText!: string

  @IsLatitude()
  latitude!: number

  @IsLongitude()
  longitude!: number

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string

  @IsOptional()
  @ToBoolean()
  active?: boolean
}
