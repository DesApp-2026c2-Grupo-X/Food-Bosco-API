# Auditoría e implementación integral de validaciones, errores y mensajes

- Fecha: 2026-10-20T18:59:56-03:00
- App: general
- Autor del prompt: usuario

## Prompt

````markdown
# Tarea: Auditoría e implementación integral de validaciones rigurosas y mensajes claros en Food-Bosco

## 1. Objetivo general

Realizar una auditoría integral de los mecanismos de validación, manejo de errores y mensajes de respuesta de toda la aplicación Food-Bosco, tanto en el frontend como en el backend, incluyendo el Gateway GraphQL, los microservicios y las operaciones que interactúan con MongoDB.

El objetivo es garantizar que **toda interacción que requiera validar datos, estados, permisos, disponibilidad o reglas de negocio esté correctamente validada**, y que el usuario reciba mensajes claros, específicos, coherentes y accionables cuando una operación no pueda realizarse.

No limitar la tarea a corregir los casos conocidos. Identificar también validaciones ausentes, incompletas, duplicadas, inconsistentes o implementadas únicamente en el frontend.

## 2. Arquitectura y alcance

El proyecto está dividido en dos repositorios:

### Frontend: `Food-Bosco-Frontend`

Monorepo basado en React, TypeScript, Vite, Apollo Client y GraphQL, con las aplicaciones y paquetes compartidos existentes.

Auditar todas las aplicaciones funcionales, incluyendo:

- Store.
- Admin.
- Branch.
- Rider/Delivery, si se encuentra implementado en la versión actual.
- Paquetes compartidos de API, autenticación, componentes y dominio.

### Backend: `Food-Bosco-API`

Backend basado en NestJS, con Gateway GraphQL, microservicios y MongoDB/Mongoose.

Auditar, como mínimo:

- Gateway GraphQL (puerto 4000).
- Microservicio de autenticación (puerto 4201).
- Microservicio de comercio (puerto 4202).
- Microservicio de delivery (puerto 4203).
- Resolvers, controllers, services, DTO, esquemas, modelos, guards, interceptors, filtros de excepciones y validaciones existentes.

Estos puertos y componentes son referencias de la arquitectura conocida. Verificar la estructura real del repositorio antes de realizar modificaciones.

**Regla fundamental:** respetar la arquitectura actual, los contratos GraphQL, los patrones de comunicación entre servicios y las responsabilidades de cada aplicación. No introducir llamadas directas desde el navegador a los microservicios ni duplicar reglas de negocio en distintos lugares sin justificación.

## 3. Primera etapa: auditoría completa

Antes de modificar código, inspeccionar ambos repositorios y elaborar un inventario de todas las interacciones relevantes.

Para cada operación, determinar:

1. Qué datos recibe.
2. Qué campos son obligatorios y cuáles opcionales.
3. Qué formatos, tipos, rangos y restricciones deben cumplir.
4. Qué reglas de negocio se deben verificar.
5. Qué permisos y condiciones de autenticación requiere.
6. Qué información debe consultarse en la base de datos.
7. Qué errores puede producir cada capa.
8. Qué mensaje recibe actualmente el usuario.
9. Si el error se propaga correctamente desde el microservicio hasta el frontend.
10. Si existen validaciones exclusivamente visuales que pueden omitirse enviando una petición directa al backend.
11. Si hay operaciones concurrentes que puedan invalidar una comprobación previa.
12. Si se contemplan estados de carga, éxito, error, reintento y recuperación.

Identificar también mensajes genéricos, errores técnicos expuestos al usuario, excepciones absorbidas silenciosamente, respuestas ambiguas y operaciones que aparentan completarse aunque hayan fallado.

No asumir que una funcionalidad está correctamente validada porque ya exista una validación en algún archivo.

## 4. Validaciones y casos de uso que deben revisarse

Los siguientes ejemplos son requisitos mínimos. No constituyen una lista exhaustiva.

### A. Autenticación y cuentas

