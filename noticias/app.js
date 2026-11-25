/* ALEMA Noticias · página pública. Lee las notas publicadas del servidor (Apps Script). */
(function () {
  const { esc, fechaTxt, minutos, imgUrl, imgRespaldo, enlace, formato, MESES, driveId } = window.NOT;
  const API = window.NOTICIAS_API;
  const CATS = ["Mercados", "ALEMA", "Educación", "Comunidad", "Videos"];
  const $ = id => document.getElementById(id);
  let NOTAS = null, filtro = "Todas", busqueda = "";

  /* ---------- utilidades ---------- */
  const hoyISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const esVideo = n => n.tipo === "video";
  const img = (v, ancho) => `<img src="${esc(imgUrl(v, ancho))}" alt="" loading="lazy" data-respaldo="${esc(imgRespaldo(v))}">`;
  function toast(t) { const e = $("toast"); e.textContent = t; e.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => e.hidden = true, 2400); }
  const rastrear = (...a) => { try { if (typeof fbq === "function") fbq(...a); } catch (e) {} };
  // Si una imagen de Drive no carga por el primer link, prueba el de respaldo.
  document.addEventListener("error", e => { const t = e.target; if (t.tagName === "IMG" && t.dataset.respaldo && t.src !== t.dataset.respaldo) { t.src = t.dataset.respaldo; t.dataset.respaldo = ""; } }, true);

  /* ---------- rutas: /noticias/  ·  /noticias/n/<id>/  ·  /noticias/?n=<id> ---------- */
  function rutaNota() {
    const m = /\/noticias\/n\/([\w-]+)\/?/.exec(location.pathname); if (m) return m[1];
    return new URLSearchParams(location.search).get("n") || window.NOTA_ID || "";
  }
  function ir(id) {
    history.pushState(null, "", id ? `/noticias/n/${id}/` : "/noticias/");
    pintar(); scrollTo(0, 0);
  }
  addEventListener("popstate", pintar);

  /* ---------- tarjetas ---------- */
  function insignia(n) { return esVideo(n) ? `<span class="play${n.ig && !n.video ? " ig" : ""}">${n.ig && !n.video ? "Instagram" : "Video"}</span>` : ""; }
  function tarjeta(n) {
    return `<a class="vidrio tarjeta" href="/noticias/n/${esc(n.id)}/" data-abrir="${esc(n.id)}"><div class="foto">${img(n.imagen, 900)}${insignia(n)}</div>
      <div class="txt"><div class="meta"><span class="cat cat-${esc(n.cat)}">${esc(n.cat)}</span><span>${fechaTxt(n.fecha)}</span></div><h3>${esc(n.titulo)}</h3><p>${esc(n.resumen)}</p></div></a>`;
  }
  function reel(n) {
    return `<a class="reel" href="/noticias/n/${esc(n.id)}/" data-abrir="${esc(n.id)}">${img(n.imagen, 700)}${insignia(n)}
      <div class="sobre-reel"><span class="meta"><span>${fechaTxt(n.fecha)}</span></span><b>${esc(n.titulo)}</b></div></a>`;
  }
  function hace(n) { const hoy = hoyISO(); if (n.fecha === hoy) return n.hora || "Hoy"; const d = Math.round((new Date(hoy) - new Date(n.fecha)) / 864e5); return d === 1 ? "Ayer" : n.fecha.slice(8, 10) + "/" + n.fecha.slice(5, 7); }
  function seccion(nombre, color, notas, cat, como) {
    if (!notas.length) return "";
    return `<div class="seccion-t"><h2><i style="background:${color}"></i>${nombre}</h2><button type="button" data-cat="${cat}">Ver todo →</button></div>` +
      (como === "reels" ? `<div class="reels">${notas.map(reel).join("")}</div>` : `<div class="rejilla">${notas.map(tarjeta).join("")}</div>`);
  }

  /* ---------- portada ---------- */
  function verPortada() {
    document.title = "ALEMA Noticias · Mercados, educación y comunidad";
    const todas = NOTAS, q = busqueda.trim().toLowerCase(), hoy = new Date();
    const lista = todas.filter(n => (filtro === "Todas" || n.cat === filtro) && (!q || (n.titulo + " " + n.resumen + " " + n.texto).toLowerCase().includes(q)));
    let cuerpo;
    if (!todas.length) cuerpo = `<div class="vidrio vacio">Muy pronto publicaremos aquí las noticias de ALEMA.</div>`;
    else if (filtro === "Todas" && !q) {
      const prin = todas.find(n => n.destacada && !esVideo(n)) || todas.find(n => !esVideo(n));
      const usadas = new Set([prin && prin.id]);
      const toma = (f, k) => { const r = todas.filter(n => !usadas.has(n.id) && f(n)).slice(0, k); r.forEach(n => usadas.add(n.id)); return r; };
      const ultimas = todas.filter(n => n !== prin).slice(0, 6);
      cuerpo = `<div class="arriba">${prin ? `<a class="vidrio principal" href="/noticias/n/${esc(prin.id)}/" data-abrir="${esc(prin.id)}"><div class="foto">${img(prin.imagen)}</div>
          <div class="txt"><div class="meta"><span class="cat cat-${esc(prin.cat)}">${esc(prin.cat)}</span><span>${fechaTxt(prin.fecha)}${prin.hora ? " · " + prin.hora : ""}</span><i></i><span>${minutos(prin.texto)} min de lectura</span></div>
          <h2>${esc(prin.titulo)}</h2><p>${esc(prin.resumen)}</p><span class="leer">Leer nota →</span></div></a>` : ""}
        ${ultimas.length ? `<aside class="vidrio ultima" aria-label="Última hora"><h2>Última hora</h2>${ultimas.map(n => `<a href="/noticias/n/${esc(n.id)}/" data-abrir="${esc(n.id)}"><time>${hace(n)}</time><span><b>${esVideo(n) ? "▶ " : ""}${esc(n.titulo)}</b><small>${esc(n.cat)}</small></span></a>`).join("")}</aside>` : ""}</div>
        ${seccion("Mercados", "var(--teal)", toma(n => n.cat === "Mercados" && !esVideo(n), 3), "Mercados")}
        ${seccion("ALEMA Noticias en video", "#EC4899", todas.filter(esVideo), "Videos", "reels")}
        ${seccion("ALEMA", "var(--ambar)", toma(n => n.cat === "ALEMA" && !esVideo(n), 3), "ALEMA")}
        ${seccion("Educación", "var(--verde)", toma(n => n.cat === "Educación" && !esVideo(n), 3), "Educación")}
        ${seccion("Comunidad", "#818CF8", toma(n => n.cat === "Comunidad" && !esVideo(n), 3), "Comunidad")}`;
    } else {
      cuerpo = lista.length ? (filtro === "Videos" && !q ? `<div class="reels">${lista.map(reel).join("")}</div>` : `<div class="rejilla">${lista.map(tarjeta).join("")}</div>`)
        : `<div class="vidrio vacio">No encontramos noticias${q ? ` con “${esc(busqueda)}”` : " en esta categoría"}. Prueba con otra búsqueda.</div>`;
    }
    $("vista").innerHTML = `<div class="cont">
      <div class="cabeza"><div><div class="fecha-hoy">${hoy.getDate()} de ${MESES[hoy.getMonth()]} de ${hoy.getFullYear()} · Desde 2020</div><h1>Noticias, mercados y educación <em>de ALEMA</em></h1>
        <p>Lo que pasa en ALEMA, lo que mueve a los mercados y lo que necesitas saber para operar con método.</p></div></div>
      <div class="filtros" role="group" aria-label="Categorías">${["Todas", ...CATS].map(c => `<button type="button" class="chip" data-cat="${c}" aria-pressed="${c === filtro}">${c === "Videos" ? "▶ Videos" : c}</button>`).join("")}
        <label class="buscar"><span hidden>Buscar</span><input id="q" type="search" placeholder="Buscar noticias…" value="${esc(busqueda)}"></label></div>
      ${cuerpo}
      ${cta()}${pie()}</div>`;
    $("q").addEventListener("input", e => { busqueda = e.target.value; const pos = e.target.selectionStart; verPortada(); const q2 = $("q"); q2.focus(); q2.setSelectionRange(pos, pos); });
  }
  const cta = () => `<div class="vidrio cta"><div><h3>Aprende practicando, gratis</h3><p>Pon en práctica lo que lees en ALEMA Noticias con la terminal simulada del Trading Lab.</p></div>
    <a class="btn btn-oro" href="/lab/?utm_source=noticias">🚀 Entrar al Trading Lab</a></div>`;
  const pie = () => `<footer class="pie"><span>© ALEMA Trading Academy · ALEMA Noticias</span><span>Contenido educativo. No es asesoría de inversión.</span></footer>`;

  /* ---------- nota abierta ---------- */
  function medio(n) {
    if (esVideo(n) && n.video) {
      const id = driveId(n.video);
      return id ? `<div class="reproductor"><iframe src="https://drive.google.com/file/d/${id}/preview" allow="autoplay; fullscreen" allowfullscreen title="${esc(n.titulo)}"></iframe></div>`
        : `<div class="reproductor"><video controls playsinline preload="metadata" poster="${esc(imgUrl(n.imagen, 900))}" src="${esc(n.video)}"></video></div>`;
    }
    if (esVideo(n) && n.ig) return `<div class="insta-emb"><blockquote class="instagram-media" data-instgrm-permalink="${esc(n.ig)}" data-instgrm-version="14"><a href="${esc(n.ig)}" target="_blank" rel="noopener">Ver este video en Instagram ↗</a></blockquote></div>`;
    return n.imagen ? `<div class="portada">${img(n.imagen)}</div>` : "";
  }
  function htmlNota(n, otras) {
    const url = enlace(n), msg = encodeURIComponent(n.titulo + " " + url);
    return `<div class="cont"><article class="nota">
      <a class="volver" href="/noticias/" data-abrir="">← Todas las noticias</a>
      <div class="meta"><span class="cat cat-${esc(n.cat)}">${esc(n.cat)}</span><span>${fechaTxt(n.fecha)}</span><i></i><span>${esc(n.autor || "Equipo ALEMA")}</span><i></i><span>${esVideo(n) ? "▶ Video" : minutos(n.texto) + " min de lectura"}</span></div>
      <h1>${esc(n.titulo)}</h1><p class="bajada">${esc(n.resumen)}</p>
      ${medio(n)}
      <div class="cuerpo">${formato(n.texto)}</div>
      <div class="compartir"><span>Compartir:</span>
        <a class="btn btn-vidrio btn-chico" href="https://wa.me/?text=${msg}" target="_blank" rel="noopener">WhatsApp</a>
        <a class="btn btn-vidrio btn-chico" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}" target="_blank" rel="noopener">Facebook</a>
        <button type="button" class="btn btn-vidrio btn-chico" id="copiar" data-url="${esc(url)}">Copiar enlace</button></div>
      <p class="aviso">ALEMA Noticias publica contenido educativo e informativo. No es asesoría de inversión ni recomendación de compra o venta. Operar en los mercados reales implica riesgo de pérdida.</p>
      ${otras && otras.length ? `<div class="mas"><h2>Más noticias</h2><div class="rejilla">${otras.map(tarjeta).join("")}</div></div>` : ""}
    </article></div>`;
  }
  function verNota(n) {
    const otras = NOTAS.filter(x => x.id !== n.id).sort((a, b) => (b.cat === n.cat) - (a.cat === n.cat)).slice(0, 3);
    document.title = n.titulo + " · ALEMA Noticias";
    $("vista").innerHTML = htmlNota(n, otras);
    if (esVideo(n) && n.ig && !n.video) cargarInstagram();
    rastrear("track", "ViewContent", { content_name: n.titulo, content_category: n.cat });
  }
  function cargarInstagram() {
    if (window.instgrm) return window.instgrm.Embeds.process();
    const s = document.createElement("script"); s.async = true; s.src = "https://www.instagram.com/embed.js"; document.body.appendChild(s);
  }
  function noEncontrada() {
    document.title = "Noticia no encontrada · ALEMA Noticias";
    $("vista").innerHTML = `<div class="cont"><div class="nota"><a class="volver" href="/noticias/" data-abrir="">← Todas las noticias</a><div class="vidrio vacio">Esta noticia ya no está disponible. Mira las más recientes en la portada.</div></div></div>`;
  }

  /* ---------- carga ---------- */
  function pintar() {
    if (!NOTAS) return;
    const id = rutaNota();
    if (!id) return verPortada();
    const n = NOTAS.find(x => x.id === id); n ? verNota(n) : noEncontrada();
  }
  function cargar() {
    if (!/^https:\/\/script\.google\.com\//.test(API || "")) { $("vista").innerHTML = `<div class="cont"><div class="vidrio vacio">Falta configurar el servidor de noticias.</div></div>`; return; }
    fetch(API + "?accion=lista").then(r => r.json()).then(j => {
      if (!j.ok) throw new Error(j.error);
      NOTAS = j.notas || []; pintar();
    }).catch(() => {
      if (window.NOTA_INICIAL) return; // la página para compartir ya trae la nota
      $("vista").innerHTML = `<div class="cont"><div class="vidrio vacio">No pudimos cargar las noticias. Revisa tu conexión.<br><br><button type="button" class="btn btn-vidrio" id="reintentar">Intentar de nuevo</button></div></div>`;
      $("reintentar").onclick = cargar;
    });
  }

  /* ---------- clics ---------- */
  document.addEventListener("click", e => {
    const a = e.target.closest("[data-abrir]");
    if (a && !e.metaKey && !e.ctrlKey && !e.shiftKey && NOTAS) { e.preventDefault(); ir(a.dataset.abrir); return; }
    const c = e.target.closest("[data-cat]");
    if (c && NOTAS) { filtro = c.dataset.cat; if (rutaNota()) history.pushState(null, "", "/noticias/"); verPortada(); if (filtro !== "Todas") $("vista").scrollIntoView({ block: "start" }); return; }
    const cp = e.target.closest("#copiar");
    if (cp) { const u = cp.dataset.url; (navigator.clipboard ? navigator.clipboard.writeText(u) : Promise.reject()).then(() => toast("Enlace copiado"), () => toast(u)); }
    const inicio = e.target.closest("#ir_inicio");
    if (inicio && NOTAS) { e.preventDefault(); filtro = "Todas"; busqueda = ""; ir(""); }
  });
  cargar();
})();
