import { IsBoolean } from 'class-validator'

export class SetProductAvailabilityDto {
  @IsBoolean()
  available!: boolean
}
