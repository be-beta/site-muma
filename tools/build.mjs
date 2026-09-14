#!/usr/bin/env node
// Gera o site estático a partir de data/site.json e assets/projetos/<slug>/projeto.json.
// Projetos em assets/projetos/ que não estão na lista de data/site.json entram no início da grade,
// do mais recente ao mais antigo — basta importar o pacote do admin.
// Uso: node tools/build.mjs
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import {
  esc,
  inline,
  plain,
  fillTemplate,
  normalizeProject,
  validateProject,
  renderCard,
  renderProjectBlocks,
} from './lib/projeto.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATES = join(ROOT, 'tools', 'templates');

const read = (path) => readFileSync(join(ROOT, path), 'utf8');
const write = (path, content) => {
  mkdirSync(dirname(join(ROOT, path)), { recursive: true });
  writeFileSync(join(ROOT, path), content);
};

const site = JSON.parse(read('data/site.json'));
const obfuscate = (s) => [...s].map((c) => `&#${c.codePointAt(0)};`).join('');

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

function assertImage(dir, file) {
  const path = join(ROOT, dir, file);
  if (!existsSync(path)) throw new Error(`Imagem não encontrada: ${dir}${file}`);
  return path;
}

// Versão leve (-sm) quando existe
function lightSrc(dir, file) {
  assertImage(dir, file);
  const sm = file.replace(/\.webp$/, '-sm.webp');
  return existsSync(join(ROOT, dir, sm)) ? `${dir}${sm}` : `${dir}${file}`;
}

// Gera <img> com srcset quando existe a versão -sm.webp ao lado do arquivo
function imageTag(dir, file, { alt = '', sizes = '100vw', cls = '', eager = false } = {}) {
  const path = assertImage(dir, file);
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
    'draggable="false"',
  ];
  return `<img ${attrs.filter(Boolean).join(' ')}>`;
}

const image = (p, file, options) => imageTag(p.dir, file, options);
const ratio = (p, file) => {
  const { w, h } = webpInfo(assertImage(p.dir, file));
  return (w / h).toFixed(4);
};

// ——— Projetos ———
function loadProject(slug) {
  const dir = `assets/projetos/${slug}/`;
  const data = JSON.parse(read(`${dir}projeto.json`));
  const { errors, warnings } = validateProject(data, slug, (file) => existsSync(join(ROOT, dir, file)));
  warnings.forEach((warning) => console.warn(`Aviso (${slug}): ${warning}`));
  if (errors.length) throw new Error(`${dir}projeto.json:\n  - ${errors.join('\n  - ')}`);
  return normalizeProject(data, slug);
}

const projectsDir = join(ROOT, 'assets', 'projetos');
const onDisk = readdirSync(projectsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(join(projectsDir, entry.name, 'projeto.json')))
  .map((entry) => entry.name);
const missing = site.projetos.filter((slug) => !onDisk.includes(slug));
if (missing.length) throw new Error(`data/site.json lista projetos sem pasta em assets/projetos/: ${missing.join(', ')}`);

const newest = (p) => String(p.criadoEm || p.ano || '');
const unlisted = onDisk
  .filter((slug) => !site.projetos.includes(slug))
  .map(loadProject)
  .sort((a, b) => newest(b).localeCompare(newest(a)));
const projects = [...unlisted, ...site.projetos.map(loadProject)];
const bySlug = Object.fromEntries(projects.map((p) => [p.slug, p]));

// ——— Templates ———
const partial = (name) => readFileSync(join(TEMPLATES, 'partials', `${name}.html`), 'utf8');

function render(template, vars) {
  try {
    return fillTemplate(readFileSync(join(TEMPLATES, template), 'utf8'), vars, partial);
  } catch (error) {
    throw new Error(`${template}: ${error.message}`);
  }
}

const version = createHash('md5').update(read('css/site.css')).update(read('js/site.js')).digest('hex').slice(0, 8);

const servicosChips = site.servicos
  .map((s) => {
    const nome = esc(plain(s.nome));
    return `<label class="chip"><input type="checkbox" name="servicos" value="${nome}" data-label="Serviços de interesse"><span>${nome}</span></label>`;
  })
  .join('\n          ');

const common = {
  version,
  year: String(new Date().getFullYear()),
  email: obfuscate(site.email),
  formEndpoint: obfuscate(site.formulario),
  servicosChips,
};

// ——— Home ———
const heroSizes = '(max-width: 760px) 50vw, 33vw';
const heroTiles = site.destaques.map((d, i) => {
  const p = bySlug[d.projeto];
  if (!p) throw new Error(`data/site.json: destaque aponta para projeto inexistente "${d.projeto}"`);
  return `<a class="tile" href="{{root}}${p.url}" style="--i:${i}">
          ${image(p, d.imagem, { alt: `${p.nome} — ${p.cliente}`, sizes: heroSizes, eager: i < 3 })}
          <span class="tag">${esc(p.cliente)}</span>
        </a>`;
});
const heroColumns = [0, 2, 4]
  .map((start) => `<div class="hero-col">\n        ${heroTiles.slice(start, start + 2).join('\n        ')}\n      </div>`)
  .join('\n      ');

const servicos = site.servicos
  .map((s, i) => {
    const p = s.projeto && bySlug[s.projeto];
    if (s.projeto && !p) throw new Error(`data/site.json: serviço "${s.nome}" aponta para projeto inexistente "${s.projeto}"`);
    const thumb = p && s.imagem ? ` data-thumb="{{root}}${lightSrc(p.dir, s.imagem)}"` : '';
    return `<li class="service" tabindex="0" style="--i:${i}"${thumb} data-reveal>
          <span class="service-num">${String(i + 1).padStart(2, '0')}</span>
          <div class="service-body">
            <h3 class="service-name">${inline(s.nome)}</h3>
            <div class="service-desc"><p>${inline(s.descricao)}</p></div>
          </div>
          <span class="service-icon" aria-hidden="true"></span>
        </li>`;
  })
  .join('\n        ');

const cards = projects.map((p, i) => renderCard(p, { image, wide: i === 0 })).join('\n      ');

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
    servicos,
    cards,
  }),
);

// ——— Páginas de projeto ———
rmSync(join(ROOT, 'projetos'), { recursive: true, force: true });

projects.forEach((p, i) => {
  const next = projects[(i + 1) % projects.length];
  write(
    `${p.url}index.html`,
    render('projeto.html', {
      ...common,
      root: '../../',
      title: `${p.nome} — ${p.cliente} · Muma Estúdio Criativo`,
      description: esc(p.resumo),
      url: `${site.url}/${p.url}`,
      image: `${site.url}/${p.dir}${p.capa}`,
      ...renderProjectBlocks(p, { image, ratio }),
      nextUrl: `{{root}}${next.url}`,
      nextTitulo: inline(next.titulo),
      nextCliente: esc(next.cliente),
      nextImagem: image(next, next.card || next.capa, { alt: `${next.nome} — ${next.cliente}`, sizes: '(max-width: 760px) 100vw, 50vw' }),
    }),
  );
});

// Lista usada pelo admin para abrir projetos publicados
write(
  'projetos/index.json',
  `${JSON.stringify(projects.map((p) => ({ slug: p.slug, titulo: p.titulo, cliente: p.cliente, ano: p.ano || '' })), null, 2)}\n`,
);

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
