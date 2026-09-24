import { Body, Controller, Post } from '@nestjs/common'
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'
import { Internal } from '../config/security/internal.decorator'
import { SeedService, type SeedBranch, type SeedResult } from './seed.service'

class SeedBranchBody {
  @IsString()
  id!: string

  @IsString()
  name!: string
}

class SeedBody {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SeedBranchBody)
  branches?: SeedBranch[]
}

@Controller('v1/seed')
export class SeedController {
  constructor(private readonly seedService: SeedService) {}

  @Post()
  @Internal()
  seed(@Body() body: SeedBody): Promise<SeedResult> {
    return this.seedService.seed(body.branches ?? [])
  }
}
