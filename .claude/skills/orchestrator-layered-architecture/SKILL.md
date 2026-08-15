---
name: orchestrator-layered-architecture
description: Diseñar backend con patrón Controller → Orchestrator → Servicios primarios → Repositorios. Usar cuando haya que implementar o refactorizar un caso de uso en la API. Incluye la regla de que los servicios primarios nunca se comunican entre sí y las responsabilidades de cada capa.
---

# Arquitectura por capas con Orchestrator

Patrón para el backend de la plataforma de pedidos: monolito modular con
**Controller → Orchestrator (cuando corresponde) → Servicios primarios → Repositorios → Base de datos**.

## La regla de oro

> **Un servicio primario nunca llama a otro servicio primario. La coordinación pertenece al orchestrator.**

Siempre respetar RA-002, RA-003, RA-004, RA-005 y RA-006 del plan.

## Capas y responsabilidades

### Controller

- Recibe la solicitud (HTTP) de la aplicación cliente o administrativa.
- Valida la forma básica de los datos recibidos (DTOs, pipes).
- Obtiene el usuario autenticado (guards / decorators).
- Llama a un orchestrator o a un servicio primario.
- **No** accede directamente a repositorios.
- **No** coordina varios módulos.

### Orchestrator

- Representa un **caso de uso completo**.
- Coordina dos o más servicios primarios.
- Define el **orden de las operaciones**.
- Devuelve el resultado final al controller.
- **No** contiene consultas de base de datos.

### Servicio primario

- Se encarga de una responsabilidad concreta.
- Aplica las reglas locales de su módulo.
- Accede **solamente a su repositorio**.
- **Nunca** llama a otro servicio primario.

### Repositorio

- Encapsula el acceso a la base de datos.
- Realiza altas, bajas, modificaciones y consultas.
- **No** coordina casos de uso.
- **No** llama a servicios.

## Cuándo usar cada camino

**CRUD simple → controller llama directo al servicio primario:**

```text
ProductController ──> ProductService ──> ProductRepository
```

**Caso de uso compuesto → controller llama al orchestrator:**

```text
CheckoutController ──> CheckoutOrchestrator ──> UserService, AddressService,
CartService, ProductService, ProductConfigService, BranchService,
GeneralStateService, SystemParameterService, OrderService
```

## Criterios para decidir

1. ¿El caso de uso toca un solo módulo y no tiene reglas cruzadas? → controller → servicio primario.
2. ¿El caso de uso combina dos o más módulos, o define un orden de operaciones entre servicios? → orchestrator.
3. ¿El servicio primario necesitaría datos de otro módulo? → refactorizar: el orchestrator pide a cada servicio lo suyo y combina los resultados.
4. ¿El controller necesitaría un repositorio? → es un error de diseño: buscar que el trabajo lo haga un servicio u orchestrator.

## Estructura de capas (arquitectura multicapa)

El backend usa capas globales en `src/`, con los archivos de cada dominio dentro de su capa:

```text
src/
├── config/       # constantes, guards, decorators, interfaces globales
├── controller/   # auth.controller.ts, order.controller.ts, ...
├── dto/          # DTOs por dominio
├── exception/    # excepciones de dominio
├── service/      # servicios primarios + orchestrators (checkout.orchestrator.ts, ...)
├── model/        # interfaces del DER por dominio
├── repository/   # order.repository.ts, ...
└── module/       # módulos @Module de NestJS por dominio (order.module.ts, ...)
```

## Checklist al implementar

- [ ] El controller no toca repositorios.
- [ ] El orchestrator no tiene consultas de base de datos.
- [ ] Ningún servicio primario importa otro servicio primario.
- [ ] Cada servicio primario usa solo su repositorio.
- [ ] Los casos compuestos están coordinados por un orchestrator.
- [ ] Los CRUD simples van controller → servicio primario directo.
