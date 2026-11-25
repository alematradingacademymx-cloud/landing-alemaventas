/* ALEMA Noticias · Decoración de Navidad: serie de luces finas apoyada sobre la barra de arriba, con parpadeo.
   Para QUITARLA: en noticias/index.html borra la línea que carga navidad.js (está marcada con NAVIDAD). */
(function () {
  const nav = document.querySelector("header.barra nav"); if (!nav) return;
  const P = 96, XS = [10, 29, 48, 67, 86], COLORES = ["#FF4040", "#FFC233", "#35D873", "#3EA9FF", "#FF7AD9"]; // rojo, ámbar, verde, azul, rosa
  const y = x => { const t = x / P; return 22 + 24 * t * (1 - t); }; // el cable se apoya en el borde y la onda baja 6 px
  const svg = c => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${P}' height='36' viewBox='0 0 ${P} 36'>${c}</svg>`)}")`;
  const foco = (x, color, prendido) => { const yy = y(x), giro = XS.indexOf(x) % 2 ? -12 : 10;
    return `<g transform='rotate(${giro} ${x} ${yy})'>` +
      (prendido ? `<circle cx='${x}' cy='${yy - 8}' r='6.5' fill='${color}' opacity='.28'/><circle cx='${x}' cy='${yy - 8}' r='3.8' fill='${color}' opacity='.45'/>` : "") +
      `<rect x='${x - 1.4}' y='${yy - 3}' width='2.8' height='3.4' rx='.6' fill='#1F2B22'/>` +
      `<ellipse cx='${x}' cy='${yy - 7.6}' rx='2.3' ry='4.4' fill='${prendido ? color : "#3A4150"}'/>` +
      `<ellipse cx='${x - .8}' cy='${yy - 9}' rx='.6' ry='1.4' fill='white' opacity='${prendido ? .8 : .25}'/></g>`; };
  const cable = `<path d='M0 22 Q${P / 2} 34 ${P} 22' fill='none' stroke='#3A6646' stroke-width='1.3' stroke-linecap='round'/>` +
    `<circle cx='0' cy='22' r='1.8' fill='#3A6646'/><circle cx='${P}' cy='22' r='1.8' fill='#3A6646'/>`;
  const ritmos = [[2.3, 0], [3.1, .6], [1.9, 1.1], [2.7, .3], [3.5, .9]];
  const css = `
.barra { padding-top: 24px; }
.barra nav { position: relative; }
.navidad-serie { position: absolute; left: 16px; right: 16px; top: -23px; height: 36px; pointer-events: none; z-index: 3;
  background: ${svg(cable + XS.map((x, k) => foco(x, COLORES[k], false)).join(""))} repeat-x 0 0; animation: navidad-cae .9s cubic-bezier(.3, 1.5, .5, 1) both; }
.navidad-serie i { position: absolute; inset: 0; background-repeat: repeat-x; animation: navidad-parpadeo 2s steps(1, end) infinite; }
${XS.map((x, k) => `.navidad-serie i:nth-child(${k + 1}) { background-image: ${svg(foco(x, COLORES[k], true))}; animation-duration: ${ritmos[k][0]}s; animation-delay: ${ritmos[k][1]}s; }`).join("\n")}
@keyframes navidad-parpadeo { 0%, 38% { opacity: 1; } 42% { opacity: .08; } 50%, 74% { opacity: 1; } 78% { opacity: .15; } 82%, 100% { opacity: 1; } }
@keyframes navidad-cae { from { transform: translateY(-12px); opacity: 0; } to { transform: none; opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .navidad-serie, .navidad-serie i { animation: none; } }`;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
  const s = document.createElement("div"); s.className = "navidad-serie"; s.setAttribute("aria-hidden", "true"); s.innerHTML = "<i></i>".repeat(XS.length);
  nav.prepend(s);
})();
