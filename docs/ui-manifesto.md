# UI Manifesto — DESA Apps

Este documento es la **fuente de verdad visual, de sistema y de producto** para los frontends (store + admin). Todo agente que escriba UI debe leerlo antes de tocar código. Leer junto con la skill `frontend-components` (reglas de código). Las skills `interface-design`, `better-ui`, `impeccable` y `apple-ui-design` son **solo orientativas**: ante cualquier conflicto, **gana este documento**.

> **Principio raíz:** no hacemos una versión "más linda" de lo que ya existe. Entendemos el problema, cuestionamos la estructura, quitamos lo innecesario, organizamos lo que importa, damos jerarquía y espacio, y recién después aplicamos identidad. **Preservar el propósito. Romper el layout. Diseñar la experiencia.**

> **Spec funcional:** `requerimientos-frontend.md` (en esta misma carpeta) define el **alcance funcional** (roles, admin página por página, responsive, integración backend). Este manifesto es la fuente de verdad **visual y de sistema**; la spec es la fuente de verdad **funcional**. Si una decisión cambia el sistema visual, actualizar este documento.

---

## 1. Principios de diseño

1. **Diseñar desde el problema, no desde la pantalla actual.** Primero entender qué necesita hacer/saber/decidir el usuario. La interfaz actual es evidencia, no la solución.
2. **Preservar el producto, no la interfaz.** Funcionalidad, intención, datos, reglas de negocio y necesidades reales se conservan. Su representación visual puede cambiar por completo (una tabla puede volverse una colección visual; una página puede volverse un sheet; tres pantallas pueden ser una).
3. **La jerarquía importa más que la cantidad de elementos.** Cada pantalla debe tener jerarquía clara: primario → secundario → contextual → de apoyo. Usar escala, posición, contraste, espacio, tipografía, agrupación e imagen. No meter todo dentro de contenedores.
4. **Menos UI, más producto.** Quitar bordes innecesarios, divisores, etiquetas redundantes, contenedores anidados, íconos sin propósito, color sin significado, encabezados obvios y navegación duplicada. Si al quitarlo no se pierde comprensión ni funcionalidad, quitarlo.
5. **El espacio vacío también es diseño.** No llenar una pantalla solo porque hay lugar. El aire crea jerarquía, ritmo y sofisticación.
6. **Componer, no juntar componentes.** Una pantalla no debe sentirse como piezas arrastradas de una librería. Pensar ritmo, balance, tensión, proporción y masa visual. No todo en la misma grilla ni con las mismas dimensiones.
7. **Usar cards solo cuando hay una razón.** Una card sirve para una entidad claramente distinta. Muchas veces alcanza tipografía + espacio + alineación + contraste. Menos cajas, más estructura.
8. **La tipografía es arquitectura.** La escala tipográfica comunica importancia. Los números pueden ser elementos visuales. Las etiquetas pueden desaparecer cuando el contexto alcanza. Si la UI funciona en blanco y negro solo con tipografía y espacio, la base es sólida.
9. **Diseñar con imágenes, no alrededor de ellas.** La fotografía puede ser fondo, superficie, contexto, navegación o storytelling. Permitir que algunas imágenes dominen la composición. Usar fotografía real (ver sección de imaginería).
10. **El color debe significar algo.** Construir primero con composición, escala, contraste, imagen, espacio y profundidad; después color. Una paleta restringida da más identidad que una multicolor. Menos colores, mejor usados.
11. **La profundidad se siente, no se anuncia.** Evitar sombras duras. Crear profundidad con tono, transparencia, blur, escala, posición y luz. Glassmorphism solo cuando comunica capas.
12. **Lo importante merece escala.** No convertir toda la información en texto chico. Una métrica clave puede ser enorme; una imagen puede dominar el viewport; una acción primaria puede ser imposible de no ver.
13. **Toda pantalla necesita un protagonista.** Si la respuesta a "¿qué debería mirar primero?" son cinco cosas, la jerarquía no está resuelta.
14. **Diseñar el recorrido, no las pantallas.** Pensar antes → durante → después. La UX debe sentirse continua.
15. **La navegación no debe competir con el contenido.** Priorizar tareas frecuentes; disclosure progresivo para el resto. Mobile y desktop no necesitan el mismo patrón.
16. **Mobile no es desktop comprimido.** Cada tamaño merece su propia composición (recomponer, no encoger).
17. **La interacción también tiene personalidad.** Diseñar hover, focus, pressed, loading, éxito, error, vacío, skeleton y transiciones. El motion explica cambios, no decora.
18. **Consistencia ≠ repetición.** Coherencia en radios, tipografía, spacing, íconos, estados, color y motion; pero las composiciones pueden variar según el contenido. Mismo lenguaje, frases distintas.
19. **Si todo parece importante, nada lo es.** Evitar cinco CTAs primarios, múltiples acentos y badges por todos lados. La restricción aumenta el impacto.
20. **Evitar "un dashboard".** No convertir todo en sidebar + header + 4 métricas + gráfico + tabla. Empezar por la necesidad del usuario.
21. **La interfaz debe sentirse inevitable.** El siguiente paso debe ser natural. Claridad > novedad.
22. **Premium ≠ complejo.** Significa precisión, contención, detalle, composición, buena tipografía y espacio. No más gradientes, blur, animaciones ni sombras.
23. **Dispuesto a destruir una solución mediocre.** El código existente es tiempo invertido, no necesariamente una buena decisión. La deuda visual también existe.
24. **Toda decisión necesita una razón.** Nunca "porque se ve mejor". Buscar la razón de jerarquía, carga cognitiva, velocidad de tarea, legibilidad o identidad.

