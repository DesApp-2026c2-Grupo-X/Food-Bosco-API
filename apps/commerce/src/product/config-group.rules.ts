import { ERROR_CODES } from '../config/constants'
import { DomainException } from '../config/exceptions/domain.exception'

export interface ConfigGroupShape {
  required?: boolean
  min?: number | null
  max?: number | null
}

export const isConfigGroupCoherent = ({ required, min, max }: ConfigGroupShape): boolean => {
  if (required === true && (min === undefined || min === null)) {
    return false
  }
  if (min !== undefined && min !== null && min < 0) {
    return false
  }
  if (max !== undefined && max !== null && max < 0) {
    return false
  }
  if (min !== undefined && min !== null && max !== undefined && max !== null && min > max) {
    return false
  }
  return true
}

export const assertConfigGroupCoherent = (group: ConfigGroupShape): void => {
  if (!isConfigGroupCoherent(group)) {
    throw new DomainException(
      ERROR_CODES.validationError,
      'La configuración del grupo es inconsistente (required/min/max)',
      400,
    )
  }
}
