// Modelo de datos de ERPeq: cómo se leen y escriben las filas de la planilla y los cálculos
// (stock por depósito, costo promedio, ganancia). No depende del navegador, así se puede probar con Node.
(function (raiz) {
  const RANGOS = {
    productos: "'Productos'!A2:D",
    compras: "'Compras'!A2:J",
    ventas: "'Ventas'!A2:P",
    ajustes: "'Ajustes'!A2:F",
    tipos: "'Tipos de cliente'!A2:B",
  };
  // Columnas de stock calculado en la hoja Productos (E en adelante, una por depósito).
  const PRODUCTOS_COL_STOCK = 4;

  const txt = (v) => (v === undefined || v === null ? '' : String(v).trim());
  const num = (v) => (v === '' || v === undefined || v === null || isNaN(Number(v)) ? null : Number(v));
  const redondear = (n, d = 2) => (n === null ? null : Math.round(n * 10 ** d) / 10 ** d);

  function parsear(crudo, deSerie) {
    const fecha = (v) => (typeof v === 'number' ? deSerie(v) : null);
    const [prod, comp, vent, ajus, tip] = crudo;
    return {
      productos: prod.filter((f) => txt(f[0])).map((f) => ({
        id: txt(f[0]), producto: txt(f[1]), unidad: txt(f[2]) || 'kg', minimo: num(f[3]) || 0,
      })),
      compras: comp.filter((f) => txt(f[3])).map((f) => ({
        fecha: fecha(f[0]), deposito: txt(f[1]), proveedor: txt(f[2]), id: txt(f[3]), producto: txt(f[4]),
        cantidad: num(f[5]) || 0, precio: num(f[6]), importe: num(f[7]), remito: txt(f[8]), nota: txt(f[9]),
      })),
      ventas: vent.filter((f) => txt(f[6])).map((f) => ({
        fecha: fecha(f[0]), deposito: txt(f[1]), cliente: txt(f[2]), tipo: txt(f[3]), localidad: txt(f[4]),
        provincia: txt(f[5]), id: txt(f[6]), producto: txt(f[7]), cantidad: num(f[8]) || 0, precio: num(f[9]),
        importe: num(f[10]), comision: num(f[11]) || 0, costo: num(f[12]), ganancia: num(f[13]),
        carga: txt(f[14]), nota: txt(f[15]),
      })),
      ajustes: ajus.filter((f) => txt(f[2])).map((f) => ({
        fecha: fecha(f[0]), deposito: txt(f[1]), id: txt(f[2]), producto: txt(f[3]), cantidad: num(f[4]) || 0,
        motivo: txt(f[5]),
      })),
      tipos: tip.filter((f) => txt(f[0])).map((f) => ({ tipo: txt(f[0]), comision: num(f[1]) || 0 })),
    };
  }

  // Costo promedio ponderado por producto, sobre todas las compras con precio (ambos depósitos).
  function costosPromedio(compras) {
    const acum = new Map();
    for (const c of compras) {
      if (c.precio === null || c.cantidad <= 0) continue;
      const a = acum.get(c.id) || { cant: 0, total: 0 };
      a.cant += c.cantidad;
      a.total += c.cantidad * c.precio;
      acum.set(c.id, a);
    }
    const res = new Map();
    for (const [id, a] of acum) res.set(id, redondear(a.total / a.cant));
    return res;
  }

  // Stock = compras − ventas + ajustes, por depósito.
  function stockPorProducto(datos, depositos) {
    const res = new Map(datos.productos.map((p) => [p.id, Object.fromEntries(depositos.map((d) => [d, 0]))]));
    const sumar = (id, dep, cant) => {
      const s = res.get(id);
      if (s && dep in s) s[dep] += cant;
    };
    for (const c of datos.compras) sumar(c.id, c.deposito, c.cantidad);
    for (const v of datos.ventas) sumar(v.id, v.deposito, -v.cantidad);
    for (const a of datos.ajustes) sumar(a.id, a.deposito, a.cantidad);
    for (const s of res.values()) for (const d of depositos) s[d] = redondear(s[d], 3);
    return res;
  }

  // Calcula importe, comisión, costo y ganancia de una línea de venta.
  function lineaVenta({ cantidad, precio, comisionPct, costo }) {
    const importe = redondear(cantidad * precio);
    const comision = redondear(importe * (comisionPct || 0) / 100);
    const ganancia = costo === null || costo === undefined ? null : redondear(importe - comision - cantidad * costo);
    return { importe, comision, ganancia };
  }

  const claveMes = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

  function ventasPorMes(ventas) {
    const meses = new Map();
    for (const v of ventas) {
      if (!v.fecha) continue;
      const k = claveMes(v.fecha);
      const m = meses.get(k) || { mes: k, importe: 0, ganancia: 0, comision: 0, lineas: 0 };
      m.importe += v.importe || 0;
      m.ganancia += v.ganancia || 0;
      m.comision += v.comision || 0;
      m.lineas += 1;
      meses.set(k, m);
    }
    return [...meses.values()].sort((a, b) => a.mes.localeCompare(b.mes));
  }

  function siguienteId(productos) {
    const max = productos.reduce((m, p) => Math.max(m, Number(p.id.replace(/\D/g, '')) || 0), 0);
    return `P${String(max + 1).padStart(3, '0')}`;
  }

  // Filas tal como se escriben en cada hoja (mismo orden de columnas).
  const filas = {
    producto: (p) => [p.id, p.producto, p.unidad, p.minimo ?? ''],
    compra: (c) => [c.fecha, c.deposito, c.proveedor, c.id, c.producto, c.cantidad, c.precio ?? '',
      c.precio === null ? '' : redondear(c.cantidad * c.precio), c.remito, c.nota],
    venta: (v) => [v.fecha, v.deposito, v.cliente, v.tipo, v.localidad, v.provincia, v.id, v.producto, v.cantidad,
      v.precio, v.importe, v.comision, v.costo ?? '', v.ganancia ?? '', v.carga, v.nota],
    ajuste: (a) => [a.fecha, a.deposito, a.id, a.producto, a.cantidad, a.motivo],
  };

  const Modelo = {
    RANGOS, PRODUCTOS_COL_STOCK, parsear, costosPromedio, stockPorProducto, lineaVenta, ventasPorMes, claveMes,
    siguienteId, filas, redondear,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Modelo;
  else raiz.Modelo = Modelo;
})(this);
