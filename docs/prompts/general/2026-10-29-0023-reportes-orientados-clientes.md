# Reportes orientados a clientes

- Fecha: 2026-10-29T00:23:26-03:00
- App: general
- Autor del prompt: usuario

## Prompt

> # Tarea: Reportes orientados a clientes — Food-Bosco
>
> ## 1. Objetivo principal
>
> Analizar, diseñar e implementar la funcionalidad **“Reportes orientados a clientes”** dentro de Food-Bosco, enfocada en brindar al cliente una visualización clara y útil de su propia actividad en la plataforma de pedidos.
>
> La solución debe integrarse con la arquitectura, los modelos de dominio, las funcionalidades y las convenciones existentes, manteniendo la separación de responsabilidades entre frontend, Gateway GraphQL y microservicios backend.
>
> No asumir que los reportes administrativos existentes cumplen este objetivo: esta funcionalidad debe estar orientada al usuario con rol de cliente y a sus necesidades.
>
> ## 2. Primera etapa obligatoria: inspección y análisis
>
> Antes de modificar cualquier archivo:
>
> 1. Inspeccionar las instrucciones generales del proyecto, `AGENTS.md`, `agents.md`, `README`, documentación técnica y cualquier archivo de contexto disponible.
> 2. Identificar las skills de los agentes disponibles y leer las que resulten relevantes para:
>    - Desarrollo frontend.
>    - Desarrollo backend.
>    - GraphQL y comunicación entre servicios.
>    - Seguridad, autenticación y autorización.
>    - Testing y validación.
> 3. Analizar la estructura real de ambos repositorios:
>    - `Food-Bosco-Frontend`.
>    - `Food-Bosco-API`.
> 4. Revisar la aplicación `apps/store`, sus páginas, rutas, componentes, layouts, navegación y funcionalidades relacionadas con la cuenta del cliente.
> 5. Investigar las funcionalidades existentes de pedidos, historial de compras, productos, sucursales y autenticación.
> 6. Examinar los modelos, esquemas, resolvers, servicios, repositorios y consultas existentes que permitan obtener información de los pedidos de un cliente.
> 7. Revisar los reportes existentes para los roles administrativos, identificando qué componentes, patrones y lógica pueden reutilizarse sin mezclar permisos ni responsabilidades.
> 8. Comprobar cómo se identifica al usuario autenticado y cómo se valida que los datos solicitados le pertenezcan.
>
> **Regla:** no inventar estructuras, endpoints, operaciones GraphQL, campos, roles, modelos ni funcionalidades que no estén respaldados por el código o por una necesidad confirmada.
>
> ## 3. Definición funcional de los reportes
>
> A partir del análisis anterior, determinar qué información útil puede ofrecerse al cliente utilizando los datos reales disponibles.
>
> Evaluar, cuando el modelo de datos lo permita, las siguientes posibilidades:
>
> - **Historial de pedidos:** cantidad de pedidos realizados, detalle, fecha, estado y acceso al pedido correspondiente.
> - **Resumen de compras:** cantidad de compras completadas y monto total asociado a ellas.
> - **Evolución temporal:** actividad de compras agrupada por períodos, si existen datos suficientes.
> - **Productos frecuentes:** productos que el cliente solicita con mayor frecuencia, considerando los datos históricos disponibles.
> - **Indicadores personales:** métricas sencillas que permitan al usuario comprender su actividad dentro de Food-Bosco.
>
> Estos puntos son posibilidades a evaluar, no requisitos que deban implementarse automáticamente. Determinar cuáles aportan valor, cuáles son viables con los datos existentes y cuáles requieren aclaraciones.
>
> Para cada indicador, definir:
> - Qué representa.
> - Qué datos necesita.
> - Cómo se calcula.
> - Qué estados de pedido incluye o excluye.
> - Qué período temporal utiliza.
> - Qué ocurre cuando no hay información.
> - Qué restricciones de acceso requiere.
>
> No presentar pedidos cancelados, pendientes o fallidos como compras completadas. No sumar importes de manera indiscriminada: respetar los estados, importes y reglas de negocio definidos por el proyecto.
>
> Si los datos disponibles no permiten calcular correctamente un indicador, documentar la limitación en lugar de generar resultados aproximados o ficticios.
>
> ## 4. Frontend
>
> Implementar la funcionalidad en `apps/store`, respetando la estructura actual de la aplicación.
>
> Requisitos:
>
> - Integrar el acceso a los reportes en la navegación y en la experiencia de usuario existente.
> - Reutilizar layouts, componentes compartidos, estilos, tokens de diseño y patrones de interacción.
> - Mantener consistencia visual con el resto de Food-Bosco y adaptar la experiencia a dispositivos móviles.
> - Utilizar los mecanismos existentes de autenticación y acceso a datos.
> - Incorporar gráficos solamente si aportan valor y son compatibles con las dependencias y convenciones actuales.
> - Mostrar correctamente los estados de carga, error, ausencia de datos y éxito.
> - Proporcionar textos claros para que un cliente sin conocimientos técnicos comprenda los indicadores.
> - Evitar duplicar lógica de negocio, consultas o componentes que ya existan.
> - Respetar los tipos de TypeScript y las interfaces públicas de los hooks y paquetes compartidos.
>
> Investigar primero si conviene ampliar funcionalidades existentes o crear componentes y hooks nuevos.
>
> No introducir dependencias adicionales sin justificar su necesidad y compatibilidad.
>
> ## 5. Integración con el backend
>
> Si los datos o las operaciones existentes no son suficientes, implementar las modificaciones necesarias en `Food-Bosco-API`.
>
> Respetar el flujo arquitectónico:
>
> Frontend → Gateway GraphQL → microservicio responsable → persistencia existente.
>
> Requisitos:
>
> - Reutilizar las operaciones, servicios y modelos existentes cuando corresponda.
> - Incorporar nuevas consultas o servicios solamente cuando estén justificados.
> - Calcular las métricas sobre datos reales y aplicar las reglas de negocio en la capa correspondiente.
> - Evitar trasladar grandes volúmenes de pedidos al frontend para calcular agregaciones que deban resolverse en el backend.
> - Evitar consultas N+1 y duplicación innecesaria de accesos a la base de datos.
> - Mantener los contratos GraphQL y los tipos sincronizados con el frontend.
> - Respetar las convenciones de errores, validación y logging existentes.
> - No modificar contratos utilizados por otras aplicaciones de manera incompatible.
>
> Si la información necesaria ya está disponible mediante operaciones existentes, reutilizarlas en lugar de crear alternativas equivalentes.
>
> ## 6. Seguridad y privacidad
>
> La información debe corresponder exclusivamente al cliente autenticado.
>
> - Validar la identidad del usuario en el backend.
> - Obtener el identificador del cliente desde el contexto de autenticación confiable, siguiendo los patrones existentes.
> - No confiar en un `userId` enviado libremente desde el frontend para determinar de quién son los datos.
> - Aplicar filtros de pertenencia a nivel de consulta o servicio.
> - Evitar exponer información de otros clientes, domicilios, pedidos o datos personales.
> - Respetar los guards, decoradores y mecanismos de autorización existentes.
> - No otorgar permisos administrativos a los clientes ni modificar los controles de acceso globales para facilitar la implementación.
>
> Agregar pruebas que intenten consultar información de otro cliente y verificar que el acceso sea rechazado o que los datos ajenos no puedan recuperarse, según el contrato de seguridad definido.
>
> ## 7. Pruebas y validación
>
> Agregar o actualizar las pruebas siguiendo las herramientas y convenciones existentes.
>
> Cubrir, como mínimo:
>
> - Cliente con historial de compras.
> - Cliente sin pedidos.
> - Pedidos con diferentes estados.
> - Cálculos de importes y cantidades.
> - Límites temporales de los reportes, cuando correspondan.
> - Usuario no autenticado.
> - Intentos de acceso a información de otro cliente.
> - Errores de consultas y servicios.
> - Estados de carga, error y ausencia de información en el frontend.
>
> Ejecutar las pruebas, verificaciones de tipos, lint y builds relevantes para los cambios realizados.
>
> No afirmar que una prueba pasó si no se ejecutó o si falló. Documentar cualquier limitación del entorno.
>
> ## 8. Restricciones de implementación
>
> - No reemplazar funcionalidades reales por mocks.
> - No utilizar datos ficticios en producción.
> - No agregar modelos o colecciones duplicados para resolver información que ya existe.
> - No refactorizar módulos ajenos al alcance sin justificación.
> - No modificar configuraciones globales sin necesidad.
> - No exponer credenciales ni secretos.
> - No introducir dependencias incompatibles con el monorepo.
> - Mantener compatibilidad con las aplicaciones Store, Admin, Branch y Delivery.
> - Respetar las skills e instrucciones de los agentes.
> - No asumir que una funcionalidad está terminada hasta haber validado su integración.
>
> ## 9. Forma de trabajo
>
> Trabajar por etapas:
>
> **Etapa A — Diagnóstico**
> - Leer las instrucciones y skills.
> - Inspeccionar frontend y backend.
> - Identificar datos, operaciones, componentes y permisos existentes.
> - Documentar los hallazgos relevantes.
>
> **Etapa B — Propuesta**
> - Definir el alcance funcional recomendado.
> - Especificar indicadores, reglas de cálculo y estados de pedido.
> - Identificar archivos que deben modificarse o crearse.
> - Describir los cambios necesarios en frontend, Gateway y microservicios.
> - Identificar riesgos, dependencias y pruebas necesarias.
>
> Si quedan decisiones de negocio indispensables sin resolver, formular preguntas concretas antes de implementar esas partes.
>
> **Etapa C — Implementación**
> - Desarrollar la solución siguiendo la propuesta.
> - Reutilizar la arquitectura existente.
> - Mantener los cambios acotados y coherentes.
> - Incorporar las pruebas correspondientes.
>
> **Etapa D — Validación**
> - Ejecutar las verificaciones disponibles.
> - Revisar seguridad, cálculos y aislamiento de datos.
> - Verificar la integración frontend-backend.
> - Corregir los errores introducidos por los cambios.
>
> ## 10. Entregable final
>
> Al terminar, presentar un informe breve que incluya:
>
> 1. Funcionalidades implementadas.
> 2. Indicadores y reglas de negocio aplicadas.
> 3. Archivos creados y modificados.
> 4. Operaciones GraphQL y servicios afectados.
> 5. Medidas de seguridad implementadas.
> 6. Pruebas ejecutadas y resultados reales.
> 7. Limitaciones o requisitos pendientes.
> 8. Decisiones relevantes tomadas durante la implementación.
>
> ## Criterio de aceptación
>
> La tarea se considera terminada cuando el cliente puede acceder a reportes útiles sobre su propia actividad, consultar información obtenida de datos reales, comprender los indicadores mostrados y utilizar la funcionalidad de manera segura, sin afectar los reportes administrativos ni las demás aplicaciones de Food-Bosco.  asegurate de tener en cuenta agents.md y las skills del proyecto , e inspecciona tanto foodbosco api como foodbosco frontend , una vez terminado arma un informe de los cambios y mejoras realizadas

## Informe

- Resumen: se pidió diseñar e implementar reportes de actividad para clientes en Store, con datos reales y acceso seguro.
- Objetivo: que cada cliente vea sus compras, gasto, evolución, productos y sucursal frecuente sin ver datos ajenos.
- Qué se hizo: se agregó un endpoint REST de commerce, una query GraphQL y la página “Mi actividad” en Store.
- Puntos clave:
  - Solo los pedidos entregados cuentan como compras y suman gasto.
  - El backend toma el cliente del token, nunca de un `userId` del frontend.
  - Se reutilizaron pedidos y reportes existentes, sin duplicar colecciones.
  - Se agregaron pruebas unitarias, de repositorio, E2E, gateway y frontend.
- Siguiente paso: revisar el informe final y decidir commit/PR.
