import { ToBoolean } from '../../config/validation/is-boolean-value.decorator'

export class SetProductAvailabilityDto {
  @ToBoolean()
  available!: boolean
}
