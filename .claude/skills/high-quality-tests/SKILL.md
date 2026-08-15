---
name: high-quality-tests
description: Escribir tests parametrizados y de alta calidad para el backend. Usar siempre que se agregue o modifique lógica de la API (servicios, orchestrators, controllers, repositorios). Cubre casos límite, tablas de casos de uso, aislamiento y criterios de calidad.
---

# Tests de alta calidad y parametrizados

Los tests de la API deben ser **parametrizados**, **determinísticos** y de **alta calidad**.
No se aceptan tests que solo cubran el camino feliz.

## Principios

1. **Parametrizados**: un solo caso de prueba define un set de entradas y su resultado
   esperado. Varios casos se ejecutan con la misma lógica (tabla de casos).
2. **Determinísticos**: mismo código de test → mismo resultado. Nada de fechas aleatorias,
   IDs dinámicos ni datos que dependan del entorno.
3. **Aislados**: cada test crea y limpia sus propios datos. No depender del orden de
   ejecución ni de datos compartidos.
4. **Fieles al requisito**: cada test referencia el RF/HU que valida.
5. **Rápidos**: sin red, sin base de datos real (repositorios mockeados o en memoria).

## Estructura de un test de alta calidad

```ts
describe("OrderStatusOrchestrator.changeStatus", () => {
  // Tabla de casos: cada fila es un escenario completo
  const cases: Array<{
    name: string;
    current: OrderStatus;
    target: OrderStatus;
    expected: "ok" | "error";
  }> = [
    { name: "pendiente → confirmado", current: "Pendiente", target: "Confirmado", expected: "ok" },
    { name: "pendiente → cancelado", current: "Pendiente", target: "Cancelado", expected: "ok" },
    { name: "confirmado → pendiente (retroceso)", current: "Confirmado", target: "Pendiente", expected: "error" },
    { name: "entregado → en camino", current: "Entregado", target: "En camino", expected: "error" },
    { name: "cancelado → confirmado", current: "Cancelado", target: "Confirmado", expected: "error" },
  ];

  it.each(cases)("$name → $expected", async ({ current, target, expected }) => {
    // el OrderService mockeado devuelve un pedido en el estado `current`
    const result = await orchestrator.changeStatus(orderId, target);
    if (expected === "ok") {
      expect(result).toBeDefined();
    } else {
      expect(result).rejects.toThrow();
    }
  });
});
```

## Qué se parametriza típicamente

- **Máquina de estados**: todas las transiciones válidas e inválidas (matriz completa).
- **Cálculos**: total del carrito, ETA, distancia, subtotales con configuraciones.
- **Validaciones**: DTOs, casos límite de rangos, formato, obligatoriedad.
- **Reglas de negocio**: sucursal no activa, cerrada, fuera de distancia máxima,
  dirección ajena al cliente, productos no disponibles.
- **Errores**: 404, 401, 403, 409, 400 con mensajes correctos.

## Criterios de calidad obligatorios

- [ ] **Cada test falla** si la lógica no cumple su contrato (no tests que siempre pasan).
- [ ] Mínimo 3 casos por regla de negocio (válido, límite, inválido).
- [ ] La **matriz de transiciones** de estados está completa (todas las combinaciones).
- [ ] Sin `only`, `skip` ni `todo` en el código final.
- [ ] Nombres descriptivos: `"agrega un ítem con cantidad inválida → lanza error"`.
- [ ] Los mocks respetan los contratos reales de los servicios/repositorios.
- [ ] Cobertura de **casos límite** (0, negativo, máximo, vacío, nulo).
- [ ] Los errores se verifican **por tipo y mensaje**, no solo por "tira algo".

## Mocks y aislamiento

- Mocks de repositorios con datos mínimos de cada escenario.
- No reutilizar el mismo mock entre tests con expectativas diferentes.
- Usar `beforeEach` para resetear el estado.
- Si el caso de uso es un orchestrator, mockear **todos** sus servicios primarios y
  verificar el **orden** de las llamadas cuando el orden importa.

## Contratos

- Unit tests: servicio u orchestrator aislado, repositorios mockeados.
- E2E: flujos completos (registro → login → carrito → pedido → estados) contra una
  base de datos de prueba aislada, no la de desarrollo.
- Controllers: testear la validación de DTOs y los códigos de respuesta.