### Orden de prioridades

Cuando haya conflicto, priorizar en este orden:

1. Comprensión
2. Utilidad
3. Jerarquía
4. Flujo
5. Composición
6. Identidad
7. Consistencia
8. Detalle visual
9. Reutilización de componentes

Nunca sacrificar las primeras para proteger las últimas.

### La pregunta fundamental

Antes de finalizar: **"¿Si nunca hubiera visto la interfaz anterior, la diseñaría así?"** Si la respuesta es no, seguís atado al pasado.

---

## 2. Verdades de producto (no inventar)

- **La entrega es a la dirección del cliente**, que se **carga en el flujo de checkout**. No existe "entrega al campus" ni una dirección por defecto.
- Al cargar la app, si no hay una dirección seleccionada, se pide elegir la **dirección actual** (modal en desktop, bottom sheet en mobile): se ofrecen las direcciones guardadas y, si no hay, se invita a cargar una. La elección persiste y precarga el checkout.
- La **sucursal se asigna automáticamente** al confirmar (la más cercana, activa y abierta). No es una decisión del cliente.
- No hay pago en línea ni descuentos automáticos. El mapa (estático, Geoapify) se usa solo para el seguimiento de un pedido activo.
- El carrito y el total son datos del servidor; el frontend no los calcula como verdad final.
- El estado de pedido tiene su propia máquina de estados y traducción (ver §5.6).

---

## 3. Dirección visual: "Calor"

Una app de delivery **cálida, vibrante y cercana**, como la comida recién hecha. No fría, no corporativa, no genérica.

- **Temperatura:** cálida en claro (cremas, naranja). En oscuro, el calor lo aporta el **naranja sobre negro**, no un fondo marrón.
- **Sensación:** apetito, urgencia, calidez. "Pedí y llega caliente".
- **Mobile = app, desktop = web.** Mobile: app nativa (dock flotante, densidad compacta, protagonista claro). Desktop: web cuidada (nav superior, más aire).

---

## 4. Paleta

Definida en `@repo/theme` (`packages/theme/src/config.ts`) como tokens semánticos de Chakra. Cada app consume ese `config` en `src/theme.ts` (`createSystem(defaultConfig, config)`).

| Token               | Claro     | Oscuro    | Uso                                                              |
| ------------------- | --------- | --------- | ---------------------------------------------------------------- |
| `bg`                | `#FFFFFF` | `#000000` | Fondo de página (blanco puro en claro, **negro puro** en oscuro) |
| `bg.panel`          | `#FFFFFF` | `#0A0A0A` | Tarjetas, header, dock                                           |
| `bg.muted`          | `#FFF1E5` | `#1A1A1A` | Fondo suave de inputs/cards destacados                           |
| `bg.subtle`         | `#FFF9F4` | `#121212` | Fondo secundario / secciones                                     |
| `fg`                | `#1C1917` | `#F5F5F5` | Texto principal                                                  |
| `fg.muted`          | `#6B7280` | `#A1A1A1` | Texto secundario                                                 |
| `fg.subtle`         | `#9CA3AF` | `#737373` | Texto terciario                                                  |
| `border.subtle`     | `#FBE4D2` | `#262626` | Bordes finos                                                     |
| `border.muted`      | `#F6D6BE` | `#333333` | Bordes de separación                                             |
| `border.emphasized` | `#EBC2A2` | `#404040` | Bordes de énfasis                                                |
| `brand.500`         | `#EA580C` | `#EA580C` | Elementos destacados, item activo                                |
| `brand.600`         | `#C2410C` | `#C2410C` | Botón primario                                                   |
| `brand.700`         | `#9A3412` | `#9A3412` | Hover / estados fuertes                                          |
| `accent.500`        | `#F59E0B` | `#F59E0B` | Indicadores secundarios                                          |
| `success`           | `#15803D` | `#4ADE80` | Confirmaciones / entregado                                       |
| `warning`           | `#B45309` | `#FBBF24` | Pendiente                                                        |
| `danger`            | `#B91C1C` | `#F87171` | Errores / cancelado                                              |
| `info`              | `#1D4ED8` | `#60A5FA` | Confirmado / en camino                                           |

