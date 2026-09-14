#!/usr/bin/env node
// Gera o site estático a partir de data/site.json e assets/projetos/<slug>/projeto.json.
// Uso: node tools/build.mjs
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATES = join(ROOT, 'tools', 'templates');

const read = (path) => readFileSync(join(ROOT, path), 'utf8');
const write = (path, content) => {
  mkdirSync(dirname(join(ROOT, path)), { recursive: true });
  writeFileSync(join(ROOT, path), content);
};

const site = JSON.parse(read('data/site.json'));

// ——— Texto ———
const esc = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
// *palavra* vira destaque
const inline = (s = '') => esc(s).replace(/\*(.+?)\*/g, '<em>$1</em>');
const plain = (s = '') => String(s).replace(/\*/g, '');
const obfuscate = (s) => [...s].map((c) => `&#${c.codePointAt(0)};`).join('');
const truncate = (s, max = 155) => (s.length > max ? `${s.slice(0, max - 1).replace(/\s+\S*$/, '')}…` : s);

// ——— Imagens (webp) ———
function webpInfo(file) {
  const b = readFileSync(file);
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WEBP') {
    throw new Error(`Não é um arquivo webp: ${file}`);
  }
  const chunk = b.toString('ascii', 12, 16);
  if (chunk === 'VP8X') {
    return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3), animated: (b[20] & 0x02) !== 0 };
  }
  if (chunk === 'VP8L') {
    const bits = b.readUInt32LE(21);
    return { w: 1 + (bits & 0x3fff), h: 1 + ((bits >> 14) & 0x3fff), animated: false };
  }
  return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff, animated: false };
}

// Gera <img> com srcset quando existe a versão -sm.webp ao lado do arquivo
function image(dir, file, { alt = '', sizes = '100vw', cls = '', eager = false } = {}) {
  const path = join(ROOT, dir, file);
  if (!existsSync(path)) throw new Error(`Imagem não encontrada: ${dir}${file}`);
  const info = webpInfo(path);
  const smFile = file.replace(/\.webp$/, '-sm.webp');
  const smPath = join(ROOT, dir, smFile);
  const useSm = !info.animated && existsSync(smPath);
  const attrs = [
    cls && `class="${cls}"`,
    `src="{{root}}${dir}${useSm ? smFile : file}"`,
    useSm && `srcset="{{root}}${dir}${smFile} ${webpInfo(smPath).w}w, {{root}}${dir}${file} ${info.w}w"`,
    useSm && `sizes="${sizes}"`,
    `width="${info.w}" height="${info.h}"`,
    `alt="${esc(alt)}"`,
    eager ? 'fetchpriority="high"' : 'loading="lazy"',
    'decoding="async"',
  ];
  return `<img ${attrs.filter(Boolean).join(' ')}>`;
}

// ——— Projetos ———
function loadProject(slug) {
  const dir = `assets/projetos/${slug}/`;
  const data = JSON.parse(read(`${dir}projeto.json`));
  for (const field of ['titulo', 'cliente', 'capa']) {
    if (!data[field]) throw new Error(`${dir}projeto.json: campo "${field}" é obrigatório`);
  }
  const descricao = [].concat(data.descricao || []);
  return {
    ...data,
    slug,
    dir,
    url: `projetos/${slug}/`,
    descricao,
    bastidores: [].concat(data.bastidores || []),
    midias: data.midias || [],
    servicos: data.servicos || [],
    creditos: data.creditos || [],
    nome: plain(data.titulo),
    resumo: truncate(plain(descricao[0] || `${plain(data.titulo)} — ${data.cliente}`)),
  };
}

const projects = site.projetos.map(loadProject);
const bySlug = Object.fromEntries(projects.map((p) => [p.slug, p]));

// ——— Templates ———
const partial = (name) => readFileSync(join(TEMPLATES, 'partials', `${name}.html`), 'utf8');

function render(template, vars) {
  const html = readFileSync(join(TEMPLATES, template), 'utf8')
    .replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (_, name) => partial(name))
    .replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => {
      if (key === 'root') return match;
      if (!(key in vars)) throw new Error(`Variável "${key}" ausente em ${template}`);
      return vars[key];
    });
  return html.replaceAll('{{root}}', vars.root);
}

