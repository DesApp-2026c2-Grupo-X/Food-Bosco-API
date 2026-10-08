import { Body, Controller, Post } from '@nestjs/common'
import { Type } from 'class-transformer'
import { IsArray, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator'
import { Internal } from '../config/security/internal.decorator'
import { SeedService, type SeedResult } from './seed.service'

class BranchSeedDto {
  @IsString()
  @IsNotEmpty()
  id!: string

  @IsString()
  @IsNotEmpty()
  name!: string
}

class SeedBody {
  @IsOptional()
  @IsString()
  branchId?: string | number | boolean

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BranchSeedDto)
  branches?: BranchSeedDto[]
}

@Controller('v1/seed')
export class SeedController {
  constructor(private readonly seedService: SeedService) {}

  @Post()
  @Internal()
  seed(@Body() body: SeedBody): Promise<SeedResult> {
    return this.seedService.seed({
      branchId: typeof body.branchId === 'string' ? body.branchId : undefined,
      branches: body.branches,
    })
  }
}