Revisar:

- Inicio de sesión.
- Registro y creación de usuarios.
- Validación de correo electrónico y campos obligatorios.
- Contraseñas incorrectas, contraseñas vacías y requisitos de seguridad.
- Cuentas inexistentes, deshabilitadas o en estados que impidan el acceso.
- Recuperación y restablecimiento de contraseñas.
- Tokens inválidos, vencidos o ya utilizados.
- Sesiones vencidas y acceso a rutas protegidas.
- Roles y permisos insuficientes.
- Cierre de sesión y renovación de credenciales, si corresponde.

Los errores de validación de campos deben identificar qué dato es incorrecto y cómo corregirlo.

**Seguridad:** no revelar si un correo está registrado cuando hacerlo permita enumerar cuentas. Para credenciales inválidas, utilizar un mensaje seguro, por ejemplo: «El correo electrónico o la contraseña son incorrectos». Para campos vacíos o con formato inválido, sí se deben indicar los errores concretos.

### B. Productos, catálogo y compras

Revisar:

- Existencia del producto.
- Productos activos, publicados y disponibles para la venta.
- Precio vigente y valores válidos.
- Stock disponible al agregar al carrito y al confirmar la compra.
- Cantidad solicitada mayor que cero.
- Cantidad solicitada superior al stock disponible.
- Productos eliminados, deshabilitados o modificados durante la compra.
- Carrito vacío, productos duplicados y cantidades inconsistentes.
- Cambios de precio entre la selección y la confirmación.
- Reglas de compra mínima o máxima, cuando existan.
- Disponibilidad de la sucursal seleccionada.
- Cálculo y consistencia de subtotales, descuentos, impuestos, envío y total.
- Aplicación de promociones y cupones, si existen.
- Confirmación de compra y creación de pedidos.

Ejemplos de mensajes esperados:

- «El producto ya no está disponible».
- «Solo quedan 3 unidades disponibles. Ajustá la cantidad para continuar».
- «El precio de uno de los productos cambió. Revisá el total antes de confirmar».
- «No se puede confirmar la compra porque el carrito está vacío».

Los valores económicos, los descuentos y las cantidades deben recalcularse y validarse en el backend. Nunca confiar en precios, totales o disponibilidad enviados por el cliente.

La comprobación de stock debe realizarse también al confirmar la compra y protegerse frente a compras simultáneas, utilizando las operaciones atómicas o transacciones que correspondan al modelo de datos existente. Evitar vender más unidades de las disponibles.

Si la operación involucra varias entidades, garantizar la consistencia del pedido, sus detalles y la actualización del inventario. No informar una compra exitosa si la operación no quedó confirmada correctamente.

### C. Pedidos y seguimiento

Revisar:

- Existencia del pedido.
- Usuario propietario o sucursal autorizada para consultarlo.
- Estados válidos del pedido.
- Transiciones permitidas entre estados.
- Cancelaciones, modificaciones y restricciones según el estado actual.
- Asignación y disponibilidad de repartidores, si corresponde.
- Datos de entrega y dirección.
- Operaciones repetidas o duplicadas.
- Errores al crear, actualizar o consultar pedidos.

No permitir transiciones de estado arbitrarias ni modificaciones por usuarios que carezcan de permisos.

### D. Administración global y gestión de sucursales

Revisar:

- Creación, modificación, consulta y eliminación de entidades.
- Campos obligatorios, formatos, longitudes y valores admitidos.
- Identificadores inexistentes o malformados.
- Registros duplicados y restricciones de unicidad.
- Relaciones entre sucursales, usuarios, productos y pedidos.
- Permisos de administración global frente a permisos limitados a una sucursal.
- Accesos cruzados a datos de otras sucursales.
- Estados activos, inactivos y eliminados.
- Operaciones masivas, si existen.
- Datos inconsistentes o referencias a entidades inexistentes.

Las operaciones deben validar tanto los datos como el alcance de los permisos. Un `branchId` recibido desde el frontend no constituye por sí solo autorización para acceder a esa sucursal.

