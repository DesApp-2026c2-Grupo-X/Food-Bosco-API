# Food-Bosco-API

Monorepo Turborepo con los servicios backend NestJS:

- `apps/auth` — autenticación (puerto 4201).
- `apps/commerce` — catálogo/pedidos (puerto 4202).
- `apps/delivery` — entrega/despacho (puerto 4203).

## Requisitos

- Node.js >= 20
- npm

## Comandos

```bash
npm install        # instala dependencias del workspace
npm run dev        # levanta los servicios en paralelo (Turborepo)
npm run build      # compila los servicios
npm run lint       # ESLint en todos los servicios (config compartida)
npm run typecheck  # TypeScript en todos los servicios (config compartida)
npm run test       # tests unitarios de todos los servicios
npm run format     # Prettier sobre todo el repo
npm run format:check
```

## Estructura

```text
apps/
├── auth/      # autenticación (puerto 4201)
├── commerce/  # catálogo/pedidos (puerto 4202)
└── delivery/  # entrega/despacho (puerto 4203)

packages/
├── eslint-config/       # config ESLint compartida (@repo/eslint-config)
└── typescript-config/   # config TypeScript compartida (@repo/typescript-config)
```

Cada app sigue la arquitectura por dominio definida en `CLAUDE.md` (`controller` → `orchestrator`/`service` → `repository`).
