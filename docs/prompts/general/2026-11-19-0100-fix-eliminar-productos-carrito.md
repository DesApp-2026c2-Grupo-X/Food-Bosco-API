# Fix: eliminar productos del carrito

- Fecha: 2026-11-19T01:00:00-03:00
- App: general
- Autor del prompt: usuario

## Prompt

> # PROMPT — FIX: Incorporar opción para quitar productos del carrito de compras (Food-Bosco)
>
> ## 1. Contexto y objetivo
>
> Estamos trabajando sobre Food-Bosco, una aplicación de gestión de pedidos desarrollada como proyecto académico.
>
> Actualmente, el carrito de compras permite agregar productos y gestionar el pedido, pero presenta una limitación funcional: **no existe una opción para quitar o eliminar un producto que ya fue agregado al carrito.**
>
> El objetivo de esta tarea es incorporar exclusivamente la funcionalidad que permita al usuario eliminar productos individuales del carrito de compras.
>
> La funcionalidad debe integrarse con el comportamiento y la arquitectura existentes, respetando las convenciones actuales del proyecto.
>
> **IMPORTANTE: Esta tarea consiste únicamente en agregar la opción de quitar productos del carrito. No se debe modificar, refactorizar ni alterar ninguna otra funcionalidad existente.**
>
> ---
>
> ## 2. Primera etapa: revisión obligatoria de documentación y contexto
>
> Antes de modificar cualquier archivo, realizar una lectura y análisis de la documentación existente en ambos repositorios:
>
> 1. `Food-Bosco-API` (Backend).
> 2. `Food-Bosco-Frontend` (Frontend).
>
> Revisar obligatoriamente:
>
> - Todos los archivos `AGENTS.md` y `agents.md` aplicables.
> - Archivos de contexto (`context.md`, `contexto.md` y equivalentes).
> - Documentación general y técnica del proyecto.
> - Skills disponibles y sus instrucciones.
> - Documentación de arquitectura.
> - Informes de funcionalidades anteriores.
> - Documentación relacionada con carrito, productos, pedidos y checkout.
> - Convenciones de desarrollo y estructura de carpetas.
> - Contratos de comunicación entre frontend y backend.
>
> Es importante comprender cómo está implementado actualmente el carrito antes de proponer cualquier modificación.
>
> No asumir que la documentación está completamente actualizada. Contrastar las instrucciones con el código real.
>
> ---
>
> ## 3. Segunda etapa: gestión de Git y creación de rama
>
> Antes de comenzar la investigación técnica:
>
> 1. Revisar el estado actual de Git en ambos repositorios.
> 2. Identificar la rama actual.
> 3. Verificar si existen cambios locales pendientes, modificaciones sin commit o archivos sin seguimiento.
> 4. Preservar todos los cambios preexistentes.
> 5. Identificar la rama de desarrollo correspondiente (`develop` o la que se utilice actualmente).
> 6. Crear una rama independiente para este nuevo fix.
>
> Nombre de rama:
>
> `fix/eliminar-productos-carrito`
>
> Crear la rama en ambos repositorios únicamente si se necesitan modificaciones en ambos.
>
> ### Restricciones de Git
>
> - No trabajar directamente sobre `main`, `master` o `develop`.
> - No sobrescribir cambios existentes.
> - No descartar archivos ni modificaciones preexistentes.
> - No realizar operaciones destructivas.
> - No realizar merge.
> - No hacer push sin autorización explícita.
> - No mezclar este fix con el fix anterior del código de pedido.
> - No crear commits sin autorización explícita.
>
> Al finalizar, informar las ramas utilizadas y el estado final de ambos repositorios.
>
> ---
>
> ## 4. Tercera etapa: investigación del funcionamiento actual del carrito
>
> Antes de implementar, investigar cómo funciona actualmente el carrito de compras.
>
> ### Frontend
>
> Identificar:
>
> - Componente o página donde se visualiza el carrito.
> - Componente que representa cada producto agregado.
> - Estado global o local utilizado para almacenar los productos.
> - Context, Store, Provider, hooks o mecanismos utilizados para administrar el carrito.
> - Cómo se agregan productos.
> - Cómo se actualizan las cantidades.
> - Cómo se calculan los subtotales y el total.
> - Cómo se persiste el carrito, si corresponde.
> - Cómo se sincroniza el carrito con el backend.
> - Cómo se comporta el carrito cuando queda vacío.
>
> Identificar el lugar más adecuado para incorporar una acción de eliminación individual.
>
> ### Backend
>
> Investigar:
>
> - Si el carrito se almacena en el backend o exclusivamente en el frontend.
> - Si existe un servicio o endpoint para modificar el carrito.
> - Si existe alguna operación para eliminar un producto.
> - Cómo se persisten los productos asociados al carrito.
> - Qué validaciones se realizan.
> - Cómo se sincronizan los cambios con el checkout.
>
> No agregar endpoints ni modificar servicios si la arquitectura actual no los necesita.
>
> ### Diagnóstico
>
> Antes de implementar, determinar:
>
> - Cómo se representa actualmente un producto dentro del carrito.
> - Cómo identificar inequívocamente el producto que se desea eliminar.
> - Qué mecanismo debe utilizarse para mantener sincronizado el estado.
> - Qué lógica existente puede reutilizarse para actualizar los totales.
>
> No modificar código durante esta etapa.
>
> ---
>
> ## 5. Cuarta etapa: implementación de la funcionalidad
>
> Una vez comprendida la implementación actual, incorporar la opción para quitar productos individuales del carrito.
>
> ### Comportamiento esperado
>
> Cada producto agregado al carrito debe contar con una acción visible y accesible que permita eliminarlo individualmente.
>
> Al ejecutar dicha acción:
>
> 1. Se debe eliminar exclusivamente el producto seleccionado.
> 2. Los demás productos deben permanecer en el carrito.
> 3. Se debe actualizar inmediatamente la visualización del carrito.
> 4. Se debe recalcular correctamente el subtotal y el total.
> 5. Se debe actualizar la cantidad total de productos, si existe un contador.
> 6. Se debe mantener la sincronización con el mecanismo de persistencia actual.
> 7. La modificación debe reflejarse correctamente al navegar por la aplicación.
>
> ### Carrito vacío
>
> Si el usuario elimina el último producto:
>
> - El carrito debe quedar vacío.
> - El contador debe reflejar cero productos.
> - Los totales deben quedar correctamente en cero.
> - Debe mostrarse el estado vacío que corresponda según las convenciones visuales actuales del proyecto.
> - No debe producirse ningún error al intentar acceder al checkout con un carrito vacío.
>
> ### Integración visual
>
> La nueva opción debe:
>
> - Respetar el diseño actual de Food-Bosco.
> - Mantener los componentes y estilos existentes.
> - Seguir las convenciones visuales utilizadas en el resto de la aplicación.
> - Ser fácilmente identificable por el usuario.
> - Tener un comportamiento consistente en las distintas resoluciones soportadas.
>
> No rediseñar el carrito ni modificar su estructura visual general.
>
> ### Consideraciones técnicas
>
> - Reutilizar la lógica existente de gestión del carrito.
> - Mantener el mecanismo actual de almacenamiento y sincronización.
> - Evitar duplicar lógica de actualización de cantidades y totales.
> - Identificar correctamente el producto seleccionado.
> - Evitar eliminar accidentalmente otros productos.
> - Evitar inconsistencias entre el estado visual y el estado persistido.
> - Mantener la compatibilidad con el checkout existente.
> - No introducir dependencias nuevas.
> - No modificar modelos, esquemas o contratos de API salvo que sea estrictamente necesario y esté justificado por la arquitectura actual.
>
> ---
>
> ## 6. Quinta etapa: restricciones de alcance
>
> Esta tarea tiene un alcance estrictamente limitado.
>
> **ÚNICAMENTE se debe agregar la funcionalidad para quitar productos individuales del carrito.**
>
> Está prohibido:
>
> - Modificar el flujo de checkout.
> - Cambiar el proceso de creación de pedidos.
> - Modificar el sistema de pagos.
> - Modificar el cálculo de precios existente, salvo la actualización necesaria como consecuencia de eliminar un producto.
> - Modificar el sistema de stock.
> - Alterar la gestión de sucursales.
> - Modificar el sistema de repartidores.
> - Modificar las calificaciones.
> - Alterar los reportes.
> - Modificar autenticación o autorización.
> - Cambiar permisos o roles.
> - Refactorizar componentes ajenos al carrito.
> - Cambiar modelos o estructuras de datos sin necesidad demostrable.
> - Modificar funcionalidades de administración.
> - Cambiar estilos globales.
> - Realizar limpiezas generales de código.
> - Incorporar mejoras adicionales no solicitadas.
>
> Si durante la investigación se encuentran otros problemas, documentarlos como observaciones pendientes, pero no corregirlos.
>
> **Regla fundamental: cada modificación debe estar directamente relacionada con la incorporación de la opción de eliminar productos del carrito.**
>
> ---
>
> ## 7. Sexta etapa: pruebas y validación
>
> Una vez implementada la funcionalidad, realizar las siguientes pruebas:
>
> | Caso                                                 | Resultado esperado                                                                  |
> | ---------------------------------------------------- | ----------------------------------------------------------------------------------- |
> | Carrito con un producto                              | Permite eliminarlo correctamente                                                    |
> | Carrito con varios productos                         | Elimina únicamente el seleccionado                                                  |
> | Eliminar el último producto                          | El carrito queda vacío                                                              |
> | Eliminar un producto con cantidad mayor a uno        | Se elimina el producto completo, no solamente una unidad                            |
> | Productos con diferentes precios                     | Los totales se recalculan correctamente                                             |
> | Productos con variantes o identificadores diferentes | Se elimina únicamente el producto seleccionado                                      |
> | Actualización del carrito                            | Los cambios se reflejan inmediatamente                                              |
> | Persistencia                                         | El producto eliminado no reaparece al recargar o navegar, según el mecanismo actual |
> | Checkout                                             | Continúa funcionando correctamente con productos restantes                          |
> | Carrito vacío                                        | No permite continuar con una compra inválida                                        |
>
> También verificar:
>
> - Que agregar productos siga funcionando.
> - Que modificar cantidades siga funcionando.
> - Que el contador del carrito siga funcionando.
> - Que los precios y subtotales no sufran alteraciones.
> - Que no se produzcan errores en consola.
> - Que no se rompan consultas ni operaciones del backend.
>
> Ejecutar las pruebas automatizadas disponibles.
>
> No declarar como exitosas pruebas que no se hayan ejecutado.
>
> ---
>
> ## 8. Séptima etapa: informe técnico obligatorio
>
> Generar un documento Markdown en la carpeta de documentación correspondiente, respetando la estructura y nomenclatura existente.
>
> Nombre sugerido:
>
> `informe-fix-eliminar-productos-carrito.md`
>
> El informe debe incluir:
>
> ### 1. Resumen
>
> Descripción de la funcionalidad incorporada.
>
> ### 2. Diagnóstico inicial
>
> Explicación de cómo funcionaba el carrito antes del cambio y qué limitación presentaba.
>
> ### 3. Arquitectura identificada
>
> Explicar brevemente cómo se administraba el estado y la persistencia del carrito.
>
> ### 4. Implementación
>
> Describir cómo se incorporó la opción de eliminación y qué lógica existente se reutilizó.
>
> ### 5. Archivos modificados
>
> | Repositorio | Archivo | Función o componente | Modificación | Justificación |
> | ----------- | ------- | -------------------- | ------------ | ------------- |
>
> Incluir todos los archivos modificados, sin omitir ninguno.
>
> ### 6. Funcionamiento final
>
> Explicar el comportamiento de la nueva opción desde la interacción del usuario hasta la actualización del carrito.
>
> ### 7. Pruebas realizadas
>
> Detallar casos probados, resultados y limitaciones.
>
> ### 8. Compatibilidad
>
> Explicar cómo se preservaron las funcionalidades anteriores del carrito y del checkout.
>
> ### 9. Control de alcance
>
> Confirmar que no se modificaron funcionalidades ajenas al objetivo.
>
> ### 10. Git
>
> Informar:
>
> - Rama creada en cada repositorio.
> - Rama base.
> - Estado final de Git.
> - Archivos modificados.
> - Commits realizados, si existieran.
>
> ### 11. Pendientes
>
> Documentar observaciones que hayan quedado fuera del alcance.
>
> ---
>
> ## 9. Criterios de aceptación
>
> El fix se considera terminado únicamente cuando:
>
> - El usuario puede eliminar individualmente cualquier producto del carrito.
> - Los demás productos permanecen intactos.
> - Los totales y contadores se actualizan correctamente.
> - El comportamiento funciona con el mecanismo de persistencia actual.
> - El carrito vacío se representa correctamente.
> - El checkout continúa funcionando.
> - No se alteraron otras funcionalidades.
> - Se ejecutaron y documentaron las pruebas posibles.
> - Se generó el informe técnico.
> - Se verificó el diff completo.
> - Todos los cambios están aislados en la rama correspondiente.
>
> ---
>
> ## 10. Instrucción final
>
> Trabajar con criterio de mantenimiento correctivo y mínimo impacto.
>
> La prioridad es incorporar una funcionalidad puntual sin comprometer todo el trabajo desarrollado previamente en Food-Bosco.
>
> No aprovechar esta tarea para realizar mejoras adicionales.
>
> Antes de finalizar, revisar cada archivo modificado y justificar por qué fue necesario.
>
> **Si un cambio no es indispensable para permitir quitar productos del carrito, no debe formar parte de este fix.**
>
> No realizar merge ni push. Entregar la implementación en su rama independiente, junto con el informe técnico y el resultado de las pruebas.

## Informe

- Resumen: el usuario pidió agregar la opción de quitar productos del carrito y dejar un informe técnico.
- Objetivo: habilitar la eliminación individual de ítems sin romper el resto de la aplicación.
- Qué se hizo: se revisaron ambos repositorios y se verificó que la función ya existe completa.
- Puntos clave:
  - El frontend ya muestra el botón Eliminar en cada línea del carrito.
  - El backend ya tiene la mutación y el endpoint para eliminar el ítem.
  - El total se recalcula en el servidor y la interfaz se refresca.
  - Los tests del carrito y del backend pasaron.
  - No se modificó código fuente porque el pedido ya estaba resuelto.
- Siguiente paso: validar manualmente la app con backend y base de datos levantados.
