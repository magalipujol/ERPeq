"""
Convierte el Excel histórico (ROSARIO ACTUALIZADO.xlsm) en la base de datos de ERPeq.

Genera un .xlsx con la estructura de spec/modelo-de-datos.md. Ese archivo se sube a Google Drive
y se abre como Hoja de cálculo de Google.

    uv run --with openpyxl herramientas/excel_a_base.py "ROSARIO ACTUALIZADO.xlsm" "ERPeq-base.xlsx"

IMPORTANTE: el archivo generado tiene datos personales (agenda de clientes). No lo subas al repo.
"""
import re
import sys
import warnings
from collections import Counter, defaultdict
from datetime import datetime

import openpyxl
from openpyxl.styles import Font, PatternFill
from openpyxl.utils import get_column_letter

warnings.filterwarnings('ignore')
sys.stdout.reconfigure(encoding='utf-8')

# Depósito de cada hoja de compras del Excel.
DEPOSITOS = [('BB', 'General', 'Bahía Blanca'), ('ROS', 'Rosario', 'Rosario')]
# Nombre y localidad de cada vendedor según la columna CARGA del Excel. La app propone el vendedor en los
# pedidos de clientes de su localidad.
VENDEDORES = {'GUADA/HERNAN': ('Guada/Hernán', 'Rosario'), 'LEO': ('Leo', '')}
# Socios entre los que se reparte la plata de las ventas: (id, nombre, vendedor de la columna CARGA, rol).
# Sampatti es la empresa de Leo y la dueña de la mercadería.
SOCIOS = [('SOC01', 'Sampatti', 'LEO', 'dueño'), ('SOC02', 'Guada/Hernán', 'GUADA/HERNAN', 'socio')]

# Encabezados de cada hoja, en el orden de columnas de src/db/sheets/hojas.ts (HOJAS y filas). Las filas guardan
# IDs y no nombres: el nombre de un producto, contacto, vendedor o socio está solo en su hoja.
COLS = {
    'Depósitos': ['id', 'nombre', 'localidad'],
    'Productos': ['id', 'producto', 'unidad', 'minimo'],
    'Contactos': ['id', 'rol', 'nombre', 'tipo_cliente', 'telefono', 'direccion', 'email', 'localidad', 'provincia',
                  'observaciones'],
    'Tipos de cliente': ['tipo'],
    'Vendedores': ['id', 'nombre', 'activo', 'localidad'],
    'Precios': ['producto_id', 'precio', 'desde'],
    'Reglas de comisión': ['vendedor_id', 'producto_id', 'porcentaje', 'desde'],
    'Compras': ['fecha', 'deposito_id', 'contacto_id', 'producto_id', 'cantidad', 'precio', 'importe', 'remito',
                'pedido_id', 'nota'],
    'Pedidos': ['id', 'fecha', 'contacto_id', 'deposito_id', 'nota'],
    'Pedidos ítems': ['pedido_id', 'linea', 'producto_id', 'cantidad', 'precio_lista', 'precio'],
    'Pedidos estados': ['pedido_id', 'fecha', 'estado'],
    'Pedidos vendedores': ['pedido_id', 'vendedor_id'],
    'Ventas': ['id', 'fecha', 'pedido_id', 'deposito_id', 'nota'],
    'Ventas ítems': ['venta_id', 'linea', 'pedido_linea', 'producto_id', 'cantidad', 'precio', 'importe', 'costo'],
    'Ventas comisiones': ['venta_id', 'linea', 'vendedor_id', 'porcentaje_regla', 'porcentaje', 'monto'],
    'Fletes': ['id', 'fecha', 'contacto_id', 'origen_id', 'destino_id', 'costo', 'guia', 'nota'],
    'Fletes ítems': ['flete_id', 'producto_id', 'cantidad'],
    'Fletes estados': ['flete_id', 'fecha', 'estado'],
    'Pedidos fletes': ['pedido_id', 'flete_id', 'costo_asignado'],
    'Ajustes': ['fecha', 'deposito_id', 'producto_id', 'cantidad', 'motivo'],
    'Socios': ['id', 'nombre', 'vendedor_id', 'rol'],
    'Cobros': ['fecha', 'venta_id', 'importe', 'medio', 'socio_id', 'nota'],
    'Rendiciones': ['fecha', 'de_socio_id', 'a_socio_id', 'importe', 'medio', 'nota'],
    'Recetas': ['id', 'version', 'desde', 'producto_id', 'cantidad', 'activa'],
    'Recetas ítems': ['receta_id', 'version', 'producto_id', 'cantidad'],
}
COLS_FECHA = {'fecha', 'desde'}
COLS_PLATA = {'precio', 'importe', 'costo', 'monto', 'precio_lista', 'costo_asignado'}


