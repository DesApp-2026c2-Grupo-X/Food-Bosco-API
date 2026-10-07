# Análisis de Pull Requests y Mapeo a Trello

**Repositorios analizados**

- [Food-Bosco-API](https://github.com/DesApp-2026c2-Grupo-X/Food-Bosco-API) — 19 PRs
- [Food-Bosco-Frontend](https://github.com/DesApp-2026c2-Grupo-X/Food-Bosco-Frontend) — 35 PRs

**Tablero Trello:** [Desarrollo de Aplicaciones - Grupo 1 - 2026 C2](https://trello.com/b/vMzxnkzo/desarrollo-de-aplicaciones-grupo-1-2026-c2)

**Metodología (herramientas):** GitHub CLI (`gh`) para PRs y perfiles; Composio (toolkit Trello) para el tablero.

---

## 1. Mapeo Autor de GitHub ↔ Miembro de Trello

| Autor GitHub     | Nombre (GitHub / git)          | Miembro Trello           | Usuario Trello          | ID Trello                  | Estado                                                   |
| ---------------- | ------------------------------ | ------------------------ | ----------------------- | -------------------------- | -------------------------------------------------------- |
| `thomasbarenghi` | Thomas Barenghi                | Thomas Barenghi          | `thomasbarenghi`        | `643575db217dfcc016ca8431` | Confirmado (nombre y usuario idénticos)                  |
| `Mateo1223`      | Mateo Agustín Sanchez Sa       | MATEO AGUSTÍN SANCHEZ SA | `mateoagustinsanchezsa` | `6a7dffb53121be3af6cc6478` | Confirmado (nombre y correo `mateoasanchezsa@gmail.com`) |
| `Manuhead98`     | Juan Manuel Solis Diaz         | Juan Manuel Solis Diaz   | `juanmanuelsolisdiaz`   | `66718e8fbcda276439b208ce` | Confirmado (correo `manuhead98@gmail.com` en commits)    |
| `boscocesar`     | Bosco (`boscocesar@gmail.com`) | cesar gerace             | `cesargerace`           | `6a7f93ec680eb7e4f6afc2e3` | **Inferido** (ver Notas)                                 |

### Miembros del tablero sin actividad en los repos

Los siguientes miembros existen en el tablero pero **no son autores de ningún PR** en ninguno de los dos repositorios (no se les creó ningún ticket):

- Carlos Lombardi (`carloslombardi12`)
- Cristian Schiffino (`cristianschiffino3`)
- nicolas.delafuente (`nicolasdelafuente3`) — miembro _ghost_ (invitado sin confirmar)

### Autores de GitHub sin miembro de Trello

Ninguno: los 4 autores de PRs de GitHub pudieron asociarse a un miembro del tablero.

---

## 2. Actividades por autor

Cada fila mapea **Autor → PR → Actividad → Ticket de Trello**. Todos los tickets fueron asignados a su miembro correspondiente. Los PRs _MERGED_ y _CLOSED_ quedaron en la lista **`Done`**; los PRs _OPEN_ quedaron en **`In Progress`**.

### 2.1 Thomas Barenghi — `thomasbarenghi`

| PR  | Repo     | Actividad                                                     | Estado | Ticket (link)                            | Lista |
| --- | -------- | ------------------------------------------------------------- | ------ | ---------------------------------------- | ----- |
| #2  | API      | Migrar API a Turborepo con apps NestJS por dominio            | MERGED | [API #2](https://trello.com/c/ovSXrTkq)  | Done  |
| #4  | API      | API Gateway (GraphQL, seguridad y rate limiting)              | MERGED | [API #4](https://trello.com/c/AtRiSFmA)  | Done  |
| #7  | API      | Seed flow coordinado entre servicios                          | MERGED | [API #7](https://trello.com/c/SxZ1hpfy)  | Done  |
| #8  | API      | Rider assignment y disponibilidad por ubicación               | MERGED | [API #8](https://trello.com/c/kVdXZpi0)  | Done  |
| #11 | API      | Feature/gateway env config                                    | MERGED | [API #11](https://trello.com/c/Q9jm1LjD) | Done  |
| #12 | API      | Feature/gateway env config                                    | MERGED | [API #12](https://trello.com/c/4XwAQNhD) | Done  |
| #1  | Frontend | Update README.md                                              | MERGED | [FE #1](https://trello.com/c/skqEiEHd)   | Done  |
| #3  | Frontend | Reorganizar documentación del frontend                        | MERGED | [FE #3](https://trello.com/c/UUAoCZpn)   | Done  |
| #5  | Frontend | Reorganizar documentación del frontend (docs/CLAUDE/skills)   | MERGED | [FE #5](https://trello.com/c/HLdU4zFF)   | Done  |
| #6  | Frontend | App base de Autenticación (login, registro, recovery)         | MERGED | [FE #6](https://trello.com/c/Jq7N9bK5)   | Done  |
| #7  | Frontend | App base de Tienda (catálogo, carrito, checkout, direcciones) | MERGED | [FE #7](https://trello.com/c/xd7j0JND)   | Done  |
| #9  | Frontend | Paquetes compartidos (components, api, theme)                 | MERGED | [FE #9](https://trello.com/c/pVgNhbTn)   | Done  |
| #10 | Frontend | Cliente GraphQL y redirect por rol                            | MERGED | [FE #10](https://trello.com/c/mShzyvUh)  | Done  |
| #11 | Frontend | App iOS (Capacitor) con branding y barras nativas             | MERGED | [FE #11](https://trello.com/c/kDFuPmuh)  | Done  |
| #12 | Frontend | Conectar auth, perfil y direcciones al gateway                | MERGED | [FE #12](https://trello.com/c/1v0h9dyD)  | Done  |
| #14 | Frontend | Integrar flujos de Store con GraphQL                          | MERGED | [FE #14](https://trello.com/c/290sYlxK)  | Done  |
| #16 | Frontend | Integrar flujo del repartidor con GraphQL y ubicación         | MERGED | [FE #16](https://trello.com/c/3Nif5F4u)  | Done  |
| #20 | Frontend | Feature/update env                                            | MERGED | [FE #20](https://trello.com/c/29yFp2zm)  | Done  |
| #26 | Frontend | httpLink configurable via `VITE_API_URL`                      | MERGED | [FE #26](https://trello.com/c/exvuRRYT)  | Done  |
| #27 | Frontend | Eliminar código obsoleto en apps y paquetes                   | MERGED | [FE #27](https://trello.com/c/EpIyW46R)  | Done  |
| #28 | Frontend | Limpieza de componentes y refactor de AddressPickerModal      | MERGED | [FE #28](https://trello.com/c/77VzkL6Z)  | Done  |

**Subtotal: 21 PRs.**

### 2.2 Mateo Agustín Sanchez Sa — `Mateo1223`

| PR  | Repo     | Actividad                                                 | Estado | Ticket (link)                            | Lista |
| --- | -------- | --------------------------------------------------------- | ------ | ---------------------------------------- | ----- |
| #1  | API      | Inicializar scaffolding NestJS del backend                | MERGED | [API #1](https://trello.com/c/dpEl6x2L)  | Done  |
| #3  | API      | Auth Service y dominio auth del Gateway con tests         | MERGED | [API #3](https://trello.com/c/Wkk5IwQa)  | Done  |
| #17 | API      | Endpoint de sucursales cercanas (`nearby`)                | MERGED | [API #17](https://trello.com/c/pNMQdY8t) | Done  |
| #18 | API      | Feature/conflicts (cerrado sin merge)                     | CLOSED | [API #18](https://trello.com/c/q4N6Vd4Y) | Done  |
| #2  | Frontend | Inicializar monorepo frontend (store + admin) con tooling | MERGED | [FE #2](https://trello.com/c/6VOVSESc)   | Done  |
| #4  | Frontend | App Admin global (super_admin)                            | MERGED | [FE #4](https://trello.com/c/sL1949Yl)   | Done  |
| #8  | Frontend | App base del Repartidor (rider)                           | MERGED | [FE #8](https://trello.com/c/Wesm1icK)   | Done  |
| #13 | Frontend | App Admin de Sucursal (branch_admin)                      | MERGED | [FE #13](https://trello.com/c/9wVBahRr)  | Done  |
| #15 | Frontend | Conectar Admin global al API Gateway                      | MERGED | [FE #15](https://trello.com/c/SMPM8XP7)  | Done  |
| #33 | Frontend | Fix: nombre real de la sucursal en el header              | MERGED | [FE #33](https://trello.com/c/edvQdBXE)  | Done  |
| #34 | Frontend | Mostrar sucursales cerradas como "Cerrada"                | MERGED | [FE #34](https://trello.com/c/uAJtNV1Q)  | Done  |

**Subtotal: 11 PRs.**

### 2.3 Juan Manuel Solis Diaz — `Manuhead98`

| PR  | Repo     | Actividad                                                   | Estado   | Ticket (link)                            | Lista       |
| --- | -------- | ----------------------------------------------------------- | -------- | ---------------------------------------- | ----------- |
| #9  | API      | Seed-utils, zonas/turnos y horarios de sucursal             | MERGED   | [API #9](https://trello.com/c/3jRpmZyQ)  | Done        |
| #15 | API      | Recuperación de contraseña (email y URL según rol)          | MERGED   | [API #15](https://trello.com/c/G1P1nbGd) | Done        |
| #19 | API      | Reportes avanzados de ventas, pedidos y sucursales          | **OPEN** | [API #19](https://trello.com/c/qER2JUwC) | In Progress |
| #17 | Frontend | Conectar admin global al gateway (cerrado sin merge)        | CLOSED   | [FE #17](https://trello.com/c/erCO1sSt)  | Done        |
| #18 | Frontend | Conectar admin global al gateway (capa GraphQL de sucursal) | MERGED   | [FE #18](https://trello.com/c/b8FvA5lL)  | Done        |
| #31 | Frontend | Recuperación de contraseña con token por query              | MERGED   | [FE #31](https://trello.com/c/cGTn9gCt)  | Done        |
| #35 | Frontend | Panel de reportes avanzados para admin y branch             | **OPEN** | [FE #35](https://trello.com/c/zqa4IYar)  | In Progress |

**Subtotal: 7 PRs.**

### 2.4 Bosco (Cesar Gerace) — `boscocesar`

> ⚠️ La asociación de `boscocesar` con el miembro Trello **cesar gerace** es **inferida** (ver sección de Notas).

| PR  | Repo     | Actividad                                             | Estado | Ticket (link)                            | Lista |
| --- | -------- | ----------------------------------------------------- | ------ | ---------------------------------------- | ----- |
| #5  | API      | Delivery Service (rider, ofertas y viajes)            | MERGED | [API #5](https://trello.com/c/9JLdO8hj)  | Done  |
| #6  | API      | Commerce Service + dominio GraphQL commerce           | MERGED | [API #6](https://trello.com/c/vzfIXkRS)  | Done  |
| #10 | API      | Release 0.0.1                                         | MERGED | [API #10](https://trello.com/c/OcKz4HfO) | Done  |
| #13 | API      | Imagen de producto a Cloudinary via gateway           | MERGED | [API #13](https://trello.com/c/EG7F4qn3) | Done  |
| #14 | API      | Suite exhaustiva de tests unitarios e integración     | MERGED | [API #14](https://trello.com/c/zSDNwLdf) | Done  |
| #16 | API      | Release/0.0.2                                         | MERGED | [API #16](https://trello.com/c/HwYRPw1Q) | Done  |
| #19 | Frontend | release 0.0.1 (cerrado sin merge)                     | CLOSED | [FE #19](https://trello.com/c/KGplZXWn)  | Done  |
| #21 | Frontend | Release/0.0.1                                         | MERGED | [FE #21](https://trello.com/c/3DU6nf33)  | Done  |
| #22 | Frontend | chore: update package-lock.json (cerrado sin merge)   | CLOSED | [FE #22](https://trello.com/c/EKW5Rp5d)  | Done  |
| #23 | Frontend | Feature/update package lock                           | MERGED | [FE #23](https://trello.com/c/0PdyZXne)  | Done  |
| #24 | Frontend | Develop (cerrado sin merge)                           | CLOSED | [FE #24](https://trello.com/c/KnoRNwDv)  | Done  |
| #25 | Frontend | Release 0.0.2                                         | MERGED | [FE #25](https://trello.com/c/Ub4ZtAno)  | Done  |
| #29 | Frontend | Subir imagen de producto a Cloudinary desde el admin  | MERGED | [FE #29](https://trello.com/c/E72FjtVB)  | Done  |
| #30 | Frontend | Suite de tests funcionales/de comportamiento (Vitest) | MERGED | [FE #30](https://trello.com/c/CzVpbj0p)  | Done  |
| #32 | Frontend | Release/0.0.2                                         | MERGED | [FE #32](https://trello.com/c/vZrM6UEj)  | Done  |

**Subtotal: 15 PRs.**

---

## 3. Resumen cuantitativo

| Autor          | PRs API | PRs Frontend | Total PRs | Tickets creados |
| -------------- | :-----: | :----------: | :-------: | :-------------: |
| thomasbarenghi |    6    |      15      |    21     |       21        |
| Mateo1223      |    4    |      7       |    11     |       11        |
| Manuhead98     |    3    |      4       |     7     |        7        |
| boscocesar     |    6    |      9       |    15     |       15        |
| **Total**      | **19**  |    **35**    |  **54**   |     **54**      |

**Distribución por estado de PR:** 50 MERGED, 4 CLOSED (sin merge), 2 OPEN (sin revisar/mergear aún) — de 56 PRs totales, 54 corresponden a autores mapeados. _(Los 2 PRs OPEN se contabilizan dentro de los 54 y se ubicaron en `In Progress`.)_

---

## 4. Estado final del tablero Trello

Se **archivaron las 7 listas antiguas** (con sus tarjetas) y se crearon únicamente las tres listas solicitadas:

| Lista           | Tarjetas                                              |
| --------------- | ----------------------------------------------------- |
| **To Do**       | 0                                                     |
| **In Progress** | 2 → `[API #19]` (Manuhead98), `[FE #35]` (Manuhead98) |
| **Done**        | 52                                                    |

- **Listas eliminadas (archivadas):** `Espacios de Trabajo`, `Semana 1`, `Semana 2`, `Semana 3`, `Semana 4`, `Para despues - a ordenar`, `Terminado en el sprint 1`.
- **Listas activas:** `To Do`, `In Progress`, `Done`.
- **Total de tickets creados:** 54 (uno por PR), todos asignados a su miembro correspondiente.

---

## 5. Notas y limitaciones

1. **Asociación `boscocesar` → `cesar gerace` (inferida).** El autor de GitHub `boscocesar` figura con el nombre _"Bosco"_ y correo `boscocesar@gmail.com`. No existe en el tablero ningún miembro llamado "Bosco"; el único candidato por nombre es **cesar gerace** (`cesargerace`), coincidente con el sufijo "cesar" del handle. La asociación **no puede confirmarse al 100 %** (los apellidos "Bosco" y "Gerace" no coinciden) y queda sujeta a validación del equipo.
2. **`Mateo1223`** se asoció por nombre y correo (`Mateo Agustín Sanchez Sa`, `mateoasanchezsa@gmail.com`) idénticos a los registrados en git y en el tablero.
3. **`thomasbarenghi`** coincide exactamente en nombre y usuario de Trello.
4. **`Manuhead98`** se asoció a `juanmanuelsolisdiaz` por el correo de los commits (`manuhead98@gmail.com`) y el nombre "Juan Manuel (Manu)".
5. **PRs CLOSED sin merge** (`API #18`, `FE #17`, `FE #19`, `FE #22`, `FE #24`) representan ramas descartadas/duplicadas; se registraron en **`Done`** por tratarse de actividad ya concluida, y se marcaron como _CLOSED_ en la descripción del ticket.
6. **PRs OPEN** (`API #19`, `FE #35`) son los únicos aún no mergeados: se ubicaron en **`In Progress`**.
7. **Miembros sin actividad de PR** (Carlos Lombardi, Cristian Schiffino, nicolas.delafuente) no recibieron tickets para no inventar actividades.
8. Los datos se obtuvieron con `gh` (GitHub CLI) y Composio (Trello). El tool de miembros de tablero de Composio falló por un bug (`unexpected keyword argument 'metadata'`); los miembros se obtuvieron vía `TRELLO_GET_BOARDS_BY_ID_BOARD` con `members=all`.
