---
name: modern-code-quality
description: Reglas de calidad de código para TypeScript moderno en el backend y frontend: ES6+, funciones flecha, código moderno y orientación a objetos. Usar al escribir o revisar cualquier archivo fuente.
---

# Calidad de código: ES6+, moderno y orientado a objetos

Normas obligatorias para todo el código TypeScript del proyecto.

## Funciones flecha y ES6+

- Usar **funciones flecha** (`const fn = (x) => ...`) en lugar de `function` cuando no se
  necesita `this` dinámico ni hoisting.
- Preferir **`const`**; usar `let` solo cuando la variable se reasigna. **Nunca `var`**.
- Destructuring: `const { name, price } = product;` y parámetros por defecto
  `function createProduct({ name, price = 0 })`.
- Template literals en lugar de concatenación: `` `El total es ${total}` ``.
- `async/await` en lugar de cadenas de `.then()`. Manejar errores con `try/catch`.
- `Array.prototype.map/filter/reduce/find/some/every` en lugar de loops `for` cuando se
  transforma o filtra.
- Optional chaining `?.` y nullish coalescing `??` en vez de `&&`/`||` para defensas.
- Spread `...` para copiar/mergear objetos y arrays (nunca mutar el original).
- Desestructurar imports con nombre: `import { createOrder } from "./order.service"`.
- Sin `any` implícito ni explícito sin justificación: tipar con los tipos del dominio o
  `unknown` cuando el valor llega de afuera y hay que validarlo.
- Sin imports sin usar, sin código muerto, sin variables no usadas.

## Orientación a objetos

- **Encapsulamiento**: cada clase expone solo lo necesario; la lógica privada queda
  privada. El estado mutable de una entidad no se edita desde afuera salvo por sus métodos.
- **Un solo propósito por clase**: servicios primarios con una responsabilidad concreta.
  Si una clase crece en más de una responsabilidad → dividir.
- **Inyección de dependencias**: las dependencias (repositorios, otros servicios de
  infraestructura) entran por el constructor. Nada de instanciar dependencias con `new`
  dentro de servicios de negocio.
- **Interfaces para contratos**: las dependencias se declaran con su interfaz/tipo, no
  con la implementación concreta, para facilitar mocks y tests.
- Nombres de clases en **PascalCase**, métodos en **camelCase**, constantes en
  **UPPER_SNAKE_CASE**.
- Sin clases tontas (sin lógica, solo campos) cuando un tipo/interfaz alcanza; usar
  **interfaces y tipos para datos**, clases solo cuando tienen comportamiento.

## Buenas prácticas generales

- Nombres descriptivos: variables y funciones dicen qué representan/hacen.
  Preferir `isActive`, `calculateTotal`, `getAvailableBranches` a `flag`, `calc`, `get`.
- Funciones cortas: una función hace una sola cosa. Si hay que explicarla con
  comentarios largos, extraer subfunciones con nombres claros.
- Sin lógica duplicada: extraer a funciones/constantes compartidas.
- Manejo de errores explícito: lanzar errores de dominio con mensajes claros en lugar
  de devolver valores mágicos.
- Sin side effects ocultos: las funciones que modifican estado lo declaran en su nombre
  (`update`, `markAsConfirmed`, `removeItem`).
- Formato y estilos según Prettier/ESLint del repo (no apagar las reglas sin motivo).

## Checklist al escribir código

- [ ] Sin `var`, sin `.then()`, sin concatenar strings con `+` para texto.
- [ ] `const` por defecto; `let` solo si reasigna.
- [ ] Tipos explícitos en firmas de funciones; sin `any` injustificado.
- [ ] Clases con un solo propósito y dependencias inyectadas por constructor.
- [ ] Sin imports ni variables sin usar.
- [ ] Funciones cortas y con nombres descriptivos.
- [ ] Sin lógica duplicada ni código muerto.
