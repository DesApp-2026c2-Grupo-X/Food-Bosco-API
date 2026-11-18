# Sistema integral de calificaciones de sucursales y repartidores

- Fecha: 2026-11-15T18:25:00-03:00
- App: general
- Autor del prompt: usuario

## Prompt

> buenas , antes de ejecutar el siguuiente prompt , necesito que me crees la rama feauture-calificaciones tanto en el repo backend como en el front end. luego de crear las ramas , ejecutar el prompt en las nuevas ramas del feature : # FEATURE: Sistema integral de calificaciones de sucursales y repartidores — Food-Bosco
>
> ## 1. CONTEXTO GENERAL
>
> Estás trabajando sobre Food-Bosco, una plataforma de pedidos para una cadena de comidas rápidas desarrollada como proyecto académico de Desarrollo de Aplicaciones (UNAHUR).
>
> Se solicita implementar una nueva funcionalidad integral de calificaciones que permita a los clientes evaluar tanto a la sucursal como al repartidor que participaron en la preparación y entrega de un pedido.
>
> La experiencia debe estar inspirada funcionalmente en aplicaciones como PedidosYa: una única pantalla posterior a la recepción del pedido, donde el cliente pueda calificar a los distintos actores involucrados.
>
> La implementación debe contemplar ambos repositorios:
>
> - Food-Bosco-API: backend, persistencia, reglas de negocio, validaciones y contratos GraphQL.
> - Food-Bosco-Frontend: interfaz de usuario, integración GraphQL, gestión de estados y experiencia del cliente.
>
> **IMPORTANTE:** No se busca construir una funcionalidad aislada o una demostración visual. Se requiere una implementación real, integrada con la arquitectura y los módulos existentes.
>
> ---
>
> ## 2. OBJETIVO FUNCIONAL
>
> Permitir que un cliente, una vez que recibe su pedido, pueda realizar dos calificaciones independientes:
>
> ### A. Calificación de sucursal
>
> El cliente evalúa la experiencia relacionada con la sucursal que preparó su pedido.
>
> Información:
>
> - Puntaje de 1 a 5 estrellas.
> - Comentario opcional.
> - Identificación de la sucursal.
> - Identificación del pedido.
>
> ### B. Calificación de repartidor
>
> El cliente evalúa la experiencia relacionada con el repartidor que realizó la entrega.
>
> Información:
>
> - Puntaje de 1 a 5 estrellas.
> - Comentario opcional.
> - Identificación del repartidor.
> - Identificación del pedido.
>
> Ambas evaluaciones deben realizarse desde una misma pantalla, pero conservar su independencia lógica y estadística.
>
> En pedidos que no utilizan delivery, no debe mostrarse la sección de calificación del repartidor.
>
> ### Criterio funcional recomendado
>
> - La calificación de la sucursal es obligatoria cuando se envía una reseña.
> - Para pedidos con delivery, se solicitan ambas calificaciones.
> - Los comentarios son opcionales e independientes.
> - Una reseña corresponde a un pedido.
> - No se permiten reseñas duplicadas.
> - Las calificaciones enviadas quedan definitivas inicialmente, salvo que la documentación existente establezca otra política.
>
> Antes de implementar, verificar que estas decisiones no contradigan requerimientos o decisiones documentadas previamente.
>
> ---
>
> ## 3. FASE 0 — INVESTIGACIÓN OBLIGATORIA
>
> Antes de modificar cualquier archivo, realizar un relevamiento completo de ambos repositorios.
>
> No asumir que la arquitectura actual coincide exactamente con documentos anteriores.
>
> ### 3.1 Documentación
>
> Buscar y leer:
>
> - README.md.
> - CLAUDE.md.
> - AGENTS.md.
> - Archivos de instrucciones de agentes.
> - Documentación técnica y funcional.
> - Informes integrales.
> - Historias de usuario.
> - Requerimientos funcionales y no funcionales.
> - Documentación de arquitectura.
> - Diagramas de entidades y relaciones.
> - Documentación de APIs y contratos GraphQL.
> - Skills disponibles en el proyecto.
> - Documentación de módulos relacionados con pedidos, sucursales y delivery.
> - Decisiones técnicas registradas.
>
> Utilizar los skills disponibles cuando correspondan y respetar sus instrucciones.
>
> No inventar skills ni reemplazar las instrucciones existentes por convenciones genéricas.
>
> ### 3.2 Backend
>
> Inspeccionar particularmente:
>
> - GraphQL Gateway.
> - Commerce Service.
> - Delivery Service.
> - Modelos y esquemas Mongoose.
> - Repositories.
> - Services.
> - Controllers.
> - DTOs.
> - Resolvers GraphQL.
> - Guards y mecanismos de autorización.
> - Middleware de autenticación.
> - Propagación de contexto mediante headers.
> - Comunicación REST entre servicios.
> - Orquestadores existentes.
> - Manejo de errores.
> - Índices de MongoDB.
> - Estrategia de testing.
>
> Identificar dónde se encuentran realmente los datos de:
>
> - Clientes.
> - Pedidos.
> - Sucursales.
> - Repartidores.
> - Viajes y asignaciones de delivery.
>
> Investigar cómo se relaciona un pedido con un repartidor, especialmente porque un viaje puede contener múltiples pedidos.
>
> ### 3.3 Frontend
>
> Inspeccionar:
>
> - apps/store.
> - apps/branch.
> - apps/admin.
> - apps/rider.
> - packages/api.
> - packages/domain.
> - packages/components.
> - packages/theme.
> - packages/auth.
>
> Identificar:
>
> - Cómo se consulta el historial de pedidos.
> - Cómo se visualiza el detalle de un pedido.
> - Cómo se representa el estado de entrega.
> - Cómo se determina que un pedido fue recibido.
> - Cómo se gestiona Apollo Client.
> - Cómo se organizan queries y mutations.
> - Cómo se gestionan formularios.
> - Qué componentes visuales reutilizables existen.
> - Cómo se muestran notificaciones y errores.
> - Cómo se manejan los estados de carga.
> - Qué convenciones de diseño establece Calor.
>
> ### 3.4 Informe de relevamiento
>
> Antes de implementar, generar un documento:
>
> `docs/feature-calificaciones/relevamiento.md`
>
> Debe incluir:
>
> 1. Arquitectura actual relevante.
> 2. Archivos y módulos involucrados.
> 3. Modelo actual de pedidos.
> 4. Relación entre pedidos, sucursales y repartidores.
> 5. Estado exacto que representa la entrega efectiva.
> 6. Ubicación recomendada de la nueva funcionalidad en cada servicio.
> 7. Contratos GraphQL que será necesario agregar.
> 8. Componentes frontend que pueden reutilizarse.
> 9. Restricciones y riesgos detectados.
> 10. Decisiones técnicas justificadas.
>
> No comenzar la implementación hasta completar este relevamiento.
>
> ---
>
> ## 4. FASE 1 — DISEÑO DEL MODELO DE DATOS
>
> Diseñar una entidad que represente la evaluación de un pedido.
>
> Nombre conceptual recomendado: `OrderReview`.
>
> Una posible estructura inicial:
>
> ```typescript
> interface OrderReview {
>   _id: ObjectId
>
>   orderId: ObjectId
>   customerId: ObjectId
>
>   branch: {
>     branchId: ObjectId
>     rating: number
>     comment?: string
>   }
>
>   courier?: {
>     courierId: ObjectId
>     rating: number
>     comment?: string
>   }
>
>   createdAt: Date
>   updatedAt: Date
> }
> ```
>
> Esta estructura es una referencia funcional, no una implementación obligatoria.
>
> El agente debe evaluar el diseño definitivo según los modelos existentes y la separación de responsabilidades de los microservicios.
>
> ### Reglas de persistencia
>
> - Una única reseña por pedido.
> - El cliente debe ser el propietario del pedido.
> - La sucursal debe obtenerse del pedido original.
> - El repartidor debe obtenerse de la asignación real de delivery.
> - No confiar en identificadores enviados libremente por el frontend.
> - El puntaje debe ser un entero entre 1 y 5.
> - Los comentarios deben tener límites de longitud y validación.
> - Crear índices adecuados para orderId, branchId y courierId.
> - Garantizar unicidad mediante un índice único sobre orderId, considerando las convenciones existentes.
> - Evitar duplicaciones y problemas de concurrencia.
> - Mantener timestamps.
> - Contemplar pedidos sin repartidor.
>
> ### Decisión arquitectónica
>
> No crear un microservicio nuevo exclusivamente para las calificaciones.
>
> Evaluar qué servicio debe ser responsable de la persistencia y las reglas de negocio.
>
> La solución debe respetar las siguientes condiciones:
>
> - Commerce es responsable del dominio comercial y de las sucursales.
> - Delivery es responsable del dominio de repartidores, viajes y asignaciones.
> - Gateway compone y expone contratos GraphQL.
> - Los servicios primarios no deben introducir llamadas directas entre sí.
> - Si se requiere coordinación entre dominios, utilizar el mecanismo de orquestación existente.
>
> Justificar dónde se guarda la reseña y cómo se garantiza que las relaciones entre pedido, sucursal y repartidor sean válidas sin introducir dependencias arquitectónicas indebidas.
>
> ---
>
> ## 5. FASE 2 — IMPLEMENTACIÓN BACKEND
>
> Repositorio: `Food-Bosco-API`.
>
> Implementar el flujo completo respetando la estructura actual del proyecto.
>
> ### 5.1 Persistencia
>
> Crear:
>
> - Schema Mongoose.
> - Modelos y tipos TypeScript.
> - DTOs.
> - Validaciones.
> - Repository.
> - Service.
> - Integración con los módulos existentes.
>
> No introducir una arquitectura alternativa si el proyecto ya tiene convenciones definidas.
>
> ### 5.2 Operaciones de negocio
>
> Implementar las operaciones necesarias para:
>
> **Crear calificación**
>
> - Recibir la evaluación de sucursal.
> - Recibir la evaluación de repartidor cuando corresponda.
> - Obtener el pedido desde el backend.
> - Verificar que pertenece al usuario autenticado.
> - Verificar que el pedido está efectivamente entregado.
> - Obtener sucursal y repartidor de las relaciones reales.
> - Validar los puntajes.
> - Guardar la reseña.
> - Evitar duplicaciones.
> - Devolver la información registrada.
>
> **Consultar calificación de un pedido**
>
> - Determinar si el pedido fue calificado.
> - Obtener la reseña del cliente autenticado.
> - Informar si todavía puede calificarse.
>
> **Consultar estado de calificación**
>
> - Identificar pedidos entregados pendientes de calificación.
> - Evitar ofrecer nuevamente el formulario cuando ya existe una reseña.
>
> ### 5.3 Estadísticas
>
> Preparar las operaciones de consulta necesarias para obtener:
>
> **Por sucursal:**
>
> - Promedio de estrellas.
> - Cantidad total de calificaciones.
> - Distribución de puntajes de 1 a 5.
> - Comentarios recibidos.
>
> **Por repartidor:**
>
> - Promedio de estrellas.
> - Cantidad total de calificaciones.
> - Distribución de puntajes de 1 a 5.
> - Comentarios recibidos.
>
> Las estadísticas deben calcularse de forma independiente.
>
> No mezclar las valoraciones de sucursales con las de repartidores.
>
> Evaluar agregaciones MongoDB e índices apropiados.
>
> Evitar realizar una consulta individual por cada registro cuando se pueden resolver estadísticas mediante agregaciones.
>
> ### 5.4 GraphQL Gateway
>
> Incorporar los contratos necesarios:
>
> - Tipos GraphQL.
> - Inputs.
> - Queries.
> - Mutations.
> - Resolvers.
> - Servicios de integración REST.
> - Manejo de errores.
>
> El Gateway debe actuar exclusivamente como punto de entrada, autenticación, traducción y composición.
>
> No implementar cálculos de promedios ni reglas de negocio en los resolvers.
>
> Los frontends deben continuar consumiendo exclusivamente el Gateway.
>
> Documentar los nuevos contratos y sus permisos.
>
> ### 5.5 Seguridad y autorización
>
> Contemplar los siguientes roles:
>
> - customer.
> - branch_admin.
> - super_admin.
> - rider.
>
> Reglas:
>
> **Customer**
>
> - Puede crear una reseña únicamente sobre sus propios pedidos.
> - Puede consultar sus propias reseñas.
> - No puede calificar pedidos de otros usuarios.
>
> **Branch Admin**
>
> - Puede consultar estadísticas y reseñas exclusivamente de su propia sucursal.
> - No puede modificar calificaciones.
>
> **Super Admin**
>
> - Puede consultar estadísticas y reseñas de todas las sucursales.
> - Puede consultar estadísticas generales de repartidores según los permisos definidos.
>
> **Rider**
>
> - No puede modificar ni eliminar las calificaciones recibidas.
> - No puede consultar información privada de otros repartidores.
>
> Los permisos deben validarse en backend. Nunca confiar exclusivamente en los guards o controles visuales del frontend.
>
> ### 5.6 Errores
>
> Contemplar al menos:
>
> - Pedido inexistente.
> - Pedido perteneciente a otro cliente.
> - Pedido todavía no entregado.
> - Pedido ya calificado.
> - Repartidor inexistente o no asociado al pedido.
> - Puntaje inválido.
> - Comentario demasiado extenso.
> - Usuario sin permisos.
> - Error de persistencia.
> - Error de comunicación entre servicios.
>
> Respetar el formato de errores existente en Food-Bosco.
>
> ---
>
> ## 6. FASE 3 — IMPLEMENTACIÓN FRONTEND
>
> Repositorio: `Food-Bosco-Frontend`.
>
> Aplicación principal: `apps/store`.
>
> La experiencia debe estar inspirada en PedidosYa, adaptada al sistema de diseño Calor.
>
> ### 6.1 Dónde aparece la funcionalidad
>
> Investigar el flujo existente y determinar los puntos de entrada más adecuados.
>
> La calificación debe estar disponible desde:
>
> - El detalle de un pedido entregado.
> - El historial de pedidos del cliente.
>
> No duplicar innecesariamente el formulario.
>
> Cuando un pedido sea elegible y no esté calificado, mostrar una acción clara:
>
> "Calificar pedido".
>
> Cuando ya esté calificado, mostrar:
>
> "Pedido calificado".
>
> No habilitar la calificación antes de que el backend confirme que el pedido fue entregado.
>
> ### 6.2 Pantalla de calificación
>
> Crear una pantalla o componente reutilizable.
>
> Título sugerido:
>
> "¿Cómo estuvo tu pedido?"
>
> Descripción:
>
> "Tu opinión nos ayuda a mejorar la experiencia de Food-Bosco."
>
> La pantalla debe incluir dos bloques visuales.
>
> **Bloque 1: Sucursal**
>
> - Nombre de la sucursal.
> - Identidad visual o imagen disponible.
> - Selector de 1 a 5 estrellas.
> - Comentario opcional.
> - Mensajes descriptivos asociados al puntaje.
>
> **Bloque 2: Repartidor**
>
> - Nombre o información disponible del repartidor.
> - Imagen o avatar si existe.
> - Selector de 1 a 5 estrellas.
> - Comentario opcional.
> - Mensajes descriptivos asociados al puntaje.
>
> El bloque del repartidor solo aparece cuando el pedido tuvo entrega mediante un repartidor.
>
> ### 6.3 Interacción
>
> Implementar:
>
> - Selección de estrellas mediante interacción táctil y mouse.
> - Estados seleccionados y no seleccionados.
> - Retroalimentación visual.
> - Comentarios independientes.
> - Validaciones de formulario.
> - Botón de envío.
> - Loading durante el envío.
> - Prevención de múltiples envíos.
> - Confirmación de operación exitosa.
> - Tratamiento de errores.
> - Accesibilidad y navegación por teclado.
>
> No mostrar información ficticia ni utilizar mocks en la integración final.
>
> Los datos deben provenir del backend.
>
> ### 6.4 Diseño y experiencia de usuario
>
> Requisitos:
>
> - Mobile-first.
> - Responsive.
> - Consistencia visual con Store.
> - Reutilizar componentes de Calor.
> - Mantener tipografías, colores, espaciados y radios existentes.
> - Evitar crear componentes duplicados.
> - Aprovechar iconografía ya instalada.
> - Mantener una interfaz sencilla e intuitiva.
> - No sobrecargar la pantalla con información innecesaria.
>
> La pantalla debe poder utilizarse cómodamente desde un teléfono celular.
>
> ### 6.5 Integración Apollo / GraphQL
>
> Implementar:
>
> - Queries.
> - Mutations.
> - Tipos TypeScript.
> - Hooks según convenciones del repositorio.
> - Manejo de cache.
> - Actualización del historial de pedidos después de calificar.
> - Invalidación o actualización de consultas relacionadas.
>
> No realizar llamadas REST directas desde el frontend.
>
> No utilizar SWR si el módulo correspondiente utiliza Apollo Client como estrategia establecida.
>
> ---
>
> ## 7. FASE 4 — INTEGRACIÓN DE ESTADÍSTICAS
>
> La calificación no debe limitarse al formulario del cliente.
>
> El objetivo es que la información recolectada pueda aprovecharse en Food-Bosco.
>
> Evaluar e implementar la visualización de las valoraciones en las aplicaciones administrativas cuando corresponda a la arquitectura y al alcance actual.
>
> ### Admin de sucursal
>
> Incorporar un apartado de calificaciones de la sucursal:
>
> - Promedio general.
> - Cantidad de opiniones.
> - Distribución de estrellas.
> - Comentarios.
> - Filtros por período.
>
> La información debe corresponder exclusivamente a la sucursal del administrador autenticado.
>
> ### Admin global
>
> Permitir consultar:
>
> - Promedio de cada sucursal.
> - Promedio general.
> - Cantidad de calificaciones.
> - Comparación entre sucursales.
> - Distribución de puntajes.
> - Calificaciones de repartidores.
> - Ranking de sucursales y repartidores, cuando exista información suficiente.
>
> ### Rider
>
> Evaluar la incorporación de una sección de reputación personal:
>
> - Promedio de estrellas.
> - Cantidad de calificaciones.
> - Distribución de puntajes.
>
> No exponer datos personales de los clientes que realizaron las evaluaciones.
>
> Si las pantallas administrativas requieren un alcance demasiado amplio, documentarlo y priorizar la implementación del flujo completo de calificación antes de agregar funcionalidades secundarias.
>
> ---
>
> ## 8. FASE 5 — TESTING
>
> Implementar pruebas siguiendo las herramientas y convenciones existentes.
>
> ### Backend
>
> Pruebas unitarias:
>
> - Validación de puntajes.
> - Validación de comentarios.
> - Validación de propietario del pedido.
> - Validación de estado entregado.
> - Validación de sucursal.
> - Validación de repartidor.
> - Prevención de duplicados.
> - Cálculo de promedios.
> - Distribución de estrellas.
> - Autorización por roles.
>
> Pruebas de integración:
>
> - Creación de reseña.
> - Persistencia en MongoDB.
> - Consulta de reseñas.
> - Consulta de estadísticas.
> - Índice único.
> - Concurrencia y doble envío.
> - Comunicación Gateway → servicio correspondiente.
>
> ### Frontend
>
> Pruebas:
>
> - Renderizado de pantalla.
> - Selección de estrellas.
> - Comentarios independientes.
> - Validaciones.
> - Pedido sin delivery.
> - Pedido todavía no entregado.
> - Pedido ya calificado.
> - Envío exitoso.
> - Error de backend.
> - Prevención de doble envío.
> - Estados de carga.
> - Actualización del historial.
>
> ### Escenarios E2E
>
> 1. Cliente realiza un pedido con delivery.
> 2. La sucursal prepara el pedido.
> 3. El repartidor retira el pedido.
> 4. El repartidor marca la entrega efectiva.
> 5. El cliente accede al pedido.
> 6. Se habilita la calificación.
> 7. El cliente califica sucursal y repartidor.
> 8. Se registra la reseña.
> 9. El pedido deja de aparecer como pendiente de calificación.
> 10. Se actualizan las estadísticas de ambos actores.
>
> Repetir el escenario para un pedido sin delivery.
>
> Verificar también los intentos de calificación no autorizados.
>
> No afirmar que una prueba pasó si no fue ejecutada.
>
> ---
>
> ## 9. FASE 6 — DOCUMENTACIÓN
>
> Actualizar la documentación existente.
>
> Crear:
>
> `docs/feature-calificaciones/`
>
> Archivos sugeridos:
>
> - `relevamiento.md`
> - `diseno-tecnico.md`
> - `modelo-datos.md`
> - `contratos-graphql.md`
> - `integracion-frontend.md`
> - `casos-de-prueba.md`
> - `informe-implementacion.md`
>
> Actualizar también:
>
> - README.md de los módulos afectados.
> - CLAUDE.md o AGENTS.md cuando corresponda.
> - Documentación general de arquitectura.
> - Historias de usuario.
> - Requerimientos funcionales.
> - Diagramas de arquitectura y entidades si existen.
>
> No duplicar documentación que ya esté correctamente centralizada.
>
> Incorporar una nueva historia de usuario para el cliente y criterios de aceptación.
>
> Documentar las decisiones técnicas tomadas, especialmente la distribución de responsabilidades entre Commerce, Delivery y Gateway.
>
> ---
>
> ## 10. RESTRICCIONES OBLIGATORIAS
>
> 1. No modificar funcionalidades existentes que no estén relacionadas con este feature.
> 2. No romper contratos GraphQL existentes.
> 3. No duplicar modelos ni servicios que ya resuelvan la misma responsabilidad.
> 4. No introducir mocks como solución definitiva.
> 5. No introducir dependencias innecesarias.
> 6. No alterar la arquitectura de microservicios.
> 7. No permitir acceso directo del frontend a MongoDB o REST.
> 8. No implementar reglas de negocio únicamente en frontend.
> 9. No modificar roles o permisos existentes sin justificación.
> 10. No eliminar funcionalidades ni documentación existente.
> 11. No realizar cambios destructivos en la base de datos.
> 12. No inventar datos de prueba en entornos reales.
> 13. No modificar archivos de configuración o secretos sin necesidad.
> 14. No realizar commits, pushes, merges ni cambios de rama sin autorización.
> 15. Mantener compatibilidad con el stack y versiones existentes.
>
> Si encontrás una contradicción entre la documentación y el código real, prevalece el comportamiento y la arquitectura efectivamente implementados, pero debés documentar la discrepancia.
>
> Si falta información indispensable, investigar primero. No inventar decisiones estructurales.
>
> ---
>
> ## 11. METODOLOGÍA DE EJECUCIÓN
>
> Trabajar por etapas:
>
> **ETAPA A — Relevamiento**
>
> - Leer documentación y skills.
> - Inspeccionar ambos repositorios.
> - Identificar dependencias.
> - Elaborar relevamiento técnico.
>
> **ETAPA B — Diseño**
>
> - Definir modelo.
> - Definir responsabilidades.
> - Definir contratos.
> - Documentar decisiones.
>
> **ETAPA C — Backend**
>
> - Implementar persistencia.
> - Implementar reglas de negocio.
> - Implementar seguridad.
> - Implementar GraphQL.
> - Ejecutar pruebas.
>
> **ETAPA D — Frontend**
>
> - Implementar pantalla.
> - Integrar GraphQL.
> - Integrar historial y detalle.
> - Implementar estados visuales.
> - Ejecutar pruebas.
>
> **ETAPA E — Estadísticas**
>
> - Incorporar consultas y visualizaciones administrativas según el alcance acordado.
>
> **ETAPA F — Validación**
>
> - Ejecutar tests.
> - Ejecutar builds.
> - Verificar integración.
> - Revisar regresiones.
> - Corregir errores.
>
> **ETAPA G — Documentación**
>
> - Actualizar informes.
> - Documentar contratos.
> - Documentar decisiones.
> - Generar informe final.
>
> No detenerse después de producir el relevamiento: el objetivo es completar la implementación integral. Si alguna etapa está bloqueada por una dependencia real, documentar el bloqueo y continuar con las tareas independientes.
>
> ---
>
> ## 12. CRITERIOS DE ACEPTACIÓN FINALES
>
> El feature se considerará terminado cuando:
>
> - [ ] El cliente puede calificar una sucursal después de recibir un pedido.
> - [ ] El cliente puede calificar al repartidor desde la misma pantalla.
> - [ ] Los pedidos sin delivery no muestran la evaluación del repartidor.
> - [ ] Los puntajes son independientes.
> - [ ] Los comentarios son independientes y opcionales.
> - [ ] No se puede calificar antes de la entrega efectiva.
> - [ ] No se puede calificar un pedido ajeno.
> - [ ] No se permiten reseñas duplicadas.
> - [ ] Las relaciones con sucursal y repartidor se validan desde backend.
> - [ ] Los datos persisten correctamente en MongoDB.
> - [ ] GraphQL expone los contratos necesarios.
> - [ ] Store utiliza exclusivamente el Gateway.
> - [ ] Se actualiza correctamente el estado de calificación en el historial.
> - [ ] Se pueden consultar promedios y estadísticas independientes.
> - [ ] Se respetan los permisos RBAC.
> - [ ] Se contemplan loading, error, vacío y éxito.
> - [ ] Se ejecutaron pruebas relevantes.
> - [ ] Los builds de los módulos afectados son exitosos.
> - [ ] Se actualizó la documentación técnica y funcional.
>
> ---
>
> ## 13. INFORME FINAL OBLIGATORIO
>
> Al finalizar, generar un informe que incluya:
>
> 1. Resumen ejecutivo.
> 2. Arquitectura implementada.
> 3. Archivos creados.
> 4. Archivos modificados.
> 5. Modelos y colecciones incorporados.
> 6. Operaciones GraphQL agregadas.
> 7. Endpoints REST internos incorporados.
> 8. Reglas de negocio implementadas.
> 9. Validaciones y permisos.
> 10. Componentes frontend desarrollados.
> 11. Estadísticas implementadas.
> 12. Pruebas ejecutadas y resultados.
> 13. Builds ejecutados y resultados.
> 14. Documentación actualizada.
> 15. Decisiones técnicas adoptadas.
> 16. Limitaciones o funcionalidades pendientes.
> 17. Instrucciones para ejecutar y probar el feature.
>
> Ubicación:
>
> `docs/feature-calificaciones/informe-implementacion.md`
>
> Distinguir claramente entre:
>
> - Implementado y probado.
> - Implementado pero no probado.
> - Pendiente.
> - Bloqueado.
>
> ## INSTRUCCIÓN FINAL
>
> Actuá como un desarrollador senior full-stack con experiencia en React, TypeScript, NestJS, GraphQL, Apollo Client, MongoDB, Mongoose y arquitectura de microservicios.
>
> Tu responsabilidad es entregar una funcionalidad completa, mantenible, segura y consistente con Food-Bosco.
>
> No te limites a agregar un formulario visual o una colección en MongoDB.
>
> Analizá el flujo completo desde que el repartidor confirma la entrega hasta que el cliente registra las calificaciones y estas quedan disponibles para su posterior consulta y análisis.
>
> Respetá las convenciones reales de ambos repositorios, aprovechá los componentes existentes y priorizá la reutilización.
>
> **El resultado esperado es un feature funcional de punta a punta, no solamente una propuesta técnica.**

## Informe

- Resumen: el usuario pidió crear la rama `feauture-calificaciones` en backend y frontend y luego implementar calificaciones de sucursal y repartidor de punta a punta.
- Objetivo: que el cliente pueda calificar un pedido entregado y que la información alimente estadísticas para sucursales, administradores y repartidores.
- Qué se hizo: se crearon las ramas, se relevó la arquitectura, se implementó el dominio de reseñas en Commerce, los contratos GraphQL del gateway, la pantalla de calificación en Store y las vistas de reputación en branch, admin y rider.
- Puntos clave:
  - Una reseña por pedido, con bloque de sucursal obligatorio y bloque de repartidor cuando hubo delivery.
  - El backend deriva sucursal, repartidor y cliente del pedido y del usuario autenticado.
  - Estadísticas separadas por sucursal y repartidor, con filtros por período y rankings.
  - Se ejecutaron tests de backend y frontend, builds y lint en ambos repositorios.
- Siguiente paso: validar el flujo E2E manual con los servicios y MongoDB levantados, según `docs/feature-calificaciones/casos-de-prueba.md`.
