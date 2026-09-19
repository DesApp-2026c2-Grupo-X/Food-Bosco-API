import { randomUUID } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'
import { HEADERS } from '../config/constants'
import { RequestIdMiddleware } from './request-id.middleware'

jest.mock('node:crypto', () => ({
  randomUUID: jest.fn(() => 'generated-id'),
}))

const buildRequest = (headers: Record<string, string | string[]> = {}): Request =>
  ({ headers }) as unknown as Request

const buildResponse = (): { response: Response; setHeader: jest.Mock } => {
  const setHeader = jest.fn()
  return { response: { setHeader } as unknown as Response, setHeader }
}

describe('RequestIdMiddleware.use', () => {
  const middleware = new RequestIdMiddleware()
  let next: jest.Mock

  beforeEach(() => {
    next = jest.fn()
    jest.mocked(randomUUID).mockClear()
  })

  it('genera un requestId cuando no viene en el header y lo propaga en req/res', () => {
    const request = buildRequest()
    const { response, setHeader } = buildResponse()

    middleware.use(request, response, next as unknown as NextFunction)

    expect(randomUUID).toHaveBeenCalledTimes(1)
    expect(request.headers[HEADERS.requestId]).toBe('generated-id')
    expect(setHeader).toHaveBeenCalledWith(HEADERS.requestId, 'generated-id')
    expect(next).toHaveBeenCalledTimes(1)
  })

  it('respeta el requestId entrante y no genera uno nuevo', () => {
    const request = buildRequest({ [HEADERS.requestId]: 'rid-cliente' })
    const { response, setHeader } = buildResponse()

    middleware.use(request, response, next as unknown as NextFunction)

    expect(randomUUID).not.toHaveBeenCalled()
    expect(request.headers[HEADERS.requestId]).toBe('rid-cliente')
    expect(setHeader).toHaveBeenCalledWith(HEADERS.requestId, 'rid-cliente')
  })

  it('si el header llega como array toma el primer valor', () => {
    const request = buildRequest({ [HEADERS.requestId]: ['rid-1', 'rid-2'] })
    const { response, setHeader } = buildResponse()

    middleware.use(request, response, next as unknown as NextFunction)

    expect(request.headers[HEADERS.requestId]).toBe('rid-1')
    expect(setHeader).toHaveBeenCalledWith(HEADERS.requestId, 'rid-1')
    expect(randomUUID).not.toHaveBeenCalled()
  })

  it('genera ids distintos en llamadas sucesivas sin header entrante', () => {
    jest
      .mocked(randomUUID)
      .mockReturnValueOnce('11111111-1111-1111-1111-111111111111')
      .mockReturnValueOnce('22222222-2222-2222-2222-222222222222')
    const first = buildRequest()
    const second = buildRequest()

    middleware.use(first, buildResponse().response, next as unknown as NextFunction)
    middleware.use(second, buildResponse().response, next as unknown as NextFunction)

    expect(first.headers[HEADERS.requestId]).toBe('11111111-1111-1111-1111-111111111111')
    expect(second.headers[HEADERS.requestId]).toBe('22222222-2222-2222-2222-222222222222')
    expect(randomUUID).toHaveBeenCalledTimes(2)
    expect(next).toHaveBeenCalledTimes(2)
  })
})