**Reglas de color:**

- **Modo oscuro = negro + grises neutros + naranja.** Nunca marrones en dark (los fondos cálidos oscuros ensucian). El negro reemplaza al blanco puro.
- Siempre tokens semánticos, nunca hex sueltos en el markup.
- El naranja `brand` es el **único acento**. Un solo color, usado con intención.
- En claro el fondo es `#fff` siempre.
- Estados: combinar color + ícono + texto (nunca color solo).

---

## 5. Sistema y patrones

### 5.1 Tipografía

- **Fuente global:** Outfit (Google Fonts), en `index.html` y `@repo/theme` (`fonts.heading`/`fonts.body`).
- **Jerarquía por peso y color, no solo por tamaño.** Tres niveles sobre la misma base: `value` 600/`fg`, `label` 500/`fg.muted`, `meta` 400/`fg.subtle`.
- Escala (ratio ~1.25): caption 12 · body 14/16 · h4 18 · h3 22 · h2 28 · h1 32 · display 44.
- Headings `fontWeight="bold"` (700), tracking negativo en tamaños grandes, `textWrap="balance"`.
- `tabular-nums` en números dinámicos (precios, contadores).
- **Tipografía tokenizada** (`@repo/components`): `PageTitle` (h1 de página), `SectionTitle` (h2 de sección), `Eyebrow` (overline uppercase), `Lead`, `Strong` (semibold), `Muted` (`fg.muted`), `Subtle` (`fg.subtle`), `Price` (semibold + `tabular-nums`), `TextLink` (enlace `brand.600`). No componer `Heading`/`Text` con props de estilo repetidas: usar el token.

### 5.2 Geometría y profundidad

- Bordes píldora (`full`) en botones, chips y nav activo. Radios generosos (`xl`/`2xl`) en cards.
- **Concentricidad:** `outerRadius = innerRadius + padding`.
- Espaciado base 4px, múltiplos.
- **Profundidad:** en claro, bordes sutiles + sombras suaves; en oscuro, solo bordes (`rgba(255,255,255,0.06–0.12)` o tokens `border.*`), sin sombras.
- Glow "ember": usar blobs `brand.500`/`accent.500` con `filter="blur(80–90px)"` y opacidad baja, sobre superficie. Usar con contención (un protagonista por pantalla).

### 5.3 Header (`StoreHeader`)

- Sticky, `bg.panel`, borde inferior `border.subtle`.
- **Desktop:** logo + nav con píldora activa naranja + acciones (toggle dark, carrito, perfil).
- **Mobile: logo + selector de dirección.** El selector (`LocationButton`) aparece solo en Inicio y Catálogo; el resto de acciones (carrito, dark) viven en el dock y en Perfil.
- **Pantallas empujadas (fuera del dock):** el header con logo se reemplaza por una **flecha de volver** (`BackButton`, `ArrowLeft` + `navigate(-1)`) tipo iOS. Aplica a: detalle de producto (`/productos/:id`), checkout, sucursales, detalle de pedido (`/pedidos/:id`), editar perfil y mis direcciones. Las pantallas del dock (Inicio, Catálogo, Carrito, Pedidos, Perfil) conservan el header con logo.

### 5.4 Navegación mobile (`MobileStoreNavigation`)

- Solo mobile, **dock flotante** (píldora centrada, `borderRadius="full"`, borde + sombra), no una barra a todo lo ancho.
- Item activo = píldora `brand.500` con texto blanco. Inactivo = `fg.muted`.
- El carrito muestra badge con la cantidad.
- Items de cuenta (Perfil, Editar, Direcciones, Apariencia) viven en la página Perfil, no duplicados en el dock.
- El dock es el componente genérico `MobileNav` de `@repo/components` (ítems configurables con `icon`, `path`, `badge`, `exact`). `MobileStoreNavigation` es solo la configuración de la tienda.

### 5.5 Footer

- **Solo en desktop.** En mobile no hay footer (el dock y el contenido alcanzan).

### 5.6 Estados de pedido

Traducción + apariencia compartidas entre store y admin. Usar `OrderStatusBadge` (color + punto + texto) y, en seguimiento, un timeline.