### E. Delivery y repartidores

Si estas funcionalidades existen en el proyecto, revisar:

- Disponibilidad y asignación de repartidores.
- Existencia y estado de las entregas.
- Asignaciones duplicadas o incompatibles.
- Cambios de estado no permitidos.
- Permisos para aceptar, rechazar, retirar o entregar pedidos.
- Consistencia entre el estado del pedido y el de la entrega.
- Datos de entrega incompletos.
- Errores de ubicación o de comunicación con servicios externos, si corresponde.

### F. Formularios y demás interacciones

Revisar todos los formularios y operaciones restantes de la aplicación, incluyendo búsquedas, filtros, paginación, carga de archivos, configuración, perfiles y cualquier otra funcionalidad implementada.

Para cada campo, determinar si requiere:

- Validación de obligatoriedad.
- Tipo y formato.
- Longitud mínima y máxima.
- Rangos numéricos.
- Valores permitidos.
- Restricciones de unicidad.
- Validación de relaciones con otras entidades.
- Normalización de datos.
- Validación de archivos, extensiones, tamaño y contenido, cuando corresponda.

No agregar restricciones arbitrarias: derivarlas de los requisitos existentes, el modelo de datos y las reglas de negocio.

## 5. Validaciones por capa

Implementar las validaciones en la capa correspondiente, evitando depender exclusivamente de la interfaz.

### Frontend

- Validar campos antes de enviar formularios.
- Mostrar errores junto al campo correspondiente cuando sea posible.
- Deshabilitar acciones mientras se procesan solicitudes para evitar envíos accidentales duplicados.
- Mostrar estados de carga, éxito y error.
- Informar cuando una operación no pueda realizarse y explicar cómo continuar.
- Preservar los datos ingresados cuando una operación falle, siempre que sea apropiado.
- Manejar correctamente errores de red, timeouts, respuestas inesperadas y sesiones vencidas.
- Evitar mostrar errores técnicos directamente al usuario.
- Mantener consistencia entre Store, Admin, Branch y las demás aplicaciones existentes.
- No mostrar éxito cuando la API devuelva un error o cuando la operación no esté confirmada.

### Gateway GraphQL

- Validar entradas y respetar los contratos GraphQL.
- Propagar los errores de dominio de manera coherente.
- Diferenciar errores de autenticación, autorización, validación, reglas de negocio y fallas de infraestructura.
- Evitar transformar todos los errores en respuestas genéricas que oculten su causa.
- No exponer detalles internos de los microservicios.

### Microservicios y backend

- Validar los datos recibidos en cada operación.
- Utilizar los mecanismos de validación y excepciones propios de NestJS cuando corresponda.
- Verificar permisos, existencia de entidades y reglas de negocio.
- Validar nuevamente las condiciones críticas antes de persistir los cambios.
- Manejar restricciones de unicidad, concurrencia e integridad de datos.
- Evitar operaciones parciales inconsistentes.
- Mantener la consistencia entre los distintos servicios y la base de datos.

### Base de datos

- Revisar las restricciones y validaciones que ya ofrece MongoDB/Mongoose.
- Evaluar esquemas, tipos, campos obligatorios, índices únicos y referencias.
- No asumir que las validaciones de Mongoose se aplican automáticamente a todas las operaciones de actualización.
- Revisar las actualizaciones directas, operaciones masivas y escrituras que puedan eludir validaciones.
- Utilizar transacciones solamente cuando estén justificadas y sean compatibles con la infraestructura existente.

Las restricciones de base de datos deben complementar, no reemplazar, las validaciones de negocio del backend.

## 6. Sistema coherente de errores y mensajes

Analizar cómo se manejan actualmente las excepciones y las respuestas de cada servicio. A partir de esa auditoría, implementar o adaptar un criterio consistente para toda la aplicación.

Cuando sea viable, diferenciar las siguientes categorías:

