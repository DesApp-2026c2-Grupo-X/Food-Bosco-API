# Correcciones de personal, tipos GraphQL y baja lógica

- Fecha: 2026-10-28T12:45:00-03:00
- App: general
- Autor del prompt: usuario

## Prompt

> app Admin global:
>
> - no funciona el boton para habilitar/deshabilitar colaboradores desde la seccion Personal.
> - No hay opcion para eliminar colaboradores de sucursales.
> - No funciona la funcion para reasignar a otra sucursal a un colaborador dentro de la pestaña editar
> - Dentro de la pestaña personal no aparecen en la lista todos los colaboradores que fueron creados durante el seed. solo aparecen los que son creados manualmente.
>
> General:
>
> - Los menus de seleccion vienen preseleccionados con la opcion Todas/Todos. Una vez que cambiamos la opcion, no se puede volver a seleccionar Todas/Todos. Revisar todos los menus de seleccion.
> - A la hora de ajustar Stock, el campo permite ingresar numeros negativos con el signo "-". Para los numeros positivos hay que ingresar el numero sin signo, pero deberia Tambien permitir ingresar el signo "+", ya que actualmente si ingresamos por ejemplo +25, no reconoce el numero. [Image 1] [Image 2] [Image 3] [Image 4] [Image 5] quiero que respetes las skills de documentacion de cada repo. analizá los dos repos por completo antes de comenzar. Si tenes alguna pregunta hacela.

## Informe

- Resumen: el usuario reportó fallas de Personal en el Admin global que dependían del backend.
- Objetivo: que el toggle, la reasignación de sucursal y la baja de colaboradores funcionen de punta a punta.
- Qué se hizo: se corrigió el Gateway, se agregó la baja lógica en Auth y se actualizaron pruebas y documentación.
- Puntos clave:
  - Los argumentos `id` de usuarios y direcciones en GraphQL ahora son `ID`, igual que el contrato que usa el frontend.
  - Se agregó `deleteUser` en GraphQL y `DELETE /v1/users/{id}` en Auth, solo para colaboradores `branch_admin`.
  - La baja es lógica: guarda `deletedAt`, desactiva la cuenta, la oculta del listado y revoca sus sesiones.
  - El listado acepta el filtro `roles` para traer solo personal y evitar que los clientes demo lo desplacen.
- Siguiente paso: ninguno.
