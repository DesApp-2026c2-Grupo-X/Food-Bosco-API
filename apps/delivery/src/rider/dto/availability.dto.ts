import { IsBoolean } from 'class-validator'

export class AvailabilityDto {
  @IsBoolean()
  online!: boolean
}
