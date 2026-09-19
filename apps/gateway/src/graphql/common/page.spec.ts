import { PageInfo, PageInput } from './page'

describe('PageInput', () => {
  it.each<[Partial<PageInput>, { limit?: number; offset?: number }]>([
    [{}, { limit: undefined, offset: undefined }],
    [{ limit: 10 }, { limit: 10, offset: undefined }],
    [{ offset: 5 }, { limit: undefined, offset: 5 }],
    [{ limit: 0, offset: 0 }, { limit: 0, offset: 0 }],
  ])('sin página se conservan los valores provistos: %p', (input, expected) => {
    const page = Object.assign(new PageInput(), input)

    expect({ limit: page.limit, offset: page.offset }).toEqual(expected)
  })
})

describe('PageInfo', () => {
  it('expone total, limit y offset tal cual', () => {
    const info: PageInfo = Object.assign(new PageInfo(), { total: 0, limit: 20, offset: 40 })

    expect(info).toEqual({ total: 0, limit: 20, offset: 40 })
  })
})
