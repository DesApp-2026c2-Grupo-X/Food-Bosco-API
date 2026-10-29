# Crear rama para reportes administrativos de clientes

- Fecha: 2026-10-29T15:04:05-03:00
- App: general
- Autor del prompt: usuario

## Prompt

> antes de ejecutar el siguiente prompt generame la rama correspondiente para dicho feauture : # Food-Bosco — Reportes administrativos sobre clientes
>
> ## Objetivo
>
> Implementar reportes orientados a clientes para los perfiles administrativos de Food-Bosco:
>
> - **Administrador general:** consulta y analiza información de clientes a nivel global de la plataforma.
> - **Administrador de sucursal:** consulta y analiza información de clientes vinculados a la actividad de su sucursal.
>
> La funcionalidad de reportes personales del cliente en `apps/store` ya existe y no forma parte de esta tarea. No modificarla, duplicarla ni reemplazarla.
>
> El objetivo es proporcionar herramientas de análisis que permitan a los administradores conocer la actividad de sus clientes, identificar patrones de compra y evaluar su recurrencia.
>
> ## 1. Inspección previa obligatoria
>
> Antes de implementar:
>
> 1. Leer `AGENTS.md`, `agents.md`, documentación del proyecto y skills relevantes.
> 2. Inspeccionar la estructura de `Food-Bosco-Frontend` y `Food-Bosco-API`.
> 3. Analizar las funcionalidades existentes de `apps/admin` y `apps/branch`.
> 4. Revisar los dashboards, reportes, tablas, filtros, gráficos y componentes reutilizables.
> 5. Identificar los modelos y relaciones reales entre clientes, pedidos y sucursales.
> 6. Revisar las queries GraphQL, resolvers, servicios y mecanismos de autorización existentes.
> 7. Identificar qué información ya está disponible y qué requiere nuevas operaciones o agregaciones.
>
> No asumir nombres de campos, relaciones, operaciones ni reglas de negocio sin verificarlos en el código.
>
> ## 2. Reportes para el administrador general
>
> Implementar una sección administrativa de reportes de clientes que permita analizar la actividad global.
>
> Evaluar e implementar, cuando los datos lo permitan, los siguientes indicadores:
>
> - Total de clientes registrados.
> - Clientes que realizaron compras durante un período.
> - Nuevos clientes registrados por período.
> - Clientes nuevos compradores frente a clientes recurrentes.
> - Evolución temporal de la cantidad de compradores.
> - Frecuencia de compra por cliente.
> - Distribución de clientes según cantidad de pedidos.
> - Tiempo transcurrido desde la última compra.
> - Distribución de la actividad de clientes por sucursal.
> - Comparación de indicadores entre sucursales, cuando corresponda.
>
> Incluir filtros por período y por sucursal cuando resulten relevantes y sean compatibles con el modelo de datos.
>
> Los indicadores globales deben contar clientes únicos. Un cliente que compra en varias sucursales no debe contabilizarse varias veces en el total global, aunque pueda formar parte de los reportes individuales de cada sucursal.
>
> ## 3. Reportes para el administrador de sucursal
>
> Implementar una experiencia equivalente, adaptada al alcance de una sucursal.
>
> Evaluar e implementar:
>
> - Cantidad de clientes compradores en el período.
> - Nuevos clientes de la sucursal.
> - Clientes recurrentes en la sucursal.
> - Evolución de compradores a lo largo del tiempo.
> - Frecuencia de pedidos por cliente.
> - Tiempo desde la última compra en la sucursal.
> - Distribución de clientes según su actividad.
> - Listado consultable de clientes con indicadores de actividad.
>
> Diferenciar entre un cliente nuevo en toda la plataforma y un cliente que realiza su primera compra en una sucursal determinada, siempre que los datos permitan establecer ambas situaciones.
>
> El administrador de sucursal solo puede consultar información correspondiente a la sucursal que tiene autorizada.
>
> ## 4. Definición de indicadores
>
> Antes de implementar los cálculos, establecer reglas explícitas para cada indicador.
>
> Por ejemplo:
>
> - **Cliente registrado:** usuario que cumple las condiciones existentes para considerarse cliente.
> - **Cliente comprador:** cliente que tiene al menos un pedido válido dentro del período seleccionado.
> - **Cliente recurrente:** cliente que cumple una definición documentada de compras repetidas.
> - **Nuevo cliente:** distinguir entre fecha de registro, primera compra en la plataforma y primera compra en una sucursal.
> - **Última compra:** fecha del último pedido que califique como compra efectiva según las reglas de negocio.
>
> No considerar automáticamente todos los pedidos como compras efectivas. Respetar los estados existentes y las reglas de cancelación, cobro y finalización del pedido.
>
> No crear métricas que no puedan calcularse correctamente con los datos reales.
>
> ## 5. Frontend
>
> Implementar los reportes exclusivamente en las aplicaciones administrativas existentes:
>
> - `apps/admin`.
> - `apps/branch`.
>
> Requisitos:
>
> - Integrar la funcionalidad en la navegación actual.
> - Reutilizar componentes y patrones visuales existentes.
> - Presentar indicadores mediante tarjetas, gráficos y tablas cuando corresponda.
> - Permitir filtrar por período.
> - Incorporar filtros por sucursal en el administrador general cuando sean útiles.
> - Permitir consultar y ordenar listados de clientes si el diseño y los datos lo justifican.
> - Gestionar carga, errores, ausencia de resultados y filtros sin coincidencias.
> - Mantener una interfaz responsive, accesible y coherente con Food-Bosco.
> - Respetar los tipos de TypeScript y las convenciones de consultas del proyecto.
>
> No agregar dependencias de visualización sin revisar primero las existentes.
>
> ## 6. Backend y GraphQL
>
> Inspeccionar y reutilizar las operaciones existentes antes de crear otras nuevas.
>
> Cuando sea necesario, implementar las modificaciones correspondientes respetando el flujo arquitectónico actual:
>
> Frontend → Gateway GraphQL → microservicio responsable → persistencia.
>
> Las agregaciones deben realizarse en la capa apropiada del backend, evitando descargar todos los pedidos al navegador para calcular métricas.
>
> Mantener los contratos GraphQL y los tipos sincronizados. Evitar duplicar la lógica de negocio, introducir consultas N+1 o modificar funcionalidades no relacionadas.
>
> ## 7. Seguridad
>
> La autorización debe garantizar:
>
> - El administrador general solo accede a los datos permitidos para su rol.
> - El administrador de sucursal solo accede a los datos correspondientes a su sucursal autorizada.
> - La sucursal no se determina confiando exclusivamente en parámetros enviados por el frontend.
> - Las consultas de clientes y pedidos aplican los filtros de autorización también en el backend.
> - Los listados no exponen información personal innecesaria.
>
> Agregar pruebas para los intentos de acceder a información de otra sucursal y para los usuarios sin permisos suficientes.
>
> ## 8. Pruebas
>
> Agregar o actualizar pruebas para:
>
> - Cálculo de indicadores con datos de varias sucursales.
> - Clientes que compran en múltiples sucursales.
> - Clientes sin pedidos.
> - Pedidos en distintos estados.
> - Filtros temporales.
> - Diferenciación entre clientes nuevos y recurrentes.
> - Totales globales sin duplicación.
> - Aislamiento de datos por sucursal.
> - Errores y estados vacíos de la interfaz.
>
> Ejecutar las pruebas, el chequeo de tipos, lint y build pertinentes. Informar únicamente resultados efectivamente verificados.
>
> ## 9. Metodología de implementación
>
> Trabajar en estas etapas:
>
> 1. Inspeccionar la arquitectura, las skills y las funcionalidades existentes.
> 2. Definir los indicadores viables y sus reglas de cálculo.
> 3. Identificar los archivos y servicios que requieren cambios.
> 4. Implementar los reportes de `admin` y `branch`.
> 5. Implementar las operaciones backend necesarias, si las existentes son insuficientes.
> 6. Validar cálculos, permisos, integración y pruebas.
>
> Si una decisión de negocio indispensable no puede deducirse del código, formular una pregunta concreta antes de asumirla.
>
> ## 10. Restricciones
>
> - No modificar los reportes personales existentes en `apps/store`.
> - No duplicar reportes que ya existen para el cliente.
> - No implementar reportes de ventas genéricos como sustituto de los reportes de clientes.
> - No utilizar datos ficticios ni mocks como sustitución de datos reales.
> - No crear modelos, endpoints u operaciones innecesarios.
> - No realizar refactorizaciones ajenas al alcance.
> - Respetar las skills, convenciones y arquitectura actuales.
>
> ## Criterio de aceptación
>
> El administrador general dispone de reportes globales sobre los clientes y su actividad, mientras que el administrador de sucursal dispone de reportes equivalentes limitados a su ámbito autorizado.
>
> Los indicadores se calculan con datos reales, tienen reglas de negocio definidas, se integran con la arquitectura existente y no modifican la funcionalidad de reportes personales de `apps/store`.

## Informe

- Resumen: se creó la rama y luego se implementaron los reportes de clientes para admin y sucursal.
- Objetivo: que cada administrador vea la actividad de sus clientes sin duplicar los reportes de la app store.
- Qué se hizo: rama `feature/reportes-admin-clientes`, backend en commerce/auth/gateway y pantallas nuevas en admin y branch.
- Reglas aplicadas:
  - Compra efectiva = pedido entregado. Cancelados y pedidos activos no cuentan.
  - Cliente comprador = cliente único con al menos una compra efectiva en el período.
  - Nuevo = su primera compra del alcance cae en el período; se distingue nuevo en la sucursal de nuevo en la plataforma.
  - Recurrente = dos o más compras efectivas en el período.
  - Total global sin duplicados; la distribución por sucursal puede repetir un cliente en cada sucursal.
- Seguridad: la sucursal del administrador de sucursal se toma del token y el backend la impone.
- Verificación: typecheck, lint, build y tests de API y frontend ejecutados correctamente.
- Siguiente paso: revisar los cambios y commitear cuando el usuario lo indique.
