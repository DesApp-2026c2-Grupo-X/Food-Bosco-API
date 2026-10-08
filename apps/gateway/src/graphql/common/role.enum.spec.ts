import { Role, roleFromRest, roleToRest } from './role.enum'

describe('roleToRest', () => {
  it.each([
    [Role.CUSTOMER, 'customer'],
    [Role.BRANCH_ADMIN, 'branch_admin'],
    [Role.SUPER_ADMIN, 'super_admin'],
    [Role.RIDER, 'rider'],
  ])('convierte %s a %s', (graphqlRole, rest) => {
    expect(roleToRest(graphqlRole)).toBe(rest)
  })
})

describe('roleFromRest', () => {
  it.each([
    ['customer', Role.CUSTOMER],
    ['branch_admin', Role.BRANCH_ADMIN],
    ['super_admin', Role.SUPER_ADMIN],
    ['rider', Role.RIDER],
    ['CUSTOMER', Role.CUSTOMER],
    ['BRANCH_ADMIN', Role.BRANCH_ADMIN],
    ['SUPER_ADMIN', Role.SUPER_ADMIN],
    ['RIDER', Role.RIDER],
    ['Super_Admin', Role.SUPER_ADMIN],
    ['Rider', Role.RIDER],
  ])('convierte %s a %s (case-insensitive)', (rest, graphqlRole) => {
    expect(roleFromRest(rest)).toBe(graphqlRole)
  })

  it('lanza error para un rol desconocido', () => {
    expect(() => roleFromRest('admin_master')).toThrow('Unknown role')
  })

  it('lanza error para un rol vacío', () => {
    expect(() => roleFromRest('')).toThrow('Unknown role')
  })
})