def norm(s):
    return re.sub(r'\s+', ' ', str(s)).strip() if s not in (None, '') else ''


def num(v):
    if v in (None, ''):
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def fecha(d, m, a):
    try:
        return datetime(int(a), int(m), int(d), 12, 0)
    except (TypeError, ValueError):
        return None


def unidad_probable(nombre):
    n = nombre.upper()
    if re.search(r'\bX\s*\d+\s*(G|GR|CC|ML|LTS?)\b|\d+\s*CC\b|BIDON|FRASCO', n):
        return 'unid.'
    return 'kg'


def filas(ws, desde, max_col=20, corte=500):
    """Filas con datos. Corta tras `corte` filas vacías seguidas: algunas hojas figuran con
    un millón de filas formateadas pero vacías."""
    vacias = 0
    for r, fila in enumerate(ws.iter_rows(min_row=desde, max_col=max_col, values_only=True), start=desde):
        if all(v in (None, '') for v in fila):
            vacias += 1
            if vacias >= corte:
                return
            continue
        vacias = 0
        yield r, list(fila) + [None] * (max_col - len(fila))


class Ids:
    """IDs consecutivos con prefijo, uno por clave."""

    def __init__(self, prefijo, ancho):
        self.prefijo, self.ancho, self.ids = prefijo, ancho, {}

    def __call__(self, clave):
        if clave not in self.ids:
            self.ids[clave] = f'{self.prefijo}{len(self.ids) + 1:0{self.ancho}d}'
        return self.ids[clave]


