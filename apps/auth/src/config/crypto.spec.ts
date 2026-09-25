import { randomToken, sha256 } from './crypto'

const EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
const ABC_SHA256 = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'

describe('sha256', () => {
  it.each([
    { name: 'cadena vacía', value: '', expected: EMPTY_SHA256 },
    { name: 'abc', value: 'abc', expected: ABC_SHA256 },
    {
      name: 'texto largo',
      value: 'a'.repeat(1_000),
      expected: '41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3',
    },
  ])('calcula el hash esperado para $name', ({ value, expected }) => {
    expect(sha256(value)).toBe(expected)
  })

  it.each([
    { name: 'mismo valor', a: 'token', b: 'token', equal: true },
    { name: 'distinto valor', a: 'token', b: 'token2', equal: false },
    { name: 'mayúsculas vs minúsculas', a: 'Token', b: 'token', equal: false },
  ])('$name → hashes iguales=$equal', ({ a, b, equal }) => {
    expect(sha256(a) === sha256(b)).toBe(equal)
  })

  it.each(['', 'a', 'token-secreto', 'áéíóú', 'a'.repeat(10_000)])(
    'siempre produce 64 caracteres hexadecimales (%#)',
    (value) => {
      expect(sha256(value)).toMatch(/^[0-9a-f]{64}$/)
    },
  )

  it('es determinista entre invocaciones', () => {
    expect(sha256('token')).toBe(sha256('token'))
  })
})

describe('randomToken', () => {
  it.each([
    { name: 'por defecto (32 bytes)', bytes: undefined, expectedLength: 64 },
    { name: '1 byte', bytes: 1, expectedLength: 2 },
    { name: '16 bytes', bytes: 16, expectedLength: 32 },
    { name: '64 bytes', bytes: 64, expectedLength: 128 },
  ])('genera hexadecimal del tamaño pedido: $name', ({ bytes, expectedLength }) => {
    const token = bytes === undefined ? randomToken() : randomToken(bytes)

    expect(token).toMatch(/^[0-9a-f]+$/)
    expect(token).toHaveLength(expectedLength)
  })

  it('genera valores distintos en cada llamada', () => {
    const tokens = new Set(Array.from({ length: 50 }, () => randomToken()))

    expect(tokens.size).toBe(50)
  })
})
