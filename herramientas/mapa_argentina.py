#!/usr/bin/env python3
"""Genera src/mapa/argentina.json: el contorno de las provincias y las localidades de Argentina, ya proyectados.

Fuentes (datos abiertos del Gobierno nacional, servicio Georef):
  - Provincias: https://infra.datos.gob.ar/georef/provincias.geojson (IGN).
  - Localidades censales: https://apis.datos.gob.ar/georef/api/localidades-censales (INDEC).

Proyección equirectangular centrada en 38° S: x = (lon + 74) · cos(38°) · 20, y = (-21,5 - lat) · 20.
Queda fuera lo que está al sur de 56° S (Antártida) y al este de 53° O (Georgias y Sandwich del Sur).

Uso: python3 herramientas/mapa_argentina.py
"""

import json
import math
import urllib.request
from pathlib import Path

PROVINCIAS = 'https://infra.datos.gob.ar/georef/provincias.geojson'
LOCALIDADES = ('https://apis.datos.gob.ar/georef/api/localidades-censales?max=5000&formato=json'
               '&campos=nombre,provincia.nombre,centroide,departamento.nombre,municipio.nombre,categoria')
SALIDA = Path(__file__).resolve().parent.parent / 'src' / 'mapa' / 'argentina.json'

LON0, LAT0, ESCALA = -74.0, -21.5, 20.0
COS = math.cos(math.radians(38))
LAT_MIN, LON_MAX = -56.0, -53.0
TOLERANCIA = 0.6  # en unidades del mapa (≈ 3 km): Douglas-Peucker


def proyectar(lon, lat):
    return (round((lon - LON0) * COS * ESCALA, 1), round((LAT0 - lat) * ESCALA, 1))


def bajar(url):
    # infra.datos.gob.ar responde 403 al user-agent por defecto de urllib.
    pedido = urllib.request.Request(url, headers={'User-Agent': 'ERPeq/1.0 (herramientas/mapa_argentina.py)'})
    with urllib.request.urlopen(pedido, timeout=60) as r:
        return json.load(r)


def douglas_peucker(puntos, tol):
    if len(puntos) < 3:
        return puntos
    (x1, y1), (x2, y2) = puntos[0], puntos[-1]
    dx, dy = x2 - x1, y2 - y1
    largo = math.hypot(dx, dy)
    peor, idx = 0.0, 0
    for i in range(1, len(puntos) - 1):
        px, py = puntos[i]
        d = abs(dy * px - dx * py + x2 * y1 - y2 * x1) / largo if largo else math.hypot(px - x1, py - y1)
        if d > peor:
            peor, idx = d, i
    if peor <= tol:
        return [puntos[0], puntos[-1]]
    return douglas_peucker(puntos[:idx + 1], tol)[:-1] + douglas_peucker(puntos[idx:], tol)


def anillo(coords):
    if all(lat < LAT_MIN or lon > LON_MAX for lon, lat in coords):
        return None
    pts = douglas_peucker([proyectar(lon, lat) for lon, lat in coords], TOLERANCIA)
    if len(pts) < 4:  # el anillo cerrado repite el primer punto: menos de 4 es una isla que se pierde a esta escala
        return None
    return 'M' + 'L'.join(f'{x:g} {y:g}' for x, y in pts[:-1]) + 'Z'


def provincias():
    res = []
    for f in bajar(PROVINCIAS)['features']:
        g = f['geometry']
        poligonos = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
        d = ''.join(a for p in poligonos for r in p if (a := anillo(r)))
        res.append({'nombre': f['properties']['nombre'], 'd': d})
    return sorted(res, key=lambda p: p['nombre'])


def normal(s):
    return (s or '').strip().lower()


def localidades(nombres_prov):
    idx = {n: i for i, n in enumerate(nombres_prov)}
    res = []
    for loc in bajar(LOCALIDADES)['localidades_censales']:
        c = loc['centroide']
        x, y = proyectar(c['lon'], c['lat'])
        n = normal(loc['nombre'])
        # Para un nombre repetido en varias provincias se prefiere la cabecera de un aglomerado.
        rango = int(n in (normal(loc['departamento']['nombre']), normal(loc['municipio']['nombre'])))
        rango += int('compuesta' in normal(loc['categoria']))
        res.append([loc['nombre'], idx[loc['provincia']['nombre']], x, y, rango])
    return sorted(res, key=lambda l: (l[1], l[0]))


def main():
    provs = provincias()
    nombres = [p['nombre'] for p in provs]
    datos = {
        'ancho': proyectar(LON_MAX, 0)[0],
        'alto': proyectar(0, LAT_MIN)[1],
        'provincias': provs,
        'localidades': localidades(nombres),
    }
    SALIDA.parent.mkdir(parents=True, exist_ok=True)
    SALIDA.write_text(json.dumps(datos, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    print(f'{SALIDA}: {len(provs)} provincias, {len(datos["localidades"])} localidades, {SALIDA.stat().st_size // 1024} KB')


if __name__ == '__main__':
    main()
