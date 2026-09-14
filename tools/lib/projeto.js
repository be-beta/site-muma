// Muma — renderização e validação de projetos, compartilhadas entre o gerador (tools/build.mjs)
// e o admin (tools/admin.html), para a prévia do admin ser idêntica à página publicada.

// ——— Texto ———
export const esc = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
// *palavra* vira destaque
export const inline = (s = '') => esc(s).replace(/\*(.+?)\*/g, '<em>$1</em>');
export const plain = (s = '') => String(s).replace(/\*/g, '');
export const truncate = (s, max = 155) => (s.length > max ? `${s.slice(0, max - 1).replace(/\s+\S*$/, '')}…` : s);
export const slugify = (s = '') =>
  plain(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// Parágrafos separados por linha em branco
export const paragraphs = (text = '') =>
  String(text)
    .split(/\n\s*\n/)
    .map((p) => p.trim().replace(/\s*\n\s*/g, ' '))
    .filter(Boolean);

// ——— Templates ———
export function fillTemplate(html, vars, partial = () => '') {
  const filled = html
    .replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (_, name) => partial(name))
    .replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => {
      if (key === 'root') return match;
      if (!(key in vars)) throw new Error(`Variável "${key}" ausente no template`);
      return vars[key];
    });
  return filled.replaceAll('{{root}}', vars.root ?? '');
}

// ——— Dados ———
export function normalizeProject(data, slug) {
  const descricao = [].concat(data.descricao || []);
  return {
    ...data,
    slug,
    dir: `assets/projetos/${slug}/`,
    url: `projetos/${slug}/`,
    titulo: data.titulo || '',
    cliente: data.cliente || '',
    descricao,
    bastidores: [].concat(data.bastidores || []),
    midias: data.midias || [],
    servicos: data.servicos || [],
    creditos: data.creditos || [],
    nome: plain(data.titulo || ''),
    resumo: truncate(plain(descricao[0] || `${plain(data.titulo || '')} — ${data.cliente || ''}`)),
  };
}

// hasFile(nome) diz se o arquivo existe ao lado do projeto.json
export function validateProject(data, slug, hasFile) {
  const errors = [];
  const warnings = [];
  const text = (value) => String(value ?? '').trim();

  if (slug && !SLUG_RE.test(slug)) errors.push(`Endereço "${slug}" inválido: use só letras minúsculas, números e hífens.`);
  if (!text(data.titulo)) errors.push('Falta o título do projeto.');
  if (!text(data.cliente)) errors.push('Falta o cliente.');
  if (!data.capa) errors.push('Falta a imagem de capa.');

  const checkFile = (file, where) => {
    if (!file) return;
    if (!/\.webp$/i.test(file)) errors.push(`${where}: "${file}" precisa ser .webp.`);
    else if (!hasFile(file)) errors.push(`${where}: arquivo "${file}" não encontrado.`);
  };
  checkFile(data.capa, 'Capa');
  checkFile(data.card, 'Card');
  [].concat(data.bastidores || []).forEach((file, i) => checkFile(file, `Bastidor ${i + 1}`));
  (data.midias || []).forEach((m, i) => {
    const where = `Galeria, item ${i + 1}`;
    if (m.tipo === 'imagem') checkFile(m.arquivo, where);
    else if (m.tipo === 'vimeo') {
      if (!/^\d+$/.test(text(m.id))) errors.push(`${where}: ID do Vimeo inválido.`);
      if (m.hash && !/^[0-9a-f]+$/i.test(m.hash)) errors.push(`${where}: código de vídeo não listado inválido.`);
      if (m.orientacao && !['vertical', 'horizontal'].includes(m.orientacao)) errors.push(`${where}: orientação deve ser vertical ou horizontal.`);
    } else errors.push(`${where}: tipo "${m.tipo}" desconhecido.`);
  });

  for (const [label, value] of [['título', data.titulo], ['frase de impacto', data.subtitulo], ...[].concat(data.descricao || []).map((p, i) => [`parágrafo ${i + 1}`, p])]) {
    if ((String(value || '').match(/\*/g) || []).length % 2) warnings.push(`O ${label} tem um * sem par: o destaque não vai funcionar.`);
  }
  return { errors, warnings };
}

// ——— Vídeo com player próprio (a interface é controlada por js/site.js) ———
const icon = {
  play: '<svg class="i-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none"/></svg>',
  pause: '<svg class="i-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 5.5v13M15.5 5.5v13"/></svg>',
  mute: '<svg class="i-mute" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="m16.5 9.5 5 5m0-5-5 5"/></svg>',
  sound: '<svg class="i-sound" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
  expand: '<svg class="i-expand" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
  collapse: '<svg class="i-collapse" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>',
  external: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg>',
};

