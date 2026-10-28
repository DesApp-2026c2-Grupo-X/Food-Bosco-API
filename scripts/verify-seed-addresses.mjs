/**
 * Verifica que las direcciones del seed existan y que sus coordenadas
 * correspondan a la dirección indicada, usando Geoapify.
 *
 * Uso:
 *   GEOAPIFY_API_KEY=<key> npm run seed:verify-addresses
 *
 * Falla (exit code 1) si una dirección no se encuentra o si la coordenada
 * devuelta por Geoapify está a más de 40 metros de la del archivo.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const API_KEY = process.env.GEOAPIFY_API_KEY
const MAX_DISTANCE_METERS = 40
const DELAY_MS = 250

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const FILES = {
  auth: join(ROOT, 'apps/auth/src/seed/data/auth.json'),
  customers: join(ROOT, 'apps/auth/src/seed/data/customers.json'),
  commerce: join(ROOT, 'apps/commerce/src/seed/data/commerce.json'),
}

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))

const stripAccents = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

const normalizeCity = (value) => {
  const normalized = stripAccents((value ?? '').toLowerCase()).trim()
  return normalized === 'caba' ? 'buenos aires' : normalized
}

const toRadians = (degrees) => (degrees * Math.PI) / 180

const distanceMeters = (a, b) => {
  const earthRadius = 6371000
  const deltaLat = toRadians(b.latitude - a.latitude)
  const deltaLng = toRadians(b.longitude - a.longitude)
  const lat1 = toRadians(a.latitude)
  const lat2 = toRadians(b.latitude)
  const h =
    Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2
  return 2 * earthRadius * Math.asin(Math.sqrt(h))
}

const buildQuery = (text, city) => {
  const base = text.replace(/\bCABA\b/gi, 'Buenos Aires').trim()
  const normalized = stripAccents(base.toLowerCase())
  const parts = [base]

  if (city && !normalized.includes(stripAccents(city.toLowerCase()))) {
    parts.push(city.replace(/\bCABA\b/gi, 'Buenos Aires'))
  }
  if (!normalized.includes('buenos aires')) {
    parts.push('Buenos Aires')
  }
  parts.push('Argentina')

  return parts.join(', ')
}

const cityFromAddressText = (addressText) => {
  const parts = addressText.split(',')
  return parts.length > 1 ? parts[parts.length - 1].trim() : ''
}

const collectAddresses = () => {
  const auth = readJson(FILES.auth)
  const customers = readJson(FILES.customers)
  const commerce = readJson(FILES.commerce)

  return [
    ...(auth.addresses ?? []).map((address) => ({
      source: 'auth.json',
      owner: address.key,
      text: address.text,
      city: address.city,
      latitude: address.latitude,
      longitude: address.longitude,
    })),
    ...customers.customers.flatMap((customer) =>
      customer.addresses.map((address) => ({
        source: 'customers.json',
        owner: `${customer.firstName} ${customer.lastName}`,
        text: address.text,
        city: address.city,
        latitude: address.latitude,
        longitude: address.longitude,
      })),
    ),
    ...commerce.branches.map((branch) => ({
      source: 'commerce.json',
      owner: `Sucursal ${branch.name}`,
      text: branch.addressText,
      city: cityFromAddressText(branch.addressText),
      latitude: branch.latitude,
      longitude: branch.longitude,
    })),
  ]
}

const geocode = async (query) => {
  const url =
    'https://api.geoapify.com/v1/geocode/search?text=' +
    encodeURIComponent(query) +
    '&filter=countrycode:ar&lang=es&limit=1&format=json&apiKey=' +
    API_KEY

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Geoapify respondió ${response.status} para "${query}"`)
  }

  const body = await response.json()
  return body.results?.[0] ?? null
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const main = async () => {
  if (!API_KEY) {
    console.error(
      'Falta GEOAPIFY_API_KEY. Ejemplo: GEOAPIFY_API_KEY=... npm run seed:verify-addresses',
    )
    process.exitCode = 1
    return
  }

  const addresses = collectAddresses()
  const failures = []

  for (const entry of addresses) {
    const query = buildQuery(entry.text, entry.city)
    const result = await geocode(query)

    if (!result) {
      failures.push({ ...entry, reason: 'sin resultado' })
      console.log(`FAIL  ${entry.owner}  ${entry.text}  → sin resultado`)
      await sleep(DELAY_MS)
      continue
    }

    const distance = distanceMeters(
      { latitude: entry.latitude, longitude: entry.longitude },
      { latitude: result.lat, longitude: result.lon },
    )

    const expectedCity = normalizeCity(entry.city)
    const resultCity = normalizeCity(result.city)
    const cityMatches = !expectedCity || resultCity.includes(expectedCity)
    const hasHouseNumber = Boolean(result.housenumber)
    const ok = distance <= MAX_DISTANCE_METERS && cityMatches && hasHouseNumber

    if (!ok) {
      failures.push({
        ...entry,
        reason: `${Math.round(distance)} m, ciudad "${result.city}", número "${result.housenumber ?? ''}"`,
      })
      console.log(
        `FAIL  ${entry.owner}  ${entry.text}  → ${result.formatted} (${Math.round(distance)} m)`,
      )
    } else {
      console.log(`ok    ${entry.owner}  ${entry.text}  (${Math.round(distance)} m)`)
    }

    await sleep(DELAY_MS)
  }

  console.log(`\n${addresses.length - failures.length}/${addresses.length} direcciones verificadas`)

  if (failures.length > 0) {
    console.error(`\n${failures.length} dirección(es) con problemas:`)
    failures.forEach((failure) => {
      console.error(`- ${failure.owner}: ${failure.text} (${failure.reason})`)
    })
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
