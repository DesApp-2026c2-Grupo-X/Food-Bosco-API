export interface DemoAddressSeed {
  label: string
  text: string
  city?: string
  postalCode?: string
  latitude: number
  longitude: number
}

export interface DemoCustomerSeed {
  firstName: string
  lastName: string
  email: string
  phone: string
  addresses: DemoAddressSeed[]
}

export interface DemoCustomerNames {
  firstNames: string[]
  lastNames: string[]
}

/**
 * Devuelve la bolsa de clientes demo pedida.
 *
 * - Hasta el tamaño de la bolsa curada, usa los clientes del JSON (con sus
 *   direcciones reales verificadas).
 * - Si se piden más, genera clientes nuevos con emails únicos y reutiliza las
 *   mismas direcciones (varios clientes pueden vivir en la misma dirección).
 */
export const expandDemoCustomers = (
  curated: DemoCustomerSeed[],
  count: number,
  names: DemoCustomerNames,
): DemoCustomerSeed[] => {
  const limit = Math.max(0, Math.trunc(count))
  if (limit <= curated.length) return curated.slice(0, limit)

  const addressPool = curated.flatMap((customer) => customer.addresses)
  if (addressPool.length === 0 || names.firstNames.length === 0 || names.lastNames.length === 0) {
    return curated.slice(0, limit)
  }

  const generated: DemoCustomerSeed[] = []

  for (let index = curated.length; index < limit; index += 1) {
    const firstName = names.firstNames[index % names.firstNames.length]
    const lastName =
      names.lastNames[Math.floor(index / names.firstNames.length) % names.lastNames.length]
    const address = addressPool[index % addressPool.length]

    generated.push({
      firstName,
      lastName,
      email: `cliente.demo.${index + 1}@foodbosco.local`,
      phone: `11${String(45550000 + index)}`,
      addresses: [{ ...address, label: 'Casa' }],
    })
  }

  return [...curated, ...generated]
}