- `VALIDATION_ERROR`: datos incompletos o inválidos.
- `AUTHENTICATION_ERROR`: falta de autenticación o credenciales inválidas.
- `AUTHORIZATION_ERROR`: permisos insuficientes.
- `NOT_FOUND`: recurso inexistente o no accesible.
- `BUSINESS_RULE_ERROR`: operación que incumple una regla de negocio.
- `CONFLICT`: conflicto de estado, duplicidad o modificación concurrente.
- `INSUFFICIENT_STOCK`: stock insuficiente.
- `NETWORK_ERROR`: problema de comunicación.
- `INTERNAL_ERROR`: fallo inesperado.

Estos códigos son una propuesta de referencia. Adaptarlos al estándar existente, evitando introducir formatos incompatibles con los clientes actuales.

Cada error debería tener, cuando corresponda:

- Código estable para identificarlo programáticamente.
- Mensaje legible para el usuario.
- Información de campo y detalles de validación, si aplica.
- Información técnica segura para diagnóstico interno.
- Un identificador de correlación para rastrear errores entre Gateway y microservicios, si la arquitectura lo permite.

Ejemplo conceptual de error de stock:

{
  "code": "INSUFFICIENT_STOCK",
  "message": "No hay stock suficiente para la cantidad solicitada.",
  "details": {
    "requestedQuantity": 5,
    "availableQuantity": 3
  }
}

El formato definitivo debe respetar los contratos reales del proyecto. No copiar este ejemplo literalmente si resulta incompatible con el esquema GraphQL actual.

Los mensajes deben ser concretos, breves y orientados a la acción. Evitar textos como «Algo salió mal», «Error al procesar», «Solicitud inválida» o «Error desconocido» cuando se conozca una causa específica.

Si la causa no puede determinarse con certeza, utilizar un mensaje genérico seguro y registrar el detalle técnico en los logs.

**No exponer:** contraseñas, tokens, secretos, credenciales, trazas internas, consultas sensibles ni detalles de infraestructura.

## 7. Manejo de errores distribuidos

Revisar específicamente qué sucede cuando un microservicio devuelve un error y el Gateway lo transmite al frontend.

Verificar que:

- Los errores de dominio se preserven y puedan interpretarse.
- Los errores conocidos no se conviertan indiscriminadamente en errores internos genéricos.
- Los fallos de comunicación se distingan de los errores de validación.
- Los errores de GraphQL se procesen correctamente en Apollo Client.
- Se manejen tanto los errores de ejecución de GraphQL como los errores de transporte.
- Las respuestas parciales de GraphQL se traten de acuerdo con la operación y el esquema.
- No se produzcan mensajes duplicados o contradictorios.
- Los logs permitan identificar en qué servicio se originó el problema.

## 8. Pruebas requeridas

Crear o ampliar las pruebas automatizadas siguiendo las herramientas y convenciones existentes en ambos repositorios.

Incluir, cuando corresponda:

- Casos válidos.
- Campos obligatorios ausentes.
- Formatos inválidos.
- Valores fuera de rango.
- Entidades inexistentes.
- Duplicados.
- Permisos insuficientes.
- Sesiones y tokens inválidos o vencidos.
- Reglas de negocio incumplidas.
- Stock insuficiente.
- Compras concurrentes.
- Cambios de precio o disponibilidad durante la compra.
- Fallas de comunicación entre servicios.
- Errores propagados por el Gateway.
- Mensajes y estados de error visibles en el frontend.
- Ausencia de filtraciones de información sensible.

Las pruebas deben comprobar tanto el resultado técnico como el comportamiento observable para el usuario.

No utilizar únicamente mocks para validar reglas críticas de persistencia o concurrencia: incorporar pruebas de integración apropiadas cuando la infraestructura disponible lo permita.

## 9. Criterios de aceptación

La tarea se considera completada cuando:

