export type RawRecord = Record<string, unknown>

export const asString = (value: unknown): string => (value == null ? '' : String(value))

export const nullableString = (value: unknown): string | null =>
  value == null ? null : String(value)

export const asNumber = (value: unknown): number => (value == null ? 0 : Number(value))

export const nullableNumber = (value: unknown): number | null =>
  value == null ? null : Number(value)

export const asBoolean = (value: unknown): boolean => Boolean(value)

export const idOf = (raw: RawRecord): string => asString(raw.id ?? raw._id)

export const asStringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.map((entry) => asString(entry)) : []

export const asRecordList = (value: unknown): RawRecord[] =>
  Array.isArray(value)
    ? value.filter((entry): entry is RawRecord => typeof entry === 'object' && entry !== null)
    : []
