import {
  ConfigGroupType,
  configGroupTypeFromRest,
  configGroupTypeToRest,
} from './config-group-type.enum'

describe('configGroupTypeFromRest', () => {
  it.each<[string, ConfigGroupType]>([
    ['single', ConfigGroupType.SINGLE],
    ['multiple', ConfigGroupType.MULTIPLE],
  ])('convierte "%s" a %s', (rest, type) => {
    expect(configGroupTypeFromRest(rest)).toBe(type)
  })

  it.each(['SINGLE', 'Single', 'MULTIPLE', 'Multiple'])(
    'es insensible a mayúsculas: %s',
    (value) => {
      expect(configGroupTypeFromRest(value)).toBe(configGroupTypeFromRest(value.toLowerCase()))
    },
  )

  it.each(['', 'foo', 'single ', 'single multiple', 'once'])(
    'lanza error para un valor desconocido %p',
    (value) => {
      expect(() => configGroupTypeFromRest(value)).toThrow(`Unknown config group type: ${value}`)
    },
  )
})

describe('configGroupTypeToRest', () => {
  it.each<[ConfigGroupType, string]>([
    [ConfigGroupType.SINGLE, 'single'],
    [ConfigGroupType.MULTIPLE, 'multiple'],
  ])('convierte %s a "%s"', (type, rest) => {
    expect(configGroupTypeToRest(type)).toBe(rest)
  })

  it.each(Object.values(ConfigGroupType))(
    'es inversa de configGroupTypeFromRest para %s',
    (type) => {
      expect(configGroupTypeFromRest(configGroupTypeToRest(type))).toBe(type)
    },
  )
})
