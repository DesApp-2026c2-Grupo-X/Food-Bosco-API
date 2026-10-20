export const PHONE_PATTERN = /^\+?[\d\s().-]{7,50}$/

export const normalizeEmail = (value: unknown): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value

export const normalizeOptionalEmail = (value: unknown): unknown =>
  value === undefined || value === null ? value : normalizeEmail(value)
