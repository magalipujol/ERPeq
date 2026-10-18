# Pantalla Stock

El stock se calcula por producto y depósito a partir de los movimientos (`calcularStock` en
`src/dominio/modelo.ts`; la fórmula está en `spec/modelo-de-datos.md`). La pantalla lo muestra en dos tablas:
una por depósito y otra con el total de cada producto contra su mínimo.

## Stock por depósito

Un grupo por depósito, con su nombre y su localidad ("General · Bahía Blanca"). Dentro,
una fila por producto que tenga algo en ese depósito: stock distinto de cero, algo en camino hacia ahí o
pedidos por entregar desde ahí. Los productos sin nada en el depósito no aparecen en su grupo.

| Columna | Qué es |
|---|---|
| En depósito | El stock en el depósito. En rojo si es negativo. |
| En camino | Lo que viaja hacia este depósito en fletes en camino. |
| Comprometido | Lo pendiente de los pedidos abiertos que se entregan desde este depósito. En amarillo si falta: comprometido − en depósito − en camino > 0 (`faltante`). |

El selector *Mostrar depósito* deja un solo grupo; el ícono de un depósito en el mapa de Inicio abre Stock con
ese depósito elegido. El buscador y el filtro (*Con stock*, *Stock negativo*, *Faltan para pedidos*) se aplican
a las filas de cada grupo, y ordenar por una columna ordena dentro de cada grupo.

## Stock total

Una fila por producto, con todos los depósitos juntos:

| Columna | Qué es |
|---|---|
| En depósitos | La suma del stock de todos los depósitos. |
| En camino | Lo que viaja en fletes en camino, a cualquier depósito. |
| Total | En depósitos + En camino. |
| Mínimo | La columna `minimo` de *Productos*: uno por producto, para el total. Vacío o 0 es "sin mínimo" (–). |
| Estado | Compara el Total con el Mínimo (ver abajo). Ordenar por estado pone primero lo más urgente. |

| Condición (en este orden) | Estado |
|---|---|
| Total < 0 | Negativo |
| Total < Mínimo | Reponer |
| Total < Mínimo × 1,5 | Atención |
| Total = 0 | Sin stock |
| Otro caso | OK |

El filtro deja los productos *Con mínimo* o *Bajo el mínimo*.

## En celular

En pantallas de menos de 768 px (breakpoint `sm`) las dos tablas se muestran como tarjetas, una por producto, para
no tener que desplazarse a lo ancho:

- Arriba, el producto con su unidad (y su estado, en *Stock total*) y, a la derecha, el dato principal:
  *En depósito* en *Stock por depósito* y *Total* en *Stock total*.
- Debajo, en una fila, los demás datos con su etiqueta: *En camino* y *Comprometido*; o *Mínimo*, *En depósitos*
  y *En camino*. Si falta stock para pedidos, la tarjeta lo dice ("Faltan 4 kg para pedidos.").
- En *Stock por depósito*, cada depósito es un título con sus tarjetas debajo.
- Como no hay encabezados de columna para tocar, cada lista tiene un selector *Ordenar*: por producto, más o
  menos stock primero, más comprometido primero (por depósito) o más urgente primero (total: Negativo, Reponer,
  Atención, Sin stock, OK).

Tocar una tarjeta abre la ficha del producto, como tocar una fila.

## Ejemplo

Depósitos General (Bahía Blanca) y Rosario. Almendras: 10 kg en General y un flete en camino a Rosario con
6 kg, sin mínimo. Avena: 25 kg en Rosario y un pedido abierto de 10 kg en Rosario, mínimo 50.

Stock por depósito:

| | En depósito | En camino | Comprometido |
|---|---|---|---|
| **General · Bahía Blanca** | | | |
| Almendras | 10 | – | – |
| **Rosario** | | | |
| Almendras | 0 | 6 | – |
| Avena | 25 | – | 10 |

Stock total:

| | En depósitos | En camino | Total | Mínimo | Estado |
|---|---|---|---|---|---|
| Almendras | 10 | 6 | 16 | – | OK |
| Avena | 25 | – | 25 | 50 | Reponer |