def main(origen, destino):
    wv = openpyxl.load_workbook(origen, data_only=True)   # valores calculados
    wf = openpyxl.load_workbook(origen, data_only=False)  # fórmulas (para saber el depósito de cada venta)
    avisos = []

    # ---------- Productos ----------
    producto_id = Ids('P', 3)
    for r in range(3, wv['Listas de datos'].max_row + 1):
        if norm(wv['Listas de datos'].cell(r, 5).value):
            producto_id(norm(wv['Listas de datos'].cell(r, 5).value))
    for hoja in ('STOCK GENERAL', 'STOCK ROSARIO'):
        for r in range(2, wv[hoja].max_row + 1):
            if norm(wv[hoja].cell(r, 2).value):
                producto_id(norm(wv[hoja].cell(r, 2).value))
    conocidos = set(producto_id.ids)

    # ---------- Contactos ----------
    contacto_id = Ids('C', 4)
    contactos = {}  # (rol, nombre en mayúsculas) → fila

    def contacto(rol, nombre, **datos):
        clave = (rol, nombre.upper())
        if clave not in contactos:
            contactos[clave] = {'id': contacto_id(clave), 'rol': rol, 'nombre': nombre, **datos}
        return contactos[clave]['id']

    # ---------- Compras ----------
    compras = []
    proveedores = set()
    for hoja, deposito in (('COMPRAS', 'BB'), ('COMPRAS ROSARIO', 'ROS')):
        for r, f in filas(wv[hoja], 3):
            # B día, C mes, D año, E proveedor, F tipo, G localidad, H provincia, I producto, J cantidad,
            # K pagado, L remito, M importe
            prod, cant = norm(f[8]), num(f[9])
            if not prod or cant is None:
                continue
            precio = num(f[10])
            importe = num(f[12])
            if importe is None and precio is not None:
                importe = cant * precio
            prov = norm(f[4])
            proveedores.add(prov.upper())
            cid = contacto('proveedor', prov, tipo=norm(f[5]), localidad=norm(f[6]), provincia=norm(f[7])) if prov else ''
            compras.append({
                'fecha': fecha(f[1], f[2], f[3]), 'deposito': deposito, 'proveedor': prov, 'contacto': cid,
                'id': producto_id(prod), 'producto': prod, 'cantidad': cant, 'precio': precio,
                'importe': importe, 'remito': norm(f[11]),
            })

    # La agenda del Excel mezcla clientes y proveedores: es proveedor si aparece en las compras.
    for r, f in filas(wv['ALTA CLIEN-PROV'], 2):
        nombre = norm(f[2])
        if not nombre:
            continue
        tel = f[3]
        if isinstance(tel, float) and tel.is_integer():
            tel = int(tel)
        rol = 'proveedor' if nombre.upper() in proveedores else 'cliente'
        datos = {'tipo': norm(f[1]), 'telefono': norm(tel), 'direccion': norm(f[4]), 'email': norm(f[5]),
                 'localidad': norm(f[6]), 'provincia': norm(f[7]),
                 'observaciones': ' · '.join(x for x in (norm(f[8]), norm(f[9])) if x)}
        if (rol, nombre.upper()) in contactos:
            contactos[(rol, nombre.upper())].update({k: v for k, v in datos.items() if v})
        else:
            contacto(rol, nombre, **datos)

    # Costo promedio ponderado de cada producto hasta una fecha (todos los depósitos).
    compras_por_id = defaultdict(list)
    for c in compras:
        if c['precio'] is not None and c['cantidad'] > 0:
            compras_por_id[c['id']].append(c)

    def costo_promedio(pid, hasta):
        lista = compras_por_id.get(pid, [])
        previas = [c for c in lista if hasta is None or c['fecha'] is None or c['fecha'] <= hasta] or lista
        cant = sum(c['cantidad'] for c in previas)
        return round(sum(c['cantidad'] * c['precio'] for c in previas) / cant, 2) if cant else None

    # ---------- Líneas de venta del Excel ----------
    lineas = []
    vv, vf = wv['Ventas Realizadas'], wf['Ventas Realizadas']
    for r, f in filas(vv, 3):
        # B día, C mes, D año, E cliente, F tipo, G localidad, H provincia, I producto, J cantidad,
        # K precio, L comisión, M carga, N ganancia, O importe
        prod, cant = norm(f[8]), num(f[9])
        if not prod or cant is None:
            continue
        formula_ganancia = str(vf.cell(r, 14).value or '')
        precio, importe = num(f[10]), num(f[14])
        if importe is None and precio is not None:
            importe = cant * precio
        if precio is None and importe is not None and cant:
            precio = importe / cant
        if precio is None:
            avisos.append(f'Venta fila {r}: sin precio ni importe, queda en $0 ({prod})')
            precio, importe = 0, 0
        cuando = fecha(f[1], f[2], f[3])
        if cuando is None:
            avisos.append(f'Venta fila {r}: fecha incompleta ({f[1]}/{f[2]}/{f[3]})')
        carga = norm(f[12]).upper()
        vendedor = carga if carga in VENDEDORES else ''
        if carga and not vendedor:
            avisos.append(f'Venta fila {r}: CARGA "{norm(f[12])}" no es un vendedor conocido')
        lineas.append({
            'fecha': cuando, 'deposito': 'ROS' if 'COMPRAS ROSARIO' in formula_ganancia.upper() else 'BB',
            'cliente': norm(f[4]), 'tipo': norm(f[5]), 'localidad': norm(f[6]), 'provincia': norm(f[7]),
            'id': producto_id(prod), 'producto': prod, 'cantidad': cant, 'precio': precio,
            'importe': round(importe or 0, 2), 'comision': round(num(f[11]) or 0, 2), 'vendedor': vendedor,
            'nota': '' if formula_ganancia.startswith('=') or num(f[13]) is not None else norm(f[13]),
        })

    # ---------- Vendedores y reglas de comisión ----------
    vendedor_id = {v: f'VEN{i:02d}' for i, v in enumerate(VENDEDORES, start=1)}
    tasa = lambda l: round(l['comision'] / l['importe'] * 100, 2) if l['importe'] else 0.0
    reglas = []
    for v in VENDEDORES:
        suyas = [l for l in lineas if l['vendedor'] == v]
        if not suyas:
            continue
        desde = min((l['fecha'] for l in suyas if l['fecha']), default=None)
        general = Counter(tasa(l) for l in suyas).most_common(1)[0][0]
        if general:
            reglas.append([vendedor_id[v], '', general, desde])
        por_producto = defaultdict(Counter)
        for l in suyas:
            por_producto[l['id']][tasa(l)] += 1
        for pid, tasas in sorted(por_producto.items()):
            t = tasas.most_common(1)[0][0]
            if t != general:
                reglas.append([vendedor_id[v], pid, t, desde])

    def porcentaje_regla(v, pid):
        especifica = [r[2] for r in reglas if r[0] == v and r[1] == pid]
        general = [r[2] for r in reglas if r[0] == v and r[1] == '']
        return (especifica or general or [0])[0]

    # ---------- Pedidos y ventas ----------
    # Cada grupo de líneas con la misma fecha, cliente, depósito y vendedor es un pedido entregado completo.
    pedidos, pedidos_items, pedidos_estados, pedidos_vendedores = [], [], [], []
    ventas, ventas_items, ventas_comisiones = [], [], []
    grupos = defaultdict(list)
    for l in lineas:
        grupos[(l['fecha'], l['cliente'].upper(), l['deposito'], l['vendedor'])].append(l)
    for n, ((cuando, _, deposito, vendedor), ls) in enumerate(grupos.items(), start=1):
        pid, vid = f'PE{n:04d}', f'V{n:04d}'
        primera = ls[0]
        cid = contacto('cliente', primera['cliente'], tipo=primera['tipo'], localidad=primera['localidad'],
                       provincia=primera['provincia']) if primera['cliente'] else ''
        nota = ' · '.join(dict.fromkeys(l['nota'] for l in ls if l['nota']))
        pedidos.append([pid, cuando, cid, deposito, nota])
        pedidos_estados.append([pid, cuando, 'abierto'])
        ventas.append([vid, cuando, pid, deposito, ''])
        if vendedor:
            pedidos_vendedores.append([pid, vendedor_id[vendedor]])
        for i, l in enumerate(ls, start=1):
            pedidos_items.append([pid, i, l['id'], l['cantidad'], None, l['precio']])
            ventas_items.append([vid, i, i, l['id'], l['cantidad'], l['precio'], l['importe'], costo_promedio(l['id'], cuando)])
            if vendedor and l['comision']:
                ventas_comisiones.append([vid, i, vendedor_id[vendedor], porcentaje_regla(vendedor_id[vendedor], l['id']),
                                          tasa(l), l['comision']])

    # ---------- Precios: el de la última venta de cada producto ----------
    ultimo = {}
    for l in sorted((l for l in lineas if l['fecha'] and l['precio']), key=lambda l: l['fecha']):
        ultimo[l['id']] = l
    precios = [[pid, round(l['precio'], 2), l['fecha']] for pid, l in sorted(ultimo.items())]

    # ---------- Tipos de cliente ----------
    tipos = []
    for r in range(3, wv['Listas de datos'].max_row + 1):
        t = norm(wv['Listas de datos'].cell(r, 6).value)
        if t and t not in tipos:
            tipos.append(t)
    for l in lineas:
        if l['tipo'] and l['tipo'] not in tipos:
            tipos.append(l['tipo'])

    # ---------- Fletes ----------
    # El Excel no dice origen, destino ni mercadería: quedan como fletes terminados que no mueven stock.
    fletes, fletes_estados = [], []
    for r, f in filas(wv['FLETES'], 3):
        # A día, B mes, C año, D cliente/transporte, E abonado, F flete, G comisión, H total
        nombre, costo = norm(f[3]), num(f[5])
        if not nombre and costo is None:
            continue
        fid = f'F{len(fletes) + 1:04d}'
        cuando = fecha(f[0], f[1], f[2])
        cid = contacto('transporte', nombre) if nombre else ''
        fletes.append([fid, cuando, cid, '', '', costo, '', ''])
        fletes_estados.append([fid, cuando, 'finalizado'])
        if any(num(x) is not None for x in (f[4], f[6], f[7])):
            avisos.append(f'Flete fila {r}: tiene Abonado/Comisión/Total, que el modelo no guarda')

    nuevos = sorted(set(producto_id.ids) - conocidos)
    for n in nuevos:
        avisos.append(f'Producto que solo aparece en ventas/compras (¿variante de otro?): {n}')
    nombre_de = {pid: n for n, pid in producto_id.ids.items()}
    for n in sorted({nombre_de[row[3]] for row in ventas_items if row[7] is None}):
        avisos.append(f'Sin compras con precio, la ganancia de sus ventas no descuenta costo: {n}')

    # ---------- Escribir ----------
    datos = {
        'Depósitos': [list(d) for d in DEPOSITOS],
        'Productos': [[pid, nombre, unidad_probable(nombre), None]
                      for nombre, pid in sorted(producto_id.ids.items(), key=lambda x: x[1])],
        'Contactos': [[c['id'], c['rol'], c['nombre'], c.get('tipo', ''), c.get('telefono', ''), c.get('direccion', ''),
                       c.get('email', ''), c.get('localidad', ''), c.get('provincia', ''), c.get('observaciones', '')]
                      for c in sorted(contactos.values(), key=lambda c: c['id'])],
        'Tipos de cliente': [[t] for t in tipos],
        'Vendedores': [[vendedor_id[v], nombre, 'sí', localidad] for v, (nombre, localidad) in VENDEDORES.items()],
        'Precios': precios,
        'Reglas de comisión': reglas,
        'Compras': [[c['fecha'], c['deposito'], c['contacto'], c['id'], c['cantidad'], c['precio'], c['importe'],
                     c['remito'], '', ''] for c in compras],
        'Pedidos': pedidos,
        'Pedidos ítems': pedidos_items,
        'Pedidos estados': pedidos_estados,
        'Pedidos vendedores': pedidos_vendedores,
        'Ventas': ventas,
        'Ventas ítems': ventas_items,
        'Ventas comisiones': ventas_comisiones,
        'Fletes': fletes,
        'Fletes ítems': [],
        'Fletes estados': fletes_estados,
        'Pedidos fletes': [],
        'Ajustes': [],
        # El Excel no dice quién cobró cada venta: los cobros y las rendiciones empiezan vacíos.
        'Socios': [[sid, nombre, vendedor_id[v], rol] for sid, nombre, v, rol in SOCIOS],
        'Cobros': [],
        'Rendiciones': [],
        'Recetas': [],
        'Recetas ítems': [],
    }
    out = openpyxl.Workbook()
    out.remove(out.active)
    for nombre, cols in COLS.items():
        ws = out.create_sheet(nombre)
        ws.append(cols)
        for c in ws[1]:
            c.font = Font(bold=True)
            c.fill = PatternFill('solid', fgColor='E8F0E3')
        ws.freeze_panes = 'A2'
        for fila in datos[nombre]:
            ws.append(fila)
        for i, col in enumerate(cols, start=1):
            formato = 'dd/mm/yyyy' if col in COLS_FECHA else '"$"#,##0.00' if col in COLS_PLATA else None
            if formato:
                for (c,) in ws.iter_rows(min_row=2, min_col=i, max_col=i):
                    c.number_format = formato
            largo = max((len(str(f[i - 1])) for f in datos[nombre][:200] if f[i - 1] is not None), default=8)
            ws.column_dimensions[get_column_letter(i)].width = min(max(largo, len(col)) + 2, 45)
    out.save(destino)

    # ---------- Resumen ----------
    stock = defaultdict(float)
    for c in compras:
        stock[(c['id'], c['deposito'])] += c['cantidad']
    for l in lineas:
        stock[(l['id'], l['deposito'])] -= l['cantidad']
    negativos = sorted(((nombre_de[pid], d, round(s, 2)) for (pid, d), s in stock.items() if s < -0.001),
                       key=lambda x: x[2])

    print(f'Base generada: {destino}')
    print('  ' + '  '.join(f'{k}: {len(v)}' for k, v in datos.items() if v))
    print('\nReglas de comisión deducidas del Excel (la más frecuente por vendedor y por producto):')
    for v, p, t, _ in reglas:
        print(f'  {v} {nombre_de.get(p, "general"):45} {t}%')
    print(f'\nStock negativo ({len(negativos)}): se corrige con un ajuste de stock desde la app')
    for n, d, s in negativos:
        print(f'  {s:>10}  {d:4} {n}')
    print(f'\nAvisos ({len(avisos)}):')
    for a in avisos:
        print('  -', a)


if __name__ == '__main__':
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1], sys.argv[2])
