import { MODULE_METADATA } from '@nestjs/common/constants'
import { APP_GUARD } from '@nestjs/core'
import { Test } from '@nestjs/testing'
import { JwtService } from './jwt.service'
import { RolesGuard } from './roles.guard'
import { SecurityModule } from './security.module'

describe('SecurityModule (RQ-SEC-01/04)', () => {
  it('compila y expone JwtService', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [SecurityModule] }).compile()

    expect(moduleRef.get(JwtService)).toBeInstanceOf(JwtService)

    await moduleRef.close()
  })

  it('registra RolesGuard como guard global (APP_GUARD)', () => {
    const providers = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, SecurityModule) as unknown[]

    expect(providers).toEqual(
      expect.arrayContaining([{ provide: APP_GUARD, useClass: RolesGuard }]),
    )
  })

  it('exporta JwtService para que otros módulos lo inyecten', () => {
    const exports = Reflect.getMetadata(MODULE_METADATA.EXPORTS, SecurityModule) as unknown[]

    expect(exports).toContain(JwtService)
  })

  it('el JwtService del módulo firma y verifica tokens', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [SecurityModule] }).compile()
    const service = moduleRef.get(JwtService)

    const token = service.signAccessToken({ id: 'u1', role: 'customer', branchId: null })

    expect(service.verify(token)).toMatchObject({ authenticated: true, userId: 'u1' })

    await moduleRef.close()
  })
})
