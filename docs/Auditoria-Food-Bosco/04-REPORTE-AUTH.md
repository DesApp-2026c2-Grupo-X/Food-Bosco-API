# REPORTE — AUTENTICACIÓN (`packages/auth`)

> La app documentada como `apps/auth` no existe; la autenticación es `@repo/auth`, embebida en store/admin/branch/rider.

## Resumen

- **Objetivo:** login, registro (cliente + rider), recuperación y reset de contraseña; redirección por rol.
- **Estado general:** funcional end-to-end.
- **Cumplimiento estimado:** ~95%.
- Requerimientos: RF-001..008. Cumplidos 7, parcial 1, inconsistente 1.

## Requerimientos cumplidos

| ID     | Requerimiento       | Frontend                    | Backend                           | Estado |
| ------ | ------------------- | --------------------------- | --------------------------------- | ------ |
| RF-001 | Registro cliente    | `RegisterPage/*`            | `auth.controller.ts:22`           | ✅     |
| RF-002 | Login               | `LoginPage/*`               | `auth.controller.ts:32`           | ✅     |
| RF-003 | Recuperación        | `ForgotPasswordPage/*`      | `auth.controller.ts:54` (neutral) | ✅     |
| RF-004 | Reset con token     | `ResetPasswordPage/*`       | `password-recovery.service.ts`    | ✅     |
| RF-005 | Redirección por rol | `useAuthRedirect.ts`        | role en `/me`                     | ✅     |
| RF-006 | Guards de ruta      | `RequireAuth` + `*/App.tsx` | RBAC server                       | ✅     |
| RF-007 | Refresh de sesión   | `apollo.ts:30-71`           | `auth.controller.ts:38`           | ✅     |

## Requerimientos parciales

| ID     | Qué funciona                                            | Qué falta                                                                   | Prioridad |
| ------ | ------------------------------------------------------- | --------------------------------------------------------------------------- | --------- |
| RF-003 | recuperación con token de 1h, un solo uso, fail neutral | en modo dev el correo sale a logs (`EMAIL_PROVIDER=log`); falta Resend real | Media     |

## Inconsistencias

| ID     | Problema                     | Frontend                                                            | Backend                                                | Impacto                                        | Prioridad |
| ------ | ---------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------- | --------- |
| RF-008 | carrera en logout            | `authStore.ts:100-103` dispara `LOGOUT` sin `await` y limpia tokens | el revoke puede viajar sin `Authorization` → no revoca | refresh token válido hasta 7d                  | Media     |
| —      | `?forceAuth=true` persistido | `RequireAuth/index.tsx:14`                                          | —                                                      | backdoor de testing en localStorage            | Media     |
| —      | auto-registro rider público  | `useRegister.ts:40-47`                                              | `auth.controller.ts:27`                                | contradice spec (solo super_admin crea riders) | Media     |

## Funcionalidades adicionales

- Auto-registro de rider con vehículo (moto marca/modelo/patente o bici).

## Problemas técnicos

- Tokens en `localStorage` (`authStore.ts:138-146`) → riesgo XSS.
- `createStaff` no valida `branchId` contra Commerce (`auth/config/env.ts:37` sin uso).
- Defaults `JWT_SECRET`/`INTERNAL_API_TOKEN` (`config/env.ts`).
- Email de rider duplicado en `Rider` model.

## Recomendaciones

1. Corregir la carrera de logout (`await` antes de limpiar el token).
2. Revisar/desactivar `forceAuth` fuera de test.
3. Alinear auto-registro de rider con la spec (o deshabilitarlo).
4. Implementar validación de sucursal (RQ-AUTH-13).
