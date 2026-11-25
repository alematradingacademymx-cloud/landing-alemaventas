/* ALEMA Noticias · funciones compartidas (página, panel y generador de páginas para compartir). */
(function (raiz) {
  const SITIO = "https://alematradingacademy.com.mx";
  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fechaTxt = f => { const [a, m, d] = String(f).split("-").map(Number); return a && m ? `${d} de ${MESES[m - 1]} de ${a}` : ""; };
  const minutos = t => Math.max(1, Math.round(String(t || "").split(/\s+/).length / 200));
  const driveId = v => (/^drive:([\w-]{10,})$/.exec(v || "") || [])[1] || "";
  // Imagen: "drive:ID" (subida desde el panel) o un link normal.
  const imgUrl = (v, ancho) => { const id = driveId(v); return id ? `https://lh3.googleusercontent.com/d/${id}=w${ancho || 1600}` : String(v || ""); };
  const imgRespaldo = v => { const id = driveId(v); return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w1600` : ""; };
  const enlace = n => `${SITIO}/noticias/n/${n.id}/`;
  // Texto simple → HTML: línea en blanco = párrafo, "## " = subtítulo, "> " = frase destacada, "- " = lista, **negrita**, links automáticos.
  function formato(txt) {
    const linea = s => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/(https?:\/\/[^\s<]+[^\s<.,)])/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
    const out = []; let par = [], lista = [];
    const cerrar = () => { if (par.length) { out.push("<p>" + par.join("<br>") + "</p>"); par = []; } if (lista.length) { out.push("<ul>" + lista.map(l => `<li>${l}</li>`).join("") + "</ul>"); lista = []; } };
    String(txt || "").replace(/\r/g, "").split("\n").forEach(l => {
      if (!l.trim()) return cerrar();
      if (/^\s*-\s+/.test(l)) { if (par.length) { out.push("<p>" + par.join("<br>") + "</p>"); par = []; } lista.push(linea(l.replace(/^\s*-\s+/, ""))); return; }
      if (lista.length) cerrar();
      if (/^##\s+/.test(l)) { cerrar(); out.push(`<h3>${linea(l.replace(/^##\s+/, ""))}</h3>`); return; }
      if (/^>\s?/.test(l)) { cerrar(); out.push(`<blockquote>${linea(l.replace(/^>\s?/, ""))}</blockquote>`); return; }
      par.push(linea(l));
    });
    cerrar(); return out.join("");
  }
  const N = { SITIO, MESES, esc, fechaTxt, minutos, driveId, imgUrl, imgRespaldo, enlace, formato };
  if (typeof module !== "undefined" && module.exports) module.exports = N; else raiz.NOT = N;
})(typeof window !== "undefined" ? window : globalThis);
