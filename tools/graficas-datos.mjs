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

const ahora = Math.floor(Date.now() / 1000);


/* ---------- PRUEBA Dukascopy (volumen de ticks + historial largo) ----------
   Solo genera archivos "prueba_*.json" para revisarlos; la página todavía no los usa. Corre una sola vez (si ya existe prueba_resumen.json no repite). */
async function duka(instr, ruta) {
  for (let i = 0; i < 3; i++) {
    try {
      if (Date.now() > LIMITE_DUKA) return null;
      const r = await fetch(`https://datafeed.dukascopy.com/datafeed/${instr}/${ruta}`, { headers: { "User-Agent": "Mozilla/5.0 (ALEMA Graficas)" }, signal: AbortSignal.timeout(15000) });
      if (r.status === 404) return false; // no existe (todavía)
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
  let res = {}; try { res = JSON.parse(fs.readFileSync(path.join(DIR, "prueba_resumen.json"), "utf8")); } catch {}
  LIMITE_DUKA = Date.now() + 10 * 60000; // como máximo 10 minutos para la prueba
  const PRUEBAS = [["EURUSD", "EURUSD", 5], ["GER40", "DEUIDXEUR", 2], ["NVDA", "NVDAUSUSD", 2]];
  if (PRUEBAS.every(([s]) => res[s] && res[s].completo && !res[s].error)) return; // ya se hizo completa
  for (const [s, instr, d] of PRUEBAS) {
    if (res[s] && res[s].completo && !res[s].error) continue;
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

/* ---------- Dukascopy: velas con VOLUMEN (de ticks) y años de historial para forex, metales, petróleo, gas, GER40 y JP225 ----------
   Guarda archivos "dk_<SIMBOLO>_<tf>.json" (mismo formato). La página los usa para esos activos.
   Fuentes: velas de 1 minuto por día (días cerrados), ticks por hora (el día en curso) y velas de 1 hora por mes (historial desde 2012).
   Cada corrida trabaja como máximo DUKA_MIN minutos y deja anotado lo que ya bajó (dk_estado.json); el historial se completa en varias corridas. */
const DUKA = { EURUSD: "EURUSD", GBPUSD: "GBPUSD", USDJPY: "USDJPY", USDCHF: "USDCHF", AUDUSD: "AUDUSD", USDCAD: "USDCAD", NZDUSD: "NZDUSD",
  EURJPY: "EURJPY", GBPJPY: "GBPJPY", USDMXN: "USDMXN", XAUUSD: "XAUUSD", XAGUSD: "XAGUSD", USOIL: "LIGHTCMDUSD", UKOIL: "BRENTCMDUSD",
  NATGAS: "GASCMDUSD", GER40: "DEUIDXEUR", JP225: "JPNIDXJPY" };
const DUKA_MIN = +(process.env.DUKA_MIN || 22), DIAS_ATRAS = 420, DESDE_ANIO = 2012;
const TOPES = { "1": 60000, "5": 60000, "15": 40000, "45": 20000, "60": 100000, "240": 25000, D: 6000, W: 1500 };
function leerTicks(raw, base) { const out = []; for (let i = 0; i + 20 <= raw.length; i += 20) out.push([base + Math.floor(raw.readUInt32BE(i) / 1000), raw.readUInt32BE(i + 8), raw.readFloatBE(i + 16)]); return out; }
function ticksAMinutos(ticks) { const m = new Map(); for (const [t, p, v] of ticks) { const k = t - t % 60, c = m.get(k); if (!c) m.set(k, [k, p, p, p, p, v]); else { c[2] = Math.max(c[2], p); c[3] = Math.min(c[3], p); c[4] = p; c[5] += v; } } return [...m.values()].sort((a, b) => a[0] - b[0]); }
const diaTxt = t => new Date(t * 1000).toISOString().slice(0, 10);
const rutaDia = t => { const x = new Date(t * 1000); return `${x.getUTCFullYear()}/${dd(x.getUTCMonth())}/${dd(x.getUTCDate())}`; };
function semanas(diario, horario, d) {
  const out = []; let cur = null, wk = null;
  for (const b of diario) { const ny = horario === "utc" ? 0 : desfaseNY(b[0]), anc = horario === "fx" ? 7 * 3600 : 0, k = Math.floor((Math.floor((b[0] + ny + anc) / 86400) + 3) / 7);
    if (k !== wk) { if (cur) out.push(cur); cur = b.slice(); wk = k; } else { cur[2] = Math.max(cur[2], b[2]); cur[3] = Math.min(cur[3], b[3]); cur[4] = b[4]; cur[5] += b[5]; } }
  if (cur) out.push(cur); return out;
}
async function dukascopy() {
  LIMITE_DUKA = Date.now() + DUKA_MIN * 60000;
  let est = {}; try { est = JSON.parse(fs.readFileSync(path.join(DIR, "dk_estado.json"), "utf8")); } catch {}
  const guardarEstado = () => fs.writeFileSync(path.join(DIR, "dk_estado.json"), JSON.stringify(est));
  const hoy = Math.floor(ahora / 86400) * 86400, lista = ACTIVOS.filter(a => DUKA[a[0]]);
  const conv = (e, arr) => arr.map(([t, o, h, l, c, v]) => [t, o / e.esc, h / e.esc, l / e.esc, c / e.esc, Math.round(v * 1000)]);
  // 1) escala de precio (una vez) y velas recientes: días cerrados con archivo de 1 minuto, el resto con ticks por hora
  for (const [s, , d, horario] of lista) {
    const instr = DUKA[s], e = est[s] = est[s] || { dias: [], horas: [], meses: [] };
    try {
      if (!e.esc) {
        const y1 = leer(`${s}_1.json`); if (!y1.length) continue;
        const m = new Map(y1.map(v => [v[0], v[4]]));
        for (let k = 1; k <= 6 && !e.esc; k++) { const raw = await duka(instr, `${rutaDia(hoy - k * 86400)}/BID_candles_min_1.bi5`); if (!raw || !raw.length) continue;
          const v = leerDuka(raw, hoy - k * 86400).find(x => m.has(x[0])); if (v) e.esc = 10 ** Math.round(Math.log10(v[4] / m.get(v[0]))); }
        if (!e.esc) continue;
      }
      if (!e.volTicks) for (let k = 1; k <= 6 && !e.volTicks; k++) { const dia = hoy - k * 86400, raw = await duka(instr, `${rutaDia(dia)}/BID_candles_min_1.bi5`); if (!raw || !raw.length) continue;
        const h = 13, tk = await duka(instr, `${rutaDia(dia)}/${dd(h)}h_ticks.bi5`); if (!tk || !tk.length) continue;
        const a = leerDuka(raw, dia).filter(v => v[0] >= dia + h * 3600 && v[0] < dia + (h + 1) * 3600).reduce((x, v) => x + v[5], 0), b = leerTicks(tk, dia + h * 3600).reduce((x, v) => x + v[2], 0);
        if (a > 0 && b > 0) e.volTicks = a / b; }
      let nuevas = [];
      for (let k = 4; k >= 0; k--) { // últimos 4 días + hoy
        const dia = hoy - k * 86400, txt = diaTxt(dia); if (e.dias.includes(txt)) continue;
        if (k > 0) { const raw = await duka(instr, `${rutaDia(dia)}/BID_candles_min_1.bi5`);
          if (raw && raw.length) { nuevas = nuevas.concat(conv(e, leerDuka(raw, dia).filter(v => v[5] > 0 || v[1] !== v[4]))); e.dias.push(txt); continue; }
          if (raw && !raw.length) { e.dias.push(txt); continue; } } // fin de semana / feriado
        // día en curso (o archivo del día aún no publicado): ticks por hora ya cerrada
        const hMax = k === 0 ? Math.floor((ahora - dia) / 3600) - 1 : 23;
        for (let h = 0; h <= hMax; h++) { const id = `${txt}T${dd(h)}`; if (e.horas.includes(id)) continue;
          const raw = await duka(instr, `${rutaDia(dia)}/${dd(h)}h_ticks.bi5`); if (!raw) break;
          nuevas = nuevas.concat(conv(e, ticksAMinutos(leerTicks(raw, dia + h * 3600)).map(v => (v[5] *= e.volTicks || 1, v)))); e.horas.push(id); }
      }
      e.dias = e.dias.slice(-DIAS_ATRAS - 10); e.horas = e.horas.filter(x => x >= diaTxt(hoy - 6 * 86400));
      if (nuevas.length) actualizarDk(s, d, horario, nuevas, true);
    } catch (err) { console.log("Dukascopy", s, "error", String(err && err.message || err)); }
  }
  guardarEstado();
  // 2) historial de 1 hora por meses cerrados (del más reciente al más viejo), por turnos entre activos
  let hubo = true;
  while (hubo && Date.now() < LIMITE_DUKA) { hubo = false;
    for (const [s, , d, horario] of lista) { const e = est[s]; if (!e || !e.esc || Date.now() > LIMITE_DUKA) continue;
      const hoyD = new Date(ahora * 1000); let y = hoyD.getUTCFullYear(), m = hoyD.getUTCMonth() - 1; if (m < 0) { m = 11; y--; }
      const lote = [];
      while (y >= DESDE_ANIO && lote.length < 12) { const id = `${y}-${dd(m)}`; if (!e.meses.includes(id)) lote.push([`${y}/${dd(m)}/BID_candles_hour_1.bi5`, Date.UTC(y, m, 1) / 1000, id]); if (--m < 0) { m = 11; y--; } }
      if (!lote.length) continue; hubo = true;
      const res = await Promise.all(lote.map(async ([ruta, base, id]) => { const raw = await duka(DUKA[s], ruta); if (raw !== null) e.meses.push(id); return raw && raw.length ? leerDuka(raw, base) : []; }));
      const h1 = conv(e, res.flat().filter(v => v[5] > 0 || v[1] !== v[4]));
      if (h1.length) actualizarDk(s, d, horario, h1, false);
      guardarEstado(); }
  }
  // 3) días viejos de 1 minuto (para que 5m y 15m tengan más historial), del más reciente al más viejo
  hubo = true;
  while (hubo && Date.now() < LIMITE_DUKA) { hubo = false;
    for (const [s, , d, horario] of lista) { const e = est[s]; if (!e || !e.esc || Date.now() > LIMITE_DUKA) continue;
      const lote = [];
      for (let k = 5; k <= DIAS_ATRAS && lote.length < 16; k++) { const dia = hoy - k * 86400, txt = diaTxt(dia), wd = new Date(dia * 1000).getUTCDay();
        if (wd === 6 || e.dias.includes(txt)) continue; lote.push([dia, txt]); }
      if (!lote.length) continue; hubo = true;
      const res = await Promise.all(lote.map(async ([dia, txt]) => { const raw = await duka(DUKA[s], `${rutaDia(dia)}/BID_candles_min_1.bi5`); if (raw !== null) e.dias.push(txt); return raw && raw.length ? leerDuka(raw, dia) : []; }));
      const m1 = conv(e, res.flat().filter(v => v[5] > 0 || v[1] !== v[4]).sort((a, b) => a[0] - b[0]));
      if (m1.length) actualizarDk(s, d, horario, m1, false);
      guardarEstado(); }
  }
  guardarEstado();
  const fila = lista.map(([s]) => { const e = est[s] || {}; return `${s}: escala ${e.esc || "?"} · meses ${e.meses ? e.meses.length : 0} · días ${e.dias ? e.dias.length : 0}`; });
  console.log("Dukascopy\n" + fila.join("\n"));
}
// junta velas nuevas de 1 minuto (o de 1 hora) en los archivos dk_ y rearma las temporalidades
function actualizarDk(s, d, horario, velas, esMinuto) {
  const ord = velas.sort((a, b) => a[0] - b[0]);
  const meter = (tf, nuevas) => { if (!nuevas.length) return; const v = juntar(leer(`dk_${s}_${tf}.json`), nuevas, d, TOPES[tf]); escribir(`dk_${s}`, tf, v, d); };
  const esM1 = ord.length > 1 && ord.slice(1).some((v, i) => v[0] - ord[i][0] < 3600);
  if (esM1) {
    // los minutos más viejos que el tope de 1m no se guardan como 1m, pero sí cuentan para 5m, 15m, 45m y 1h
    // llegan días u horas completas, así que 5m, 15m y 1h salen completas; 45m se arma con el archivo de 15m
    meter("1", ord);
    for (const [tf, min] of [["5", 5], ["15", 15], ["60", 60]]) meter(tf, armar(ord, min, horario, d));
    const m15 = leer(`dk_${s}_15.json`); if (m15.length) escribir(`dk_${s}`, "45", armar(m15, 45, horario, d).slice(-TOPES["45"]), d);
  } else meter("60", ord);
  const h1 = leer(`dk_${s}_60.json`); if (!h1.length) return;
  escribir(`dk_${s}`, "240", armar(h1, 240, horario, d).slice(-TOPES["240"]), d);
  const dia = armar(h1, 1440, horario, d); escribir(`dk_${s}`, "D", dia.slice(-TOPES.D), d);
  escribir(`dk_${s}`, "W", semanas(dia, horario, d).slice(-TOPES.W), d);
}

/* ---------- corrida principal ---------- */
const resumen = [];
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
      let viejas = leer(`${s}_${g.tf}.json`);
      // si lo guardado no es diario/semanal (Yahoo con "range=max" lo manda mensual), se vuelve a bajar completo
      if (viejas.length > 2) { const sep = viejas.slice(1).map((v, i) => v[0] - viejas[i][0]).sort((a, b) => a - b)[Math.floor(viejas.length / 2)]; if (sep > (g.tf === "D" ? 5 : 10) * 86400) viejas = []; }
      // periodo desde 1900 (así Yahoo manda velas diarias/semanales de todo el historial, no mensuales)
      const nuevas = await yahoo(sym, g.y, viejas.length ? ahora - (g.tf === "D" ? 100 : 400) * 86400 : -2208994789, ahora + 86400); await espera(350);
      // Yahoo marca la vela del día/semana en curso con la hora actual: se alinea con las anteriores para no duplicarla
      const norm = nuevas.map(v => v.slice()), paso = g.tf === "D" ? 86400 : 604800, n = norm.length;
      if (n > 1) { const p = norm[n - 2][0], dt = norm[n - 1][0] - p;
        if (dt % paso) { const k = Math.floor(dt / paso);
          if (k >= 1) norm[n - 1][0] = p + k * paso;
          else { const a = norm[n - 2], b = norm.pop(); a[2] = Math.max(a[2], b[2]); a[3] = Math.min(a[3], b[3]); a[4] = b[4]; a[5] = Math.max(a[5], b[5]); } } }
      const velas = juntar(viejas.filter(v => !norm.length || v[0] < norm[0][0]), norm, d, g.max);
      if (velas.length) escribir(s, g.tf, velas, d);
      fila.push(`${g.tf}:${velas.length}`);
    } catch (e) { fila.push(`${g.tf}:error`); }
  }
  resumen.push(fila.join("  ")); console.log(fila.join("  "));
}
await pruebaDukascopy();
await dukascopy();
fs.writeFileSync(path.join(DIR, "indice.json"), JSON.stringify({ act: ahora, activos: ACTIVOS.map(a => a[0]) }));
fs.writeFileSync(path.join(DIR, "README.md"), "Velas de ALEMA Gráficas (Yahoo Finanzas). Esta rama la reescribe la tarea automática; no la edites a mano.\n");
console.log(`Listo · ${resumen.length} activos`);
