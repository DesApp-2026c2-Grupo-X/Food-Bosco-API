---
name: orchestrator-domain-architecture
description: Diseñar backend NestJS organizado por dominio (dentro de cada dominio están sus controllers, servicios, DTOs, etc.) con patrón Controller → Orchestrator → Servicios primarios → Repositorios. Usar cuando haya que implementar o refactorizar un caso de uso en la API. Incluye la regla de que los servicios primarios nunca se comunican entre sí y las responsabilidades de cada pieza.
---

# Arquitectura por dominio con Orchestrator

Patrón para el backend de la plataforma de pedidos: cada servicio NestJS se organiza
**por dominio**, con el flujo
**Controller → Orchestrator (cuando corresponde) → Servicios primarios → Repositorios → Base de datos**.

## La regla de oro

> **Un servicio primario nunca llama a otro servicio primario. La coordinación pertenece al orchestrator.**

Siempre respetar RA-002, RA-003, RA-004, RA-005 y RA-006 del plan.

## Piezas y responsabilidades

### Controller

- Recibe la solicitud (HTTP) de la aplicación cliente o administrativa.
- Valida la forma básica de los datos recibidos (DTOs, pipes).
- Obtiene el usuario autenticado (guards / decorators).
- Llama a un orchestrator o a un servicio primario.
- **No** accede directamente a repositorios.
- **No** coordina varios dominios.

### Orchestrator

- Representa un **caso de uso completo**.
- Coordina dos o más servicios primarios.
- Define el **orden de las operaciones**.
- Devuelve el resultado final al controller.
- **No** contiene consultas de base de datos.

### Servicio primario

- Se encarga de una responsabilidad concreta.
- Aplica las reglas locales de su dominio.
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

1. ¿El caso de uso toca un solo dominio y no tiene reglas cruzadas? → controller → servicio primario.
2. ¿El caso de uso combina dos o más dominios, o define un orden de operaciones entre servicios? → orchestrator.
3. ¿El servicio primario necesitaría datos de otro dominio? → refactorizar: el orchestrator pide a cada servicio lo suyo y combina los resultados.
4. ¿El controller necesitaría un repositorio? → es un error de diseño: buscar que el trabajo lo haga un servicio u orchestrator.

## Estructura por dominio

Cada dominio es una carpeta en `src/`, y **dentro** de esa carpeta están sus controllers,
servicios, DTOs, repositorios y módulos. Lo compartido entre dominios vive en `config/`.

Hay dos tipos de dominio:

- **Dominio de negocio**: tiene su entidad, servicio primario y repositorio.
- **Dominio de orquestación**: es un dominio distinto, con su propio controller, módulo y
  DTOs. En lugar de servicio primario + repositorio, tiene un orchestrator.

```text
apps/<service>/src/
├── config/                    # compartido: constantes, guards, decorators, interfaces globales, excepciones de dominio
├── product/                   # dominio de negocio
│   ├── product.controller.ts
│   ├── product.service.ts     # servicio primario
│   ├── product.repository.ts
│   ├── product.module.ts
│   ├── dto/
│   └── product.model.ts       # modelo/entidad del dominio (interfaces del DER)
└── checkout/                  # dominio de orquestación (caso de uso compuesto)
    ├── checkout.controller.ts
    ├── checkout.orchestrator.ts
    ├── checkout.module.ts
    └── dto/
```

Reglas de ubicación:

- Un archivo pertenece al dominio de su entidad/negocio (`order.controller.ts` en `order/`).
- Un orchestrator **es su propio dominio** (`checkout/`), con su controller, su module y sus
  DTOs. No tiene repositorio ni entidad propia: coordina los servicios primarios de otros dominios.
- Lo que usa más de un dominio (guards, decorators, excepciones, constantes) va a `config/`.
- El nombre del archivo refleja su rol: `.controller.ts`, `.service.ts`, `.orchestrator.ts`, `.repository.ts`, `.module.ts`.

## Checklist al implementar

- [ ] El controller no toca repositorios.
- [ ] El orchestrator no tiene consultas de base de datos.
- [ ] Ningún servicio primario importa otro servicio primario.
- [ ] Cada servicio primario usa solo su repositorio.
- [ ] Los casos compuestos están coordinados por un orchestrator.
- [ ] Los CRUD simples van controller → servicio primario directo.
- [ ] Cada archivo está en el folder de su dominio (no en carpetas globales por capa).