1. Se auditaron todas las aplicaciones y operaciones relevantes de ambos repositorios.
2. Se identificaron y documentaron las validaciones faltantes o insuficientes.
3. Las reglas críticas se verifican en el backend y no dependen únicamente del frontend.
4. Las operaciones que consultan o modifican la base de datos validan la existencia, integridad, permisos y estado de las entidades involucradas.
5. Los errores conocidos producen mensajes específicos y coherentes.
6. Los errores se propagan correctamente desde los microservicios hasta la interfaz.
7. Las operaciones críticas, especialmente compras e inventario, contemplan conflictos y concurrencia.
8. No se exponen detalles sensibles ni información técnica interna.
9. Las pantallas muestran correctamente los estados de carga, éxito y error.
10. Las pruebas nuevas y existentes relevantes pasan satisfactoriamente.
11. Los chequeos de tipos, lint y builds aplicables terminan sin errores atribuibles a los cambios.
12. No se rompe la compatibilidad con funcionalidades existentes ni se introducen cambios de arquitectura innecesarios.

## 10. Forma de trabajo y entregables

Trabajar en las siguientes fases:

**Fase 1 — Inspección y diagnóstico**

- Inspeccionar ambos repositorios.
- Identificar las operaciones y sus validaciones actuales.
- Documentar los problemas encontrados con referencias a archivos, funciones y servicios.
- Priorizar los problemas por impacto funcional, seguridad e integridad de datos.
- Presentar una matriz de auditoría con: funcionalidad, validación actual, problema, solución propuesta, capa afectada y prioridad.

**Fase 2 — Plan de implementación**

- Proponer los cambios necesarios y su orden de ejecución.
- Identificar contratos compartidos, dependencias y riesgos de compatibilidad.
- Reutilizar mecanismos existentes cuando sean adecuados.
- Evitar refactorizaciones amplias que no sean necesarias para resolver los problemas identificados.

**Fase 3 — Implementación**

- Corregir las validaciones faltantes.
- Unificar el manejo de errores donde corresponda.
- Mejorar los mensajes y estados visibles.
- Agregar las pruebas necesarias.
- Mantener separados los cambios de frontend y backend de forma que puedan revisarse y probarse correctamente.

**Fase 4 — Verificación y cierre**

- Ejecutar las pruebas relevantes.
- Ejecutar los chequeos de tipos, lint y builds disponibles.
- Documentar los casos corregidos y los que todavía presentan limitaciones.
- Informar los archivos modificados y los motivos de cada cambio.
- Detallar los resultados de las pruebas, los errores pendientes y cualquier dependencia externa que impida completar una validación.

No declarar una prueba exitosa si no se ejecutó realmente.

## 11. Restricciones

- No modificar funcionalidades ajenas al alcance sin justificación.
- No reemplazar datos reales por mocks ni introducir fallbacks silenciosos.
- No alterar contratos GraphQL de manera incompatible sin analizar y resolver sus dependencias.
- No duplicar lógica de negocio en el frontend como sustituto de las validaciones del backend.
- No confiar en datos, precios, permisos, roles o stock enviados por el cliente.
- No ocultar errores capturándolos y devolviendo respuestas exitosas ficticias.
- No realizar cambios destructivos en la base de datos ni eliminar datos reales.
- No modificar credenciales, variables de entorno sensibles ni configuraciones de infraestructura sin necesidad.
- No dar por terminada la tarea únicamente porque compile el proyecto.

## Resultado esperado

Una aplicación Food-Bosco en la que cada interacción valide correctamente los datos y las reglas de negocio, los errores se gestionen de manera consistente entre frontend, Gateway, microservicios y base de datos, y el usuario comprenda por qué una operación no pudo completarse y qué puede hacer para resolverlo.

La prioridad es **corrección funcional, integridad de datos, seguridad, claridad de los mensajes y coherencia en toda la aplicación**, sin comprometer la arquitectura existente.

## Uso obligatorio de skills y herramientas del agente

Antes de comenzar la auditoría y la implementación, inspeccionar las skills disponibles en el entorno del agente y determinar cuáles son relevantes para esta tarea.

