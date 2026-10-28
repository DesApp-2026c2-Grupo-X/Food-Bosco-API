# Plan de seed con datos para reportes

- Fecha: 2026-10-27T20:15:11-03:00
- App: general
- Autor del prompt: usuario

## Prompt

> necesitamos hacer un seed que contenga mas datos para que en una demo se pueda lucir mas el apartado de reportes. pedidos con distintas fechas y precios, mas clientes que hagan varios pedidos. Etcetera. Idealmente el seed se debeeria poder correr muchas veces y que siempre genere datos aleatorios asi lo podemos correr la cantidad de veces que querramos segun necesitemos. primero generame un plan y despues lo ajustamos e implementamos. quiero que analices todo el proyecto, y en base al seed actual, decirme que nos conviene hacer para tener un mejor coverage en el seed. No toques codigo aun. solo genera el plan

## Informe

- Resumen: el usuario pidió un plan para ampliar el seed con muchos pedidos, fechas y clientes variados, de modo que los reportes se vean completos en una demo.
- Objetivo: poder correr el seed varias veces y que cada corrida agregue datos distintos y creíbles, sin romper lo que ya existe.
- Qué se hizo: se analizaron los reportes del sistema, el modelo de pedidos y el seed actual; se propuso un plan por fases y se listaron las decisiones a confirmar.
- Puntos clave:
  - Los reportes se calculan con la fecha de creación del pedido, que hoy el seed no puede controlar.
  - Se propone una bolsa fija de clientes demo y pedidos nuevos por cada corrida, con fechas, precios y estados variados.
  - Falta stock en cero y ventas repartidas para que los reportes de stock y de productos no salgan vacíos.
  - Se recomienda un identificador de lote para poder borrar sólo los datos de demo.
- Siguiente paso: ajustar las decisiones propuestas y empezar la fase 1.
