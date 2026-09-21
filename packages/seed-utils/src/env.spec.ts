import { envBoolean, envJson, envNumber, envString } from './env'

const withEnv = (values: Record<string, string | undefined>): void => {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
}

describe('envString', () => {
  it.each([
    { name: 'valor presente', value: 'hola', fallback: 'x', expected: 'hola' },
    { name: 'vacío → fallback', value: '', fallback: 'x', expected: 'x' },
    { name: 'espacios → fallback', value: '   ', fallback: 'x', expected: 'x' },
    { name: 'undefined → fallback', value: undefined, fallback: 'x', expected: 'x' },
  ])('$name', ({ value, fallback, expected }) => {
    withEnv({ TEST_ENV_STR: value })
    expect(envString('TEST_ENV_STR', fallback)).toBe(expected)
  })
})

describe('envNumber', () => {
  it.each([
    { name: 'entero', value: '42', fallback: 0, expected: 42 },
    { name: 'decimal', value: '3.14', fallback: 0, expected: 3.14 },
    { name: 'inválido → fallback', value: 'abc', fallback: 7, expected: 7 },
    { name: 'vacío → fallback', value: '', fallback: 7, expected: 7 },
    { name: 'undefined → fallback', value: undefined, fallback: 7, expected: 7 },
    { name: 'NaN → fallback', value: 'NaN', fallback: 7, expected: 7 },
    { name: 'negativo', value: '-5', fallback: 0, expected: -5 },
  ])('$name', ({ value, fallback, expected }) => {
    withEnv({ TEST_ENV_NUM: value })
    expect(envNumber('TEST_ENV_NUM', fallback)).toBe(expected)
  })
})

describe('envBoolean', () => {
  it.each([
    { name: "'1' → true", value: '1', fallback: false, expected: true },
    { name: "'true' → true", value: 'true', fallback: false, expected: true },
    { name: "'TRUE' → true (case-insensitive)", value: 'TRUE', fallback: false, expected: true },
    { name: "'yes' → true", value: 'yes', fallback: false, expected: true },
    { name: "'on' → true", value: 'on', fallback: false, expected: true },
    { name: "'0' → false", value: '0', fallback: true, expected: false },
    { name: "'false' → false", value: 'false', fallback: true, expected: false },
    { name: 'cualquier otra cosa → false', value: 'nope', fallback: true, expected: false },
    { name: 'vacío → fallback', value: '', fallback: true, expected: true },
    { name: 'undefined → fallback', value: undefined, fallback: true, expected: true },
  ])('$name', ({ value, fallback, expected }) => {
    withEnv({ TEST_ENV_BOOL: value })
    expect(envBoolean('TEST_ENV_BOOL', fallback)).toBe(expected)
  })
})

describe('envJson', () => {
  it('parsea un JSON válido', () => {
    withEnv({ TEST_ENV_JSON: '{"a":1}' })
    expect(envJson('TEST_ENV_JSON', { a: 0 })).toEqual({ a: 1 })
  })

  it.each([
    { name: 'JSON inválido → fallback', value: '{nope}', fallback: { a: 0 } },
    { name: 'vacío → fallback', value: '', fallback: { a: 0 } },
    { name: 'undefined → fallback', value: undefined, fallback: { a: 0 } },
  ])('$name', ({ value, fallback }) => {
    withEnv({ TEST_ENV_JSON: value })
    expect(envJson('TEST_ENV_JSON', fallback)).toEqual(fallback)
  })
})