### 1. Identificación y selección de skills

- Revisar las skills instaladas y disponibles para el agente, incluyendo las que puedan estar definidas en el proyecto o en las herramientas de desarrollo utilizadas.
- Identificar y utilizar las skills pertinentes para React, TypeScript, NestJS, GraphQL, MongoDB/Mongoose, validación de datos, seguridad, manejo de excepciones, testing y buenas prácticas de arquitectura, según las capacidades reales del entorno.
- Consultar las instrucciones y la documentación de cada skill relevante antes de realizar cambios que correspondan a su especialidad.
- Si existen skills específicas para auditoría de código, revisión de seguridad, diseño de APIs, testing o manejo de errores, priorizar su utilización cuando aporten valor a la tarea.

### 2. Aplicación de las skills durante el trabajo

No limitarse a enumerar las skills disponibles. Utilizar activamente sus procedimientos, convenciones, herramientas y recomendaciones durante las fases de auditoría, planificación, implementación y verificación.

Las skills deben ayudar a:

- Detectar validaciones faltantes y posibles vulnerabilidades.
- Identificar responsabilidades incorrectamente distribuidas entre frontend, Gateway, microservicios y base de datos.
- Diseñar mensajes y contratos de error coherentes.
- Implementar validaciones robustas y seguras.
- Crear pruebas unitarias, de integración y de extremo a extremo cuando corresponda.
- Verificar que las modificaciones respeten las convenciones y la arquitectura existentes.

### 3. Prioridad de las instrucciones y compatibilidad

- Respetar las instrucciones del proyecto, las convenciones existentes y los requisitos funcionales.
- Utilizar las skills como guías especializadas, sin aplicarlas mecánicamente cuando sus recomendaciones no sean compatibles con la arquitectura actual.
- No introducir tecnologías, dependencias o patrones nuevos únicamente porque una skill los recomiende, sin justificar su necesidad.
- Si varias skills son relevantes, combinarlas de forma coherente y evitar cambios redundantes o contradictorios.
- Si una skill no está disponible, no se puede consultar o no resulta aplicable, continuar con las herramientas y conocimientos disponibles, dejando constancia de esa limitación cuando sea relevante.

### 4. Informe de utilización

En el diagnóstico inicial, informar brevemente:

- Qué skills relevantes se encontraron.
- Cuáles se consultaron y utilizaron.
- Para qué parte de la tarea se aplicó cada una.
- Si alguna skill recomendó un enfoque que debió adaptarse a la arquitectura de Food-Bosco.

No afirmar que se utilizó una skill si no se consultó ni se aplicó realmente.

**Objetivo:** aprovechar las capacidades especializadas del agente para mejorar la calidad, seguridad, consistencia y mantenibilidad de las validaciones en toda la aplicación, sin perder de vista los requisitos del proyecto ni su arquitectura actual.
````

## Informe

- Resumen: el usuario pidió auditar y corregir validaciones, errores y mensajes en toda la plataforma, en backend y frontend.
- Objetivo: evitar datos inconsistentes, ventas sin stock, permisos indebidos y mensajes técnicos o ambiguos para el usuario.
- Qué se hizo: se auditaron ambos repositorios, se corrigieron concurrencia de stock, transiciones de pedidos y carrito, propagación de errores, DTOs, autenticación y mensajes; se agregaron tests y documentación.
- Puntos clave:
  - El stock y las transiciones ahora son atómicos y no permiten vender de más.
  - El Gateway ya no expone detalles internos y conserva códigos de dominio.
  - El frontend muestra mensajes específicos y accionables del backend.
  - Se documentaron limitaciones pendientes en `docs/auditoria-validaciones.md`.
- Siguiente paso: revisar la rama `feature/validation-errors-audit`, ejecutar la suite E2E completa de frontend en CI y definir si se abordan las limitaciones pendientes (propiedad de direcciones, numeración de pedidos y concurrencia de viajes).
