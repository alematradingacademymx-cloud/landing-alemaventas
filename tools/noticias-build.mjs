// ALEMA Noticias · genera /noticias/n/<id>/ (con vista previa para WhatsApp, Facebook y Google) y actualiza sitemap.xml.
// Lo corre GitHub Actions cada 30 minutos (.github/workflows/noticias.yml). Uso local: node tools/noticias-build.mjs [lista.json]
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const N = require(path.join(RAIZ, "noticias/formato.js"));
const { esc, fechaTxt, minutos, imgUrl, enlace, formato, driveId, SITIO } = N;

const config = fs.readFileSync(path.join(RAIZ, "noticias/config.js"), "utf8");
const API = (/NOTICIAS_API\s*=\s*"([^"]+)"/.exec(config) || [])[1] || "";
let notas;
if (process.argv[2]) notas = JSON.parse(fs.readFileSync(process.argv[2], "utf8")).notas;
else {
  if (!/^https:\/\/script\.google\.com\//.test(API)) { console.log("Falta la URL del servidor en noticias/config.js; no se genera nada."); process.exit(0); }
  const r = await fetch(API + "?accion=lista", { redirect: "follow" }), j = await r.json();
  if (!j.ok || !Array.isArray(j.notas)) { console.error("El servidor no respondió bien:", j.error || r.status); process.exit(1); }
  notas = j.notas;
}
notas = notas.filter(n => /^[\w-]{1,90}$/.test(n.id));

const plantilla = fs.readFileSync(path.join(RAIZ, "noticias/index.html"), "utf8");
const entre = (s, a, b, nuevo) => { const i = s.indexOf(a), k = s.indexOf(b); if (i < 0 || k < 0) throw new Error("Falta el marcador " + a); return s.slice(0, i + a.length) + "\n" + nuevo + "\n    " + s.slice(k); };
const esVideo = n => n.tipo === "video";

function medio(n) {
  if (esVideo(n) && n.video) { const id = driveId(n.video);
    return id ? `<div class="reproductor"><iframe src="https://drive.google.com/file/d/${id}/preview" allow="autoplay; fullscreen" allowfullscreen title="${esc(n.titulo)}"></iframe></div>`
      : `<div class="reproductor"><video controls playsinline preload="metadata" poster="${esc(imgUrl(n.imagen, 900))}" src="${esc(n.video)}"></video></div>`; }
  if (esVideo(n) && n.ig) return `<div class="insta-emb"><a class="btn btn-vidrio" href="${esc(n.ig)}" target="_blank" rel="noopener">Ver este video en Instagram ↗</a></div>`;
  return n.imagen ? `<div class="portada"><img src="${esc(imgUrl(n.imagen))}" alt=""></div>` : "";
}
function pagina(n) {
  const url = enlace(n), foto = imgUrl(n.imagen, 1200), titulo = `${n.titulo} · ALEMA Noticias`;
  const meta = `    <title>${esc(titulo)}</title>
    <meta name="description" content="${esc(n.resumen)}">
    <link rel="canonical" href="${url}">
    <meta property="og:type" content="article">
    <meta property="og:locale" content="es_MX">
    <meta property="og:site_name" content="ALEMA Noticias">
    <meta property="og:title" content="${esc(n.titulo)}">
    <meta property="og:description" content="${esc(n.resumen)}">
    <meta property="og:url" content="${url}">
    ${foto ? `<meta property="og:image" content="${esc(foto)}">` : `<meta property="og:image" content="${SITIO}/noticias/img/og-noticias.jpg">`}
    <meta property="article:published_time" content="${n.fecha}T${n.hora || "00:00"}:00-06:00">
    <meta property="article:section" content="${esc(n.cat)}">
    <script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "NewsArticle", headline: n.titulo, description: n.resumen,
      image: foto ? [foto] : undefined, datePublished: `${n.fecha}T${n.hora || "00:00"}:00-06:00`, author: { "@type": "Organization", name: n.autor || "Equipo ALEMA" },
      publisher: { "@type": "Organization", name: "ALEMA Trading Academy", logo: { "@type": "ImageObject", url: SITIO + "/noticias/img/logo-noticias.png" } }, mainEntityOfPage: url }).replace(/</g, "\\u003c")}</script>`;
  const cuerpo = `<div class="cont"><article class="nota">
      <a class="volver" href="/noticias/" data-abrir="">← Todas las noticias</a>
      <div class="meta"><span class="cat cat-${esc(n.cat)}">${esc(n.cat)}</span><span>${fechaTxt(n.fecha)}</span><i></i><span>${esc(n.autor || "Equipo ALEMA")}</span><i></i><span>${esVideo(n) ? "▶ Video" : minutos(n.texto) + " min de lectura"}</span></div>
      <h1>${esc(n.titulo)}</h1><p class="bajada">${esc(n.resumen)}</p>${medio(n)}<div class="cuerpo">${formato(n.texto)}</div>
      <p class="aviso">ALEMA Noticias publica contenido educativo e informativo. No es asesoría de inversión ni recomendación de compra o venta. Operar en los mercados reales implica riesgo de pérdida.</p>
    </article></div>`;
  let s = entre(plantilla, "<!--META-->", "<!--/META-->", meta);
  s = entre(s, "<!--NOTA-->", "<!--/NOTA-->", cuerpo);
  s = entre(s, "<!--DATOS-->", "<script src=\"/noticias/app.js", `<script>window.NOTA_ID = ${JSON.stringify(n.id)}; window.NOTA_INICIAL = true;</script>`);
  return s;
}

// páginas de cada nota (y se borran las que ya no están publicadas)
const dirN = path.join(RAIZ, "noticias/n");
fs.mkdirSync(dirN, { recursive: true });
const vivas = new Set(notas.map(n => n.id));
for (const d of fs.readdirSync(dirN)) if (!vivas.has(d)) fs.rmSync(path.join(dirN, d), { recursive: true, force: true });
for (const n of notas) { const d = path.join(dirN, n.id); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, "index.html"), pagina(n)); }

// sitemap: conserva las páginas que no son de noticias y agrega la portada y cada nota
const smPath = path.join(RAIZ, "sitemap.xml");
const previo = fs.existsSync(smPath) ? fs.readFileSync(smPath, "utf8") : "";
const otras = [...previo.matchAll(/<url>[\s\S]*?<\/url>/g)].map(m => m[0]).filter(u => !/\/noticias\//.test(u));
const urls = otras.concat([`<url><loc>${SITIO}/noticias/</loc><changefreq>daily</changefreq><priority>0.8</priority></url>`],
  notas.map(n => `<url><loc>${enlace(n)}</loc><lastmod>${n.fecha}</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>`));
fs.writeFileSync(smPath, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  ${urls.join("\n  ")}\n</urlset>\n`);
console.log(`Listo: ${notas.length} páginas de noticias y sitemap con ${urls.length} direcciones.`);
