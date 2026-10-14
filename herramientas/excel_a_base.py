"""
Convierte el Excel histórico (ROSARIO ACTUALIZADO.xlsm) en la base de datos de ERPeq.

Genera un .xlsx con la estructura que espera la app. Ese archivo se sube a Google Drive
y se abre como Hoja de cálculo de Google.

    py herramientas/excel_a_base.py "ROSARIO ACTUALIZADO.xlsm" "ERPeq-base.xlsx"

IMPORTANTE: el archivo generado tiene datos personales (agenda de clientes). No lo subas al repo.
Requiere: pip install openpyxl
"""
import re
import sys
import warnings
from collections import defaultdict
from datetime import datetime

import openpyxl
from openpyxl.styles import Font, PatternFill
from openpyxl.utils import get_column_letter

warnings.filterwarnings('ignore')
sys.stdout.reconfigure(encoding='utf-8')

DEPOSITOS = ['General', 'Rosario']
COMISION_POR_TIPO = {'DIETETICA': 3}  # % por defecto para ventas nuevas; el resto 0

COLS = {
    'Productos': ['ID', 'Producto', 'Unidad', 'Stock mínimo'] + [f'Stock {d}' for d in DEPOSITOS],
    'Compras': ['Fecha', 'Depósito', 'Proveedor', 'ID producto', 'Producto', 'Cantidad', 'Precio unitario',
                'Importe', 'Remito', 'Nota'],
    'Ventas': ['Fecha', 'Depósito', 'Cliente', 'Tipo de cliente', 'Localidad', 'Provincia', 'ID producto',
               'Producto', 'Cantidad', 'Precio unitario', 'Importe', 'Comisión', 'Costo unitario', 'Ganancia',
               'Carga', 'Nota'],
    'Ajustes': ['Fecha', 'Depósito', 'ID producto', 'Producto', 'Cantidad', 'Motivo'],
    'Tipos de cliente': ['Tipo', 'Comisión %'],
    'Fletes': ['Fecha', 'Transporte / Cliente', 'Abonado', 'Flete', 'Comisión', 'Total a recibir'],
    'Contactos': ['N°', 'Tipo', 'Nombre', 'Teléfono', 'Dirección', 'Email / Web', 'Localidad', 'Provincia',
                  'Horarios', 'Observaciones'],
}


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


