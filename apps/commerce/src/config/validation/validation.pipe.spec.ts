import { BadRequestException } from '@nestjs/common'
import type { ArgumentMetadata } from '@nestjs/common'
import { UpdateBranchHoursDto } from '../../branch/dto/branch-hours.dto'
import { AddCartItemDto } from '../../cart/dto/add-cart-item.dto'
import { CreateCategoryDto } from '../../category/dto/create-category.dto'
import { CreateOrderDto } from '../../order/dto/create-order.dto'
import { CreateProductDto } from '../../product/dto/create-product.dto'
import { AdjustStockDto } from '../../stock/dto/adjust-stock.dto'
import { createValidationPipe } from './validation.pipe'
import type { FieldValidationError } from './validation.pipe'

interface ValidationResponse {
  code?: string
  message?: string
  details?: { fields?: FieldValidationError[] }
}

const metadata = (metatype: new () => object): ArgumentMetadata => ({ type: 'body', metatype })

const responseFor = async (
  metatype: new () => object,
  payload: unknown,
): Promise<ValidationResponse | undefined> => {
  try {
    await createValidationPipe().transform(payload, metadata(metatype))
    return undefined
  } catch (error) {
    if (error instanceof BadRequestException) {
      return error.getResponse() as ValidationResponse
    }
    throw error
  }
}

const fieldsFor = async (
  metatype: new () => object,
  payload: unknown,
): Promise<FieldValidationError[]> => (await responseFor(metatype, payload))?.details?.fields ?? []

const product: Record<string, unknown> = {
  categoryId: 'cat-1',
  name: 'Hamburguesa',
  description: 'Con queso',
  price: 100,
}

describe('createValidationPipe (commerce)', () => {
  it('acepta un producto válido', async () => {
    await expect(fieldsFor(CreateProductDto, product)).resolves.toEqual([])
  })

  it.each<{
    name: string
    metatype: new () => object
    payload: Record<string, unknown>
    expected: string[]
  }>([
    {
      name: 'nombre de producto vacío',
      metatype: CreateProductDto,
      payload: { ...product, name: '' },
      expected: ['El campo nombre es obligatorio.'],
    },
    {
      name: 'precio negativo',
      metatype: CreateProductDto,
      payload: { ...product, price: -1 },
      expected: ['El campo precio debe ser mayor o igual a 0.'],
    },
    {
      name: 'precio no numérico',
      metatype: CreateProductDto,
      payload: { ...product, price: 'abc' },
      expected: ['El campo precio debe ser un número.'],
    },
    {
      name: 'campo no permitido',
      metatype: CreateProductDto,
      payload: { ...product, hacker: 'x' },
      expected: ['El campo hacker no está permitido.'],
    },
    {
      name: 'nombre de categoría demasiado largo',
      metatype: CreateCategoryDto,
      payload: { name: 'a'.repeat(101) },
      expected: ['El campo nombre no puede superar los 100 caracteres.'],
    },
    {
      name: 'cantidad por debajo del mínimo',
      metatype: AddCartItemDto,
      payload: { productId: 'prod-1', quantity: 0 },
      expected: ['El campo cantidad debe ser mayor o igual a 1.'],
    },
    {
      name: 'cantidad por encima del máximo',
      metatype: AddCartItemDto,
      payload: { productId: 'prod-1', quantity: 100 },
      expected: ['El campo cantidad debe ser menor o igual a 99.'],
    },
    {
      name: 'opciones repetidas',
      metatype: AddCartItemDto,
      payload: { productId: 'prod-1', quantity: 1, optionIds: ['op-1', 'op-1'] },
      expected: ['El campo opciones no puede tener valores repetidos.'],
    },
    {
      name: 'ajuste de stock en cero',
      metatype: AdjustStockDto,
      payload: { branchId: 'suc-1', ingredientId: 'ing-1', delta: 0 },
      expected: ['El ajuste de stock no puede ser cero'],
    },
    {
      name: 'ajuste de stock decimal',
      metatype: AdjustStockDto,
      payload: { branchId: 'suc-1', ingredientId: 'ing-1', delta: 1.5 },
      expected: ['La cantidad a ajustar debe ser un número entero'],
    },
    {
      name: 'coordenadas de entrega inválidas',
      metatype: CreateOrderDto,
      payload: {
        addressId: 'addr-1',
        deliveryAddress: { text: 'Casa', latitude: 100, longitude: 'x' },
      },
      expected: ['La latitud no es válida.', 'La longitud no es válida.'],
    },
    {
      name: 'día de la semana repetido',
      metatype: UpdateBranchHoursDto,
      payload: {
        hours: [
          { dayOfWeek: 1, closed: true },
          { dayOfWeek: 1, closed: true },
        ],
      },
      expected: ['No se puede repetir el día de la semana'],
    },
  ])('$name → devuelve un mensaje claro en español', async ({ metatype, payload, expected }) => {
    const fields = await fieldsFor(metatype, payload)

    expect(fields.map((field) => field.message)).toEqual(expect.arrayContaining(expected))
  })

  it('devuelve el envelope VALIDATION_ERROR con detalles por campo', async () => {
    const response = await responseFor(CreateProductDto, { ...product, name: '' })

    expect(response?.code).toBe('VALIDATION_ERROR')
    expect(response?.message).toBe('El campo nombre es obligatorio.')
    expect(response?.details?.fields?.length).toBeGreaterThan(0)
  })

  it('no devuelve mensajes por defecto en inglés', async () => {
    const fields = await fieldsFor(CreateProductDto, {
      ...product,
      name: '',
      description: '',
      price: 'abc',
      hacker: 'x',
    })

    expect(fields.map((field) => field.message).join(' ')).not.toMatch(
      /\b(must|should|failed|invalid)\b/i,
    )
  })
})
