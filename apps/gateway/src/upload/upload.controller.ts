import {
  Controller,
  HttpException,
  HttpStatus,
  Inject,
  Post,
  Req,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import type { Request } from 'express'
import { ERROR_CODES, HEADERS, ROLES } from '../config/constants'
import { env } from '../config/env'
import { RestClient, type RestContext } from '../rest/rest.client'
import { COMMERCE_REST_CLIENT } from '../rest/rest.module'
import { JwtService } from '../security/jwt.service'
import { Roles } from '../security/roles.decorator'
import { RolesGuard } from '../security/roles.guard'
import { UploadExceptionFilter } from './upload-exception.filter'
import type { UploadedImage } from './upload.types'

export interface UploadedImageResponse {
  url: string
}

const headerValue = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value

@Controller('v1/uploads')
@UseGuards(RolesGuard)
@UseFilters(UploadExceptionFilter)
export class UploadController {
  constructor(
    @Inject(COMMERCE_REST_CLIENT) private readonly commerce: RestClient,
    private readonly jwtService: JwtService,
  ) {}

  @Post()
  @Roles(ROLES.superAdmin)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: env.uploads.maxSizeBytes, files: 1 },
    }),
  )
  async uploadImage(
    @Req() request: Request,
    @UploadedFile() file: UploadedImage | undefined,
  ): Promise<UploadedImageResponse> {
    if (!file) {
      throw new HttpException(
        { code: ERROR_CODES.imageRequired, message: 'Se requiere una imagen', path: '/v1/uploads' },
        HttpStatus.BAD_REQUEST,
      )
    }

    const form = new FormData()
    form.append('file', new Blob([file.buffer], { type: file.mimetype }), file.originalname)

    return this.commerce.postMultipart<UploadedImageResponse>('/v1/catalog/uploads', form, {
      context: this.toRestContext(request),
    })
  }

  private toRestContext(request: Request): RestContext {
    const authorization = headerValue(request.headers[HEADERS.authorization])
    const auth = this.jwtService.verify(authorization)

    return {
      authorization: authorization ?? null,
      userId: auth.userId,
      roles: auth.roles,
      branchId: auth.branchId,
      requestId: headerValue(request.headers[HEADERS.requestId]) ?? null,
    }
  }
}