| Estado               | Etiqueta            | Tratamiento      |
| -------------------- | ------------------- | ---------------- |
| `PENDING`            | Pendiente           | `warning`        |
| `CONFIRMED`          | Confirmado          | `info`           |
| `PREPARING`          | En preparación      | `brand` (orange) |
| `READY_FOR_DELIVERY` | Listo para entregar | `purple`         |
| `ON_THE_WAY`         | En camino           | `info`           |
| `DELIVERED`          | Entregado           | `success`        |
| `CANCELLED`          | Cancelado           | `danger`         |

### 5.7 Iconografía y flechas

- Iconos: `@gravity-ui/icons`, `fill="currentColor"` (heredan color del contenedor; no pasar `color` con token al ícono directamente: envolver en un `Box` con `color`).
- **Chevrons: siempre simple** (`ChevronRight`/`ChevronLeft`). **Nunca** las flechas dobles raras (`ArrowChevronRight`/`ArrowChevronLeft`).

### 5.8 Imaginería

- Usar **fotografía real de Unsplash**, art-directed: que funcione como parte de la composición (espacio negativo, foco, contraste, crop mobile/desktop).
- No placeholders grises, gradientes que fingen ser imagen, ni bloques vacíos.
- Las imágenes de un mismo set deben pertenecer al mismo mundo visual. Curar, no llenar slots.

### 5.9 Datos

- Consumir la API desde `/api` (proxy de Vite).
- Mientras el backend sea stub, **mockear las respuestas** con SWR + fallback (patrón de `useProfile`, `useCatalog`, `useProduct`): intentar el endpoint y devolver datos mock si falla o no hay proxy.
- El estado global va con **Zustand** (`cartStore`, etc.).

### 5.10 Estructura de componentes

- Cada componente en `src/components/ComponentName/` con `index.tsx` (named export), `types.ts`, y `hooks/`/`utils/` solo si aportan (ver skill `frontend-components`).
- Chakra UI v3 siempre, nunca `div` custom. Tokens semánticos para dark mode automático.
- Lo **genérico y compartido entre apps** va a `@repo/components` / `@repo/domain` / `@repo/api` / `@repo/theme` (paquetes del monorepo). Los componentes específicos de una app quedan en `apps/*/src/components/`.

### 5.11 Layout de páginas

Dos contenedores de página, unificados en `@repo/components`. **Ninguna página usa un `VStack`/`Box` custom como raíz.**

- **`PageContainer`** — angosto (`maxW="2xl"`, centrado, `gap="6"`). Para formularios/detalle: Mis direcciones, Sucursales, Editar perfil, Mi perfil, Mis pedidos, Detalle de pedido, Checkout.
- **`WidePageContainer`** — full-width (hasta el `Container maxW="1200px"` del `StoreLayout`, `gap={{ base: "8", md: "12" }}`). Para listados y páginas amplias: Inicio, Catálogo, Carrito, Detalle de producto.
- La **autenticación es su propia app** (`apps/auth`, puerto 5175): login/registro/recuperar/restablecer viven ahí, dentro del shell `AuthLayout` (columna 480px + imagen). Tras loguearse redirige a `store` o `admin` según el `role`. Store y admin no tienen UI de auth propia.

### 5.12 Tokens de diseño (`@repo/components`)

**Un mismo look = un mismo token.** No volver a componer Chakra a mano si existe el token.

| Categoría   | Tokens                                                                                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tipografía  | `PageTitle`, `SectionTitle`, `Eyebrow`, `Lead`, `Strong`, `Muted`, `Subtle`, `Price`, `TextLink`                                                        |
| Botones     | `PrimaryButton`, `SecondaryButton`, `InverseButton`, `GhostButton`, `OutlineButton`                                                                     |
| Formularios | `TextField`, `PasswordField`, `TextAreaField`, `PasswordInput`, `SearchInput` + `FormField`, `FormPasswordField`, `FormTextAreaField` (React Hook Form) |
| Layout      | `PageContainer`, `WidePageContainer`, `Footer`, `ResponsiveModal` (dialog + bottom-sheet), `SidePanel`                                                  |
| Navegación  | `MobileNav`, `ChipCarousel`                                                                                                                             |
| Feedback    | `EmptyState`, `SplashScreen`                                                                                                                            |
| Dominio     | `OrderStatusBadge`, `OrderTimeline`                                                                                                                     |
| Base        | `Logo`, `BackButton`, `ColorModeProvider`/`ColorModeButton`, `QuantityStepper`, `Chip`, `SectionHeader`, `RequireAuth`                                  |

