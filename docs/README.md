# Documentación — Food-Bosco-API

Índice maestro de la documentación del backend.

> **Regla rectora: el código es la fuente de verdad final.** Los documentos describen intención,
> arquitectura, estado e historial; ante cualquier discrepancia con el código, **gana el código**.

## Fuentes de verdad

| Ámbito                          | Documento OFICIAL                                                                                                                                                     | Qué define                                                                                              |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Funcional backend               | [`especificaciones/requerimientos-backend-rest.md`](especificaciones/requerimientos-backend-rest.md)                                                                  | Requerimientos funcionales/no funcionales y catálogo exhaustivo de endpoints REST.                      |
| Arquitectura                    | [`especificaciones/fundamentacion-gateway-graphql-rest.md`](especificaciones/fundamentacion-gateway-graphql-rest.md)                                                  | Fundamentación de la decisión GraphQL Gateway + microservicios REST.                                    |
| Frontend (copias de referencia) | [`especificaciones/requerimientos-frontend.md`](especificaciones/requerimientos-frontend.md) · [`especificaciones/ui-manifesto.md`](especificaciones/ui-manifesto.md) | Alcance funcional y sistema visual del frontend. La fuente original vive en el repositorio de frontend. |

---

## OFICIAL

Documentos canónicos y vigentes.

| Documento                               | Qué es                                                                            | Fecha      | Link                                                                                                |
| --------------------------------------- | --------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------- |
| Requerimientos — Backend (REST)         | Fuente de verdad funcional del backend (v3.3; revisión contra código 2026-10-06). | 2026-10-06 | [`requerimientos-backend-rest.md`](especificaciones/requerimientos-backend-rest.md)                 |
| Fundamentación — Gateway GraphQL + REST | Fundamentación de la arquitectura de entrada (v1.0).                              | —          | [`fundamentacion-gateway-graphql-rest.md`](especificaciones/fundamentacion-gateway-graphql-rest.md) |

## VIGENTE

Documentos de referencia actuales (no canónicos o derivados).

| Documento                         | Qué es                                                                     | Fecha             | Link                                                                        |
| --------------------------------- | -------------------------------------------------------------------------- | ----------------- | --------------------------------------------------------------------------- |
| Especificación funcional Frontend | Copia de referencia del alcance funcional de los frontends (v1.3).         | 2026-08-25 (repo) | [`requerimientos-frontend.md`](especificaciones/requerimientos-frontend.md) |
| UI Manifesto                      | Copia de referencia del sistema visual y de producto del frontend.         | 2026-08-25 (repo) | [`ui-manifesto.md`](especificaciones/ui-manifesto.md)                       |
| Recuperación de contraseña        | Implementación del flujo de recuperación y reset (Auth Service + Gateway). | 2026-09-23        | [`password-recovery.md`](implementacion/password-recovery.md)               |
| Reporte de bugs                   | Hallazgos e inconsistencias documentados por la suite de tests.            | 2026-09-19        | [`bug-report.md`](testing/bug-report.md)                                    |
| Matriz de cobertura               | Matriz capability → reglas → casos → tests.                                | 2026-09-19        | [`matriz-cobertura.md`](testing/matriz-cobertura.md)                        |

## HISTÓRICO / OBSOLETO

Material conservado como registro; **no** describe necesariamente el estado actual.

| Documento                            | Qué es                                                                                          | Fecha                        | Link                                                                                             |
| ------------------------------------ | ----------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------ |
| Auditoría integral                   | Auditoría de solo lectura (hallazgos FE+BE) + informe de correcciones aplicadas. Ver sub-tabla. | 2026-10-06                   | [`auditoria/`](auditoria/00-INDICE.md)                                                           |
| Plan — Autenticación                 | Plan histórico del Auth Service + dominio Gateway.                                              | 2026-08-18 (act. 2026-10-06) | [`auth-plan.md`](historico/planes/auth-plan.md)                                                  |
| Plan — Commerce                      | Plan histórico del Commerce Service + dominio GraphQL.                                          | 2026-08-26 (act. 2026-10-06) | [`commerce-plan.md`](historico/planes/commerce-plan.md)                                          |
| Plan — Rider / Delivery              | Plan histórico del Delivery Service + dominio GraphQL.                                          | 2026-08-20 (act. 2026-10-06) | [`delivery-plan.md`](historico/planes/delivery-plan.md)                                          |
| Backend — variante Apollo Federation | Variante descartada (v2.0). **OBSOLETO.**                                                       | 2026-08-25 (repo)            | [`requerimientos-backend-federation.md`](historico/backend/requerimientos-backend-federation.md) |
| Backend — variante gRPC              | Variante descartada (v3.0). **OBSOLETO.**                                                       | 2026-08-25 (repo)            | [`requerimientos-backend-grpc.md`](historico/backend/requerimientos-backend-grpc.md)             |
| Análisis de PRs ↔ Trello             | Snapshot del mapeo de PRs a tarjetas del tablero.                                               | 2026-10-07 (repo)            | [`analisis-actividades-prs.md`](historico/analisis-actividades-prs.md)                           |

