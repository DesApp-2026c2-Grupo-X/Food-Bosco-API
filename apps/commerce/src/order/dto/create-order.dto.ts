import { Type } from 'class-transformer'
import {
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator'

export class DeliveryAddressDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  text!: string

  @IsLatitude()
  latitude!: number

  @IsLongitude()
  longitude!: number
}

export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  addressId!: string

  @ValidateNested()
  @Type(() => DeliveryAddressDto)
  deliveryAddress!: DeliveryAddressDto
}
