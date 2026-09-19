import { USER_ROLE_VALUES } from '../config/constants'
import { serializeUser, UserDocument, UserSchema } from './user.model'

const buildDoc = (overrides: Partial<Record<string, unknown>> = {}): UserDocument =>
  ({
    _id: { toString: () => 'u1' },
    email: 'cliente@example.com',
    passwordHash: '$2a$10$hash',
    role: 'customer',
    firstName: 'Juan',
    lastName: 'Perez',
    phone: '11223344',
    active: true,
    branchId: null,
    vehicle: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  }) as unknown as UserDocument

describe('serializeUser (RQ-AUTH-01/03/18)', () => {
  it('serializa el id como string y no expone el passwordHash', () => {
    const result = serializeUser(buildDoc())

    expect(result.id).toBe('u1')
    expect(typeof result.id).toBe('string')
    expect(Object.keys(result)).not.toContain('passwordHash')
    expect((result as unknown as Record<string, unknown>).passwordHash).toBeUndefined()
  })

  it('copia los campos públicos del documento', () => {
    const result = serializeUser(buildDoc({ role: 'branch_admin', firstName: 'Ana' }))

    expect(result).toMatchObject({
      email: 'cliente@example.com',
      role: 'branch_admin',
      firstName: 'Ana',
      lastName: 'Perez',
      phone: '11223344',
      active: true,
    })
  })

  it.each([
    { name: 'branchId y vehicle nulos del cliente', branchId: null, vehicle: null },
    { name: 'branchId de colaborador', branchId: 'branch-1', vehicle: null },
    { name: 'vehicle de repartidor', branchId: null, vehicle: 'Moto' },
  ])('normaliza campos opcionales: $name', ({ branchId, vehicle }) => {
    const result = serializeUser(buildDoc({ branchId, vehicle }))

    expect(result.branchId).toBe(branchId)
    expect(result.vehicle).toBe(vehicle)
  })

  it('convierte createdAt a ISO 8601', () => {
    const result = serializeUser(buildDoc())

    expect(result.createdAt).toBe('2026-01-01T00:00:00.000Z')
  })

  it('devuelve cadena vacía cuando createdAt no está definido', () => {
    const result = serializeUser(buildDoc({ createdAt: undefined }))

    expect(result.createdAt).toBe('')
  })

  it('no muta el documento original', () => {
    const doc = buildDoc()
    const originalRole = doc.role

    serializeUser(doc)

    expect(doc.role).toBe(originalRole)
    expect(doc.passwordHash).toBe('$2a$10$hash')
  })
})

describe('UserSchema (invariantes de persistencia)', () => {
  it('declara el email como único e indexado (RQ-AUTH-02)', () => {
    const emailPath = UserSchema.path('email') as unknown as { options: Record<string, unknown> }

    expect(emailPath.options.unique).toBe(true)
    expect(emailPath.options.index).toBe(true)
    expect(emailPath.options.lowercase).toBe(true)
    expect(emailPath.options.trim).toBe(true)
  })

  it('expone un índice único real sobre email', () => {
    const indexes = UserSchema.indexes() as Array<[Record<string, unknown>, Record<string, unknown>?]>

    const uniqueEmail = indexes.some(
      ([fields, options]) => fields.email === 1 && options?.unique === true,
    )
    expect(uniqueEmail).toBe(true)
  })

  it('excluye passwordHash de las proyecciones por defecto (RQ-AUTH-03)', () => {
    const passwordPath = UserSchema.path('passwordHash') as unknown as {
      options: Record<string, unknown>
    }

    expect(passwordPath.options.select).toBe(false)
    expect(passwordPath.options.required).toBe(true)
  })

  it('restringe el rol a los valores permitidos', () => {
    const rolePath = UserSchema.path('role') as unknown as { options: Record<string, unknown> }

    expect(rolePath.options.enum).toEqual(USER_ROLE_VALUES)
    expect(rolePath.options.required).toBe(true)
  })

  it('requiere los campos de identidad y define active por defecto', () => {
    const schema = UserSchema as unknown as {
      path(name: string): { options: Record<string, unknown> }
    }

    for (const field of ['firstName', 'lastName', 'phone'] as const) {
      expect(schema.path(field).options.required).toBe(true)
    }
    expect(schema.path('active').options.default).toBe(true)
    expect(schema.path('branchId').options.default).toBeNull()
    expect(schema.path('vehicle').options.default).toBeNull()
  })

  it('usa la colección users con timestamps de creación', () => {
    expect(UserSchema.get('collection')).toBe('users')
    expect(UserSchema.get('timestamps')).toEqual({ createdAt: true, updatedAt: false })
  })
})
