import { ToBoolean } from '../../config/validation/is-boolean-value.decorator'

export class SetAvailableDto {
  @ToBoolean()
  available!: boolean
}
