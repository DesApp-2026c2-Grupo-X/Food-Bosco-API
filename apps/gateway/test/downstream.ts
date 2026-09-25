import jwt from 'jsonwebtoken'
import { env } from '../src/config/env'

export interface DownstreamCall {
  method: string
  path: string
  url: string
  headers: Record<string, string>
  body: unknown
  rawBody: unknown
}

export interface DownstreamResponse {
  status: number
  body: unknown
}

export type Responder = (call: DownstreamCall) => DownstreamResponse | undefined

export interface DownstreamMock {
  readonly calls: DownstreamCall[]
  setResponder(responder: Responder): void
  reset(): void
  restore(): void
}

export const jsonResponse = (status: number, body: unknown): DownstreamResponse => ({
  status,
  body,
})

export const okResponse = (body: unknown): DownstreamResponse => jsonResponse(200, body)

export const errorResponse = (
  status: number,
  code: string,
  message: string,
  path: string,
): DownstreamResponse => jsonResponse(status, { code, message, path })

const parseJsonBody = (rawBody: unknown): unknown => {
  if (typeof rawBody !== 'string') {
    return undefined
  }

  try {
    return JSON.parse(rawBody)
  } catch {
    return rawBody
  }
}

export const createDownstreamMock = (responder: Responder): DownstreamMock => {
  const originalFetch = global.fetch
  const calls: DownstreamCall[] = []
  let current = responder

  global.fetch = jest.fn(async (input: unknown, init?: RequestInit) => {
    const url = new URL(String(input))
    const rawBody = init?.body
    const call: DownstreamCall = {
      method: init?.method ?? 'GET',
      path: url.pathname,
      url: url.toString(),
      headers: (init?.headers as Record<string, string>) ?? {},
      body: parseJsonBody(rawBody),
      rawBody,
    }
    calls.push(call)

    const response = current(call) ?? errorResponse(404, 'NOT_FOUND', 'not found', call.path)

    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      json: async () => response.body,
    } as unknown as Response
  }) as unknown as typeof fetch

  return {
    calls,
    setResponder: (next) => {
      current = next
    },
    reset: () => {
      calls.length = 0
    },
    restore: () => {
      global.fetch = originalFetch
    },
  }
}

export interface GraphQLErrorBody {
  message: string
  path?: Array<string | number>
  extensions?: { code?: string }
}

export interface GraphQLBody {
  data?: Record<string, unknown> | null
  errors?: GraphQLErrorBody[]
}

export const gql = (query: string) => ({ query })

export const signToken = (payload: object, options?: jwt.SignOptions): string =>
  jwt.sign(payload, env.jwtSecret, options)

export const signTokenWithSecret = (payload: object, secret: string): string =>
  jwt.sign(payload, secret)

export const queryParams = (url: string): URLSearchParams => new URL(url).searchParams

export const callsTo = (mock: DownstreamMock, path: string): DownstreamCall[] =>
  mock.calls.filter((call) => call.path === path)
