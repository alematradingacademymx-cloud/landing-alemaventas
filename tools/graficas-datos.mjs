// ALEMA Gráficas · descarga velas reales (Yahoo Finanzas) y las junta con las ya guardadas.
// Uso: node tools/graficas-datos.mjs <carpeta>   (la corre la tarea "ALEMA Gráficas (velas)" de GitHub)
// Archivos: <carpeta>/<SIMBOLO>_<tf>.json  →  { s, tf, d, act, t0, k } donde k es compacto (enteros, por diferencias):
//   cada vela = [minutos desde la anterior, apertura−cierre anterior, máximo−apertura, apertura−mínimo, cierre−apertura, volumen]
//   en "ticks" de 10^-d. Así cada archivo pesa ~3 veces menos que con precios completos.
import fs from "node:fs";
import path from "node:path";

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

const espera = ms => new Promise(r => setTimeout(r, ms));
function leer(f) { try { const j = JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8")), e = 10 ** j.d, out = []; let t = j.t0, pc = null;
    for (const [dt, a, b, c, x, v] of j.k) { t += dt * 60; const o = (pc === null ? a : pc + a); out.push([t, o / e, (o + b) / e, (o - c) / e, (o + x) / e, v]); pc = o + x; } return out; } catch { return []; } }
function escribir(s, tf, velas, d) {
  const e = 10 ** d; let pc = null, tp = velas.length ? velas[0][0] : 0; const k = [];
  for (const [t, o, h, l, c, v] of velas) { const O = Math.round(o * e), H = Math.round(h * e), L = Math.round(l * e), C = Math.round(c * e);
    k.push([Math.round((t - tp) / 60), pc === null ? O : O - pc, Math.max(0, H - O), Math.max(0, O - L), C - O, Math.round(v)]); pc = C; tp = t; }
  fs.writeFileSync(path.join(DIR, `${s}_${tf}.json`), JSON.stringify({ s, tf, d, act: Math.floor(Date.now() / 1000), t0: velas.length ? velas[0][0] : 0, k })); }

async function yahoo(sym, intervalo, desde, hasta) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=${intervalo}&period1=${desde}&period2=${hasta}&includePrePost=false`;
  for (let intento = 0; intento < 3; intento++) {
    try {
      const r = await fetch(intento === 1 ? url.replace("query1", "query2") : url, { headers: { "User-Agent": "Mozilla/5.0 (ALEMA Graficas)" } });
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
  resumen.push(fila.join("  ")); console.log(fila.join("  "));
}
fs.writeFileSync(path.join(DIR, "indice.json"), JSON.stringify({ act: ahora, activos: ACTIVOS.map(a => a[0]) }));
fs.writeFileSync(path.join(DIR, "README.md"), "Velas de ALEMA Gráficas (Yahoo Finanzas). Esta rama la reescribe la tarea automática; no la edites a mano.\n");
console.log(`Listo · ${resumen.length} activos`);
