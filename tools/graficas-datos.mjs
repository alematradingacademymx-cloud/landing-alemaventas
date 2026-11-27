// ALEMA Gráficas · descarga velas reales (Yahoo Finanzas) y las junta con las ya guardadas.
// Uso: node tools/graficas-datos.mjs <carpeta>   (la corre la tarea "ALEMA Gráficas (velas)" de GitHub)
// Archivos: <carpeta>/<SIMBOLO>_<tf>.json  →  { s, tf, d, act, t0, k } donde k es compacto (enteros, por diferencias):
//   cada vela = [minutos desde la anterior, apertura−cierre anterior, máximo−apertura, apertura−mínimo, cierre−apertura, volumen]
//   en "ticks" de 10^-d. Así cada archivo pesa ~3 veces menos que con precios completos.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const DIR = process.argv[2] || "datos";
fs.mkdirSync(DIR, { recursive: true });

// símbolo ALEMA → símbolo Yahoo, decimales y horario (fx: sesión de 17:00 Nueva York · bolsa: 9:30 Nueva York · cripto: UTC)
const ACTIVOS = [
  ["EURUSD", "EURUSD=X", 5, "fx"], ["GBPUSD", "GBPUSD=X", 5, "fx"], ["USDJPY", "JPY=X", 3, "fx"], ["USDCHF", "CHF=X", 5, "fx"],
  ["AUDUSD", "AUDUSD=X", 5, "fx"], ["USDCAD", "CAD=X", 5, "fx"], ["NZDUSD", "NZDUSD=X", 5, "fx"], ["EURJPY", "EURJPY=X", 3, "fx"],
  ["GBPJPY", "GBPJPY=X", 3, "fx"], ["USDMXN", "MXN=X", 4, "fx"],
  ["US500", "^GSPC", 2, "bolsa"], ["US100", "^NDX", 2, "bolsa"], ["US30", "^DJI", 2, "bolsa"], ["GER40", "^GDAXI", 2, "utc"], ["JP225", "^N225", 2, "utc"],
  ["XAUUSD", "GC=F", 2, "fx"], ["XAGUSD", "SI=F", 3, "fx"], ["USOIL", "CL=F", 2, "fx"], ["UKOIL", "BZ=F", 2, "fx"], ["NATGAS", "NG=F", 3, "fx"],
  ["BTCUSD", "BTC-USD", 1, "utc"], ["ETHUSD", "ETH-USD", 2, "utc"], ["SOLUSD", "SOL-USD", 2, "utc"], ["XRPUSD", "XRP-USD", 4, "utc"],
  ["AAPL", "AAPL", 2, "bolsa"], ["NVDA", "NVDA", 2, "bolsa"], ["TSLA", "TSLA", 2, "bolsa"], ["MSFT", "MSFT", 2, "bolsa"],
  ["AMZN", "AMZN", 2, "bolsa"], ["META", "META", 2, "bolsa"], ["GOOGL", "GOOGL", 2, "bolsa"],
];
// temporalidades que se descargan (las demás se arman: 45m con 15m y 4h con 1h). max = velas que se guardan como máximo.
const BAJAR = [
  { tf: "1", y: "1m", dias: 29, trozo: 7, max: 60000 },
  { tf: "5", y: "5m", dias: 59, trozo: 59, max: 60000 },
  { tf: "15", y: "15m", dias: 59, trozo: 59, max: 40000 },
  { tf: "60", y: "60m", dias: 729, trozo: 729, max: 40000 },
];
const ARMAR = [{ tf: "45", de: "15", min: 45, max: 20000 }, { tf: "240", de: "60", min: 240, max: 12000 }];
// diario y semanal: Yahoo da todo el historial (décadas)
const LARGOS = [{ tf: "D", y: "1d", max: 20000 }, { tf: "W", y: "1wk", max: 5000 }];

const espera = ms => new Promise(r => setTimeout(r, ms));
function leer(f) { try { const j = JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8")), e = 10 ** j.d, out = []; let t = j.t0, pc = null;
    for (const [dt, a, b, c, x, v] of j.k) { t += dt * 60; const o = (pc === null ? a : pc + a); out.push([t, o / e, (o + b) / e, (o - c) / e, (o + x) / e, v]); pc = o + x; } return out; } catch { return []; } }
