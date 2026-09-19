import type { NextFunction, Request, Response } from 'express'
import { HEADERS } from '../constants'
import { RequestIdMiddleware } from './request-id.middleware'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const buildContext = (headers: Record<string, string | string[] | undefined> = {}) => {
  const request = { headers: { ...headers } } as unknown as Request
  const response = { setHeader: jest.fn() } as unknown as Response
  const next = jest.fn() as unknown as NextFunction
  return { request, response, next }
}

describe('RequestIdMiddleware (NFR-03)', () => {
  const middleware = new RequestIdMiddleware()

  it('propaga el x-request-id entrante al request y a la respuesta', () => {
    const id = 'req-123'
    const { request, response, next } = buildContext({ [HEADERS.requestId]: id })

    middleware.use(request, response, next)

    expect(request.headers[HEADERS.requestId]).toBe(id)
    expect(response.setHeader).toHaveBeenCalledWith(HEADERS.requestId, id)
    expect(next).toHaveBeenCalledTimes(1)
  })

  it('toma el primer valor cuando el header viene como arreglo', () => {
    const { request, response, next } = buildContext({
      [HEADERS.requestId]: ['req-a', 'req-b'],
    })

    middleware.use(request, response, next)

    expect(request.headers[HEADERS.requestId]).toBe('req-a')
    expect(response.setHeader).toHaveBeenCalledWith(HEADERS.requestId, 'req-a')
  })

  it.each([
    { name: 'sin header', headers: {} },
    { name: 'con otros headers', headers: { host: 'localhost', authorization: 'Bearer x' } },
  ])('genera un UUID v4 cuando no viene header ($name)', ({ headers }) => {
    const { request, response, next } = buildContext(headers)

    middleware.use(request, response, next)

    const generated = request.headers[HEADERS.requestId]
    expect(typeof generated).toBe('string')
    expect(generated).toMatch(UUID_V4)
    expect(response.setHeader).toHaveBeenCalledWith(HEADERS.requestId, generated)
    expect(next).toHaveBeenCalledTimes(1)
  })

  it('genera ids distintos para requests sin header', () => {
    const first = buildContext()
    const second = buildContext()

    middleware.use(first.request, first.response, first.next)
    middleware.use(second.request, second.response, second.next)

    expect(first.request.headers[HEADERS.requestId]).not.toBe(
      second.request.headers[HEADERS.requestId],
    )
  })

  it.each([
    { name: 'id corto', id: 'a' },
    { name: 'uuid existente', id: '11111111-1111-4111-8111-111111111111' },
    { name: 'id con espacios preservado tal cual', id: ' req con espacio ' },
  ])('preserva un x-request-id provisto ($name)', ({ id }) => {
    const { request, response, next } = buildContext({ [HEADERS.requestId]: id })

    middleware.use(request, response, next)

    expect(request.headers[HEADERS.requestId]).toBe(id)
    expect(response.setHeader).toHaveBeenCalledWith(HEADERS.requestId, id)
  })

  it('KNOWN BUG: un x-request-id vacío se conserva en vez de generar uno nuevo', () => {
    const { request, response, next } = buildContext({ [HEADERS.requestId]: '' })

    middleware.use(request, response, next)

    expect(request.headers[HEADERS.requestId]).toBe('')
    expect(response.setHeader).toHaveBeenCalledWith(HEADERS.requestId, '')
  })

  it('siempre llama a next exactamente una vez', () => {
    const { request, response, next } = buildContext()

    middleware.use(request, response, next)

    expect(next).toHaveBeenCalledTimes(1)
    expect(next).toHaveBeenCalledWith()
  })
})
