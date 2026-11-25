/* ALEMA Noticias · panel para publicar. La clave se valida en el servidor; aquí solo se guarda la sesión (6 h). */
(function () {
  const { esc, fechaTxt, imgUrl, imgRespaldo, formato } = window.NOT;
  const API = window.NOTICIAS_API;
  const CATS = ["Mercados", "ALEMA", "Educación", "Comunidad", "Videos"];
  const MAX = { imagen: 8, video: 30 };
  const $ = id => document.getElementById(id);
  const sesion = { get: () => { try { return sessionStorage.getItem("not_tk") || ""; } catch (e) { return ""; } }, set: v => { try { v ? sessionStorage.setItem("not_tk", v) : sessionStorage.removeItem("not_tk"); } catch (e) {} } };
  let TK = sesion.get(), NOTAS = [], editando = null, borrarId = null, subiendo = 0, GH = true;
  const ENLACE = {}; // id → "listo" | "preparando"
  const urlCompartir = id => `${window.NOT.SITIO}/noticias/n/${id}/`;

  function toast(t, mal) { const e = $("toast"); e.textContent = t; e.style.color = mal ? "#FF9AA4" : ""; e.style.borderColor = mal ? "rgb(244 91 105 / .5)" : ""; e.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => e.hidden = true, 2800); }
  const hoyISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const img = (v, w) => `<img src="${esc(imgUrl(v, w || 600))}" alt="" data-respaldo="${esc(imgRespaldo(v))}">`;
  document.addEventListener("error", e => { const t = e.target; if (t.tagName === "IMG" && t.dataset.respaldo && t.src !== t.dataset.respaldo) { t.src = t.dataset.respaldo; t.dataset.respaldo = ""; } }, true);

  /* ---------- servidor ---------- */
  function api(accion, datos) {
    return fetch(API, { method: "POST", body: JSON.stringify(Object.assign({ accion, token: TK }, datos || {})) }).then(r => r.json())
      .then(j => { if (j.salir) { TK = ""; sesion.set(""); verLogin(j.error); throw new Error("salir"); } return j; })
      .catch(err => { if (err.message !== "salir") toast("No se pudo conectar con el servidor. Revisa tu conexión.", true); return { ok: false }; });
  }
  // Sube un archivo con barra de progreso. Devuelve "drive:ID".
  // Sin escuchar x.upload: eso obliga al navegador a pedir permiso (CORS) y Apps Script lo rechaza. El avance es estimado.
  function subirArchivo(blob, nombre, alAvanzar) {
    return new Promise(res => {
      const r = new FileReader();
      r.onload = () => {
        const datos = String(r.result).split(",")[1], x = new XMLHttpRequest();
        x.open("POST", API);
        const t0 = Date.now(), seg = Math.max(2, datos.length / 900000); // ~0.9 MB por segundo
        const reloj = setInterval(() => alAvanzar && alAvanzar(Math.min(.95, (Date.now() - t0) / 1000 / seg)), 250);
        const fin = v => { clearInterval(reloj); res(v); };
        x.onload = () => { clearInterval(reloj); try { const j = JSON.parse(x.responseText); if (j.salir) { verLogin(j.error); return res(null); } if (!j.ok) toast(j.error || "No se pudo subir el archivo.", true); res(j.ok ? j.ref : null); } catch (e) { toast("No se pudo subir el archivo.", true); res(null); } };
        x.onerror = () => { toast("Se cortó la conexión al subir el archivo. Intenta de nuevo.", true); fin(null); };
        x.send(JSON.stringify({ accion: "subir", token: TK, nombre, mime: blob.type, datos }));
      };
      r.readAsDataURL(blob);
    });
  }

  /* ---------- entrar ---------- */
  function verLogin(msg) {
    $("salir").hidden = true;
    $("vista").innerHTML = `<div class="cont"><form class="vidrio login" id="f_login">
      <h2>🔑 Panel de ALEMA Noticias</h2><p>Escribe tu clave para publicar, editar u ocultar noticias.</p>
      <label class="campo">Clave<input id="clave" type="password" autocomplete="current-password" placeholder="Tu clave del panel"></label>
      <p class="err" id="login_err" ${msg ? "" : "hidden"}>${esc(msg || "")}</p>
      <button class="btn btn-oro" type="submit">Entrar</button></form></div>`;
    $("f_login").addEventListener("submit", e => { e.preventDefault(); const b = e.target.querySelector("button"); b.disabled = true;
      fetch(API, { method: "POST", body: JSON.stringify({ accion: "login", clave: $("clave").value }) }).then(r => r.json()).then(j => {
        b.disabled = false; if (!j.ok) { $("login_err").textContent = j.error; $("login_err").hidden = false; return; }
        TK = j.token; sesion.set(TK); cargarLista(); }).catch(() => { b.disabled = false; $("login_err").textContent = "No se pudo conectar con el servidor."; $("login_err").hidden = false; }); });
    $("clave").focus();
  }
  $("salir").onclick = () => { TK = ""; sesion.set(""); verLogin(); };

  /* ---------- lista ---------- */
  function cargarLista() { $("vista").innerHTML = `<div class="cont"><p class="cargando">Cargando tus noticias…</p></div>`; api("lista").then(j => { if (j.ok) { NOTAS = j.notas; GH = j.github !== false; verLista(); revisarEnlaces(); } }); }
  /* ---------- enlaces para compartir: revisa si ya existe /noticias/n/<id>/ ---------- */
  function revisarEnlaces() {
    clearTimeout(revisarEnlaces.t);
    const pub = NOTAS.filter(n => n.publicada);
    Promise.all(pub.map(n => fetch(`/noticias/n/${n.id}/?r=${Date.now()}`, { method: "HEAD", cache: "no-store" }).then(r => [n.id, r.ok]).catch(() => [n.id, null]))).then(res => {
      let faltan = 0;
      res.forEach(([id, ok]) => { if (ok === null) return; const antes = ENLACE[id]; ENLACE[id] = ok ? "listo" : "preparando"; if (!ok) faltan++;
        if (ok && antes === "preparando") toast("✓ Enlace listo para compartir"); });
      pintarEnlaces();
      if (faltan) revisarEnlaces.t = setTimeout(revisarEnlaces, 20000); // GitHub tarda 1 o 2 minutos
    });
  }
  function pintarEnlaces() {
    document.querySelectorAll("[data-enlace]").forEach(el => { const id = el.dataset.enlace, st = ENLACE[id];
      el.innerHTML = st === "listo" ? `<span class="estado pub">✓ Enlace listo</span><button type="button" class="btn btn-vidrio btn-chico" data-copiar="${esc(id)}">🔗 Copiar enlace</button>`
        : st === "preparando" ? `<span class="estado prep">⏳ Preparando enlace…</span>` : ""; });
  }
  function avisoGitHub(g, base) {
    if (g && g.ok) { NOTAS.filter(n => n.publicada && ENLACE[n.id] !== "listo").forEach(n => ENLACE[n.id] = "preparando"); pintarEnlaces(); revisarEnlaces(); toast(base + " El enlace para compartir estará listo en 1 o 2 minutos."); }
    else if (g && !g.ok) toast(base + " " + g.error, true);
    else toast(base);
  }
  function verLista() {
    $("salir").hidden = false;
    $("vista").innerHTML = `<div class="cont panel">
      <div class="panel-cab"><div><h2>Tus noticias</h2><div class="meta"><span>${NOTAS.filter(n => n.publicada).length} publicadas</span><i></i><span>${NOTAS.filter(n => !n.publicada).length} borradores</span></div></div>
        <div class="botones"><button type="button" class="btn btn-vidrio" id="b_enlaces" title="Crea las páginas para compartir de las noticias publicadas">🔄 Preparar enlaces</button><button type="button" class="btn btn-oro" id="nueva">＋ Nueva noticia</button></div></div>
      ${GH ? "" : `<p class="aviso" style="margin:0 0 12px">Los enlaces para compartir todavía no se preparan solos: falta configurar GITHUB_TOKEN en el servidor. Mientras tanto se crean cada 30 minutos.</p>`}
      <div class="vidrio lista">${NOTAS.length ? NOTAS.map(n => `<div class="fila">${img(n.imagen, 300)}
        <div style="min-width:0"><h4>${n.tipo === "video" ? "▶ " : ""}${esc(n.titulo)}</h4><div class="meta"><span class="estado ${n.publicada ? "pub" : "bor"}">${n.publicada ? "Publicada" : "Borrador"}</span>${n.destacada ? '<span class="estado dest">★ Principal</span>' : ""}${n.urgenteHasta > Date.now() ? `<span class="estado urg-pill">🔴 Última hora · hasta ${new Date(n.urgenteHasta).toTimeString().slice(0, 5)}</span>` : ""}<span>${esc(n.cat)}</span><i></i><span>${fechaTxt(n.fecha)} · ${esc(n.hora)}</span></div>${n.publicada ? `<div class="enlace" data-enlace="${esc(n.id)}"></div>` : ""}</div>
        <div class="acc">${borrarId === n.id ? `<div class="confirmar">¿Eliminar esta noticia? También se borran su imagen y video del Drive. <button type="button" class="btn btn-peligro btn-chico" data-sib="${esc(n.id)}">Sí, eliminar</button><button type="button" class="btn btn-vidrio btn-chico" data-no>Cancelar</button></div>` :
          `<button type="button" class="btn btn-vidrio btn-chico" data-editar="${esc(n.id)}">Editar</button>${n.publicada ? `<a class="btn btn-vidrio btn-chico" href="/noticias/?n=${esc(n.id)}" target="_blank" rel="noopener">Ver ↗</a>` : ""}
          <button type="button" class="btn btn-vidrio btn-chico" data-toggle="${esc(n.id)}">${n.publicada ? "Ocultar" : "Publicar"}</button><button type="button" class="btn btn-peligro btn-chico" data-borrar="${esc(n.id)}">Eliminar</button>`}</div></div>`).join("")
        : `<div class="vacio">Todavía no tienes noticias. Crea la primera con <b>＋ Nueva noticia</b>.</div>`}</div></div>`;
    $("nueva").onclick = () => verEditor(null);
    $("b_enlaces").onclick = ev => { const b = ev.currentTarget; b.disabled = true;
      api("enlaces").then(j => { b.disabled = false; if (!j.ok) return j.error && toast(j.error, true);
        if (NOTAS.some(n => n.publicada && ENLACE[n.id] !== "listo")) avisoGitHub({ ok: true }, "Listo."); else toast("✓ Todos los enlaces ya están listos para compartir."); }); };
    pintarEnlaces();
  }

  /* ---------- editor ---------- */
  function tarjeta(n) {
    return `<article class="vidrio tarjeta"><div class="foto">${n.imagenLocal ? `<img src="${esc(n.imagenLocal)}" alt="">` : n.imagen ? img(n.imagen, 900) : ""}${n.tipo === "video" ? '<span class="play">Video</span>' : ""}</div>
      <div class="txt"><div class="meta"><span class="cat cat-${esc(n.cat)}">${esc(n.cat)}</span><span>${fechaTxt(n.fecha)}</span></div><h3>${esc(n.titulo || "Título de la noticia")}</h3><p>${esc(n.resumen || "Aquí aparece el resumen.")}</p></div></article>`;
  }
  function verEditor(id, borrador) {
    const n = borrador ? null : id ? NOTAS.find(x => x.id === id) : null;
    editando = borrador ? borrador : { id: n ? n.id : null, titulo: n ? n.titulo : "", cat: n ? n.cat : "ALEMA", fecha: n ? n.fecha : hoyISO(), hora: n ? n.hora : "", autor: n ? n.autor : "Equipo ALEMA",
      resumen: n ? n.resumen : "", texto: n ? n.texto : "", imagen: n ? n.imagen : "", imagenLocal: "", destacada: n ? n.destacada : false, publicada: n ? n.publicada : false,
      tipo: n ? n.tipo : "nota", video: n ? n.video : "", videoLocal: "", ig: n ? n.ig : "", urgenteHasta: n ? n.urgenteHasta || 0 : 0 };
    const e = editando, foto = e.imagenLocal || (e.imagen ? imgUrl(e.imagen, 900) : "");
    $("vista").innerHTML = `<div class="cont panel">
      <div class="panel-cab"><div><button type="button" class="volver" id="a_lista">← Tus noticias</button><h2>${e.id ? "Editar noticia" : "Nueva noticia"}</h2></div></div>
      <div class="editor"><form class="vidrio form" id="f_nota" novalidate>
        <div class="campo">Tipo de publicación<div class="tipo" role="group" aria-label="Tipo"><button type="button" data-tipo="nota" aria-pressed="${e.tipo !== "video"}">📰 Nota</button><button type="button" data-tipo="video" aria-pressed="${e.tipo === "video"}">🎬 Video</button></div></div>
        <label class="campo">Título<input id="e_titulo" maxlength="140" placeholder="Ej. ALEMA abre nuevas clases en vivo" value="${esc(e.titulo)}"></label>
        <div class="dos"><label class="campo">Categoría<select id="e_cat">${CATS.map(c => `<option ${c === e.cat ? "selected" : ""}>${c}</option>`).join("")}</select></label>
          <label class="campo">Fecha<input id="e_fecha" type="date" value="${esc(e.fecha)}"></label></div>
        <div class="campo" id="caja_video" ${e.tipo === "video" ? "" : "hidden"}>Video
          <div id="vid_zona">${e.video || e.videoLocal ? `<div class="vid-previa"><video ${e.videoLocal ? `src="${esc(e.videoLocal)}"` : ""} muted playsinline controls poster="${esc(foto)}"></video><div><b>Video listo</b><br><small>${e.video ? "Ya está guardado en tu Drive." : ""}</small><br><label class="btn btn-vidrio btn-chico" for="e_vid" style="margin-top:8px">Cambiar video</label></div></div>`
            : `<label class="subir video" for="e_vid"><span>🎬 <b>Sube tu video</b><br>MP4 · hasta ${MAX.video} MB (un Reel de 60 s en 1080p cabe)</span></label>`}</div>
          <input id="e_vid" type="file" accept="video/mp4,video/quicktime,video/webm" hidden>
          <div class="o">o pega el enlace de tu Reel de Instagram</div>
          <input id="e_ig" placeholder="https://www.instagram.com/reel/…" value="${esc(e.ig)}"></div>
        <div class="campo">Imagen de portada <small id="img_opc">${e.tipo === "video" ? "(en videos se toma sola del video)" : ""}</small>
          <label class="subir" id="zona" for="e_img">${foto ? `<img src="${esc(foto)}" alt="">` : ""}<span>📷 <b>Sube una imagen</b><br>o arrástrala aquí · JPG o PNG</span>${foto ? `<span class="btn btn-vidrio btn-chico cambiar">Cambiar imagen</span>` : ""}</label>
          <input id="e_img" type="file" accept="image/jpeg,image/png,image/webp" hidden><small>Se ajusta sola a 1600 px para que cargue rápido.</small></div>
        <label class="campo">Resumen <small>(aparece en la portada y al compartir · máximo 200 letras)</small><input id="e_resumen" maxlength="200" placeholder="Una o dos frases que expliquen la noticia" value="${esc(e.resumen)}"></label>
        <label class="campo"><span id="txt_lbl">${e.tipo === "video" ? "Descripción del video (opcional)" : "Texto de la noticia"}</span><textarea id="e_texto" placeholder="Escribe aquí la noticia…">${esc(e.texto)}</textarea></label>
        <div class="ayuda-formato">Formato fácil: deja una <b>línea en blanco</b> entre párrafos · <code>## Subtítulo</code> · <code>**negrita**</code> · <code>- punto de lista</code> · <code>&gt; frase destacada</code> · los links se activan solos.</div>
        <label class="check"><input type="checkbox" id="e_dest" ${e.destacada ? "checked" : ""}> Poner como noticia principal de la portada</label>
        <label class="check urgente-check"><input type="checkbox" id="e_urg" ${e.urgenteHasta > Date.now() ? "checked" : ""}> 🔴 Marcar como Última hora <small style="font-weight:400;color:var(--tenue)">(se queda fija arriba de la lista con la etiqueta URGENTE por 24 horas)</small></label>
        <p class="err" id="e_err" hidden></p>
        <div class="botones"><button type="submit" class="btn btn-oro" id="b_pub">${e.publicada ? "Guardar cambios" : "Publicar"}</button>
          <button type="button" class="btn btn-vidrio" id="e_borr">${e.publicada ? "Pasar a borrador" : "Guardar borrador"}</button>
          <button type="button" class="btn btn-vidrio" id="e_prev">Ver como quedará</button></div>
      </form>
      <aside class="previa"><span>Así se verá en la portada</span><div id="previa"></div></aside></div></div>`;
    const sync = () => { Object.assign(e, { titulo: $("e_titulo").value, cat: $("e_cat").value, fecha: $("e_fecha").value, resumen: $("e_resumen").value, texto: $("e_texto").value, destacada: $("e_dest").checked, ig: $("e_ig").value.trim() }); $("previa").innerHTML = tarjeta(e); };
    ["e_titulo", "e_cat", "e_fecha", "e_resumen", "e_texto", "e_dest", "e_ig"].forEach(i => $(i).addEventListener("input", sync)); sync();
    document.querySelectorAll("[data-tipo]").forEach(b => b.addEventListener("click", () => {
      e.tipo = b.dataset.tipo; document.querySelectorAll("[data-tipo]").forEach(x => x.setAttribute("aria-pressed", x === b));
      $("caja_video").hidden = e.tipo !== "video"; $("img_opc").textContent = e.tipo === "video" ? "(en videos se toma sola del video)" : "";
      $("txt_lbl").textContent = e.tipo === "video" ? "Descripción del video (opcional)" : "Texto de la noticia";
      if (e.tipo === "video") $("e_cat").value = "Videos"; sync(); }));
    const zona = $("zona");
    $("e_img").addEventListener("change", ev => cargarImg(ev.target.files[0]));
    ["dragenter", "dragover"].forEach(t => zona.addEventListener(t, ev => { ev.preventDefault(); zona.classList.add("sobre"); }));
    ["dragleave", "drop"].forEach(t => zona.addEventListener(t, ev => { ev.preventDefault(); zona.classList.remove("sobre"); }));
    zona.addEventListener("drop", ev => cargarImg(ev.dataTransfer.files[0]));
    $("e_vid").addEventListener("change", ev => cargarVideo(ev.target.files[0]));
    $("a_lista").onclick = () => verLista();
    $("f_nota").addEventListener("submit", ev => { ev.preventDefault(); guardar(true); });
    $("e_borr").onclick = () => guardar(false);
    $("e_prev").onclick = () => { sync(); verPrevia(); };
  }
  function error(t) { const x = $("e_err"); x.textContent = t; x.hidden = !t; }
  function progreso(dondeId, texto) { const z = $(dondeId); if (!z) return () => {};
    let b = z.querySelector(".barra-subida"); if (!b) { z.insertAdjacentHTML("beforeend", `<div class="barra-subida"><i></i></div><div class="estado-subida"></div>`); b = z.querySelector(".barra-subida"); }
    const est = z.querySelector(".estado-subida"); est.textContent = texto;
    return p => { b.querySelector("i").style.width = Math.round(p * 100) + "%"; est.textContent = p >= 1 ? "Guardando en tu Drive…" : `${texto} ${Math.round(p * 100)}%`; }; }
  function aJPEG(fuente, ancho) { const c = document.createElement("canvas"), w = fuente.videoWidth || fuente.width, h = fuente.videoHeight || fuente.height, k = Math.min(1, ancho / w);
    c.width = Math.round(w * k); c.height = Math.round(h * k); c.getContext("2d").drawImage(fuente, 0, 0, c.width, c.height);
    return new Promise(res => c.toBlob(b => res({ blob: b, url: c.toDataURL("image/jpeg", .8) }), "image/jpeg", .84)); }
  async function subirPortada(blob, url) {
    const e = editando; e.imagenLocal = url; e.imagen = ""; $("zona").innerHTML = `<img src="${url}" alt=""><span class="btn btn-vidrio btn-chico cambiar">Cambiar imagen</span>`; $("previa").innerHTML = tarjeta(e);
    subiendo++; const av = progreso("zona", "Subiendo imagen…"); const ref = await subirArchivo(blob, "portada.jpg", av); subiendo--;
    const z = $("zona"); if (z) z.querySelectorAll(".barra-subida,.estado-subida").forEach(x => x.remove());
    if (editando === e && ref) { e.imagen = ref; toast("Imagen guardada"); }
    else if (editando === e && z) { e.imagenLocal = ""; z.innerHTML = `<span>📷 <b>No se pudo subir la imagen</b><br>Vuelve a elegirla o arrástrala aquí</span>`; $("previa").innerHTML = tarjeta(e); error("La imagen no se subió. Vuelve a elegirla."); }
  }
  function cargarImg(f) {
    if (!f) return; if (!/^image\/(jpeg|png|webp)$/.test(f.type)) return error("Ese archivo no es una imagen. Sube un JPG o PNG.");
    error(""); editando.imagenAuto = false; const im = new Image(); im.onload = async () => { const j = await aJPEG(im, 1600); URL.revokeObjectURL(im.src); subirPortada(j.blob, j.url); }; im.src = URL.createObjectURL(f);
  }
  function cargarVideo(f) {
    if (!f) return; const e = editando;
    if (!/^video\//.test(f.type)) return error("Ese archivo no es un video. Sube un MP4.");
    if (f.size > MAX.video * 1048576) return error(`El video pesa ${(f.size / 1048576).toFixed(0)} MB y el máximo es ${MAX.video} MB. Expórtalo en 1080p o pega el enlace de tu Reel.`);
    error(""); e.video = ""; e.videoLocal = URL.createObjectURL(f);
    $("vid_zona").innerHTML = `<div class="vid-previa"><video src="${e.videoLocal}" muted playsinline controls></video><div><b>${esc(f.name)}</b> · ${(f.size / 1048576).toFixed(1)} MB</div></div>`;
    // portada: un cuadro del video
    const v = document.createElement("video"); v.muted = true; v.playsInline = true; v.preload = "auto"; v.src = e.videoLocal;
    v.addEventListener("loadeddata", () => { v.currentTime = Math.min(1, (v.duration || 2) / 2); });
    v.addEventListener("seeked", async () => { const j = await aJPEG(v, 900); const pv = $("vid_zona").querySelector("video"); if (pv) pv.poster = j.url; if ((!e.imagen && !e.imagenLocal) || e.imagenAuto) { e.imagenAuto = true; subirPortada(j.blob, j.url); } }, { once: true });
    subiendo++; const av = progreso("vid_zona", "Subiendo video…");
    subirArchivo(f, f.name, av).then(ref => { subiendo--; const z = $("vid_zona"); if (z) z.querySelectorAll(".barra-subida,.estado-subida").forEach(x => x.remove());
      if (editando === e && ref) { e.video = ref; toast("Video guardado en tu Drive"); }
      else if (editando === e && z) { e.videoLocal = ""; z.innerHTML = `<label class="subir video" for="e_vid"><span>🎬 <b>No se pudo subir el video</b><br>Vuelve a elegirlo (MP4 · hasta ${MAX.video} MB)</span></label>`; error("El video no se subió. Vuelve a elegirlo."); } });
  }
  function guardar(publicar) {
    const e = editando;
    ["e_titulo", "e_cat", "e_fecha", "e_resumen", "e_texto", "e_ig"].forEach(i => $(i).dispatchEvent(new Event("input")));
    if (subiendo) return error("Espera a que termine de subir la imagen o el video.");
    const b = $("b_pub"); $("f_nota").classList.add("ocupado");
    api("guardar", { nota: { id: e.id, titulo: e.titulo, cat: e.cat, fecha: e.fecha, hora: e.hora, autor: e.autor, resumen: e.resumen, texto: e.texto, tipo: e.tipo,
      img: e.imagen, video: e.tipo === "video" ? e.video : "", ig: e.tipo === "video" ? e.ig : "", destacada: e.destacada, urgente: $("e_urg").checked, publicada: publicar } }).then(j => {
      const f = $("f_nota"); if (f) f.classList.remove("ocupado");
      if (!j.ok) return j.error && error(j.error);
      NOTAS = j.notas; verLista(); avisoGitHub(j.github, publicar ? "Noticia publicada." : "Guardada como borrador.");
    });
  }
  function verPrevia() {
    const e = editando, foto = e.imagenLocal || (e.imagen ? imgUrl(e.imagen) : "");
    const medio = e.tipo === "video" && (e.videoLocal || e.video) ? (e.videoLocal ? `<div class="reproductor"><video controls playsinline poster="${esc(foto)}" src="${esc(e.videoLocal)}"></video></div>` : `<div class="reproductor"><iframe src="https://drive.google.com/file/d/${esc(e.video.slice(6))}/preview" allow="autoplay; fullscreen" allowfullscreen></iframe></div>`)
      : e.tipo === "video" && e.ig ? `<div class="insta"><b>🎬 Reel de Instagram</b><p>En la página se verá el Reel aquí mismo.</p></div>` : foto ? `<div class="portada"><img src="${esc(foto)}" alt=""></div>` : "";
    $("vista").innerHTML = `<div class="cont"><article class="nota"><button type="button" class="volver" id="a_editor">← Volver al editor</button>
      <div class="meta"><span class="cat cat-${esc(e.cat)}">${esc(e.cat)}</span><span>${fechaTxt(e.fecha)}</span><i></i><span>${esc(e.autor)}</span></div>
      <h1>${esc(e.titulo || "Título de la noticia")}</h1><p class="bajada">${esc(e.resumen)}</p>${medio}<div class="cuerpo">${formato(e.texto)}</div>
      <p class="aviso">ALEMA Noticias publica contenido educativo e informativo. No es asesoría de inversión ni recomendación de compra o venta. Operar en los mercados reales implica riesgo de pérdida.</p></article></div>`;
    $("a_editor").onclick = () => verEditor(null, editando); scrollTo(0, 0);
  }

  /* ---------- acciones de la lista ---------- */
  document.addEventListener("click", ev => {
    const cp = ev.target.closest("[data-copiar]");
    if (cp) { const u = urlCompartir(cp.dataset.copiar); (navigator.clipboard ? navigator.clipboard.writeText(u) : Promise.reject()).then(() => toast("Enlace copiado. Ya lo puedes pegar en Facebook o WhatsApp."), () => toast(u)); return; }
    const t = ev.target.closest("[data-editar],[data-toggle],[data-borrar],[data-sib],[data-no]"); if (!t) return;
    const d = t.dataset;
    if (d.editar) return verEditor(d.editar);
    if (d.borrar) { borrarId = d.borrar; return verLista(); }
    if ("no" in d) { borrarId = null; return verLista(); }
    t.disabled = true;
    if (d.toggle) { const n = NOTAS.find(x => x.id === d.toggle); api("publicar", { id: n.id, publicada: !n.publicada }).then(j => { t.disabled = false; if (!j.ok) return j.error && toast(j.error, true); const era = n.publicada; NOTAS = j.notas; verLista(); avisoGitHub(j.github, era ? "Noticia oculta." : "Noticia publicada."); }); }
    if (d.sib) api("eliminar", { id: d.sib }).then(j => { borrarId = null; if (!j.ok) return j.error && toast(j.error, true); NOTAS = j.notas; delete ENLACE[d.sib]; verLista(); avisoGitHub(j.github, "Noticia eliminada."); });
  });
  addEventListener("beforeunload", ev => { if (subiendo) { ev.preventDefault(); ev.returnValue = ""; } });

  if (!/^https:\/\/script\.google\.com\//.test(API || "")) $("vista").innerHTML = `<div class="cont"><div class="vidrio vacio">Falta configurar el servidor de noticias (noticias/config.js).</div></div>`;
  else TK ? cargarLista() : verLogin();
})();
