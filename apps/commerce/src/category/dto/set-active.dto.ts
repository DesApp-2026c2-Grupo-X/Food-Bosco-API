import { ToBoolean } from '../../config/validation/is-boolean-value.decorator'

export class SetActiveDto {
  @ToBoolean()
  active!: boolean
}
