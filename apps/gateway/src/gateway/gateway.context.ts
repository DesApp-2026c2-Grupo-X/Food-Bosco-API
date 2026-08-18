import type { Request, Response } from 'express'
import { JwtService, AuthContext } from '../security/jwt.service'
import { HEADERS } from '../config/constants'

export interface GraphQLContext extends AuthContext {
  requestId: string | null
  authorization: string | null
  req: Request
  res: Response
}

type ContextParams = {
  req: Request
  res: Response
}

const headerToString = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value

export const buildContext =
  (jwtService: JwtService): ((params: ContextParams) => GraphQLContext) =>
  ({ req, res }) => {
    const authorization = headerToString(req.headers[HEADERS.authorization])
    const auth = jwtService.verify(authorization)

    return {
      ...auth,
      requestId: headerToString(req.headers[HEADERS.requestId]) ?? null,
      authorization: authorization ?? null,
      req,
      res,
    }
  }