const version = createHash('md5').update(read('css/site.css')).update(read('js/site.js')).digest('hex').slice(0, 8);
const email = site.email;
const common = {
  version,
  year: String(new Date().getFullYear()),
  email: obfuscate(email),
  mailto: `${obfuscate(`mailto:${email}`)}?subject=${encodeURIComponent('Orçamento pelo site')}`,
  mailtoJobs: `${obfuscate(`mailto:${email}`)}?subject=${encodeURIComponent('Trabalhe com a gente')}`,
};

// ——— Home ———
const heroSizes = '(max-width: 760px) 50vw, 33vw';
const heroTiles = site.destaques.map((d, i) => {
  const p = bySlug[d.projeto];
  if (!p) throw new Error(`data/site.json: destaque aponta para projeto inexistente "${d.projeto}"`);
  return `<a class="tile" href="{{root}}${p.url}" style="--i:${i}">
          ${image(p.dir, d.imagem, { alt: `${p.nome} — ${p.cliente}`, sizes: heroSizes, eager: i < 3 })}
          <span class="tag">${esc(p.cliente)}</span>
        </a>`;
});
const heroColumns = [0, 2, 4]
  .map((start) => `<div class="hero-col">\n        ${heroTiles.slice(start, start + 2).join('\n        ')}\n      </div>`)
  .join('\n      ');

const cards = projects
  .map((p, i) => {
    const wide = i === 0;
    const sizes = wide ? '(max-width: 600px) 100vw, 66vw' : '(max-width: 600px) 100vw, (max-width: 1000px) 50vw, 33vw';
    const front = wide ? p.capa : p.card || p.capa;
    const bts = p.bastidores[0];
    return `<article class="card${wide ? ' card--wide' : ''}" data-reveal>
        <a class="card-link" href="{{root}}${p.url}">
          <div class="card-media">
            ${image(p.dir, front, { alt: `${p.nome} — ${p.cliente}`, sizes, cls: 'card-front' })}
            ${bts ? image(p.dir, bts, { alt: `Bastidores de ${p.nome}`, sizes, cls: 'card-bts' }) : ''}
            <span class="tag">${esc(p.cliente)}</span>
            ${bts ? '<span class="lens-label" aria-hidden="true">backstage</span>' : ''}
          </div>
          <div class="card-info">
            <h3 class="card-title">${inline(p.titulo)}</h3>
            <p class="card-meta">${esc(p.categoria)} · ${esc(p.ano)}</p>
          </div>
        </a>
        ${bts ? '<button class="bts-toggle" type="button" aria-pressed="false">ver bastidor</button>' : ''}
      </article>`;
  })
  .join('\n      ');

const firstHero = bySlug[site.destaques[0].projeto];
write(
  'index.html',
  render('home.html', {
    ...common,
    root: '',
    title: 'Muma Estúdio Criativo — do detalhe ao todo.',
    description:
      'Estúdio criativo modular no Rio de Janeiro, fundado por duas mulheres. Direção criativa, produção, foto, vídeo, arte, cenografia, beauty, styling, casting e catering.',
    url: `${site.url}/`,
    image: `${site.url}/${firstHero.dir}${site.destaques[0].imagem}`,
    heroColumns,
    cards,
  }),
);

// ——— Páginas de projeto ———
function vimeo(m, p, n) {
  const params = m.player
    ? 'title=0&byline=0&portrait=0&dnt=1'
    : 'autoplay=1&muted=1&loop=1&autopause=0&title=0&byline=0&portrait=0&dnt=1';
  const src = `https://player.vimeo.com/video/${encodeURIComponent(m.id)}?${params}`;
  return `<div class="video video--${m.orientacao === 'horizontal' ? 'h' : 'v'}" data-reveal>
          <iframe src="${esc(src)}" title="${esc(p.nome)} — vídeo ${n}" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>
        </div>`;
}

rmSync(join(ROOT, 'projetos'), { recursive: true, force: true });