- **Botones** ya traen `size`/`radius`/colores; solo `children` + props semánticas (`asChild`, `type`, `disabled`, `loading`, `width`, `onClick`). No re-estilizar.
- **Campos** (`TextField`/`PasswordField`/`TextAreaField`) ya traen `size="lg"`, `borderRadius="xl"`, `bg="bg.panel"` y el patrón de validación (`required` + `invalid` + `errorText`).
- **Validación de formularios:** React Hook Form + Zod + `@hookform/resolvers`. Los schemas viven en `@repo/domain` (`schemas.ts`) y se comparten entre apps. Patrón: `useForm` + `zodResolver(schema)` (mode `onTouched`) en el hook, `<FormProvider {...form}>` + `FormField`/`FormPasswordField`/`FormTextAreaField` en la página, y `form.handleSubmit(onValid)` como `onSubmit`. No validar a mano en `useState`.
- **Capas:** tipos/constantes de dominio en `@repo/domain`; hooks/datos en `@repo/api`; tokens de color en `@repo/theme`.

---

## 6. Inventario implementado

### 6.1 Apps

| App          | Puerto (dev) | Rol                                                                                                                                                                     |
| ------------ | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/auth`  | 5175         | Autenticación (login/registro/recuperar). Tras el login redirige a `store` o `admin` según el `role` del auth API (`src/config.ts`, `VITE_STORE_URL`/`VITE_ADMIN_URL`). |
| `apps/store` | 5173         | Cliente (catálogo, carrito, pedidos, perfil).                                                                                                                           |
| `apps/admin` | 5174         | Administración (aún base).                                                                                                                                              |

### 6.2 Rutas de la tienda (`apps/store/src/App.tsx`)

| Ruta                                                                                | Página                                                         |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `/`                                                                                 | HomePage (storefront)                                          |
| `/catalogo`                                                                         | CatalogPage (búsqueda + filtro por categoría via `?cat=<id>`)  |
| `/productos/:productId`                                                             | ProductDetailPage (configurador)                               |
| `/carrito`                                                                          | CartPage                                                       |
| `/checkout`                                                                         | CheckoutPage (carga de dirección + confirmación)               |
| `/sucursales`                                                                       | SucursalesPage (lista, datos mock)                             |
| `/pedidos`                                                                          | OrdersPage (timeline + historial)                              |
| `/pedidos/:orderId`                                                                 | OrderDetailPage (detalle con mapa de seguimiento para activos) |
| `/perfil`                                                                           | ProfilePage                                                    |
| `/perfil/editar`                                                                    | EditProfilePage                                                |
| `/perfil/direcciones`                                                               | AddressesPage (CRUD de direcciones guardadas)                  |
| `/login` / `/registro` / `/recuperar-contrasena` / `/restablecer-contrasena/:token` | páginas de auth                                                |

Las rutas de tienda están protegidas por el HOC `RequireAuth` (salvo las de auth). Por defecto exigen sesión; `?forceAuth=true` desactiva la protección (el flag se persiste y se forwardea entre la navegación), y `?forceAuth=false` la reactiva.

### 6.3 Componentes

- **Store (`apps/store/src/components/`):** `AddressPickerModal` (+ `AddressForm`), `CartButton`, `CartDrawer`, `CartLineCard`, `LocationButton`, `MobileStoreNavigation` (wrapper configurable del `MobileNav` genérico), `ProductCard`, `StoreHeader` (+ `DesktopNav`, `HeaderActions`).
- **Compartidos (`@repo/components`):** ver §5.12 (inventario completo de tokens). Los SVG del logo viven en `apps/*/src/assets/`; `Logo` recibe `lightSrc`/`darkSrc`.

### 6.4 Hooks, stores, utils, types

- **hooks (`@repo/api`):** `useCatalog`, `useProduct`, `useProfile`, `useOrder` (patrón SWR + fallback mock), más mocks (`MOCK_CATEGORIES`, `MOCK_PRODUCTS`, `MOCK_ORDERS`, `MOCK_USER`).
- **stores (`@repo/api`):** `authStore` (`useAuthStore`: sesión `user` + `bypassAuth` persistidos, `login(email, role?)`/`register`/`logout`/`setBypassAuth` mock). Store-local: `cartStore`, `addressStore` (direcciones guardadas + `selectedAddressId` con persistencia en `localStorage`).
- **layouts:** `StoreLayout` (store). El shell `AuthLayout`, `AuthSuccess` y `PageHeader` viven en `apps/auth/src/components/` (específicos de la app de auth).
- **utils (store):** `sucursales.ts` (mock), `addresses.ts` (mock de direcciones), `geoapify.ts` (`buildStaticMapUrl`).
- **tipos/constantes (`@repo/domain`):** `order`, `order-status`, `catalog`, `user`, `address`, `branch`, `auth` (`LoginInput`/`RegisterInput`), `format`. La tienda ya no define tipos de dominio propios.

### 6.5 Datos mock (hasta que la API sea real)

- 5 categorías, 13 productos con fotos de Unsplash.
- 2 direcciones guardadas (mock) en `utils/addresses.ts`, semilladas en `addressStore`.
- `useProfile` devuelve `MOCK_USER` ("Juan Pérez") cuando no hay `userId`.
- `useCatalog`/`useProduct` intentan `/api/...` y caen al mock si falla o no hay proxy.
- Pedidos y sucursales: mocks en `@repo/api/src/mocks/orders.ts` y `apps/store/src/utils/sucursales.ts`.
- 3 pedidos mock: 1 activo (`ON_THE_WAY`, con rider y coordenadas para el mapa), 1 entregado, 1 cancelado (con motivo).
- Auth mock: `authStore` con `login`/`register` que simulan latencia (600ms); la sesión persiste en `localStorage`.

---

## 7. Firma visual (movimientos compositivos que definen la identidad)

### 7.1 Hero editorial con "ember glow"

La pantalla de inicio no es un dashboard: es una **composición editorial** con un protagonista (el headline + el CTA).

- Superficie: `borderRadius="3xl"`, `bg="bg.subtle"`, borde `border.subtle`, `overflow="hidden"`.
- Glow: blobs `brand.500` y `accent.500` con `filter="blur(90px)"`, `opacity="0.14"`, radios `full`, posicionados fuera del contenedor (top/right y bottom/left). **Solo tokens, nunca hex.**
- Grid `1.15fr / 1fr` en desktop, una columna en mobile. Padding `8` → `14`.
- Tipo: eyebrow (ícono + texto `brand.600`), `H1` display `4xl → 6xl`, `lineHeight="1.02"`, `letterSpacing="-0.02em"`, `textWrap="balance"`. Un `H2` secundario en `brand.600` para la frase corta.
- Foto (desktop only): card `borderRadius="2xl"`, `aspectRatio="4 / 3"`, `boxShadow="xl"`, `transform="rotate(2deg)"`; una **píldora flotante** solapada (`bottom="-12px"`) con dato contextual ("Entrega ~35 min").

### 7.2 Card de producto image-led

- Card `borderRadius="2xl"`, borde `border.subtle`, `overflow="hidden"`.
- Imagen `aspectRatio="4 / 3"` (no thumbnail chico). Nombre `semibold` + descripción `fg.muted` con `lineClamp={1}`.
- Footer `HStack justify="space-between"`: precio `semibold` + `tabular-nums` a la izquierda; `IconButton` píldora `bg="brand.600"` con `Plus` (16) a la derecha.
- Hover: `translateY(-2px)` + `boxShadow="md"` (150ms, `cubic-bezier(0.2,0,0,1)`).

### 7.3 Dock flotante mobile

Navegación como app nativa, **no una barra a todo el ancho**.

- Wrapper `fixed`, `bottom="4"`, centrado, `pointerEvents="none"`; el dock interno `pointerEvents="auto"`.
- Dock: `bg.panel`, `borderRadius="full"`, `padding="1"`, borde `border.subtle`, `boxShadow="lg"`.
- Item activo = píldora `brand.500` texto blanco; inactivo = `fg.muted`. Ícono 20 + label `2xs`.
- Carrito con badge (top/right, `brand.500`, blanco cuando el ítem está activo).

### 7.4 Configurador de producto

- Detalle en `Grid 1fr/1fr` (imagen `sticky top="24"` en desktop, `aspectRatio="1 / 1"`).
- Grupos de opciones: botones `ghost` full-width, `justify-between`, `borderRadius="xl"`, `px 4 / py 3`, borde `1.5px`. Indicador 18px (círculo para single, cuadrado con `Check` para multiple). Precio delta en `brand.600` o "Sin cargo".
- Resumen del ítem en `bg.subtle` `2xl` `padding 5`: cantidad + total (grande) + CTA `brand.600` píldora full-width.

### 7.5 Timeline de pedido

- Dots 14px + línea 2px (`brand.500` completado, `border.subtle` pendiente, `brand.600` actual). Labels `2xs` `whiteSpace="nowrap"` con pasos cortos ("Preparando" en vez de "En preparación") para que no se corten en pantallas angostas.
- Badge de estado: `OrderStatusBadge` = `Badge` `variant="subtle"` + punto `currentColor` + texto (color + ícono + texto, nunca color solo).

### 7.6 Selector de dirección (`AddressPickerModal`)

Aparece al cargar la app si no hay una dirección seleccionada; se reabre desde el chip del header (`LocationButton`).

- **Desktop = modal centrado**, **mobile = bottom sheet** — implementado con el token `ResponsiveModal` (`@repo/components`), que decide la variante con `useMediaQuery(["(min-width: 48em)"])`.
- **Chip del header (`LocationButton`)**: píldora `ghost` de una línea (`GeoPin` `brand.600` + calle `medium` + `ChevronDown`), `height="9"`. Visible en desktop siempre; en mobile solo en Inicio, Catálogo y Carrito.
- Encabezado: ícono `GeoPin` en círculo `brand.600` sobre `bg.muted` (44px), título `xl` bold, subtítulo `fg.muted`.
- Lista de direcciones: `Button` `variant="outline"` full-width (`height="auto"`, `borderColor="border.subtle"`, `borderRadius="xl"`), con label `semibold` + calle `fg.muted` + localidad `fg.subtle` + `ChevronRight`. Tap = selecciona y cierra.
- "Agregar nueva dirección": `GhostButton` `brand.600` con `Plus`; cambia a un formulario (`TextField`). Si hay guardadas, el formulario tiene "Volver" (`GhostButton`).
- Bottom sheet: grabber (`w=10` `h=1` `border.emphasized`), `borderTopRadius="3xl"` y `paddingBottom` con `safe-area-inset-bottom`.
- La selección persiste en `addressStore` (`localStorage`); no vuelve a preguntar mientras exista una seleccionada. En checkout se precarga la dirección seleccionada.

### 7.7 Detalle de pedido (`OrderDetailPage`)

- **Activo** (`PENDING`…`ON_THE_WAY`): timeline (`OrderTimeline`) + **mapa estático de seguimiento** (Geoapify `buildStaticMapUrl`) con 3 markers — tienda (`info`, texto "T"), dirección del cliente (`success`, texto "C") y rider (`brand`, ícono `person-biking`) — y una leyenda con punto de color + título + subtítulo.
- **Cancelado**: card con `CircleXmarkFill` `danger` + motivo (`cancelReason`). **Entregado**: card con `CircleCheckFill` `success` + fecha (`deliveredAt`).
- Items (cantidad × nombre + subtotal) y total con `tabular-nums`. Atribución de mapa: "© OpenStreetMap · Geoapify". Mapa = `Image` responsive sobre card `bg.panel` `2xl` `overflow="hidden"`, solo en activos.

### 7.8 Autenticación (`apps/auth`)

- **Desktop**: fondo `bg.muted`, card centrada `bg.panel` con `border.subtle` y `3xl` + `md` shadow, `maxW="sm"`, logo `48px` arriba.
- **Mobile**: full-screen (sin card ni borde) sobre `bg`, logo arriba, campos `size="lg"` full-width y `paddingBottom` con `safe-area-inset-bottom` (look de app nativa).
- Formularios: `TextField` / `PasswordField` / `TextAreaField` (`size="lg"`, `borderRadius="xl"`, `bg="bg.panel"`, validación con `required` + `invalid` + `errorText`). Contraseñas con `PasswordField` (`PasswordInput` + toggle `Eye`/`EyeClosed`).
- Éxito de recuperar/restablecer: `AuthSuccess` (ícono `CircleCheckFill` `success` + título + descripción + CTA full-width), en `apps/auth/src/components/`.
- CTA primario: `PrimaryButton` con `loading`/`disabled` mientras envía. Links de auth: `TextLink` (`brand.600` `semibold`).
- Tras `login`/`register` redirige por `role` (`redirectByRole` en `apps/auth/src/config.ts`): `admin` → admin, `client` → store.

---

## 8. Medidas y tokens rápidos (cheat-sheet)

| Decisión                                  | Valor                                                                                                                     |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Ancho máximo de contenido                 | `Container maxW="1200px"`                                                                                                 |
| Contenedores de página                    | `PageContainer` (`maxW="2xl"`) · `WidePageContainer` (full-width)                                                         |
| Header height                             | `h="16"` (64px)                                                                                                           |
| Logo                                      | `height="40px"`                                                                                                           |
| Radio — píldoras/botones/chips/nav activo | `full`                                                                                                                    |
| Radio — inputs / opciones / cards chicas  | `xl`                                                                                                                      |
| Radio — cards                             | `2xl`                                                                                                                     |
| Radio — hero / banner                     | `3xl`                                                                                                                     |
| Glow ember                                | `blur(80–90px)`, `opacity(0.12–0.35)`                                                                                     |
| Elevación (claro)                         | borde `border.subtle` + `boxShadow` suave (`sm`/`md`/`lg`)                                                                |
| Elevación (oscuro)                        | solo bordes `border.*`, sin sombras                                                                                       |
| Botón primario                            | `PrimaryButton` (bg `brand.600` blanco, píldora, hover `brand.700`)                                                       |
| Nav activo                                | píldora `brand.500` / texto blanco                                                                                        |
| Espaciado base                            | 4px, múltiplos                                                                                                            |
| Grilla productos                          | `SimpleGrid` base 2 / md 3 / lg 4, gap `3` → `5`                                                                          |
| Escala tipo                               | 2xs (nav/timeline) · xs (tags) · sm (secundario) · md/lg (título de card) · xl (valores) · 2xl–4xl (títulos) · 6xl (hero) |

---

## 9. Decisiones tomadas y su porqué

| Decisión                                                              | Porqué                                                                                                                             |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Footer solo desktop                                                   | En mobile el dock + contenido alcanzan; el footer es ruido y quita protagonismo.                                                   |
| Header mobile = logo + selector de dirección (solo Inicio y Catálogo) | Menos UI. Carrito va en el dock; el toggle dark va en Perfil. El selector de dirección es una acción contextual de descubrimiento. |
| Toggle dark en Perfil (mobile)                                        | No es una acción frecuente; disclosure progresivo.                                                                                 |
| Dark = negro + grises (no marrón)                                     | El marrón ensucia en oscuro; el "calor" lo aporta el naranja sobre negro.                                                          |
| Chevrons simples (`Chevron*`)                                         | Las flechas dobles (`ArrowChevron*`) se ven raras.                                                                                 |
| Dirección cargada en checkout                                         | Verdad de producto: la entrega es a la dirección del cliente. El selector persiste y precarga el checkout.                         |
| Mock de respuestas                                                    | La API aún es stub; `SWR + fallback` mantiene el contrato y permite reemplazar por datos reales sin tocar la UI.                   |
| Fotografía Unsplash art-directed                                      | La imagen forma parte de la composición, no es un thumbnail decorativo.                                                            |
| Menos cards                                                           | Estructura con tipografía, espacio y fondo antes que contenedores.                                                                 |
| Tokens de UI en `@repo/components`                                    | Una sola identidad compartida entre apps; no repetir estilos a mano.                                                               |

---

## 10. Anti-patrones

- ❌ Fondos grises azulados fríos **y marrones en modo oscuro** (dark = negro + grises neutros).
- ❌ Múltiples acentos de color; color sin significado.
- ❌ Cards para todo (menos cajas, más estructura).
- ❌ Flechas dobles raras (`ArrowChevron*`); usar `Chevron*`.
- ❌ Footer en mobile.
- ❌ Botones en el header de mobile.
- ❌ Radios iguales en contenedores anidados.
- ❌ Números que se mueven (usar `tabular-nums`).
- ❌ `transition: all`, `will-change: all`.
- ❌ Colores hex sueltos en el markup.
- ❌ Múltiples CTAs primarios compitiendo.
- ❌ Inventar datos de producto (p. ej. "entrega al campus"); la entrega es a la dirección del cliente.

---

## 11. Cómo aplicar y extender

1. Usar componentes Chakra y tokens semánticos siempre.
2. Botones: usar `PrimaryButton` / `SecondaryButton` / `InverseButton` / `GhostButton` / `OutlineButton` (nunca `Button` con colores a mano).
3. Textos: usar los tokens de tipografía (`Strong`, `Muted`, `Subtle`, `Price`, `Eyebrow`, `PageTitle`, `SectionTitle`, …), no `Text`/`Heading` con props de estilo repetidas.
4. Formularios: usar `TextField` / `PasswordField` / `TextAreaField` (nunca `Field.Root` + `Input` a mano).
5. Layout: toda página usa `PageContainer` o `WidePageContainer` (las páginas de auth están en la app `apps/auth`).
6. Nav activo: píldora `brand.500` / texto blanco.
7. Cards: `bg="bg.panel"` + `borderRadius="2xl"` + borde `border.subtle` (solo cuando la entidad lo justifique).
8. Nuevas pantallas: definir el **protagonista** primero, luego jerarquía primario→secundario, luego identidad.
9. Mock nuevo = patrón `SWR + fallback` (como `useCatalog`/`useProduct`).
10. Verificar mobile (390px) y desktop (1200px) antes de dar por terminado; recomponer, no encoger.
11. Si una decisión nueva cambia el sistema (color, patrón, navegación, token), actualizar **este documento** en el mismo cambio.
