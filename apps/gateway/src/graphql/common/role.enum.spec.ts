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
  ])('convierte %s a %s', (rest, graphqlRole) => {
    expect(roleFromRest(rest)).toBe(graphqlRole)
  })

  it('lanza error para un rol desconocido', () => {
    expect(() => roleFromRest('admin_master')).toThrow('Unknown role')
  })
})
