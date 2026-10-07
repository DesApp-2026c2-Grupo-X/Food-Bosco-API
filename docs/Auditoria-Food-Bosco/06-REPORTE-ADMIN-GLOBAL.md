# REPORTE — ADMIN GLOBAL (`apps/admin`)

## Resumen

- **Objetivo:** administración central (`super_admin`): catálogo, sucursales, personal, configuración, pedidos, stock y reportes globales.
- **Estado general:** mayormente funcional; faltan dos módulos completos presentes en backend.
- **Cumplimiento estimado:** ~85%.
- Requerimientos: RF-050..071.

## Requerimientos cumplidos

| ID         | Requerimiento             | Frontend                          | Backend                         | Estado |
| ---------- | ------------------------- | --------------------------------- | ------------------------------- | ------ |
| RF-051/052 | Categorías list/ABM       | `CategoriesPage`                  | `category.controller.ts`        | ✅     |
| RF-053/054 | Productos list/ABM        | `ProductsPage`, `ProductEditPage` | `product.controller.ts`         | ✅     |
| RF-055/056 | Grupos/opciones de config | `ProductEditPage:146-292`         | `product.controller.ts:86-168`  | ✅     |
| RF-057     | Receta de producto        | `ProductEditPage:294-376`         | `product.controller.ts:182-227` | ✅     |
| RF-058     | Catálogo de ingredientes  | `IngredientsPage`                 | `ingredient.controller.ts`      | ✅     |
| RF-059/060 | Sucursales + horarios     | `BranchesPage`, `BranchEditPage`  | `branch.controller.ts`          | ✅     |
| RF-066     | Parámetros                | `ParametersPage`                  | `parameter.controller.ts`       | ✅     |
| RF-067     | Pedidos globales          | `OrdersPage`, `useGlobalOrders`   | `order.controller.ts:31`        | ✅     |
| RF-068     | Detalle/estado global     | `OrderDetailView`                 | `order.service.ts:58`           | ✅     |
| RF-069     | Stock global              | `StockPage`, `useGlobalStock`     | `stock.controller.ts`           | ✅     |

## Requerimientos parciales / incumplidos

| ID         | Requerimiento        | Situación actual                                                            | Qué falta                                    | Prioridad |
| ---------- | -------------------- | --------------------------------------------------------------------------- | -------------------------------------------- | --------- |
| RF-061/062 | Promociones list/ABM | BE completo (`promotion.controller.ts`, resolver), FE **sin página/hook**   | página + mutaciones                          | Media     |
| RF-065     | Estados generales    | BE completo (`order-state.controller.ts`, resolver), FE **sin página/hook** | página + CRUD                                | Media     |
| RF-063/064 | Personal list/ABM    | FE completo; BE **no valida `branchId`**                                    | validación contra Commerce (RQ-AUTH-13)      | Alta      |
| RF-070     | Reportes globales    | presenta los 4 reportes + KPIs extra                                        | acotar a alcance (quitar KPIs fuera de spec) | Baja      |
| RF-071     | Subir imagen         | cadena FE→gateway→commerce→Cloudinary                                       | credenciales `CLOUDINARY_*` en commerce      | Alta      |
| RF-050     | Home global          | listo                                                                       | —                                            | ✅        |

## Inconsistencias

| ID        | Problema                          | Frontend                                       | Backend                                | Impacto                           | Prioridad |
| --------- | --------------------------------- | ---------------------------------------------- | -------------------------------------- | --------------------------------- | --------- |
| RF-071    | subida de imagen falla en runtime | `FormImageField`/`useImageUpload`              | `upload.repository.ts` sin creds → 502 | no se pueden subir imágenes       | Alta      |
| Perfil    | read-only + mock                  | `ProfilePage/index.tsx:6` (`MOCK_SUPER_ADMIN`) | `me.controller.ts` disponible          | perfil no editable                | Baja      |
| RQ-CAT-12 | cantidad por opción no expuesta   | UI solo ingredientId+quantity                  | modelo `optionAdjustments` existe      | stock por opción no administrable | Media     |

## Funcionalidades adicionales

- Dashboard analítico (`AdvancedReportsView`: KPIs, serie de ventas, comparación de sucursales, torta por estado) → fuera de alcance (§19).

## Problemas técnicos

- Reportes llaman `reportsOverview` (endpoint no documentado).
- `apps/admin/STATUS.md` describe páginas/hooks que no existen (PromotionsPage, StatesPage, `usePromotions`, `useOrderStates`).

## Recomendaciones

1. Construir UI de Promociones y Estados (BE ya listo).
2. Validar `branchId` al crear staff.
3. Configurar Cloudinary o fallback local.
4. Acotar reportes al alcance o documentarlos.