### Detalle de `auditoria/`

| Documento               | Contenido                                                          | Link                                                                 |
| ----------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------- |
| 00-INDICE               | Índice, metodología y leyenda de la auditoría.                     | [`00-INDICE.md`](auditoria/00-INDICE.md)                             |
| 01-INFORME-GLOBAL       | Resumen ejecutivo y estadísticas.                                  | [`01-INFORME-GLOBAL.md`](auditoria/01-INFORME-GLOBAL.md)             |
| 02-MATRIZ-TRAZABILIDAD  | Matriz requerimiento → FE → BE → flujo → estado.                   | [`02-MATRIZ-TRAZABILIDAD.md`](auditoria/02-MATRIZ-TRAZABILIDAD.md)   |
| 03-REPORTE-BACKEND      | Reporte del backend.                                               | [`03-REPORTE-BACKEND.md`](auditoria/03-REPORTE-BACKEND.md)           |
| 04-REPORTE-AUTH         | Reporte de autenticación (`packages/auth`).                        | [`04-REPORTE-AUTH.md`](auditoria/04-REPORTE-AUTH.md)                 |
| 05-REPORTE-STORE        | Reporte de la Tienda.                                              | [`05-REPORTE-STORE.md`](auditoria/05-REPORTE-STORE.md)               |
| 06-REPORTE-ADMIN-GLOBAL | Reporte del Admin global.                                          | [`06-REPORTE-ADMIN-GLOBAL.md`](auditoria/06-REPORTE-ADMIN-GLOBAL.md) |
| 07-REPORTE-BRANCH       | Reporte del Admin de sucursal.                                     | [`07-REPORTE-BRANCH.md`](auditoria/07-REPORTE-BRANCH.md)             |
| 08-REPORTE-RIDER        | Reporte del Repartidor.                                            | [`08-REPORTE-RIDER.md`](auditoria/08-REPORTE-RIDER.md)               |
| 09-SEGURIDAD            | Auth, roles y seguridad.                                           | [`09-SEGURIDAD.md`](auditoria/09-SEGURIDAD.md)                       |
| 10-DOMINIO-CONSISTENCIA | Coherencia del dominio entre capas.                                | [`10-DOMINIO-CONSISTENCIA.md`](auditoria/10-DOMINIO-CONSISTENCIA.md) |
| 11-CODIGO-HUERFANO      | Código huérfano, incompleto, mock y stale.                         | [`11-CODIGO-HUERFANO.md`](auditoria/11-CODIGO-HUERFANO.md)           |
| 12-AUDITORIA-INVERSA    | Código vs requerimientos (extras/contradicciones).                 | [`12-AUDITORIA-INVERSA.md`](auditoria/12-AUDITORIA-INVERSA.md)       |
| 13-ARQUITECTURA-CALIDAD | Arquitectura y calidad técnica.                                    | [`13-ARQUITECTURA-CALIDAD.md`](auditoria/13-ARQUITECTURA-CALIDAD.md) |
| 14-PLAN-PRIORIZADO      | Plan de trabajo priorizado.                                        | [`14-PLAN-PRIORIZADO.md`](auditoria/14-PLAN-PRIORIZADO.md)           |
| 15-INFORME-CORRECCIONES | Correcciones aplicadas sobre los hallazgos (ex `AUDIT_REPORT.md`). | [`15-INFORME-CORRECCIONES.md`](auditoria/15-INFORME-CORRECCIONES.md) |

---

## Documentación del repositorio

| Documento         | Qué es                                                    | Link                                           |
| ----------------- | --------------------------------------------------------- | ---------------------------------------------- |
| README (raíz)     | Descripción del monorepo, comandos y estructura.          | [`../README.md`](../README.md)                 |
| CLAUDE.md         | Reglas de arquitectura por dominio y skills obligatorias. | [`../CLAUDE.md`](../CLAUDE.md)                 |
| AGENTS.md         | Puntero a `CLAUDE.md`.                                    | [`../AGENTS.md`](../AGENTS.md)                 |
| agent-local/pr.md | Borrador de PR (artefacto de trabajo, fuera de `docs/`).  | [`../agent-local/pr.md`](../agent-local/pr.md) |
