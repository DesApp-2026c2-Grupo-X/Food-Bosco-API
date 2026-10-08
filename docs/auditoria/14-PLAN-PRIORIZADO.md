# PLAN DE TRABAJO PRIORIZADO — Food-Bosco

> **Estado:** HISTÓRICO — hallazgos de auditoría de solo lectura (2026-10-06). Correcciones aplicadas en [`15-INFORME-CORRECCIONES.md`](15-INFORME-CORRECCIONES.md).

Orden considerando dependencias. Cada ítem referencia su hallazgo y severidad.

```text
1.  [CRÍTICO] Proteger POST /seed (guard + deshabilitar en prod) y quitar credenciales seed default.      -> S1/S2
2.  [CRÍTICO] Eliminar/defaults seguros de JWT_SECRET e INTERNAL_API_TOKEN; fallar arranque en prod.      -> S3/S4/S6
3.  [CRÍTICO] Añadir @Roles al GET /v1/orders del servicio (defensa en profundidad).                      -> S6/RQ-SEC-04
4.  [CRÍTICO] Rotar y desversionar la key Geoapify; agregar .env.native al .gitignore.                    -> S9
5.  [ALTO]    Hacer obligatorio BROKER_URL fuera de test + ack/retry/DLQ + dedupe por eventId.            -> A2/RQ-COM-05
6.  [ALTO]    Implementar UI de Repetir Pedido (backend listo).                                           -> RF-020/RQ-ORD-17
7.  [ALTO]    Validar branchId contra Commerce al crear staff (RQ-AUTH-13).                               -> RF-063/RQ-AUTH-13
8.  [ALTO]    Construir UI admin de Promociones y Estados (backend listo).                                -> RF-061/RF-065
9.  [ALTO]    UI para editar observaciones/opciones del carrito (backend listo).                          -> RQ-CART-04
10. [ALTO]    Definir/persistir el estado abierto/cerrado de sucursal server-side o eliminar el control.  -> RF-037
11. [ALTO]    Resolver credenciales Cloudinary (o fallback local) para subida de imágenes.                -> RF-071
12. [MEDIO]   Estrategia de paginación FE (enviar page/limit + UI "cargar más").                          -> contrato
13. [MEDIO]   Crear packages/contracts OpenAPI + codegen, o actualizar la doc.                            -> A3/RQ-REST
14. [MEDIO]   Reparar DataLoader (endpoints batch) y agregar TripOrder.order.                             -> A1/RQ-GW-08/09
15. [MEDIO]   Corregir carrera de logout; revisar forceAuth; mapear errores por extensions.code.          -> S7/S12/C4
16. [MEDIO]   Alinear dominio: Rider.vehicle, optionAdjustments, User.createdAt, riderId.                  -> dominio
17. [MEDIO]   Separar BD/colecciones por servicio y sacar reporting de modelos ajenos.                    -> A4
18. [MEDIO]   Aplicar validación de input/ValidationPipe en gateway.                                       -> A7
19. [BAJO]    Limpiar swr, proxy /api, STATUS.md obsoletos, dist stale, StockMovement sin query.          -> C5/C6/11
20. [BAJO]    Test e2e de frontend (checkout→pedido) y arreglar glob del test huérfano.                   -> C9
21. [BAJO]    Unificar enums/mappers (contrato compartido o test de paridad).                              -> A8/C8
22. [BAJO]    Corregir README/CLAUDE (puertos, gateway, SWR) y copias divergentes de la doc.              -> A9
```

## Dependencias clave

- **(1)(2)(3)(4)** son seguridad y no dependen de nada → primero.
- **(5)** es prerequisito de que el flujo del Repartidor (oferta→viaje) funcione en un setup limpio.
- **(13)** (contrato) habilita de forma consistente **(12)(14)(21)**.
- **(16)** debe hacerse antes de tocar UI que consuma esos campos.

## Criterio de cierre

- **Éxito crítico:** S1–S9 mitigados.
- **Éxito funcional:** RF-020, RF-061, RF-065, RQ-CART-04, RF-037, RF-071 completos.
- **Éxito de contrato:** `packages/contracts` (o doc actualizada) + paginación + DataLoader batch.