function escribir(s, tf, velas, d) {
  const e = 10 ** d; let pc = null, tp = velas.length ? velas[0][0] : 0; const k = [];
  for (const [t, o, h, l, c, v] of velas) { const O = Math.round(o * e), H = Math.round(h * e), L = Math.round(l * e), C = Math.round(c * e);
    k.push([Math.round((t - tp) / 60), pc === null ? O : O - pc, Math.max(0, H - O), Math.max(0, O - L), C - O, Math.round(v)]); pc = C; tp = t; }
  fs.writeFileSync(path.join(DIR, `${s}_${tf}.json`), JSON.stringify({ s, tf, d, act: Math.floor(Date.now() / 1000), t0: velas.length ? velas[0][0] : 0, k })); }

async function yahoo(sym, intervalo, desde, hasta, rango) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=${intervalo}&` + (rango ? `range=${rango}` : `period1=${desde}&period2=${hasta}`) + `&includePrePost=false`;
  for (let intento = 0; intento < 3; intento++) {
    try {
      const r = await fetch(intento === 1 ? url.replace("query1", "query2") : url, { headers: { "User-Agent": "Mozilla/5.0 (ALEMA Graficas)" }, signal: AbortSignal.timeout(20000) });
      if (r.status === 429) { await espera(4000 * (intento + 1)); continue; }
      const j = await r.json(), res = j && j.chart && j.chart.result && j.chart.result[0];
      if (!res || !res.timestamp) return [];
      const q = res.indicators.quote[0], out = [];
      res.timestamp.forEach((t, i) => { const o = q.open[i], h = q.high[i], l = q.low[i], c = q.close[i];
        if ([o, h, l, c].every(v => v != null && isFinite(v) && v > 0)) out.push([t, o, Math.max(h, o, c), Math.min(l, o, c), c, q.volume && q.volume[i] || 0]); });
      return out;
    } catch (e) { await espera(2000); }
  }
  return [];
}
const redondear = (v, d) => +v.toFixed(d + 1);
function juntar(viejas, nuevas, d, max) {
  const m = new Map(viejas.map(v => [v[0], v]));
  nuevas.forEach(v => m.set(v[0], [v[0], redondear(v[1], d), redondear(v[2], d), redondear(v[3], d), redondear(v[4], d), Math.round(v[5])]));
  const todo = [...m.values()].sort((a, b) => a[0] - b[0]);
  return todo.length > max ? todo.slice(todo.length - max) : todo;
}
// Hora de Nueva York (para que 45m y 4h empiecen donde empiezan en TradingView)
const fmtNY = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
function desfaseNY(t) { const p = Object.fromEntries(fmtNY.formatToParts(new Date(t * 1000)).map(x => [x.type, x.value])); return (Date.UTC(+p.year, p.month - 1, +p.day, +p.hour, +p.minute) / 1000) - t; }
function armar(base, minutos, horario, d) {
  const L = minutos * 60, out = []; let cur = null;
  for (const [t, o, h, l, c, v] of base) {
    const ny = horario === "utc" ? 0 : desfaseNY(t), ancla = horario === "fx" ? 7 * 3600 : horario === "bolsa" ? -(9 * 3600 + 1800) : 0; // fx: día empieza 17:00 NY · bolsa: 9:30 NY
    const local = t + ny + ancla, dia = Math.floor(local / 86400), k = dia * 86400 + Math.floor((local - dia * 86400) / L) * L - ny - ancla;
    if (!cur || cur[0] !== k) { if (cur) out.push(cur); cur = [k, o, h, l, c, v]; } else { cur[2] = Math.max(cur[2], h); cur[3] = Math.min(cur[3], l); cur[4] = c; cur[5] += v; }
  }
  if (cur) out.push(cur);
  return out.map(x => [x[0], redondear(x[1], d), redondear(x[2], d), redondear(x[3], d), redondear(x[4], d), x[5]]);
}

const ahora = Math.floor(Date.now() / 1000), resumen = [];
for (const [s, sym, d, horario] of ACTIVOS) {
  const fila = [s];
  for (const b of BAJAR) {
    const viejas = leer(`${s}_${b.tf}.json`);
    // primera vez: todo el periodo disponible; después solo los últimos días (con margen)
    const dias = viejas.length ? Math.min(b.dias, b.tf === "60" ? 10 : 6) : b.dias;
    let nuevas = [];
    for (let fin = ahora; fin > ahora - dias * 86400; fin -= b.trozo * 86400) {
      const ini = Math.max(ahora - dias * 86400, fin - b.trozo * 86400);
      nuevas = nuevas.concat(await yahoo(sym, b.y, ini, fin)); await espera(350);
    }
    const velas = juntar(viejas, nuevas, d, b.max);
    if (velas.length) escribir(s, b.tf, velas, d);
    fila.push(`${b.tf}:${velas.length}(+${nuevas.length})`);
  }
  for (const a of ARMAR) { const base = leer(`${s}_${a.de}.json`); if (!base.length) continue; const v = armar(base, a.min, horario, d); escribir(s, a.tf, v.slice(-a.max), d); fila.push(`${a.tf}:${v.length}`); }
  for (const g of LARGOS) {
    try {
      const viejas = leer(`${s}_${g.tf}.json`);
      const nuevas = await yahoo(sym, g.y, 0, 0, viejas.length ? (g.tf === "D" ? "3mo" : "1y") : "max"); await espera(350);
      // Yahoo marca la vela del día/semana en curso con la hora actual: se alinea con las anteriores para no duplicarla
      const norm = nuevas.map(v => v.slice()), paso = g.tf === "D" ? 86400 : 604800, n = norm.length;
      if (n > 1) { const p = norm[n - 2][0], dt = norm[n - 1][0] - p; if (dt % paso) norm[n - 1][0] = p + Math.max(1, Math.floor(dt / paso)) * paso; }
      const velas = juntar(viejas.filter(v => !norm.length || v[0] < norm[0][0]), norm, d, g.max);
      if (velas.length) escribir(s, g.tf, velas, d);
      fila.push(`${g.tf}:${velas.length}`);
    } catch (e) { fila.push(`${g.tf}:error`); }
  }
  resumen.push(fila.join("  ")); console.log(fila.join("  "));
}
await pruebaDukascopy();
fs.writeFileSync(path.join(DIR, "indice.json"), JSON.stringify({ act: ahora, activos: ACTIVOS.map(a => a[0]) }));
fs.writeFileSync(path.join(DIR, "README.md"), "Velas de ALEMA Gráficas (Yahoo Finanzas). Esta rama la reescribe la tarea automática; no la edites a mano.\n");
console.log(`Listo · ${resumen.length} activos`);

/* ---------- PRUEBA Dukascopy (volumen de ticks + historial largo) ----------
   Solo genera archivos "prueba_*.json" para revisarlos; la página todavía no los usa. Corre una sola vez (si ya existe prueba_resumen.json no repite). */
async function duka(instr, ruta) {
  for (let i = 0; i < 3; i++) {
    try {
      if (Date.now() > LIMITE_DUKA) return null;
      const r = await fetch(`https://datafeed.dukascopy.com/datafeed/${instr}/${ruta}`, { headers: { "User-Agent": "Mozilla/5.0 (ALEMA Graficas)" }, signal: AbortSignal.timeout(15000) });
      if (r.status === 404) return Buffer.alloc(0);
      if (!r.ok) { await espera(1500 * (i + 1)); continue; }
      const b = Buffer.from(await r.arrayBuffer()); if (!b.length) return b;
      return execFileSync("xz", ["--format=lzma", "-dc"], { input: b, maxBuffer: 64 << 20 });
    } catch (e) { await espera(1500 * (i + 1)); }
  }
  return null;
}
// registros de 24 bytes: segundos desde el inicio del archivo, apertura, cierre, mínimo, máximo (enteros) y volumen (decimal)
function leerDuka(raw, base) { const out = []; for (let i = 0; i + 24 <= raw.length; i += 24) out.push([base + raw.readUInt32BE(i), raw.readUInt32BE(i + 4), raw.readUInt32BE(i + 16), raw.readUInt32BE(i + 12), raw.readUInt32BE(i + 8), raw.readFloatBE(i + 20)]); return out; }
function dd(n) { return String(n).padStart(2, "0"); }
var LIMITE_DUKA = Infinity;
// baja varios archivos a la vez (8 en paralelo) y devuelve las velas ordenadas
async function bajarVarios(instr, lista) {
  const res = new Array(lista.length); let i = 0;
  await Promise.all(Array.from({ length: 8 }, async () => { while (i < lista.length) { const k = i++, [ruta, base] = lista[k]; const raw = await duka(instr, ruta); res[k] = raw && raw.length ? leerDuka(raw, base) : []; } }));
  return res.flat();
}
async function pruebaDukascopy() {
  try { if (!fs.readFileSync(path.join(DIR, "prueba_resumen.json"), "utf8").includes("error")) return; } catch {}
  LIMITE_DUKA = Date.now() + 10 * 60000; // como máximo 10 minutos para la prueba
  const PRUEBAS = [["EURUSD", "EURUSD", 5], ["GER40", "DEUIDXEUR", 2], ["NVDA", "NVDAUSUSD", 2]], res = {};
  for (const [s, instr, d] of PRUEBAS) {
    const r = res[s] = { instr };
    try {
      const ref = leer(`${s}_60.json`), refC = ref.length ? ref[ref.length - 1][4] : null;
      // 1 hora: un archivo por mes desde 2012
      const lh = [];
      for (let y = 2012; y <= new Date().getUTCFullYear(); y++) for (let m = 0; m < 12; m++) { const base = Date.UTC(y, m, 1) / 1000; if (base <= ahora) lh.push([`${y}/${dd(m)}/BID_candles_hour_1.bi5`, base]); }
      const h1 = await bajarVarios(instr, lh);
      // 1 minuto: un archivo por día, últimos 30 días
      const lm = [];
      for (let k = 30; k >= 0; k--) { const t = new Date((ahora - k * 86400) * 1000), base = Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()) / 1000;
        lm.push([`${t.getUTCFullYear()}/${dd(t.getUTCMonth())}/${dd(t.getUTCDate())}/BID_candles_min_1.bi5`, base]); }
      const m1 = await bajarVarios(instr, lm);
      // escala de precio: la potencia de 10 que más se acerca al último cierre de Yahoo
      const ultimo = (h1.length ? h1 : m1).slice(-1)[0];
      const esc = ultimo && refC ? 10 ** Math.round(Math.log10(ultimo[4] / refC)) : 10 ** d;
      const conv = arr => arr.filter(v => v[5] > 0 || v[1] !== v[4]).map(([t, o, h, l, c, v]) => [t, o / esc, h / esc, l / esc, c / esc, Math.round(v * 1000)]);
      const H1 = conv(h1), M1 = conv(m1);
      if (H1.length) escribir(`prueba_${s}`, "60", H1, d);
      if (M1.length) escribir(`prueba_${s}`, "1", M1, d);
      Object.assign(r, { completo: Date.now() <= LIMITE_DUKA, escala: esc, refYahoo: refC, ultimoDuka: ultimo ? ultimo[4] / esc : null,
        h1: H1.length, h1Desde: H1.length ? new Date(H1[0][0] * 1000).toISOString() : null, h1ConVolumen: H1.length ? Math.round(100 * H1.filter(v => v[5] > 0).length / H1.length) : 0,
        m1: M1.length, m1ConVolumen: M1.length ? Math.round(100 * M1.filter(v => v[5] > 0).length / M1.length) : 0 });
    } catch (e) { r.error = String(e && e.message || e); }
    console.log("Prueba Dukascopy", s, JSON.stringify(r));
  }
  fs.writeFileSync(path.join(DIR, "prueba_resumen.json"), JSON.stringify(res, null, 1));
}
