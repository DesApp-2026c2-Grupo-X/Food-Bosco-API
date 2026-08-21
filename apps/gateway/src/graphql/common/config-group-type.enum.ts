import { registerEnumType } from '@nestjs/graphql'

export enum ConfigGroupType {
  SINGLE = 'SINGLE',
  MULTIPLE = 'MULTIPLE',
}

registerEnumType(ConfigGroupType, { name: 'ConfigGroupType' })

const BY_STRING: Record<string, ConfigGroupType> = {
  single: ConfigGroupType.SINGLE,
  multiple: ConfigGroupType.MULTIPLE,
}

export const configGroupTypeFromRest = (value: string): ConfigGroupType => {
  const type = BY_STRING[value.toLowerCase()]
  if (!type) {
    throw new Error(`Unknown config group type: ${value}`)
  }
  return type
}

export const configGroupTypeToRest = (type: ConfigGroupType): string => type.toLowerCase()
