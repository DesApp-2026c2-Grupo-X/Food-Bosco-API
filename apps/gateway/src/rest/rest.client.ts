import { GraphQLError } from 'graphql'
import { HEADERS } from '../config/constants'

export interface RestContext {
  authorization?: string | null
  userId?: string | null
  roles?: string[]
  branchId?: string | null
  requestId?: string | null
}

export interface RestRequestOptions {
  context?: RestContext
  query?: Record<string, string | number | boolean | null | undefined>
  body?: unknown
}

export interface RestErrorBody {
  code?: string
  message?: string
  path?: string
}

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

const isErrorBody = (value: unknown): value is RestErrorBody =>
  typeof value === 'object' && value !== null && typeof (value as RestErrorBody).code === 'string'

export class RestClient {
  constructor(
    readonly serviceName: string,
    private readonly baseUrl: string,
  ) {}

  private buildHeaders(context: RestContext): Record<string, string> {
    const headers: Record<string, string> = { accept: 'application/json' }

    if (context.authorization) headers[HEADERS.authorization] = context.authorization
    if (context.userId) headers[HEADERS.userId] = context.userId
    if (context.roles?.length) headers[HEADERS.roles] = context.roles.join(',')
    if (context.branchId) headers[HEADERS.branchId] = context.branchId
    if (context.requestId) headers[HEADERS.requestId] = context.requestId

    return headers
  }

  private buildUrl(path: string, query?: RestRequestOptions['query']): string {
    const url = new URL(`${this.baseUrl}${path}`)

    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value))
      }
    }

    return url.toString()
  }

  private toGraphQLError(path: string, status: number, body: unknown): GraphQLError {
    if (isErrorBody(body) && body.code) {
      return new GraphQLError(body.message ?? `${this.serviceName} devolvió HTTP ${status}`, {
        extensions: { code: body.code, httpStatus: status, path: body.path ?? path },
      })
    }

    return new GraphQLError(`${this.serviceName} devolvió HTTP ${status}`, {
      extensions: { code: 'INTERNAL_SERVER_ERROR', httpStatus: status, path },
    })
  }

  async request<T>(method: HttpMethod, path: string, options: RestRequestOptions = {}): Promise<T> {
    const { context = {}, query, body } = options
    const hasBody = body !== undefined

    const response = await fetch(this.buildUrl(path, query), {
      method,
      headers: {
        ...this.buildHeaders(context),
        ...(hasBody ? { 'content-type': 'application/json' } : {}),
      },
      body: hasBody ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null)
      throw this.toGraphQLError(path, response.status, errorBody)
    }

    return (await response.json()) as T
  }

  get<T>(path: string, options?: RestRequestOptions): Promise<T> {
    return this.request<T>('GET', path, options)
  }

  post<T>(path: string, options?: RestRequestOptions): Promise<T> {
    return this.request<T>('POST', path, options)
  }

  patch<T>(path: string, options?: RestRequestOptions): Promise<T> {
    return this.request<T>('PATCH', path, options)
  }

  put<T>(path: string, options?: RestRequestOptions): Promise<T> {
    return this.request<T>('PUT', path, options)
  }

  delete<T>(path: string, options?: RestRequestOptions): Promise<T> {
    return this.request<T>('DELETE', path, options)
  }
}