def main(origen, destino):
    wv = openpyxl.load_workbook(origen, data_only=True)   # valores calculados
    wf = openpyxl.load_workbook(origen, data_only=False)  # fórmulas (para saber el depósito de cada venta)
    avisos = []

    # ---------- Productos ----------
    ids = {}

    def producto_id(nombre):
        nombre = norm(nombre)
        if not nombre:
            return None
        if nombre not in ids:
            ids[nombre] = f'P{len(ids) + 1:03d}'
        return ids[nombre]

    for r in range(3, wv['Listas de datos'].max_row + 1):
        producto_id(wv['Listas de datos'].cell(r, 5).value)
    for hoja in ('STOCK GENERAL', 'STOCK ROSARIO'):
        for r in range(2, wv[hoja].max_row + 1):
            producto_id(wv[hoja].cell(r, 2).value)
    conocidos = set(ids)

    # ---------- Compras ----------
    compras = []
    for hoja, deposito in (('COMPRAS', 'General'), ('COMPRAS ROSARIO', 'Rosario')):
        for r, f in filas(wv[hoja], 3):
            # B día, C mes, D año, E proveedor, I producto, J cantidad, K pagado, L remito, M importe
            prod, cant = norm(f[8]), num(f[9])
            if not prod or cant is None:
                continue
            precio = num(f[10])
            importe = num(f[12])
            if importe is None and precio is not None:
                importe = cant * precio
            compras.append({
                'fecha': fecha(f[1], f[2], f[3]), 'deposito': deposito, 'proveedor': norm(f[4]),
                'id': producto_id(prod), 'producto': prod, 'cantidad': cant, 'precio': precio,
                'importe': importe, 'remito': norm(f[11]), 'nota': '',
            })

    # Costo promedio ponderado de cada producto hasta una fecha (ambos depósitos).
    compras_por_id = defaultdict(list)
    for c in compras:
        if c['precio'] is not None and c['cantidad'] > 0:
            compras_por_id[c['id']].append(c)

    def costo_promedio(pid, hasta):
        lista = compras_por_id.get(pid, [])
        previas = [c for c in lista if hasta is None or c['fecha'] is None or c['fecha'] <= hasta] or lista
        cant = sum(c['cantidad'] for c in previas)
        return round(sum(c['cantidad'] * c['precio'] for c in previas) / cant, 2) if cant else None

    # ---------- Ventas ----------
    ventas = []
    vv, vf = wv['Ventas Realizadas'], wf['Ventas Realizadas']
    for r, f in filas(vv, 3):
        # B día, C mes, D año, E cliente, F tipo, G localidad, H provincia, I producto, J cantidad,
        # K precio, L comisión, M carga, N ganancia, O importe
        prod, cant = norm(f[8]), num(f[9])
        if not prod or cant is None:
            continue
        formula_ganancia = str(vf.cell(r, 14).value or '')
        deposito = 'Rosario' if 'COMPRAS ROSARIO' in formula_ganancia.upper() else 'General'
        precio = num(f[10])
        importe = num(f[14])
        if importe is None and precio is not None:
            importe = cant * precio
        comision = num(f[11]) or 0
        nota = '' if formula_ganancia.startswith('=') or num(f[13]) is not None else norm(f[13])
        pid = producto_id(prod)
        cuando = fecha(f[1], f[2], f[3])
        costo = costo_promedio(pid, cuando)
        ganancia = round(importe - comision - cant * costo, 2) if (importe is not None and costo is not None) else None
        if cuando is None:
            avisos.append(f'Venta fila {r}: fecha incompleta ({f[1]}/{f[2]}/{f[3]})')
        ventas.append({
            'fecha': cuando, 'deposito': deposito, 'cliente': norm(f[4]), 'tipo': norm(f[5]),
            'localidad': norm(f[6]), 'provincia': norm(f[7]), 'id': pid, 'producto': prod, 'cantidad': cant,
            'precio': precio, 'importe': importe, 'comision': round(comision, 2), 'costo': costo,
            'ganancia': ganancia, 'carga': norm(f[12]), 'nota': nota,
        })

    nuevos = sorted(set(ids) - conocidos)
    for n in nuevos:
        avisos.append(f'Producto que solo aparece en ventas/compras (¿variante de otro?): {n}')
    sin_costo = sorted({v['producto'] for v in ventas if v['costo'] is None})
    for n in sin_costo:
        avisos.append(f'Sin compras con precio, la ganancia de sus ventas queda vacía: {n}')

    # ---------- Tipos de cliente ----------
    tipos = []
    for r in range(3, wv['Listas de datos'].max_row + 1):
        t = norm(wv['Listas de datos'].cell(r, 6).value)
        if t and t not in tipos:
            tipos.append(t)
    for v in ventas:
        if v['tipo'] and v['tipo'] not in tipos:
            tipos.append(v['tipo'])

    # ---------- Fletes ----------
    fletes = []
    for r, f in filas(wv['FLETES'], 3):
        # A día, B mes, C año, D cliente, E abonado, F flete, G comisión, H total
        if not norm(f[3]) and num(f[5]) is None:
            continue
        fletes.append([fecha(f[0], f[1], f[2]), norm(f[3]), num(f[4]), num(f[5]), num(f[6]), num(f[7])])

    # ---------- Contactos ----------
    contactos = []
    for r, f in filas(wv['ALTA CLIEN-PROV'], 2):
        if not norm(f[2]):
            continue
        tel = f[3]
        if isinstance(tel, float) and tel.is_integer():
            tel = int(tel)
        contactos.append([f[0], norm(f[1]), norm(f[2]), norm(tel), norm(f[4]), norm(f[5]), norm(f[6]),
                          norm(f[7]), norm(f[8]), norm(f[9])])

    # ---------- Escribir ----------
    out = openpyxl.Workbook()
    out.remove(out.active)
    hojas = {}
    for nombre, cols in COLS.items():
        ws = out.create_sheet(nombre)
        ws.append(cols)
        for c in ws[1]:
            c.font = Font(bold=True)
            c.fill = PatternFill('solid', fgColor='E8F0E3')
        ws.freeze_panes = 'A2'
        hojas[nombre] = ws

    wp = hojas['Productos']
    for i, (nombre, pid) in enumerate(sorted(ids.items(), key=lambda x: x[1]), start=2):
        stock = []
        for d in DEPOSITOS:
            stock.append(
                f'=SUMIFS(Compras!$F:$F,Compras!$D:$D,$A{i},Compras!$B:$B,"{d}")'
                f'-SUMIFS(Ventas!$I:$I,Ventas!$G:$G,$A{i},Ventas!$B:$B,"{d}")'
                f'+SUMIFS(Ajustes!$E:$E,Ajustes!$C:$C,$A{i},Ajustes!$B:$B,"{d}")')
        wp.append([pid, nombre, unidad_probable(nombre), None] + stock)

    for c in compras:
        hojas['Compras'].append([c['fecha'], c['deposito'], c['proveedor'], c['id'], c['producto'], c['cantidad'],
                                 c['precio'], c['importe'], c['remito'], c['nota']])
    for v in ventas:
        hojas['Ventas'].append([v['fecha'], v['deposito'], v['cliente'], v['tipo'], v['localidad'], v['provincia'],
                                v['id'], v['producto'], v['cantidad'], v['precio'], v['importe'], v['comision'],
                                v['costo'], v['ganancia'], v['carga'], v['nota']])
    for t in tipos:
        hojas['Tipos de cliente'].append([t, COMISION_POR_TIPO.get(t, 0)])
    for f in fletes:
        hojas['Fletes'].append(f)
    for c in contactos:
        hojas['Contactos'].append(c)

    formato_fecha = 'dd/mm/yyyy'
    formato_plata = '"$"#,##0.00'
    for hoja, col_fecha, cols_plata in (('Compras', 'A', 'GH'), ('Ventas', 'A', 'JKLMN'), ('Ajustes', 'A', ''),
                                         ('Fletes', 'A', 'CDEF')):
        ws = hojas[hoja]
        for row in ws.iter_rows(min_row=2):
            for c in row:
                if c.column_letter == col_fecha:
                    c.number_format = formato_fecha
                elif c.column_letter in cols_plata:
                    c.number_format = formato_plata
    for ws in hojas.values():
        for i, col in enumerate(ws.iter_cols(min_row=1, max_row=min(ws.max_row, 200)), start=1):
            largo = max((len(str(c.value)) for c in col if c.value is not None and not str(c.value).startswith('=')),
                        default=8)
            ws.column_dimensions[get_column_letter(i)].width = min(max(largo + 2, 10), 45)

    out.save(destino)

    # ---------- Resumen ----------
    stock = defaultdict(float)
    for c in compras:
        stock[(c['id'], c['deposito'])] += c['cantidad']
    for v in ventas:
        stock[(v['id'], v['deposito'])] -= v['cantidad']
    nombre_de = {pid: n for n, pid in ids.items()}
    negativos = sorted(((nombre_de[pid], d, round(s, 2)) for (pid, d), s in stock.items() if s < -0.001),
                       key=lambda x: x[2])

    print(f'Base generada: {destino}')
    print(f'  Productos: {len(ids)}  Compras: {len(compras)}  Ventas: {len(ventas)}  '
          f'Tipos de cliente: {len(tipos)}  Fletes: {len(fletes)}  Contactos: {len(contactos)}')
    print(f'  Ventas por depósito: ' + ', '.join(
        f"{d} {sum(1 for v in ventas if v['deposito'] == d)}" for d in DEPOSITOS))
    print(f'\nStock negativo ({len(negativos)}): se corrige con un ajuste de stock desde la app')
    for n, d, s in negativos:
        print(f'  {s:>10}  {d:8} {n}')
    print(f'\nAvisos ({len(avisos)}):')
    for a in avisos:
        print('  -', a)


if __name__ == '__main__':
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1], sys.argv[2])
