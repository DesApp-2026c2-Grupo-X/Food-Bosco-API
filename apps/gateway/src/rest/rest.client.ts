import { HttpException } from '@nestjs/common'
import { GraphQLError } from 'graphql'
import { ERROR_CODES, HEADERS } from '../config/constants'

export interface RestContext {
  authorization?: string | null
  userId?: string | null
  roles?: string[]
  branchId?: string | null
  requestId?: string | null
  internalToken?: string | null
}

export type RestQuery = Record<string, string | number | boolean | null | undefined>

export interface RestRequestOptions {
  context?: RestContext
  query?: RestQuery
  body?: unknown
  errorsAsHttp?: boolean
}

export interface RestMultipartOptions {
  context?: RestContext
  query?: RestQuery
}

export interface RestErrorBody {
  code?: string
  message?: string
  path?: string
  details?: Record<string, unknown>
  requestId?: string
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
    if (context.internalToken) headers[HEADERS.internalToken] = context.internalToken

    return headers
  }

  private buildUrl(path: string, query?: RestQuery): string {
    const url = new URL(`${this.baseUrl}${path}`)

    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value))
      }
    }

    return url.toString()
  }

  private errorExtensions(
    code: string,
    status: number,
    path: string,
    requestId?: string | null,
    details?: Record<string, unknown>,
  ): Record<string, unknown> {
    return {
      code,
      httpStatus: status,
      path,
      ...(details ? { details } : {}),
      ...(requestId ? { requestId } : {}),
    }
  }

  private toGraphQLError(
    path: string,
    status: number,
    body: unknown,
    requestId?: string | null,
  ): GraphQLError {
    if (isErrorBody(body) && body.code) {
      return new GraphQLError(body.message ?? `${this.serviceName} devolvió HTTP ${status}`, {
        extensions: this.errorExtensions(
          body.code,
          status,
          body.path ?? path,
          body.requestId ?? requestId,
          body.details,
        ),
      })
    }

    return new GraphQLError(`${this.serviceName} devolvió HTTP ${status}`, {
      extensions: this.errorExtensions(ERROR_CODES.internal, status, path, requestId),
    })
  }

  private toHttpError(
    path: string,
    status: number,
    body: unknown,
    requestId?: string | null,
  ): HttpException {
    if (isErrorBody(body) && body.code) {
      return new HttpException(
        {
          code: body.code,
          message: body.message ?? `${this.serviceName} devolvió HTTP ${status}`,
          path: body.path ?? path,
          ...(body.details ? { details: body.details } : {}),
          ...(body.requestId ?? requestId ? { requestId: body.requestId ?? requestId } : {}),
        },
        status,
      )
    }

    return new HttpException(
      {
        code: ERROR_CODES.internal,
        message: `${this.serviceName} devolvió HTTP ${status}`,
        path,
        ...(requestId ? { requestId } : {}),
      },
      status,
    )
  }

  private unavailableError(path: string, requestId?: string | null, asHttp = false): Error {
    const message = `No pudimos comunicarnos con ${this.serviceName}. Intentá de nuevo en unos instantes.`

    if (asHttp) {
      return new HttpException(
        {
          code: ERROR_CODES.serviceUnavailable,
          message,
          path,
          ...(requestId ? { requestId } : {}),
        },
        503,
      )
    }

    return new GraphQLError(message, {
      extensions: this.errorExtensions(
        ERROR_CODES.serviceUnavailable,
        503,
        path,
        requestId,
      ),
    })
  }

  private async send(
    url: string,
    init: RequestInit,
    path: string,
    requestId: string | null | undefined,
    errorsAsHttp?: boolean,
  ): Promise<Response> {
    try {
      return await fetch(url, init)
    } catch {
      throw this.unavailableError(path, requestId, errorsAsHttp)
    }
  }

  async request<T>(method: HttpMethod, path: string, options: RestRequestOptions = {}): Promise<T> {
    const { context = {}, query, body, errorsAsHttp } = options
    const hasBody = body !== undefined

    const response = await this.send(
      this.buildUrl(path, query),
      {
        method,
        headers: {
          ...this.buildHeaders(context),
          ...(hasBody ? { 'content-type': 'application/json' } : {}),
        },
        body: hasBody ? JSON.stringify(body) : undefined,
      },
      path,
      context.requestId,
      errorsAsHttp,
    )

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null)
      throw errorsAsHttp
        ? this.toHttpError(path, response.status, errorBody, context.requestId)
        : this.toGraphQLError(path, response.status, errorBody, context.requestId)
    }

    if (response.status === 204) {
      return undefined as T
    }

    try {
      return (await response.json()) as T
    } catch {
      return undefined as T
    }
  }

  get<T>(path: string, options?: RestRequestOptions): Promise<T> {
    return this.request<T>('GET', path, options)
  }

  post<T>(path: string, options?: RestRequestOptions): Promise<T> {
    return this.request<T>('POST', path, options)
  }

  async postMultipart<T>(
    path: string,
    form: FormData,
    options: RestMultipartOptions = {},
  ): Promise<T> {
    const { context = {}, query } = options

    const response = await this.send(
      this.buildUrl(path, query),
      {
        method: 'POST',
        headers: this.buildHeaders(context),
        body: form,
      },
      path,
      context.requestId,
      true,
    )

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null)
      throw this.toHttpError(path, response.status, errorBody, context.requestId)
    }

    return (await response.json()) as T
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
