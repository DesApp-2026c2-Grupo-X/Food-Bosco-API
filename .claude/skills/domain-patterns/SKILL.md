---
name: domain-patterns
description: Patrones de dominio para la plataforma de pedidos: asignación geográfica de sucursal, snapshot de datos transaccionales, máquina de estados de pedidos, cálculo de tiempo estimado de entrega (ETA) y datos generales sin motor de reglas. Usar al implementar confirmación de pedidos, cambios de estado, seguimiento, promociones y stock.
---

# Patrones de dominio

Patrones conceptuales de negocio extraídos del plan. Se aplican en la lógica del
backend y en los contratos con las aplicaciones.

## 1. Asignación geográfica (elegir la sucursal)

Al confirmar un pedido, el sistema elige la **sucursal activa y abierta más cercana**
a la dirección del cliente.

Proceso (en el `CheckoutOrchestrator`):

1. Obtener las sucursales **activas**.
2. Verificar sus **horarios de atención** (descartar cerradas en ese momento).
3. Calcular la **distancia** entre cada sucursal y la dirección del cliente.
4. Descartar las que superen la **distancia máxima** configurada (parámetro `MAX_BRANCH_DISTANCE_KM`).
5. Elegir la **más cercana**.
6. Si **no existe** una sucursal disponible → **no confirmar el pedido** (fallar con error claro).

Reglas clave:

- Sucursal inactiva **no** se asigna (RF-024).
- Sucursal cerrada **no** se asigna (RF-025).
- El stock **no** participa en la elección (pertenece a la Extensión 1).

## 2. Snapshot de datos transaccionales

Al confirmar un pedido, **copiar** nombre y precio de cada producto al detalle del pedido:

- `ORDER_ITEMS.product_name`
- `ORDER_ITEMS.unit_price`
- `ORDER_ITEM_OPTIONS.option_name`
- `ORDER_ITEM_OPTIONS.extra_price`

Motivo: el historial debe mostrar **lo comprado en ese momento**, aunque el catálogo
cambie después (cambios de precio, nombre, disponibilidad).

Reglas:

- Nunca leer el precio del catálogo para mostrar pedidos pasados.
- Los totales del pedido se calculan con los valores copiados.

## 3. Máquina de estados de pedido

Estados (RF / consigna):

`Pendiente → Confirmado → En preparación → Listo para entregar → En camino → Entregado`

`Cualquier estado activo → Cancelado`

Transiciones permitidas:

| Estado actual       | Estados siguientes                    |
| ------------------- | ------------------------------------- |
| Pendiente           | Confirmado, Cancelado                 |
| Confirmado          | En preparación, Cancelado             |
| En preparación      | Listo para entregar, Cancelado        |
| Listo para entregar | En camino, Cancelado                  |
| En camino           | Entregado, Cancelado                  |
| Entregado           | Ninguno                               |
| Cancelado           | Ninguno                               |

Reglas:

- Cada cambio registra **fecha y hora** (`ORDER_STATUS_HISTORY`).
- Se conserva **estado anterior y nuevo**.
- Cambios inválidos se **rechazan** (RF-080): validar la transición en el
  `OrderStatusOrchestrator` (usa `OrderService` para leer el pedido y
  `GeneralStateService` para validar la transición).
- El pedido comienza en **Pendiente**.

## 4. Tiempo estimado de entrega (ETA)

Estimación simple:

```text
tiempo estimado = tiempo base de preparación + tiempo aproximado de traslado
```

- `BASE_PREPARATION_MINUTES`: tiempo base de preparación.
- `AVERAGE_DELIVERY_SPEED_KMH`: velocidad promedio de traslado.
- Traslado ≈ distancia a la sucursal / velocidad promedio.

Reglas:

- **No** hay navegación real ni cálculo de recorridos.
- Los parámetros se leen del módulo de parámetros del sistema.

## 5. Dato general sin motor de reglas

**Promociones** y **stock** se administran como **datos generales**:

- `PROMOTIONS`: ABM administrativo, sin reglas automáticas de aplicación al carrito.
- `PRODUCT_STOCK`: cantidad general por producto; **no** se usa para reservar,
  descontar ni validar pedidos. Solo alimenta el reporte de "productos sin stock".

Reglas:

- El backend expone CRUD, no lógica de descuentos ni de stock por sucursal.
- No implementar: combos, 2x1, cupones, envío gratis, niveles o alertas de stock.

## Checklist al implementar

- [ ] Asignación: filtra activas → abiertas → dentro de distancia máxima → más cercana.
- [ ] Sin sucursal disponible → falla la confirmación.
- [ ] El detalle del pedido guarda snapshots de nombre y precio.
- [ ] La máquina de estados rechaza transiciones inválidas y registra fecha/hora.
- [ ] ETA = base de preparación + traslado estimado por distancia.
- [ ] Promociones y stock son datos generales, sin reglas automáticas.
