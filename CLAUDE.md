# API — Plataforma de pedidos

Backend NestJS de la plataforma de pedidos. **Arquitectura por dominio**: cada dominio es una carpeta dentro de `src/`, y dentro de cada dominio están sus controllers, servicios, DTOs, repositorios y módulos.

## Skills disponibles

Las reglas y patrones obligatorios de este proyecto viven en skills. **Toda tarea de API debe aplicar la skill correspondiente antes de escribir o revisar código.**

| Skill                                             | Cuándo usarla                                                                                                                         |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `.claude/skills/orchestrator-domain-architecture` | Cualquier caso de uso: estructura por dominio, cuándo usar orchestrator, regla de servicios primarios aislados.                       |
| `.claude/skills/domain-patterns`                  | Confirmación de pedidos, asignación de sucursal, estados de pedido, ETA, snapshot de detalle, promociones/stock como datos generales. |
| `.claude/skills/high-quality-tests`               | Cualquier test nuevo o modificación de lógica: tests parametrizados, casos límite, matriz de transiciones, aislamiento.               |
| `.claude/skills/modern-code-quality`              | Todo archivo fuente: ES6+, funciones flecha, código moderno, orientación a objetos.                                                   |

## Estructura del monorepo (Turborepo)

```text
food-bosco-api/
├── apps/
│   ├── auth/      # autenticación (puerto 4201)
│   ├── commerce/  # catálogo/pedidos (puerto 4202)
│   └── delivery/  # entrega/despacho (puerto 4203)
├── packages/
│   ├── eslint-config/     # config ESLint compartida (@repo/eslint-config)
│   └── typescript-config/ # config TypeScript compartida (@repo/typescript-config)
└── .claude/
    ├── CLAUDE.md
    ├── AGENTS.md
    └── skills/
```

Cada app es un backend NestJS **por dominio**: un folder por dominio de negocio (y de orquestación) en `src/`, con sus controllers, servicios, DTOs, repositorios y módulos dentro.

```text
apps/<service>/
├── src/
│   ├── config/       # compartido: constantes, guards, decorators, interfaces globales, excepciones
│   ├── product/      # dominio de negocio
│   │   ├── product.controller.ts
│   │   ├── product.service.ts
│   │   ├── product.repository.ts
│   │   ├── product.module.ts
│   │   ├── dto/
│   │   └── product.model.ts
│   └── checkout/     # dominio de orquestación
│       ├── checkout.controller.ts
│       ├── checkout.orchestrator.ts
│       ├── checkout.module.ts
│       └── dto/
└── test/
```

## Regla de oro

> **Un servicio primario nunca llama a otro servicio primario. La coordinación pertenece al orchestrator.**

Flujo dentro de cada dominio: controller → orchestrator (o servicio primario) → servicio primario → repositorio → base de datos.

## Stack

- NestJS 11, TypeScript, Turborepo.
- Servicios (apps): `auth` (4201), `commerce` (4202), `delivery` (4203). Cada uno corre en `PORT` (default según app).
- Scripts (raíz): `npm run dev`, `npm run build`, `npm run lint`, `npm run typecheck`, `npm run test`.
