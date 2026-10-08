---
name: save-prompts
description: Guarda siempre en el proyecto el prompt del usuario y la interacción con IA, y produce un informe acotado, explicativo y simple de entender. Usar en toda interacción de este proyecto para dejar registro automático, sin esperar a que el usuario lo pida.
---

# Guardar prompts e interacciones con IA

Registra en el proyecto el prompt del usuario y un informe corto de la interacción,
con lenguaje simple y sin jerga técnica.

## Cuándo usar

Siempre, en cada interacción de este proyecto. Guarda cada prompt e interacción con
la IA de forma automática, sin esperar a que el usuario lo pida.

## Dónde guardar

Un archivo Markdown por interacción, dentro de una subcarpeta según la **aplicación
a la que afecta**, en:

```text
docs/prompts/<app>/YYYY-MM-DD-HHmm-<slug>.md
```

Si `docs/prompts/<app>/` no existe, créala.

## Subcarpeta por aplicación

`<app>` es la aplicación (o parte del proyecto) a la que afecta el prompt:

| `<app>`     | Cuándo usarla                                                        |
| ----------- | -------------------------------------------------------------------- |
| `gateway`   | Afecta `apps/gateway` (GraphQL, puerto 4000).                        |
| `auth`      | Afecta `apps/auth` (autenticación, puerto 4201).                     |
| `commerce`  | Afecta `apps/commerce` (catálogo/pedidos, puerto 4202).              |
| `delivery`  | Afecta `apps/delivery` (entrega/despacho, puerto 4203).              |
| `packages`  | Afecta paquetes compartidos (`packages/`).                           |
| `general`   | No afecta una app puntual, o afecta a varias / al monorepo completo. |

Cómo decidirla:

1. Si el prompt o los archivos mencionados apuntan a una sola app → usar esa app.
2. Si menciona un paquete compartido (`eslint-config`, `typescript-config`) → `packages`.
3. Si no es claro o afecta a varias → `general`.
4. Si queda ambiguo y el usuario no lo aclaró, preguntar en una sola línea antes de guardar.

## Nombre del archivo

`YYYY-MM-DD-HHmm-<slug>.md`

- Fecha y hora local del momento del registro.
- `<slug>`: 2 a 5 palabras del tema, minúsculas, sin acentos ni símbolos,
  separadas por guiones. Ej.: `2026-10-07-1530-guardar-prompt-informe.md`.
- Nunca sobreescribir un archivo existente: si el nombre ya existe, agrega `-2`, `-3`, etc.

## Contenido del archivo

Usa esta plantilla exacta:

```markdown
# <Título corto del tema>

- Fecha: <ISO local>
- App: <gateway | auth | commerce | delivery | packages | general>
- Autor del prompt: usuario

## Prompt

> <texto EXACTO del prompt del usuario, sin resumir ni corregir>

## Informe

- Resumen: <qué pidió el usuario, en 1 o 2 frases simples>
- Objetivo: <para qué lo pidió>
- Qué se hizo: <acciones o respuesta dada, breve>
- Puntos clave:
  - <punto 1>
  - <punto 2>
  - <punto 3>
- Siguiente paso: <próxima acción concreta, o "ninguno">
```

## Reglas del informe

- Máximo ~15 líneas en la sección **Informe**.
- Frases cortas y directas; explicar como si el lector no fuera técnico.
- Sin tecnicismos innecesarios; si usas un término técnico, explícalo en pocas palabras.
- No inventar datos: si algo no se sabe, escribir "no especificado".
- El **Prompt** se copia literal; el **Informe** es tu resumen.

## Pasos

1. Recupera el prompt exacto que el usuario pidió guardar.
2. Determina la app afectada usando la tabla de subcarpetas.
3. Redacta el informe siguiendo las reglas anteriores.
4. Crea `docs/prompts/<app>/` si no existe.
5. Escribe el archivo con la plantilla y el nombre indicados.
6. Responde al usuario con la ruta del archivo guardado, en una sola línea.

## Ejemplo

Archivo `docs/prompts/commerce/2026-10-07-1530-guardar-prompt-informe.md`:

```markdown
# Guardar prompt y generar informe

- Fecha: 2026-10-07T15:30:00-05:00
- App: commerce
- Autor del prompt: usuario

## Prompt

> Necesito que hagas un skill que guarde los prompts e interacciones con IA
> en este proyecto y genere un informe acotado y simple de entender.

## Informe

- Resumen: el usuario pidió un skill para guardar prompts y generar un informe simple.
- Objetivo: dejar registro ordenado de lo que se le pide a la IA en el proyecto.
- Qué se hizo: se creó el skill `save-prompts` con su plantilla de guardado.
- Puntos clave:
  - Cada interacción se guarda como un archivo en `docs/prompts/<app>/`.
  - El archivo incluye el prompt literal y un informe breve.
  - El lenguaje del informe debe ser simple.
- Siguiente paso: ninguno.
```