projects.forEach((p, i) => {
  const next = projects[(i + 1) % projects.length];
  const videos = p.midias.filter((m) => m.tipo === 'vimeo');
  const photos = p.midias.filter((m) => m.tipo === 'imagem');

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
        ${videos.map((m, n) => vimeo(m, p, n + 1)).join('\n        ')}
      </div>
    </section>`
    : '';

  // Fotos com a mesma proporção ficam em grade alinhada; proporções misturadas, em masonry
  const ratios = photos.map((m) => {
    const { w, h } = webpInfo(join(ROOT, p.dir, m.arquivo));
    return w / h;
  });
  const uniform = ratios.length > 0 && Math.max(...ratios) - Math.min(...ratios) < 0.08;

  const galleryBlock = photos.length
    ? `<section class="block wrap" aria-labelledby="galeria-title">
      <h2 class="block-title" id="galeria-title">Imagens</h2>
      <div class="gallery${uniform ? ' gallery--grid' : ''}">
        ${photos
          .map(
            (m, n) =>
              `<figure class="gallery-item" data-reveal>${image(p.dir, m.arquivo, {
                alt: m.legenda || `${p.nome} — imagem ${n + 1}`,
                sizes: '(max-width: 560px) 100vw, (max-width: 1000px) 50vw, 33vw',
              })}${m.legenda ? `<figcaption>${esc(m.legenda)}</figcaption>` : ''}</figure>`,
          )
          .join('\n        ')}
      </div>
    </section>`
    : '';

  const btsBlock = p.bastidores.length
    ? `<section class="block wrap bts${p.bastidores.length === 1 ? ' bts--single' : ''}" aria-labelledby="bts-title">
      <div class="bts-head">
        <h2 class="block-title" id="bts-title">O backstage também é <em>cena</em>.</h2>
        <p>Por trás de cada imagem, um time orquestrado.</p>
      </div>
      <div class="bts-grid">
        ${p.bastidores
          .map((file, n) => `<figure class="bts-item" data-reveal>${image(p.dir, file, { alt: `Bastidores de ${p.nome} — ${n + 1}`, sizes: '(max-width: 600px) 100vw, 33vw' })}</figure>`)
          .join('\n        ')}
      </div>
    </section>`
    : '';

  write(
    `${p.url}index.html`,
    render('projeto.html', {
      ...common,
      root: '../../',
      title: `${p.nome} — ${p.cliente} · Muma Estúdio Criativo`,
      description: esc(p.resumo),
      url: `${site.url}/${p.url}`,
      image: `${site.url}/${p.dir}${p.capa}`,
      titulo: inline(p.titulo),
      cliente: esc(p.cliente),
      categoria: esc(p.categoria),
      ano: esc(p.ano),
      subtitulo: p.subtitulo ? `<p class="project-sub">${inline(p.subtitulo)}</p>` : '',
      capa: image(p.dir, p.capa, { alt: `${p.nome} — ${p.cliente}`, sizes: '100vw', eager: true }),
      descricao: p.descricao.map((t) => `<p>${inline(t)}</p>`).join('\n          '),
      ficha,
      videoBlock,
      galleryBlock,
      btsBlock,
      nextUrl: `{{root}}${next.url}`,
      nextTitulo: inline(next.titulo),
      nextCliente: esc(next.cliente),
      nextImagem: image(next.dir, next.card || next.capa, { alt: `${next.nome} — ${next.cliente}`, sizes: '(max-width: 760px) 100vw, 50vw' }),
    }),
  );
});

// ——— 404, redirecionamentos dos endereços antigos e sitemap ———
write('404.html', render('404.html', { ...common, root: '/', url: `${site.url}/` }));

const redirects = {
  'portfolio.html': '#projetos',
  'case-koni.html': 'projetos/dia-do-koni/',
  'case-minha_cabana.html': 'projetos/minha-cabana-vidro/',
  'case-banco-de-imagens.html': 'projetos/banco-de-imagens/',
  'case-coleo-de-pratos.html': 'projetos/colecao-de-pratos/',
};
for (const [from, to] of Object.entries(redirects)) {
  write(from, render('redirect.html', { root: '', to, url: `${site.url}/${to}` }));
}

write(
  'sitemap.xml',
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${site.url}/</loc></url>
${projects.map((p) => `  <url><loc>${site.url}/${p.url}</loc></url>`).join('\n')}
</urlset>
`,
);

console.log(`Site gerado: home + ${projects.length} projetos (versão ${version}).`);
