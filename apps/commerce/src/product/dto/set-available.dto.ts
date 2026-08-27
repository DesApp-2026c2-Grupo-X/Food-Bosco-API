import { IsBoolean } from 'class-validator'

export class SetAvailableDto {
  @IsBoolean()
  available!: boolean
}