export function renderVideo(m, p, n, total) {
  const params = new URLSearchParams({
    autoplay: n === 0 ? '1' : '0',
    muted: '1',
    loop: total === 1 ? '1' : '0',
    autopause: '0',
    controls: '0',
    title: '0',
    byline: '0',
    portrait: '0',
    playsinline: '1',
    dnt: '1',
  });
  if (m.hash) params.set('h', m.hash);
  const id = encodeURIComponent(m.id);
  const link = `https://vimeo.com/${id}${m.hash ? `/${encodeURIComponent(m.hash)}` : ''}`;
  const kind = m.orientacao === 'horizontal' ? 'h' : 'v';
  return `<div class="video-slot video-slot--${kind}">
          <div class="video" data-video>
            <iframe src="https://player.vimeo.com/video/${id}?${esc(params.toString())}" title="${esc(p.nome)} — vídeo ${n + 1}"${n === 0 ? '' : ' loading="lazy"'} allow="autoplay; fullscreen; picture-in-picture"></iframe>
            <span class="video-shade" aria-hidden="true"></span>
            <button class="video-hit" type="button" data-action="toggle" aria-label="Reproduzir ou pausar o vídeo ${n + 1}"></button>
            <div class="video-bar">
              <button class="vbtn" type="button" data-action="toggle" aria-label="Reproduzir">${icon.play}${icon.pause}</button>
              <div class="vsound">
                <button class="vbtn" type="button" data-action="mute" aria-label="Ativar som">${icon.mute}${icon.sound}</button>
                <input class="vvolume" type="range" min="0" max="1" step="0.05" value="0.8" aria-label="Volume">
              </div>
              <span class="vspacer"></span>
              <button class="vbtn" type="button" data-action="feature" aria-label="Destacar vídeo" title="Destacar">${icon.expand}${icon.collapse}</button>
              <a class="vbtn" href="${esc(link)}" target="_blank" rel="noopener" aria-label="Abrir no Vimeo" title="Abrir no Vimeo">${icon.external}</a>
            </div>
          </div>
        </div>`;
}

// image(p, arquivo, opções) devolve a tag <img>; ratio(p, arquivo) devolve largura/altura
export function renderCard(p, { image, wide = false }) {
  const sizes = wide ? '(max-width: 600px) 100vw, 66vw' : '(max-width: 600px) 100vw, (max-width: 1000px) 50vw, 33vw';
  const front = wide ? p.capa : p.card || p.capa;
  const bts = p.bastidores[0];
  const meta = [p.categoria, p.ano].filter(Boolean).map(esc).join(' · ');
  return `<article class="card${wide ? ' card--wide' : ''}" data-reveal>
        <a class="card-link" href="{{root}}${p.url}">
          <div class="card-media">
            ${image(p, front, { alt: `${p.nome} — ${p.cliente}`, sizes, cls: 'card-front' })}
            ${bts ? image(p, bts, { alt: `Bastidores de ${p.nome}`, sizes, cls: 'card-bts' }) : ''}
            <span class="tag">${esc(p.cliente)}</span>
            ${bts ? '<span class="lens-label" aria-hidden="true">backstage</span>' : ''}
          </div>
          <div class="card-info">
            <h3 class="card-title">${inline(p.titulo)}</h3>
            <p class="card-meta">${meta}</p>
          </div>
        </a>
        ${bts ? '<button class="bts-toggle" type="button" aria-pressed="false">ver bastidor</button>' : ''}
      </article>`;
}

export function renderProjectBlocks(p, { image, ratio }) {
  const videos = p.midias.filter((m) => m.tipo === 'vimeo');
  const photos = p.midias.filter((m) => m.tipo === 'imagem');

  // Figura com a proporção original (a galeria justificada usa --ar)
  const figure = (cls, file, alt, extra = '') =>
    `<figure class="${cls}" style="--ar:${ratio(p, file)}" data-reveal>${image(p, file, {
      alt,
      sizes: '(max-width: 600px) 100vw, 50vw',
    })}${extra}</figure>`;

  const ficha = [
    ['Cliente', esc(p.cliente)],
    ['Ano', esc(p.ano)],
    p.servicos.length && ['Serviços', p.servicos.map(esc).join(', ')],
    ...p.creditos.map((c) => [esc(c.funcao), esc(c.nome)]),
  ]
    .filter((row) => row && row[1])
    .map(([dt, dd]) => `<div><dt>${dt}</dt><dd>${dd}</dd></div>`)
    .join('\n            ');

  const videoBlock = videos.length
    ? `<section class="block wrap" aria-labelledby="videos-title">
      <h2 class="block-title" id="videos-title">${videos.length > 1 ? 'Filmes' : 'Filme'}</h2>
      <div class="videos videos--${Math.min(videos.length, 3)}">
        ${videos.map((m, n) => renderVideo(m, p, n, videos.length)).join('\n        ')}
      </div>
    </section>`
    : '';

  const galleryBlock = photos.length
    ? `<section class="block wrap" aria-labelledby="galeria-title">
      <h2 class="block-title" id="galeria-title">Imagens</h2>
      <div class="gallery justified">
        ${photos
          .map((m, n) =>
            figure('gallery-item', m.arquivo, m.legenda || `${p.nome} — imagem ${n + 1}`, m.legenda ? `<figcaption>${esc(m.legenda)}</figcaption>` : ''),
          )
          .join('\n        ')}
      </div>
    </section>`
    : '';

  const single = p.bastidores.length === 1;
  const btsBlock = p.bastidores.length
    ? `<section class="block wrap bts${single ? ' bts--single' : ''}" aria-labelledby="bts-title">
      <div class="bts-head">
        <h2 class="block-title" id="bts-title">O backstage também é <em>cena</em>.</h2>
        <p>Por trás de cada imagem, um time orquestrado.</p>
      </div>
      <div class="bts-grid${single ? '' : ' justified'}">
        ${p.bastidores.map((file, n) => figure('bts-item', file, `Bastidores de ${p.nome} — ${n + 1}`)).join('\n        ')}
      </div>
    </section>`
    : '';

  return {
    titulo: inline(p.titulo),
    cliente: esc(p.cliente),
    categoria: esc(p.categoria || ''),
    ano: esc(p.ano || ''),
    subtitulo: p.subtitulo ? `<p class="project-sub">${inline(p.subtitulo)}</p>` : '',
    capa: p.capa ? image(p, p.capa, { alt: `${p.nome} — ${p.cliente}`, sizes: '100vw', eager: true }) : '',
    descricao: p.descricao.map((t) => `<p>${inline(t)}</p>`).join('\n          '),
    ficha,
    videoBlock,
    galleryBlock,
    btsBlock,
  };
}
