import type { Request } from 'express'
import { env } from '../../config/env'
import { DataLoader } from '../../rest/data-loader'
import type { RestClient, RestContext } from '../../rest/rest.client'

type RawRecord = Record<string, unknown>

export interface CommerceLoaders {
  category: DataLoader<string, RawRecord | null>
  ingredient: DataLoader<string, RawRecord | null>
  product: DataLoader<string, RawRecord | null>
  branch: DataLoader<string, RawRecord | null>
  order: DataLoader<string, RawRecord | null>
  user: DataLoader<string, RawRecord | null>
}

const LOADERS_KEY = '__commerceLoaders'

const buildByIdLoader = (
  rest: RestClient,
  pathPrefix: string,
  context?: RestContext,
): DataLoader<string, RawRecord | null> =>
  new DataLoader<string, RawRecord | null>(async (keys) =>
    Promise.all(
      keys.map(async (id) => {
        try {
          return await rest.get<RawRecord>(`${pathPrefix}/${id}`, ...(context ? [{ context }] : []))
        } catch {
          return null
        }
      }),
    ),
  )

export const getCommerceLoaders = (
  req: Request,
  commerce: RestClient,
  auth: RestClient,
  context: RestContext = {},
): CommerceLoaders => {
  const store = req as unknown as Record<string, unknown>
  const existing = store[LOADERS_KEY] as CommerceLoaders | undefined
  if (existing) {
    return existing
  }

  const loaders: CommerceLoaders = {
    category: buildByIdLoader(commerce, '/v1/catalog/categories'),
    ingredient: buildByIdLoader(commerce, '/v1/catalog/ingredients'),
    product: buildByIdLoader(commerce, '/v1/catalog/products'),
    branch: buildByIdLoader(commerce, '/v1/branches'),
    order: buildByIdLoader(commerce, '/v1/orders', context),
    user: new DataLoader<string, RawRecord | null>(async (keys) =>
      Promise.all(
        keys.map(async (id) => {
          try {
            return await auth.get<RawRecord>(`/v1/users/${id}`, {
              context: { internalToken: env.internalApiToken },
            })
          } catch {
            return null
          }
        }),
      ),
    ),
  }

  store[LOADERS_KEY] = loaders
  return loaders
}
