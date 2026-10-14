(() => {
  const CFG = window.ERPEQ_CONFIG;
  const DB = window.GoogleDB;
  const M = window.Modelo;
  const DEPS = CFG.DEPOSITOS;
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

  const state = {
    info: null,          // datos de la planilla (título, url, hojas)
    datos: null,         // { productos, compras, ventas, ajustes, tipos }
    stock: new Map(),    // id -> { General: n, Rosario: n }
    costos: new Map(),   // id -> costo promedio
    porId: new Map(),
    porNombre: new Map(),
    vista: 'stock',
    sortStock: { key: 'producto', dir: 1 },
    unidad: null,
    mesVentas: null,
    mesCompras: null,
  };
  const charts = {};

  // ---------- Formatos ----------
  const fmtNum = (n) => (n === null || n === undefined ? '–' : Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 }));
  const fmtMoney = (n) => (n === null || n === undefined ? '–' : Number(n).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }));
  const fmtFecha = (d) => (d ? d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '–');
  const fmtMes = (k) => {
    const [a, m] = k.split('-').map(Number);
    const t = new Date(a, m - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
    return t.charAt(0).toUpperCase() + t.slice(1);
  };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hoyISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const deISO = (s) => {
    const [a, m, d] = s.split('-').map(Number);
    return new Date(a, m - 1, d, 12);
  };
  const hora = () => new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const unicos = (arr) => [...new Set(arr.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));

  function setEstado(texto, error = false) {
    const el = $('#estado');
    el.textContent = texto;
    el.classList.toggle('err', error);
  }

  function setMsg(form, texto, tipo = '') {
    const el = $('[data-msg]', form);
    el.textContent = texto;
    el.className = `msg ${tipo}`;
  }

  // ---------- Pantallas ----------
  const PANTALLAS = ['pantalla-config', 'pantalla-login', 'pantalla-sin-acceso'];

  function mostrar(pantalla) {
    for (const id of PANTALLAS) $(`#${id}`).hidden = id !== pantalla;
    const enApp = pantalla === 'app';
    $('#nav').hidden = !enApp;
    $('#sesion').hidden = pantalla === 'pantalla-config' || pantalla === 'pantalla-login';
    $('#link-planilla').hidden = !enApp;
    $('#btn-refrescar').hidden = !enApp;
    for (const v of ['stock', 'ventas', 'compras']) $(`#vista-${v}`).hidden = !enApp || v !== state.vista;
    if (enApp) renderGraficos();
  }

  function irA(vista) {
    state.vista = vista;
    $$('#nav button').forEach((b) => b.toggleAttribute('aria-current', b.dataset.vista === vista));
    for (const v of ['stock', 'ventas', 'compras']) $(`#vista-${v}`).hidden = v !== vista;
    history.replaceState(null, '', `#${vista}`);
    renderGraficos();
  }

  // ---------- Sesión ----------
  async function ingresar() {
    const btn = $('#btn-login');
    $('#login-msg').textContent = '';
    btn.disabled = true;
    try {
      await DB.login();
      await abrirBase();
    } catch (err) {
      $('#login-msg').textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  }

  // Devuelve false si la planilla no está compartida con la cuenta que ingresó.
  async function abrirBase() {
    try {
      state.info = await DB.info();
    } catch (err) {
      if (err instanceof DB.SinAcceso) {
        mostrar('pantalla-sin-acceso');
        return false;
      }
      throw err;
    }
    $('#usuario').textContent = state.info.properties.title;
    $('#link-planilla').href = state.info.spreadsheetUrl;
    await cargar();
    mostrar('app');
    return true;
  }

  async function reintentarAcceso() {
    const btn = $('#btn-reintentar');
    $('#sin-acceso-msg').textContent = '';
    btn.disabled = true;
    try {
      if (!(await abrirBase())) $('#sin-acceso-msg').textContent = 'Sigue sin acceso. Revisá que la planilla esté compartida con esta cuenta.';
    } catch (err) {
      $('#sin-acceso-msg').textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  }

  async function reconectar() {
    try {
      await DB.login();
      $('#banner-sesion').hidden = true;
      if (state.info) await cargar();
    } catch (err) {
      setEstado(err.message, true);
    }
  }

  async function salir() {
    await DB.logout();
    state.info = null;
    state.datos = null;
    $('#banner-sesion').hidden = true;
    setEstado('Stock, ventas y compras');
    mostrar('pantalla-login');
  }

  // ---------- Datos ----------
  async function cargar() {
    setEstado('Leyendo la planilla…');
    document.body.classList.add('loading');
    try {
      const crudo = await DB.leer([M.RANGOS.productos, M.RANGOS.compras, M.RANGOS.ventas, M.RANGOS.ajustes, M.RANGOS.tipos]);
      aplicar(M.parsear(crudo, DB.deSerie));
      setEstado(`Sincronizado ${hora()}`);
    } catch (err) {
      setEstado(`No se pudo leer la planilla: ${err.message}`, true);
      throw err;
    } finally {
      document.body.classList.remove('loading');
    }
  }

  function aplicar(datos) {
    state.datos = datos;
    state.stock = M.stockPorProducto(datos, DEPS);
    state.costos = M.costosPromedio(datos.compras);
    state.porId = new Map(datos.productos.map((p) => [p.id, p]));
    state.porNombre = new Map(datos.productos.map((p) => [p.producto.toLowerCase(), p]));
    renderListas();
    renderStock();
    renderVentas();
    renderCompras();
    itemsVenta.refrescar();
    itemsCompra.refrescar();
    renderGraficos();
  }

  const buscarProducto = (nombre) => state.porNombre.get(String(nombre).trim().toLowerCase().replace(/\s+/g, ' '));
  const stockTotal = (id) => DEPS.reduce((s, d) => s + (state.stock.get(id)?.[d] || 0), 0);

  function renderListas() {
    const { productos, ventas, compras, tipos } = state.datos;
    const opts = (arr) => arr.map((v) => `<option value="${esc(v)}"></option>`).join('');
    $('#dl-productos').innerHTML = opts(unicos(productos.map((p) => p.producto)));
    $('#dl-clientes').innerHTML = opts(unicos(ventas.map((v) => v.cliente)));
    $('#dl-proveedores').innerHTML = opts(unicos(compras.map((c) => c.proveedor)));
    $('#dl-localidades').innerHTML = opts(unicos(ventas.map((v) => v.localidad)));
    $('#dl-provincias').innerHTML = opts(unicos(ventas.map((v) => v.provincia)));
    $('#dl-cargas').innerHTML = opts(unicos(ventas.map((v) => v.carga)));
    const selTipo = $('#venta-tipo');
    const actual = selTipo.value;
    selTipo.innerHTML = tipos.map((t) => `<option ${t.tipo === actual ? 'selected' : ''}>${esc(t.tipo)}</option>`).join('');
  }

  // ---------- STOCK ----------
  function estadoStock(p, total) {
    if (total < 0) return { clase: 'low', texto: 'Negativo' };
    if (p.minimo > 0 && total < p.minimo) return { clase: 'low', texto: 'Reponer' };
    if (p.minimo > 0 && total < p.minimo * 1.5) return { clase: 'warn', texto: 'Atención' };
    if (total === 0) return { clase: 'none', texto: 'Sin stock' };
    return { clase: 'ok', texto: 'OK' };
  }

  function filasStock() {
    return state.datos.productos.map((p) => {
      const s = state.stock.get(p.id);
      const total = M.redondear(stockTotal(p.id), 3);
      const costo = state.costos.get(p.id) ?? null;
      return { ...p, s, total, costo, valor: costo !== null && total > 0 ? total * costo : null, estado: estadoStock(p, total) };
    });
  }

  function renderStock() {
    const filas = filasStock();
    $('#kpi-con-stock').textContent = filas.filter((f) => f.total > 0).length;
    const bajos = filas.filter((f) => f.minimo > 0 && f.total < f.minimo).length;
    const negs = filas.filter((f) => DEPS.some((d) => f.s[d] < 0)).length;
    $('#kpi-bajos').textContent = bajos;
    $('#kpi-bajos').classList.toggle('alert', bajos > 0);
    $('#kpi-negativos').textContent = negs;
    $('#kpi-negativos').classList.toggle('alert', negs > 0);
    $('#kpi-valor').textContent = fmtMoney(filas.reduce((s, f) => s + (f.valor || 0), 0));

    const cols = [
      ['producto', 'Producto'], ['unidad', 'Unidad'], ...DEPS.map((d) => [`dep:${d}`, d, 'num']),
      ['total', 'Total', 'num'], ['minimo', 'Mínimo', 'num'], ['estado', 'Estado'], ['costo', 'Costo prom.', 'num'], ['valor', 'Valor', 'num'],
    ];
    const { key, dir } = state.sortStock;
    $('#stock-head').innerHTML = cols.map(([k, t, c]) =>
      `<th data-sort="${k}" class="${c || ''} ${k === key ? `sorted${dir < 0 ? ' desc' : ''}` : ''}">${t}</th>`).join('');

    const q = $('#stock-buscar').value.trim().toLowerCase();
    const filtro = $('#stock-filtro').value;
    const valor = (f) => (key.startsWith('dep:') ? f.s[key.slice(4)] : key === 'estado' ? f.estado.texto : f[key]);
    const visibles = filas
      .filter((f) => !q || f.producto.toLowerCase().includes(q))
      .filter((f) => !filtro
        || (filtro === 'con' && f.total > 0)
        || (filtro === 'neg' && DEPS.some((d) => f.s[d] < 0))
        || (filtro === 'bajo' && f.minimo > 0 && f.total < f.minimo))
      .sort((a, b) => {
        const va = valor(a);
        const vb = valor(b);
        if (va === null || va === undefined) return 1;
        if (vb === null || vb === undefined) return -1;
        return (typeof va === 'string' ? va.localeCompare(vb, 'es') : va - vb) * dir;
      });

    $('#tabla-stock tbody').innerHTML = visibles.map((f) => `<tr>
      <td class="prod-name">${esc(f.producto)}</td>
      <td class="muted">${esc(f.unidad)}</td>
      ${DEPS.map((d) => `<td class="num ${f.s[d] < 0 ? 'neg' : ''}">${fmtNum(f.s[d])}</td>`).join('')}
      <td class="num strong ${f.total < 0 ? 'neg' : ''}">${fmtNum(f.total)}</td>
      <td class="num muted">${f.minimo ? fmtNum(f.minimo) : '–'}</td>
      <td><span class="badge b-${f.estado.clase}">${f.estado.texto}</span></td>
      <td class="num muted">${fmtMoney(f.costo)}</td>
      <td class="num">${fmtMoney(f.valor)}</td>
    </tr>`).join('');
    $('#stock-vacio').hidden = visibles.length > 0;

    const unidades = unicos(state.datos.productos.map((p) => p.unidad));
    if (!unidades.includes(state.unidad)) state.unidad = unidades.includes('kg') ? 'kg' : unidades[0];
    $('#tabs-unidad').innerHTML = unidades.map((u) =>
      `<button type="button" role="tab" aria-selected="${u === state.unidad}" data-u="${esc(u)}">${esc(u)}</button>`).join('');
    actualizarAjuste();
  }

  function graficoStock() {
    const items = filasStock()
      .filter((f) => f.unidad === state.unidad && f.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 12);
    const colores = [css('--c1'), css('--c2'), css('--c3')];
    const data = {
      labels: items.map((f) => f.producto),
      datasets: DEPS.map((d, i) => ({
        label: d,
        data: items.map((f) => Math.max(0, f.s[d])),
        backgroundColor: colores[i % colores.length],
        borderRadius: 4,
        barPercentage: 0.75,
      })),
    };
    $('#box-stock').style.height = `${Math.max(180, items.length * 36 + 70)}px`;
    dibujar('stock', '#graf-stock', 'bar', data, {
      indexAxis: 'y',
      plugins: {
        legend: { position: 'top', align: 'end', labels: { boxWidth: 12, color: css('--muted') } },
        tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${fmtNum(c.parsed.x)} ${state.unidad}` } },
      },
      scales: {
        x: { stacked: true, beginAtZero: true, grid: { color: css('--line') }, border: { display: false }, ticks: { color: css('--muted') } },
        y: { stacked: true, grid: { display: false }, border: { display: false }, ticks: { color: css('--ink'), font: { size: 12 } } },
      },
    });
  }

  function actualizarAjuste() {
    const f = $('#form-ajuste');
    const p = buscarProducto(f.producto.value);
    $('[data-unidad]', f).textContent = p ? p.unidad : '';
    const cant = Number(f.cantidad.value);
    let txt = '';
    if (p && cant) {
      const antes = state.stock.get(p.id)?.[f.deposito.value] || 0;
      txt = `Stock en ${esc(f.deposito.value)}: ${fmtNum(antes)} → <strong>${fmtNum(M.redondear(antes + cant, 3))} ${esc(p.unidad)}</strong>`;
    } else if (f.producto.value && !p) {
      txt = 'No existe ese producto.';
    }
    $('#ajuste-preview').innerHTML = txt;
  }

  async function enviarAjuste(e) {
    e.preventDefault();
    const f = e.target;
    const p = buscarProducto(f.producto.value);
    const cantidad = Number(f.cantidad.value);
    const motivo = f.motivo.value.trim();
    const error = !p ? 'Elegí un producto de la lista.' : !cantidad ? 'Ingresá una cantidad distinta de 0.' : !motivo ? 'Indicá el motivo.' : null;
    if (error) return setMsg(f, error, 'err');
    await guardar(f, async () => {
      await DB.agregarFilas('Ajustes', [M.filas.ajuste({ fecha: new Date(), deposito: f.deposito.value, id: p.id, producto: p.producto, cantidad, motivo })]);
      f.cantidad.value = '';
      f.motivo.value = '';
      return `✓ Ajuste registrado: ${cantidad > 0 ? '+' : ''}${fmtNum(cantidad)} ${p.unidad} de ${p.producto}.`;
    });
  }

  // Envuelve un guardado: deshabilita el botón, muestra el resultado y vuelve a leer la planilla.
  async function guardar(form, fn) {
    const btn = $('button[type="submit"]', form);
    const texto = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Guardando…';
    setMsg(form, '');
    try {
      const ok = await fn();
      setMsg(form, ok, 'ok');
      await cargar().catch(() => {});
    } catch (err) {
      setMsg(form, `No se guardó: ${err.message}`, 'err');
    } finally {
      btn.disabled = false;
      btn.textContent = texto;
    }
  }

  // ---------- Líneas de productos (ventas y compras) ----------
  function crearItems(contenedor, { tipo, form, alCambiar }) {
    let lista = [];
    const vacio = () => ({ producto: '', cantidad: '', precio: '', unidad: 'kg' });

    function ultimoPrecio(id) {
      const fuente = tipo === 'venta' ? state.datos.ventas : state.datos.compras;
      for (let i = fuente.length - 1; i >= 0; i--) if (fuente[i].id === id && fuente[i].precio) return fuente[i].precio;
      return null;
    }

    function render() {
      contenedor.innerHTML = lista.map((it, i) => `
        <div class="item" data-i="${i}">
          <input class="item-prod" data-campo="producto" list="dl-productos" autocomplete="off" placeholder="Producto" value="${esc(it.producto)}" aria-label="Producto">
          <span class="affix"><input data-campo="cantidad" type="number" min="0" step="any" inputmode="decimal" placeholder="Cant." value="${esc(it.cantidad)}" aria-label="Cantidad"><span class="affix-txt" data-u></span></span>
          <span class="affix affix-pre"><span class="affix-txt">$</span><input data-campo="precio" type="number" min="0" step="any" inputmode="decimal" placeholder="Precio unit." value="${esc(it.precio)}" aria-label="Precio unitario"></span>
          <button type="button" class="btn-x" data-quitar title="Quitar" ${lista.length === 1 ? 'hidden' : ''}>×</button>
          <div class="item-info"></div>
        </div>`).join('');
      lista.forEach((_, i) => info(i));
      alCambiar();
    }

    function info(i) {
      const it = lista[i];
      const fila = $(`.item[data-i="${i}"]`, contenedor);
      if (!fila || !state.datos) return;
      const p = buscarProducto(it.producto);
      const el = $('.item-info', fila);
      $('[data-u]', fila).textContent = p ? p.unidad : (tipo === 'compra' && it.producto ? it.unidad : '');
      if (!it.producto) { el.innerHTML = ''; return; }
      if (!p) {
        el.innerHTML = tipo === 'venta'
          ? '<span class="err">No existe ese producto.</span>'
          : `<span class="warn">Producto nuevo.</span> Unidad:
             <select data-campo="unidad" aria-label="Unidad del producto nuevo">
               ${['kg', 'unid.'].map((u) => `<option ${u === it.unidad ? 'selected' : ''}>${u}</option>`).join('')}
             </select>`;
        return;
      }
      const dep = form.deposito.value;
      const disp = state.stock.get(p.id)?.[dep] || 0;
      const costo = state.costos.get(p.id);
      const cant = Number(it.cantidad) || 0;
      if (tipo === 'venta') {
        const falta = cant > disp;
        el.innerHTML = `<span class="${falta ? 'warn' : ''}">Stock en ${esc(dep)}: ${fmtNum(disp)} ${esc(p.unidad)}${falta ? ' — queda negativo' : ''}</span>
          · Costo prom. ${costo !== undefined ? fmtMoney(costo) : 'sin datos'}`;
      } else {
        el.innerHTML = `Stock en ${esc(dep)}: ${fmtNum(disp)} → ${fmtNum(M.redondear(disp + cant, 3))} ${esc(p.unidad)}`;
      }
    }

    contenedor.addEventListener('input', (e) => {
      const campo = e.target.dataset.campo;
      if (!campo) return;
      const i = Number(e.target.closest('.item').dataset.i);
      lista[i][campo] = e.target.value;
      if (campo === 'producto') {
        const p = buscarProducto(e.target.value);
        if (p && !lista[i].precio) {
          const precio = ultimoPrecio(p.id);
          if (precio) {
            lista[i].precio = String(precio);
            $(`.item[data-i="${i}"] [data-campo="precio"]`, contenedor).value = precio;
          }
        }
      }
      info(i);
      alCambiar();
    });
    contenedor.addEventListener('change', (e) => {
      if (e.target.dataset.campo === 'unidad') lista[Number(e.target.closest('.item').dataset.i)].unidad = e.target.value;
    });
    contenedor.addEventListener('click', (e) => {
      if (!e.target.matches('[data-quitar]')) return;
      lista.splice(Number(e.target.closest('.item').dataset.i), 1);
      render();
    });
    $('[data-agregar]', form).addEventListener('click', () => {
      lista.push(vacio());
      render();
      $$('.item-prod', contenedor).at(-1).focus();
    });

    lista = [vacio()];
    render();
    return {
      lista: () => lista,
      reiniciar: () => { lista = [vacio()]; render(); },
      refrescar: () => { lista.forEach((_, i) => info(i)); alCambiar(); },
    };
  }

  // ---------- VENTAS ----------
  const formVenta = $('#form-venta');
  const itemsVenta = crearItems($('#venta-items'), { tipo: 'venta', form: formVenta, alCambiar: resumenVenta });

  function comisionDeTipo(tipo) {
    return state.datos?.tipos.find((t) => t.tipo === tipo)?.comision ?? 0;
  }

  function lineasVenta() {
    const pct = Number(formVenta.comision.value) || 0;
    return itemsVenta.lista().map((it) => {
      const p = buscarProducto(it.producto);
      const cantidad = Number(it.cantidad);
      const precio = Number(it.precio);
      const costo = p ? (state.costos.get(p.id) ?? null) : null;
      return { p, cantidad, precio, costo, ...(p && cantidad > 0 ? M.lineaVenta({ cantidad, precio, comisionPct: pct, costo }) : {}) };
    });
  }

  function resumenVenta() {
    if (!state.datos) return;
    const lineas = lineasVenta().filter((l) => l.p && l.cantidad > 0);
    if (!lineas.length) { $('#venta-resumen').innerHTML = ''; return; }
    const suma = (k) => lineas.reduce((s, l) => s + (l[k] || 0), 0);
    const sinCosto = lineas.some((l) => l.ganancia === null);
    $('#venta-resumen').innerHTML = `
      <div><span>Importe</span><strong>${fmtMoney(suma('importe'))}</strong></div>
      <div><span>Comisión</span><strong>${fmtMoney(suma('comision'))}</strong></div>
      <div><span>Ganancia${sinCosto ? '*' : ''}</span><strong>${fmtMoney(suma('ganancia'))}</strong></div>
      ${sinCosto ? '<p class="hint">* Hay productos sin costo de compra: su ganancia no se calcula.</p>' : ''}`;
  }

  function autocompletarCliente() {
    const nombre = formVenta.cliente.value.trim().toLowerCase();
    const ultima = [...state.datos.ventas].reverse().find((v) => v.cliente.toLowerCase() === nombre);
    if (!ultima) return;
    if ([...formVenta.tipo.options].some((o) => o.value === ultima.tipo)) formVenta.tipo.value = ultima.tipo;
    formVenta.comision.value = comisionDeTipo(formVenta.tipo.value);
    formVenta.localidad.value = ultima.localidad;
    formVenta.provincia.value = ultima.provincia;
    if (!formVenta.carga.value) formVenta.carga.value = ultima.carga;
    resumenVenta();
  }

  async function enviarVenta(e) {
    e.preventDefault();
    const f = formVenta;
    const lineas = lineasVenta();
    const cliente = f.cliente.value.trim();
    const error = !f.fecha.value ? 'Elegí la fecha.'
      : !cliente ? 'Ingresá el cliente.'
      : lineas.some((l) => !l.p) ? 'Hay productos que no existen en la lista.'
      : lineas.some((l) => !(l.cantidad > 0)) ? 'Todas las cantidades tienen que ser mayores a 0.'
      : itemsVenta.lista().some((it) => it.precio === '' || !(Number(it.precio) >= 0)) ? 'Falta el precio de algún producto.'
      : null;
    if (error) return setMsg(f, error, 'err');

    const base = {
      fecha: deISO(f.fecha.value), deposito: f.deposito.value, cliente, tipo: f.tipo.value,
      localidad: f.localidad.value.trim(), provincia: f.provincia.value.trim(), carga: f.carga.value.trim(), nota: f.nota.value.trim(),
    };
    await guardar(f, async () => {
      await DB.agregarFilas('Ventas', lineas.map((l) => M.filas.venta({
        ...base, id: l.p.id, producto: l.p.producto, cantidad: l.cantidad, precio: l.precio,
        importe: l.importe, comision: l.comision, costo: l.costo, ganancia: l.ganancia,
      })));
      const total = lineas.reduce((s, l) => s + l.importe, 0);
      itemsVenta.reiniciar();
      f.cliente.value = '';
      f.nota.value = '';
      return `✓ Venta a ${cliente} registrada (${lineas.length} producto${lineas.length > 1 ? 's' : ''}, ${fmtMoney(total)}).`;
    });
  }

  function opcionesMes(sel, fechas, actual) {
    // Por defecto: el mes actual si tiene movimientos; si no, el último mes con datos.
    const conDatos = unicos(fechas.filter(Boolean).map(M.claveMes)).reverse();
    const hoy = M.claveMes(new Date());
    const meses = conDatos.includes(hoy) ? conDatos : [hoy, ...conDatos];
    const elegido = meses.includes(actual) ? actual : (conDatos.includes(hoy) || !conDatos.length ? hoy : conDatos[0]);
    sel.innerHTML = meses.map((m) => `<option value="${m}" ${m === elegido ? 'selected' : ''}>${fmtMes(m)}</option>`).join('');
    return elegido;
  }

  function renderVentas() {
    const { ventas } = state.datos;
    state.mesVentas = opcionesMes($('#ventas-mes'), ventas.map((v) => v.fecha), state.mesVentas);
    const delMes = ventas.filter((v) => v.fecha && M.claveMes(v.fecha) === state.mesVentas);
    const suma = (k) => delMes.reduce((s, v) => s + (v[k] || 0), 0);
    $('#kpi-vendido').textContent = fmtMoney(suma('importe'));
    $('#kpi-ganancia').textContent = fmtMoney(suma('ganancia'));
    $('#kpi-comisiones').textContent = fmtMoney(suma('comision'));
    $('#kpi-clientes').textContent = new Set(delMes.map((v) => v.cliente)).size;

    const q = $('#ventas-buscar').value.trim().toLowerCase();
    const filas = delMes
      .filter((v) => !q || v.cliente.toLowerCase().includes(q) || v.producto.toLowerCase().includes(q))
      .sort((a, b) => b.fecha - a.fecha);
    $('#tabla-ventas tbody').innerHTML = filas.map((v) => `<tr>
      <td class="muted">${fmtFecha(v.fecha)}</td>
      <td>${esc(v.cliente)}${v.nota ? `<div class="prod-pres">${esc(v.nota)}</div>` : ''}</td>
      <td>${esc(v.producto)}</td>
      <td class="num">${fmtNum(v.cantidad)}</td>
      <td class="num">${fmtMoney(v.precio)}</td>
      <td class="num strong">${fmtMoney(v.importe)}</td>
      <td class="num muted">${v.comision ? fmtMoney(v.comision) : '–'}</td>
      <td class="num ${v.ganancia < 0 ? 'neg' : ''}">${fmtMoney(v.ganancia)}</td>
      <td class="muted">${esc(v.deposito)}</td>
    </tr>`).join('');
    $('#ventas-vacio').hidden = filas.length > 0;
  }

  function graficoVentas() {
    const meses = M.ventasPorMes(state.datos.ventas).slice(-12);
    dibujar('ventas', '#graf-ventas', 'bar', {
      labels: meses.map((m) => fmtMes(m.mes).replace(/ de /, ' ')),
      datasets: [
        { label: 'Vendido', data: meses.map((m) => Math.round(m.importe)), backgroundColor: css('--c1'), borderRadius: 4 },
        { label: 'Ganancia', data: meses.map((m) => Math.round(m.ganancia)), backgroundColor: css('--c2'), borderRadius: 4 },
      ],
    }, {
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${fmtMoney(c.parsed.y)}` } } },
      scales: {
        x: { grid: { display: false }, border: { display: false }, ticks: { color: css('--muted') } },
        y: {
          beginAtZero: true, grid: { color: css('--line') }, border: { display: false },
          ticks: { color: css('--muted'), callback: (v) => `$${(v / 1e6).toLocaleString('es-AR', { maximumFractionDigits: 1 })} M` },
        },
      },
    });
  }

  // ---------- COMPRAS ----------
  const formCompra = $('#form-compra');
  const itemsCompra = crearItems($('#compra-items'), { tipo: 'compra', form: formCompra, alCambiar: resumenCompra });

  function resumenCompra() {
    if (!state.datos) return;
    const its = itemsCompra.lista().filter((it) => it.producto && Number(it.cantidad) > 0);
    if (!its.length) { $('#compra-resumen').innerHTML = ''; return; }
    const total = its.reduce((s, it) => s + Number(it.cantidad) * (Number(it.precio) || 0), 0);
    const nuevos = its.filter((it) => !buscarProducto(it.producto)).length;
    $('#compra-resumen').innerHTML = `
      <div><span>Total</span><strong>${fmtMoney(total)}</strong></div>
      ${nuevos ? `<div><span>Productos nuevos</span><strong>${nuevos}</strong></div>` : ''}`;
  }

  async function enviarCompra(e) {
    e.preventDefault();
    const f = formCompra;
    const its = itemsCompra.lista();
    const proveedor = f.proveedor.value.trim();
    const error = !f.fecha.value ? 'Elegí la fecha.'
      : !proveedor ? 'Ingresá el proveedor.'
      : its.some((it) => !it.producto.trim()) ? 'Falta el nombre de algún producto.'
      : its.some((it) => !(Number(it.cantidad) > 0)) ? 'Todas las cantidades tienen que ser mayores a 0.'
      : its.some((it) => it.precio !== '' && !(Number(it.precio) >= 0)) ? 'Hay un precio inválido.'
      : null;
    if (error) return setMsg(f, error, 'err');

    await guardar(f, async () => {
      // Productos nuevos: se agregan a la hoja Productos y se les copian las fórmulas de stock.
      const nuevos = [];
      let sigId = M.siguienteId(state.datos.productos);
      const resolver = (it) => {
        const nombre = it.producto.trim().replace(/\s+/g, ' ');
        const existente = buscarProducto(nombre) || nuevos.find((n) => n.producto.toLowerCase() === nombre.toLowerCase());
        if (existente) return existente;
        const p = { id: sigId, producto: nombre, unidad: it.unidad || 'kg', minimo: null };
        sigId = `P${String(Number(sigId.slice(1)) + 1).padStart(3, '0')}`;
        nuevos.push(p);
        return p;
      };
      const lineas = its.map((it) => ({ p: resolver(it), cantidad: Number(it.cantidad), precio: it.precio === '' ? null : Number(it.precio) }));

      if (nuevos.length) {
        const upd = await DB.agregarFilas('Productos', nuevos.map(M.filas.producto));
        const fila = Number(upd.updatedRange.split('!')[1].match(/\d+/)[0]) - 1;
        const hoja = state.info.sheets.find((s) => s.properties.title === 'Productos');
        if (hoja) await DB.extenderFormulasProductos(hoja.properties.sheetId, fila, nuevos.length, M.PRODUCTOS_COL_STOCK, M.PRODUCTOS_COL_STOCK + DEPS.length);
      }
      await DB.agregarFilas('Compras', lineas.map((l) => M.filas.compra({
        fecha: deISO(f.fecha.value), deposito: f.deposito.value, proveedor, id: l.p.id, producto: l.p.producto,
        cantidad: l.cantidad, precio: l.precio, remito: f.remito.value.trim(), nota: f.nota.value.trim(),
      })));
      itemsCompra.reiniciar();
      f.remito.value = '';
      f.nota.value = '';
      return `✓ Compra a ${proveedor} registrada (${lineas.length} producto${lineas.length > 1 ? 's' : ''}${nuevos.length ? `, ${nuevos.length} nuevo${nuevos.length > 1 ? 's' : ''}` : ''}).`;
    });
  }

  function renderCompras() {
    const { compras } = state.datos;
    state.mesCompras = opcionesMes($('#compras-mes'), compras.map((c) => c.fecha), state.mesCompras);
    const delMes = compras.filter((c) => c.fecha && M.claveMes(c.fecha) === state.mesCompras);
    $('#kpi-comprado').textContent = fmtMoney(delMes.reduce((s, c) => s + (c.importe || 0), 0));
    $('#kpi-lineas-compra').textContent = delMes.length;
    $('#kpi-proveedores').textContent = new Set(delMes.map((c) => c.proveedor)).size;

    const q = $('#compras-buscar').value.trim().toLowerCase();
    const filas = delMes
      .filter((c) => !q || c.proveedor.toLowerCase().includes(q) || c.producto.toLowerCase().includes(q))
      .sort((a, b) => b.fecha - a.fecha);
    $('#tabla-compras tbody').innerHTML = filas.map((c) => `<tr>
      <td class="muted">${fmtFecha(c.fecha)}</td>
      <td>${esc(c.proveedor)}${c.remito ? `<div class="prod-pres">Remito ${esc(c.remito)}</div>` : ''}</td>
      <td>${esc(c.producto)}</td>
      <td class="num">${fmtNum(c.cantidad)}</td>
      <td class="num">${fmtMoney(c.precio)}</td>
      <td class="num strong">${fmtMoney(c.importe)}</td>
      <td class="muted">${esc(c.deposito)}</td>
    </tr>`).join('');
    $('#compras-vacio').hidden = filas.length > 0;
  }

  // ---------- Gráficos ----------
  function dibujar(clave, canvas, type, data, options) {
    const opts = { responsive: true, maintainAspectRatio: false, animation: { duration: 400 }, ...options };
    if (charts[clave]) {
      charts[clave].data = data;
      charts[clave].options = opts;
      charts[clave].update();
    } else {
      charts[clave] = new Chart($(canvas), { type, data, options: opts });
    }
  }

  function renderGraficos() {
    if (!window.Chart || !state.datos) return;
    if (state.vista === 'stock' && !$('#vista-stock').hidden) graficoStock();
    if (state.vista === 'ventas' && !$('#vista-ventas').hidden) graficoVentas();
  }

  // ---------- Eventos ----------
  $('#btn-login').addEventListener('click', ingresar);
  $('#btn-reintentar').addEventListener('click', reintentarAcceso);
  $('#btn-otra-cuenta').addEventListener('click', salir);
  $('#btn-salir').addEventListener('click', salir);
  $('#btn-reconectar').addEventListener('click', reconectar);
  $('#btn-refrescar').addEventListener('click', () => cargar().catch(() => {}));
  $('#nav').addEventListener('click', (e) => { const v = e.target.closest('button')?.dataset.vista; if (v) irA(v); });

  $('#stock-buscar').addEventListener('input', renderStock);
  $('#stock-filtro').addEventListener('change', renderStock);
  $('#tabla-stock thead').addEventListener('click', (e) => {
    const key = e.target.closest('th')?.dataset.sort;
    if (!key) return;
    state.sortStock = { key, dir: state.sortStock.key === key ? -state.sortStock.dir : 1 };
    renderStock();
  });
  $('#tabs-unidad').addEventListener('click', (e) => {
    const u = e.target.closest('button')?.dataset.u;
    if (!u) return;
    state.unidad = u;
    $$('#tabs-unidad button').forEach((b) => b.setAttribute('aria-selected', b.dataset.u === u));
    graficoStock();
  });
  $('#form-ajuste').addEventListener('input', actualizarAjuste);
  $('#form-ajuste').addEventListener('submit', enviarAjuste);

  formVenta.addEventListener('submit', enviarVenta);
  formVenta.cliente.addEventListener('change', autocompletarCliente);
  formVenta.tipo.addEventListener('change', () => { formVenta.comision.value = comisionDeTipo(formVenta.tipo.value); resumenVenta(); });
  formVenta.comision.addEventListener('input', resumenVenta);
  formVenta.deposito.addEventListener('change', () => itemsVenta.refrescar());
  $('#ventas-mes').addEventListener('change', (e) => { state.mesVentas = e.target.value; renderVentas(); });
  $('#ventas-buscar').addEventListener('input', renderVentas);

  formCompra.addEventListener('submit', enviarCompra);
  formCompra.deposito.addEventListener('change', () => itemsCompra.refrescar());
  $('#compras-mes').addEventListener('change', (e) => { state.mesCompras = e.target.value; renderCompras(); });
  $('#compras-buscar').addEventListener('input', renderCompras);

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', renderGraficos);

  // ---------- Inicio ----------
  $$('.sel-deposito').forEach((s) => { s.innerHTML = DEPS.map((d) => `<option>${esc(d)}</option>`).join(''); });
  $$('input[type="date"]').forEach((i) => { i.value = hoyISO(); });
  const hash = location.hash.slice(1);
  if (['stock', 'ventas', 'compras'].includes(hash)) state.vista = hash;
  $$('#nav button').forEach((b) => b.toggleAttribute('aria-current', b.dataset.vista === state.vista));

  const faltan = ['CLIENT_ID', 'SPREADSHEET_ID'].filter((k) => !CFG[k]);
  if (faltan.length) {
    mostrar('pantalla-config');
  } else {
    mostrar('pantalla-login');
    $('#btn-login').disabled = true;
    DB.init(CFG, { onSesionVencida: () => { $('#banner-sesion').hidden = false; } })
      .then(() => { $('#btn-login').disabled = false; })
      .catch((err) => { $('#login-msg').textContent = err.message; });
  }
})();
