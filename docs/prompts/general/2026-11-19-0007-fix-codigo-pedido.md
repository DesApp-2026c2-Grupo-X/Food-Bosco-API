# Fix del código corto de pedido en Cliente y Bike

- Fecha: 2026-11-19T00:07:27-03:00
- App: general
- Autor del prompt: usuario

## Prompt

> # PROMPT — FIX: Restauración del código corto de pedido en Food-Bosco
>
> ## 1. Contexto y objetivo
>
> Estamos trabajando sobre Food-Bosco, una aplicación de gestión de pedidos desarrollada como proyecto académico.
>
> Actualmente existe un bug en la identificación visual de los pedidos: tanto en la interfaz del cliente como en la interfaz del repartidor (Bike), el número o código de pedido se está mostrando como una cadena de caracteres excesivamente extensa.
>
> Originalmente, el sistema utilizaba un código de pedido corto, sencillo de recordar y práctico para identificar cada operación. Sin embargo, a medida que se fueron incorporando funcionalidades y modificaciones en el proyecto, este comportamiento se desconfiguró o dejó de funcionar correctamente.
>
> El objetivo de esta tarea es investigar, identificar y corregir exclusivamente este problema.
>
> **IMPORTANTE: No se busca rediseñar el sistema de pedidos, implementar nuevas funcionalidades ni refactorizar código. Se debe recuperar el comportamiento original del código de pedido, respetando íntegramente la arquitectura y las funcionalidades actuales.**
>
> ## 2. Primera etapa: lectura y comprensión obligatoria
>
> Antes de modificar cualquier archivo, realizar una lectura y análisis de la documentación existente.
>
> Revisar, cuando estén disponibles:
>
> - Todos los archivos `AGENTS.md` y `agents.md` aplicables al repositorio.
> - Documentación general del proyecto.
> - Archivos de contexto (`context.md`, `contexto.md` y equivalentes).
> - Documentación técnica y funcional.
> - Skills disponibles e instrucciones específicas de cada módulo.
> - Informes de implementaciones anteriores.
> - Documentación relacionada con pedidos, identificadores, clientes, repartidores y procesos de checkout.
> - Estructura y convenciones de ambos repositorios: frontend y backend.
>
> Identificar especialmente:
>
> - Arquitectura actual.
> - Flujo de creación de pedidos.
> - Contrato entre frontend y backend.
> - Modelo y persistencia de pedidos.
> - Mecanismo actual de generación del código.
> - Componentes que presentan el identificador al cliente y al repartidor.
>
> No asumir que la documentación está completamente actualizada. Contrastar las instrucciones y decisiones documentadas con el código real.
>
> ## 3. Segunda etapa: investigación del bug (NO MODIFICAR CÓDIGO)
>
> Realizar una investigación completa para encontrar el origen del problema.
>
> Seguir el recorrido del código de pedido de extremo a extremo.
>
> ### Backend
>
> Investigar:
>
> - Dónde se genera el identificador del pedido.
> - Qué servicio, controlador, resolver o función interviene.
> - Si se utiliza un UUID, ObjectId de MongoDB, identificador autoincremental u otro mecanismo.
> - Si existe una función específica para generar un código corto.
> - Si la lógica original fue reemplazada o modificada.
> - Si el código corto se genera correctamente, pero luego se reemplaza por otro identificador.
> - Si existen diferencias entre los distintos servicios del backend.
> - Qué campo se persiste en MongoDB.
> - Qué identificador se devuelve en las respuestas de la API y GraphQL.
>
> ### Frontend
>
> Investigar las interfaces de:
>
> 1. Cliente: visualización del pedido luego de realizar la compra y seguimiento del pedido.
> 2. Bike/repartidor: visualización del pedido recibido, asignado o en proceso de entrega.
>
> Verificar:
>
> - Qué propiedad utiliza cada componente para mostrar el número de pedido.
> - Si se está mostrando accidentalmente `_id`, `id`, `orderId` u otro identificador técnico.
> - Si existe una confusión entre el identificador interno de MongoDB y el código público del pedido.
> - Si el frontend está utilizando una propiedad diferente de la que devuelve el backend.
> - Si existen transformaciones, mapeos o normalizaciones que alteren el valor.
>
> ### Historial y regresiones
>
> Buscar referencias al código de pedido en:
>
> - Commits anteriores, si están disponibles.
> - Funciones de generación anteriores.
> - Documentación histórica.
> - Implementaciones de funcionalidades recientes relacionadas con checkout, pedidos, seguimiento y Bike.
>
> Determinar cuándo y por qué pudo haberse perdido el comportamiento original.
>
> **No modificar ningún archivo durante esta etapa.**
>
> ## 4. Tercera etapa: diagnóstico y determinación de la causa raíz
>
> Una vez localizado el problema, documentar:
>
> - Archivo y ubicación exacta donde se origina.
> - Función, servicio o componente involucrado.
> - Comportamiento esperado.
> - Comportamiento actual.
> - Causa técnica concreta.
> - Consecuencias en el cliente y en Bike.
> - Si el problema se origina en backend, frontend o en el contrato entre ambos.
>
> No realizar cambios basados únicamente en suposiciones.
>
> Si existen varias causas posibles, continuar investigando hasta identificar cuál produce efectivamente el comportamiento observado.
>
> ## 5. Cuarta etapa: implementación del FIX
>
> Una vez identificada y documentada la causa raíz, implementar la corrección mínima necesaria.
>
> ### Comportamiento esperado
>
> El pedido debe volver a tener un código corto, legible y fácil de recordar.
>
> El mismo código público debe mostrarse de manera consistente en:
>
> - Confirmación de compra del cliente.
> - Historial de pedidos del cliente.
> - Seguimiento del pedido.
> - Panel o interfaz de Bike.
> - Detalles del pedido en las interfaces donde corresponda.
>
> El código debe ser consistente durante todo el ciclo de vida del pedido.
>
> ### Consideraciones técnicas obligatorias
>
> - Preservar el identificador interno utilizado para las relaciones y operaciones de base de datos.
> - No reemplazar ni eliminar ObjectId, UUID o identificadores técnicos utilizados por el sistema.
> - Diferenciar claramente el identificador interno del código público del pedido.
> - No romper relaciones entre pedidos, clientes, sucursales, repartidores ni pagos.
> - No modificar contratos de API innecesariamente.
> - No modificar esquemas de MongoDB salvo que la causa raíz demuestre que es estrictamente necesario.
> - Si ya existe un campo destinado al código público, priorizar recuperar su utilización correcta antes de introducir otro.
> - Evitar códigos duplicados entre pedidos.
> - No alterar códigos de pedidos históricos sin una justificación técnica comprobada.
> - Mantener compatibilidad con los pedidos que ya existen.
> - No introducir dependencias nuevas.
> - No modificar permisos, autenticación, roles ni mecanismos de autorización.
>
> Si no se puede determinar con certeza cuál era el formato original, documentar esta situación y establecer una solución mínima compatible con la arquitectura existente, sin inventar requisitos funcionales.
>
> ## 6. Restricciones de alcance: NO TOCAR
>
> Esta tarea tiene un alcance exclusivamente correctivo.
>
> Está prohibido:
>
> - Refactorizar módulos completos.
> - Modificar la arquitectura.
> - Cambiar el flujo de checkout.
> - Alterar la lógica de creación de pedidos.
> - Modificar estados de pedidos.
> - Cambiar el sistema de asignación de repartidores.
> - Modificar el sistema de calificaciones.
> - Modificar reportes o estadísticas.
> - Alterar el sistema de pagos.
> - Cambiar la autenticación o autorización.
> - Modificar funcionalidades ajenas al identificador público.
> - Eliminar funcionalidades existentes.
> - Modificar estilos o interfaces que no sean necesarios para corregir la visualización del código.
> - Realizar limpiezas generales de código.
> - Cambiar nombres de variables, estructuras o modelos sin necesidad demostrable.
>
> **Regla fundamental: modificar únicamente los archivos y líneas estrictamente necesarios para solucionar este bug.**
>
> Si durante la investigación se detectan otros problemas, documentarlos como observaciones pendientes, pero no corregirlos en esta tarea.
>
> ## 7. Quinta etapa: pruebas y validación
>
> Después de implementar el fix, realizar pruebas para verificar:
>
> ### Generación
>
> - Se genera un código corto.
> - El código es único.
> - El código se mantiene asociado al pedido correcto.
> - No se generan identificadores ambiguos o difíciles de distinguir.
>
> ### Cliente
>
> - Al realizar una compra, se muestra el código corto.
> - El código aparece correctamente en el historial.
> - El seguimiento utiliza el mismo código.
> - No se producen errores en las consultas del pedido.
>
> ### Bike / repartidor
>
> - El repartidor visualiza el mismo código que el cliente.
> - El código permanece consistente durante los cambios de estado.
> - Las operaciones de asignación y actualización siguen funcionando.
>
> ### Integridad
>
> - Las consultas internas siguen utilizando los identificadores técnicos correspondientes.
> - Las relaciones de MongoDB permanecen intactas.
> - Los pedidos existentes siguen siendo consultables.
> - No se rompen los contratos entre GraphQL Gateway y los servicios REST.
>
> Ejecutar las pruebas automatizadas disponibles y agregar pruebas específicas únicamente si son necesarias para validar esta corrección.
>
> No modificar pruebas ajenas al problema.
>
> Si alguna prueba no puede ejecutarse por limitaciones del entorno, dejarlo expresamente documentado. No declarar como exitosas pruebas que no se ejecutaron.
>
> ## 8. Sexta etapa: informe técnico obligatorio
>
> Al finalizar, generar un documento Markdown en la carpeta de documentación del proyecto, respetando la estructura y nomenclatura existente.
>
> Nombre sugerido:
>
> `informe-fix-codigo-pedido.md`
>
> El informe debe contener:
>
> ### 1. Resumen
>
> Descripción breve del bug y de la corrección realizada.
>
> ### 2. Diagnóstico
>
> Explicación del comportamiento anterior y del comportamiento esperado.
>
> ### 3. Causa raíz
>
> Explicación técnica precisa de por qué se generaban o mostraban códigos extensos.
>
> ### 4. Recorrido del problema
>
> Descripción del flujo desde la generación del pedido hasta su visualización en Cliente y Bike.
>
> ### 5. Archivos modificados
>
> Incluir una tabla:
>
> | Archivo | Función o componente | Modificación realizada | Motivo |
> | ------- | -------------------- | ---------------------- | ------ |
>
> Indicar exactamente qué se modificó y por qué fue necesario.
>
> ### 6. Resolución
>
> Explicar cómo se solucionó el problema y qué mecanismo se utiliza ahora para generar y mostrar el código.
>
> ### 7. Compatibilidad
>
> Explicar cómo se preservaron los pedidos existentes, los identificadores internos y las relaciones de datos.
>
> ### 8. Pruebas realizadas
>
> Detallar pruebas ejecutadas, resultados y limitaciones.
>
> ### 9. Alcance e impacto
>
> Dejar constancia de qué funcionalidades permanecieron intactas y confirmar si hubo modificaciones fuera del alcance autorizado.
>
> ### 10. Pendientes
>
> Documentar cualquier observación detectada que no corresponda a este fix.
>
> ## 9. Criterios de aceptación
>
> El trabajo se considera terminado únicamente cuando:
>
> - Se identificó y explicó la causa raíz.
> - Se corrigió el código de pedido.
> - Cliente y Bike muestran el mismo código corto.
> - Se preservan los identificadores internos.
> - No se alteraron funcionalidades ajenas al problema.
> - Se ejecutaron y documentaron las pruebas posibles.
> - Se generó el informe técnico.
> - Se verificó el diff final para confirmar que no existan modificaciones innecesarias.
>
> ## 10. Instrucción final
>
> Trabajar con criterio de mantenimiento correctivo y mínimo impacto.
>
> No intentar mejorar el sistema más allá de lo solicitado.
>
> La prioridad es recuperar el comportamiento correcto que tenía originalmente Food-Bosco, sin comprometer ninguna de las funcionalidades desarrolladas posteriormente.
>
> **Antes de finalizar, revisar el diff completo y justificar cada archivo modificado. Si un cambio no es indispensable para corregir el código de pedido, no debe formar parte de este fix.** ### REQUISITO OBLIGATORIO: AUDITORÍA DE AMBOS REPOSITORIOS
>
> La investigación debe abarcar obligatoriamente los dos repositorios de Food-Bosco:
>
> 1. `Food-Bosco-API` (Backend).
> 2. `Food-Bosco-Frontend` (Frontend).
>
> No comenzar la implementación hasta haber analizado ambos repositorios y comprendido el flujo completo del identificador del pedido.
>
> En cada repositorio se deben revisar sus respectivos:
>
> - AGENTS.md / agents.md.
> - Archivos de contexto.
> - Documentación técnica y funcional.
> - Skills disponibles.
> - Informes de implementaciones anteriores.
> - Código relacionado con pedidos.
>
> El diagnóstico debe contemplar la comunicación entre ambos repositorios y determinar si la regresión se origina en la generación del código, su persistencia, su exposición mediante API/GraphQL o su consumo y visualización en el frontend.
>
> La corrección podrá requerir modificar uno o ambos repositorios, pero únicamente cuando exista una justificación técnica concreta.
>
> No duplicar lógica ni introducir modificaciones innecesarias en ninguno de ellos.

## Informe

- Resumen: se auditó el flujo del código de pedido en backend y frontend. Se corrigió la app del repartidor para que no muestre el identificador interno cuando falta el detalle del pedido.
- Objetivo: que cliente y repartidor vean el mismo código corto de pedido.
- Qué se hizo: se revisó el backend, la base de datos, el gateway y las cuatro apps. Se quitó el fallback al ObjectId en el detalle del viaje y se agregó una prueba.
- Puntos clave:
  - El backend ya genera un código de 6 dígitos y lo expone como `number`.
  - El cliente ya usaba `number` en checkout, historial y seguimiento.
  - El repartidor caía en `orderId` (ObjectId) mientras cargaba o fallaba la consulta.
  - Se preservaron los identificadores internos y el contrato GraphQL/REST.
- Siguiente paso: probar manualmente en navegador y APK con los servicios levantados.
