import {
  asBoolean,
  asNumber,
  asRecordList,
  asString,
  asStringList,
  idOf,
  nullableNumber,
  nullableString,
} from './mappers'

describe('asString', () => {
  it.each<[unknown, string]>([
    [null, ''],
    [undefined, ''],
    ['hola', 'hola'],
    ['', ''],
    [0, '0'],
    [false, 'false'],
    [123, '123'],
    [{ a: 1 }, '[object Object]'],
  ])('asString(%p) → %p', (value, expected) => {
    expect(asString(value)).toBe(expected)
  })
})

describe('nullableString', () => {
  it.each<[unknown, string | null]>([
    [null, null],
    [undefined, null],
    ['', ''],
    [0, '0'],
    [false, 'false'],
    ['texto', 'texto'],
  ])('nullableString(%p) → %p', (value, expected) => {
    expect(nullableString(value)).toBe(expected)
  })
})

describe('asNumber', () => {
  it.each<[unknown, number]>([
    [null, 0],
    [undefined, 0],
    ['', 0],
    ['5', 5],
    ['5.5', 5.5],
    [7, 7],
    [true, 1],
    [false, 0],
    ['abc', Number.NaN],
    [{}, Number.NaN],
  ])('asNumber(%p) → %p', (value, expected) => {
    expect(asNumber(value)).toBe(expected)
  })
})

describe('nullableNumber', () => {
  it.each<[unknown, number | null]>([
    [null, null],
    [undefined, null],
    [0, 0],
    ['0', 0],
    ['5', 5],
    ['abc', Number.NaN],
  ])('nullableNumber(%p) → %p', (value, expected) => {
    expect(nullableNumber(value)).toBe(expected)
  })
})

describe('asBoolean', () => {
  it.each<[unknown, boolean]>([
    [null, false],
    [undefined, false],
    [0, false],
    ['', false],
    [false, false],
    [Number.NaN, false],
    [1, true],
    ['false', true],
    ['0', true],
    [{}, true],
    [[], true],
  ])('asBoolean(%p) → %p', (value, expected) => {
    expect(asBoolean(value)).toBe(expected)
  })
})

describe('idOf', () => {
  it.each<[Record<string, unknown>, string]>([
    [{ id: 'c1' }, 'c1'],
    [{ _id: 'c1' }, 'c1'],
    [{ id: 'c1', _id: 'legacy' }, 'c1'],
    [{ id: null, _id: 'legacy' }, 'legacy'],
    [{ id: undefined, _id: 'legacy' }, 'legacy'],
    [{ id: 0, _id: 'legacy' }, '0'],
    [{}, ''],
  ])('idOf(%p) → %p', (raw, expected) => {
    expect(idOf(raw)).toBe(expected)
  })
})

describe('asStringList', () => {
  it.each<[unknown, string[]]>([
    [[], []],
    [null, []],
    [undefined, []],
    ['no-es-array', []],
    [{ 0: 'a' }, []],
    [
      ['a', 'b'],
      ['a', 'b'],
    ],
    [
      ['a', 1, null],
      ['a', '1', ''],
    ],
  ])('asStringList(%p) → %p', (value, expected) => {
    expect(asStringList(value)).toEqual(expected)
  })
})

describe('asRecordList', () => {
  it.each<[unknown, unknown[]]>([
    [[], []],
    [null, []],
    [undefined, []],
    ['no-es-array', []],
    [
      [{ a: 1 }, { b: 2 }],
      [{ a: 1 }, { b: 2 }],
    ],
    [[{ a: 1 }, null, 'x', 1, undefined], [{ a: 1 }]],
    [
      [[], { b: 2 }],
      [[], { b: 2 }],
    ],
  ])('asRecordList(%p) → %p', (value, expected) => {
    expect(asRecordList(value)).toEqual(expected)
  })
})
