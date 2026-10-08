import {
  assertProductionSecrets,
  DEV_INTERNAL_API_TOKEN,
  DEV_JWT_SECRET,
  type SecretConfig,
} from './env'

const config = (overrides: Partial<SecretConfig> = {}): SecretConfig => ({
  nodeEnv: 'production',
  jwtSecret: 'secreto-real-de-produccion',
  internalApiToken: 'token-interno-real',
  ...overrides,
})

describe('assertProductionSecrets (seguridad de secretos)', () => {
  it.each([
    { name: 'development con defaults', nodeEnv: 'development' },
    { name: 'test con defaults', nodeEnv: 'test' },
    { name: 'development con secretos reales', nodeEnv: 'development' },
  ])('no falla en $name', ({ nodeEnv }) => {
    expect(() =>
      assertProductionSecrets(
        config({ nodeEnv, jwtSecret: DEV_JWT_SECRET, internalApiToken: DEV_INTERNAL_API_TOKEN }),
      ),
    ).not.toThrow()
  })

  it('no falla en producción cuando ambos secretos son propios', () => {
    expect(() => assertProductionSecrets(config())).not.toThrow()
  })

  it('falla en producción si JWT_SECRET conserva el default de dev', () => {
    expect(() => assertProductionSecrets(config({ jwtSecret: DEV_JWT_SECRET }))).toThrow(
      /JWT_SECRET/,
    )
  })

  it('falla en producción si INTERNAL_API_TOKEN conserva el default de dev', () => {
    expect(() =>
      assertProductionSecrets(config({ internalApiToken: DEV_INTERNAL_API_TOKEN })),
    ).toThrow(/INTERNAL_API_TOKEN/)
  })

  it('falla en producción si ambos secretos son los defaults de dev', () => {
    expect(() =>
      assertProductionSecrets(
        config({ jwtSecret: DEV_JWT_SECRET, internalApiToken: DEV_INTERNAL_API_TOKEN }),
      ),
    ).toThrow(/JWT_SECRET y INTERNAL_API_TOKEN/)
  })

  it.each([
    { name: 'JWT_SECRET vacío', overrides: { jwtSecret: '' }, expected: /JWT_SECRET/ },
    {
      name: 'JWT_SECRET con sólo espacios',
      overrides: { jwtSecret: '   ' },
      expected: /JWT_SECRET/,
    },
    {
      name: 'INTERNAL_API_TOKEN vacío',
      overrides: { internalApiToken: '' },
      expected: /INTERNAL_API_TOKEN/,
    },
    {
      name: 'INTERNAL_API_TOKEN con sólo espacios',
      overrides: { internalApiToken: '   ' },
      expected: /INTERNAL_API_TOKEN/,
    },
  ])('falla en producción si $name', ({ overrides, expected }) => {
    expect(() => assertProductionSecrets(config(overrides))).toThrow(expected)
  })

  it.each(['development', 'test'])('no falla en %s aunque los secretos estén vacíos', (nodeEnv) => {
    expect(() =>
      assertProductionSecrets(config({ nodeEnv, jwtSecret: '', internalApiToken: '   ' })),
    ).not.toThrow()
  })
})
