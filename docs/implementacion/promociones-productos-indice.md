# Índice — Descuentos en productos y página de promociones

> **Estado:** IMPLEMENTADO · **Fecha:** 2026-11-19
> **Repositorios:** `DESAPP` (API) y `Food-Bosco-Frontend` (Tienda)
> **Orden de despliegue:** backend primero, frontend después.

---

## Planes

| #   | Plan                                                                     | Repo                  | Alcance                                                                          |
| --- | ------------------------------------------------------------------------ | --------------------- | -------------------------------------------------------------------------------- |
| 1   | [`promociones-productos-backend.md`](./promociones-productos-backend.md) | `DESAPP`              | Commerce + Gateway: previews por producto y catálogo público de promociones.     |
| 2   | `Food-Bosco-Frontend/docs/planes/plan-promociones-productos.md`          | `Food-Bosco-Frontend` | `@repo/domain`, `@repo/api`, `ProductCard`, detalle, `/promotions` y navegación. |

---

## Decisiones cerradas

| #   | Decisión                              | Resultado                                                                                                    |
| --- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 1   | Sucursal para el preview              | Se resuelve desde la dirección, igual que el carrito: sucursal más cercana disponible.                       |
| 2   | Porcentaje con tope (`maxDiscount`)   | Badge `-20%` y texto de tope. **No** se muestra precio estimado.                                             |
| 3   | Porcentaje sin tope                   | Badge `-20%`, precio anterior tachado y precio estimado por unidad.                                          |
| 4   | `FIXED_AMOUNT`                        | Se muestra también en la tarjeta como `Hasta $1.000 OFF`. Sin precio final.                                  |
| 5   | Mínimos (`minSubtotal`/`minQuantity`) | Se muestra la promo con “Sujeto a compra mínima” / “Mínimo N unidades”. Sin precio estimado si no se cumple. |
| 6   | Código de cupón                       | Se muestra en la página de promociones.                                                                      |
| 7   | Página de promociones                 | El backend hidrata productos y categorías.                                                                   |
| 8   | Home feed                             | También calcula previews.                                                                                    |
| 9   | Mobile nav                            | 5 ítems: Inicio, Catálogo, Promos, Carrito, Perfil. “Pedidos” pasa a Perfil.                                 |

---

## Orden de implementación

1. **Backend** (`DESAPP`):
   - Implementar el plan 01 completo.
   - Deployar el contrato en el entorno donde se probará el frontend.
2. **Frontend** (`Food-Bosco-Frontend`):
   - Implementar el plan 02 contra el backend ya desplegado.
   - No mergear el frontend antes de que el backend esté disponible: los fragmentos GraphQL son estáticos y fallan si el esquema no conoce los campos.
3. **QA conjunto**:
   - Producto con 20% sin tope.
   - Producto con 20% con tope.
   - Producto con `2x1`.
   - Producto con `FIXED_AMOUNT`.
   - Promo con compra mínima.
   - Catálogo con dirección, detalle y home feed.
   - `/promotions` con cupones y productos.
   - Carrito: el total autoritativo sigue siendo el del backend.

---

## Ramas sugeridas

| Repo                  | Base      | Rama                               |
| --------------------- | --------- | ---------------------------------- |
| `DESAPP`              | `develop` | `feat/promociones-productos-api`   |
| `Food-Bosco-Frontend` | `develop` | `feat/promociones-productos-store` |

> El plan de frontend vive en el otro repositorio, en `docs/planes/plan-promociones-productos.md`.

---

## Documentación en los repos

| Repo                  | Documento                                              |
| --------------------- | ------------------------------------------------------ |
| `DESAPP`              | `docs/implementacion/promociones-productos-backend.md` |
| `Food-Bosco-Frontend` | `docs/planes/plan-promociones-productos.md`            |

---

## Definición de terminado

- [x] El catálogo con dirección muestra badges y precios estimados cuando corresponde.
- [x] El detalle muestra las promociones aplicables y aclara que el precio final se calcula en el carrito.
- [x] La home feed muestra los mismos badges que el catálogo.
- [x] `/promotions` lista cupones y productos en promoción con vigencia y condiciones.
- [x] “Promociones” está en el header y “Promos” en la nav mobile de 5 ítems.
- [x] “Pedidos” sigue accesible desde Perfil.
- [x] El backend no hace N+1.
- [x] El motor del carrito no se modificó.
- [x] Tests, lint y typecheck/check-types pasan en ambos repos.
