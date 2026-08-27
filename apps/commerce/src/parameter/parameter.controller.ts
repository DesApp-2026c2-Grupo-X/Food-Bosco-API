import { Body, Controller, Get, Param, Patch } from '@nestjs/common'
import { ROLES } from '../config/constants'
import { Roles } from '../config/security/roles.decorator'
import type { PublicParameter } from './parameter.model'
import { ParameterService } from './parameter.service'
import { UpdateParameterDto } from './dto/parameter.dto'

@Controller('v1/config/parameters')
export class ParameterController {
  constructor(private readonly parameterService: ParameterService) {}

  @Get()
  @Roles(ROLES.superAdmin)
  list(): Promise<PublicParameter[]> {
    return this.parameterService.list()
  }

  @Patch(':key')
  @Roles(ROLES.superAdmin)
  update(@Param('key') key: string, @Body() dto: UpdateParameterDto): Promise<PublicParameter> {
    return this.parameterService.update(key, dto.value)
  }
}
