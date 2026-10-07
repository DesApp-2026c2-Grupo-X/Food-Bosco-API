# REPORTE — ADMIN DE SUCURSAL (`apps/branch`)

## Resumen

- **Objetivo:** operación de la propia sucursal (`branch_admin`): pausar productos, stock de ingredientes, pedidos y reportes.
- **Estado general:** funcional; el toggle abierto/cerrado es fantasma (solo local).
- **Cumplimiento estimado:** ~90%.
- Requerimientos: RF-030..038.

## Requerimientos cumplidos

| ID     | Requerimiento              | Frontend                                          | Backend                    | Estado |
| ------ | -------------------------- | ------------------------------------------------- | -------------------------- | ------ |
| RF-030 | Login admin sucursal       | `branch/App.tsx`                                  | auth                       | ✅     |
| RF-031 | Home de sucursal           | `HomePage`, `useBranchOrders`                     | `order.controller.ts`      | ✅     |
| RF-032 | Pausar/reactivar producto  | `ProductsPage`, `useBranchProducts`               | `branch.controller.ts:135` | ✅     |
| RF-033 | Stock de ingredientes      | `StockPage`, `useBranchStock`                     | `stock.controller.ts`      | ✅     |
| RF-034 | Pedidos de la sucursal     | `OrdersPage`, `useBranchOrders`                   | scope por `branchId`       | ✅     |
| RF-035 | Detalle + cambio de estado | `OrderDetailView`, `useOrderTransition`           | `order.service.ts:58`      | ✅     |
| RF-036 | Reportes de productos      | `ReportsPage`                                     | `reporting.controller.ts`  | ✅     |
| RF-038 | Alerta de pedido entrante  | `useIncomingOrder` + `IncomingOrderModal` + audio | polling                    | 🟡     |

## Requerimientos parciales

| ID     | Qué funciona                             | Qué falta                                                   | Prioridad |
| ------ | ---------------------------------------- | ----------------------------------------------------------- | --------- |
| RF-038 | alerta por polling (5s) + modal + sonido | sin endpoint de alerta dedicado (depende de listar PENDING) | Media     |
| Perfil | render de perfil                         | edición real (hoy read-only + `MOCK_BRANCH_ADMIN`)          | Baja      |

## Inconsistencias

| ID     | Problema                                           | Frontend                                         | Backend                               | Impacto                                            | Prioridad |
| ------ | -------------------------------------------------- | ------------------------------------------------ | ------------------------------------- | -------------------------------------------------- | --------- |
| RF-037 | toggle abierto/cerrado solo local                  | `branchStatusStore.ts:10` (persist localStorage) | no existe estado open/closed editable | el cliente nunca ve el estado real                 | Alta      |
| RF-033 | `branches` query del gateway es solo `super_admin` | filtros de sucursal de branch                    | `commerce.resolver.ts:202`            | branch_admin no puede poblar filtros con esa query | Media     |

## Funcionalidades adicionales

- Reportes analíticos extra (`AdvancedReportsView scope="branch"`).

## Problemas técnicos

- `branchStatusStore` + test solo validan persistencia local.
- Proxy muerto en `vite.config.ts` (`/api` → `localhost:3000`).

## Recomendaciones

1. Definir y persistir el estado abierto/cerrado server-side, o eliminar el control local (Alta).
2. Permitir que branch_admin obtenga datos de su sucursal para filtros (Media).
3. Habilitar edición de perfil (Baja).
