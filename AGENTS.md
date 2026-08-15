# AGENTS.md — API

## Antes de empezar

1. **Leer `CLAUDE.md`** en esta carpeta. Es la fuente de verdad de las reglas de este proyecto.
2. **Leer las skills** en `.claude/skills/`. Hay una por tema: arquitectura con orchestrator, patrones de dominio, tests de alta calidad y calidad de código moderno.
3. Aplicar la skill correspondiente antes de escribir o modificar código.

## Alcance

Este directorio (`api/`) contiene únicamente el backend NestJS. Los archivos de configuración y skills de esta carpeta **no aplican al frontend** (`client/`).

## Arquitectura

Backend **multicapa**: capas globales en `src/` y módulos NestJS en `src/module/`.

```text
api/
├── src/
│   ├── config/       # constantes, guards, decorators, interfaces globales
│   ├── controller/   # controllers por dominio (auth.controller.ts, order.controller.ts, ...)
│   ├── dto/          # DTOs por dominio
│   ├── exception/    # excepciones de dominio
│   ├── service/      # servicios primarios + orchestrators por dominio
│   ├── model/        # modelos/entidades del dominio (interfaces del DER)
│   ├── repository/   # repositorios por dominio (uno por tabla del DER)
│   └── module/       # un módulo @Module por dominio + módulos orquestadores
├── test/
└── .claude/
    ├── CLAUDE.md
    ├── AGENTS.md
    └── skills/
```

Módulos: un `@Module` por dominio (`category.module.ts`, `product.module.ts`, ...). Los módulos de dominio exportan sus servicios; los orquestadores (`CatalogModule`, `CheckoutModule`, `AuthModule`, `BranchAvailabilityModule`, `OrderModule`) importan los dominios que coordinan.

## Regla de oro

> **Un servicio primario nunca llama a otro servicio primario. La coordinación pertenece al orchestrator.**

- Controllers validan la forma de los datos, obtienen el usuario autenticado y delegan en un orchestrator o servicio primario.
- Los casos de uso compuestos pasan por un orchestrator (en `service/`).
- Los CRUD simples van directo controller → servicio primario.
- Cada repositorio corresponde a una tabla del DER.
