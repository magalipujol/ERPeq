# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Una persona con dislexia que opera el negocio (una dietética) desde el celular, casi siempre con una mano y
mientras hace otra cosa: habla con un cliente, está en el depósito o arriba del auto. Es la usuaria principal y,
en la práctica, la única: usa la compu solo de vez en cuando, para análisis, precios o recetas.

Sus trabajos más frecuentes, que tienen que ser los más rápidos:

1. **Cargar un pedido nuevo**: cliente e ítems, a menudo mientras el cliente le dicta.
2. **Consultar el stock**: cuánto hay de un producto, en qué depósito y qué falta.

Lo demás (entregar, cobrar, fletes, compras, recetas, precios, contactos, productos, caja, análisis) se usa menos y
puede quedar a uno o dos toques más.

## Product Purpose

ERPeq gestiona stock, pedidos, ventas, compras, fletes, recetas y caja de una dietética, sobre una planilla de
Google Sheets que sigue siendo la base de datos. Éxito: cargar un pedido o saber cuánto hay de algo sin leer de más,
sin equivocarse de fila y sin tener que abrir la planilla.

## Operating Context

- App web instalable (manifiesto, sin service worker) publicada en GitHub Pages; se abre desde el ícono del celular.
- Login con la cuenta de Google; lee y escribe la planilla directo desde el navegador. Cada operación se guarda
  entera o no se guarda.
- Celular de referencia de las pruebas: Samsung Galaxy A53 (360 × 800 px a DPR 3).
- Los pedidos se comparten por WhatsApp (botón *Exportar a WhatsApp*).

## Capabilities and Constraints

- Pantallas: Inicio (pedido nuevo, mapa, pedidos pendientes, fletes en curso), Stock, Pedidos, Ventas, Compras,
  Recetas, Fletes, Precios, Contactos, Productos, Caja y Análisis. Cada fila de tabla abre su ficha.
- React 19 + TypeScript + Mantine; sin servidor. Arquitectura hexagonal: la UI no conoce hojas ni columnas.
- La UI nunca muestra IDs; un pedido, venta o flete se nombra por cliente y fecha ("Ana · 10/10/26").
- Lo cargado se corrige desde la app; las operaciones que mueven stock o plata piden confirmación.
- Todo en español (código, UI, documentación).

## Evidence on Hand

- `spec/legibilidad.md`: pautas de legibilidad vigentes (BDA y WCAG).
- `diseño/experimental/`: una propuesta de rediseño para celular. Es una idea entre otras, no un compromiso.
- No hay datos reales para mostrar fuera de la app: las planillas con clientes son privadas. Specs, pruebas y
  diseños usan datos inventados.

## Product Principles

1. **El celular manda.** Cada pantalla se diseña primero para 360 px y una mano; la compu es una adaptación.
2. **Usable antes que lindo.** Una decisión visual se justifica por cuánto lee, busca o toca la usuaria, no por cómo
   se ve.
3. **Leer lo menos posible.** Reconocer antes que leer: posición fija, íconos con palabra, cifras grandes, una idea
   por renglón.
4. **Lo frecuente, a un toque.** Pedido nuevo y stock están siempre a mano; lo raro puede esconderse.
5. **Equivocarse es barato.** Confirmar lo que mueve stock o plata y dejar corregir todo lo demás.

## Accessibility & Inclusion

La usuaria principal tiene dislexia. Se siguen la guía de estilo de la British Dyslexia Association y WCAG 2.2 AA
(contraste, objetivos táctiles de 44 px o más). Detalle en `spec/legibilidad.md`.
