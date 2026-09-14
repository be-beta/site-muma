// Muma — admin de projetos: monta o pacote (.zip) pronto para entrar no site
import {
  esc,
  plain,
  slugify,
  paragraphs,
  fillTemplate,
  normalizeProject,
  validateProject,
  renderProjectBlocks,
  renderCard,
} from './lib/projeto.js';

const SITE = new URL('../', window.location.href).href;
const MAX_SIDE = 2000; // lado maior das imagens
const MAX_COVER = 2400; // lado maior da capa
const MAX_SM = 900; // versão leve usada nas grades
const QUALITY = 0.82;
const MIN_RESOLUTION = 1200;
const SERVICOS_PADRAO = ['Direção criativa', 'Produção executiva', 'Foto & vídeo', 'Edição & pós', 'Arte & cenografia', 'Beauty & styling', 'Casting', 'Catering'];

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const uid = () => Math.random().toString(36).slice(2, 10);
const pad = (n) => String(n).padStart(2, '0');

// ——— Estado ———
const emptyState = () => ({
  titulo: '',
  slug: '',
  slugManual: false,
  cliente: '',
  ano: String(new Date().getFullYear()),
  categoria: '',
  subtitulo: '',
  descricao: '',
  servicos: [],
  creditos: [],
  capa: null,
  card: null,
  bastidores: [],
  galeria: [],
  criadoEm: new Date().toISOString(),
  origem: '', // slug do projeto publicado que foi aberto para edição
});
let state = emptyState();
let siteServices = SERVICOS_PADRAO;
let siteProjects = [];
let projectTemplate = null;

const currentSlug = () => (state.slugManual ? slugify(state.slug) : slugify(state.titulo));
const allImages = () => [state.capa, state.card, ...state.bastidores, ...state.galeria.filter((item) => item.tipo === 'imagem')].filter(Boolean);
const hasContent = () => Boolean(state.titulo || state.cliente || state.descricao || allImages().length || state.galeria.length);

// ——— Avisos ———
let toastTimer;
function toast(message, kind = '') {
  const el = $('#toast');
  el.textContent = message;
  el.className = `toast is-on ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-on'), 5000);
}
const setBusy = (message) => {
  $('#busy').hidden = !message;
  $('#busy').textContent = message || '';
};

const blobUrls = new WeakMap();
const urlOf = (blob) => {
  if (!blobUrls.has(blob)) blobUrls.set(blob, URL.createObjectURL(blob));
  return blobUrls.get(blob);
};

// ——— Imagens: redimensiona e converte para WebP ———
async function decode(blob) {
  try {
    return await createImageBitmap(blob, { imageOrientation: 'from-image' });
  } catch {
    const url = URL.createObjectURL(blob);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

function encode(source, maxSide) {
  const width = source.width || source.naturalWidth;
  const height = source.height || source.naturalHeight;
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob && blob.type === 'image/webp') resolve({ blob, w: canvas.width, h: canvas.height });
      else reject(new Error('Este navegador não gera imagens WebP. Use o Google Chrome ou o Microsoft Edge.'));
    }, 'image/webp', QUALITY);
  });
}

async function processFile(file, maxSide = MAX_SIDE) {
  let source;
  try {
    source = await decode(file);
  } catch {
    throw new Error(`Não consegui abrir “${file.name}”. Fotos HEIC do iPhone precisam ser exportadas como JPG.`);
  }
  try {
    const origW = source.width || source.naturalWidth;
    const origH = source.height || source.naturalHeight;
    const full = await encode(source, maxSide);
    const sm = await encode(source, MAX_SM);
    return { uid: uid(), tipo: 'imagem', full: full.blob, sm: sm.blob, w: full.w, h: full.h, origW, origH, nome: file.name, gif: file.type === 'image/gif', legenda: '' };
  } finally {
    source.close?.();
  }
}

async function addImages(files, maxSide, onImage) {
  const images = files.filter((file) => file.type.startsWith('image/') || /\.(heic|heif)$/i.test(file.name));
  if (images.length < files.length) toast('Alguns arquivos foram ignorados porque não são imagens.', 'is-error');
  const failures = [];
  for (const [i, file] of images.entries()) {
    setBusy(`Otimizando imagem ${i + 1} de ${images.length}…`);
    try {
      onImage(await processFile(file, maxSide));
    } catch (error) {
      failures.push(error.message);
    }
  }
  setBusy('');
  if (failures.length) toast([...new Set(failures)].join(' '), 'is-error');
  changed();
}

const orientation = ({ w, h }) => (w > h ? 'horizontal' : w < h ? 'vertical' : 'quadrada');

// ——— Vimeo ———
function parseVimeo(value) {
  const text = value.trim();
  let match = text.match(/player\.vimeo\.com\/video\/(\d+)(?:\?[^#]*?\bh=([0-9a-f]+))?/i);
  if (match) return { id: match[1], hash: match[2] || '' };
  match = text.match(/vimeo\.com\/(?:[a-z]+\/)*(\d{5,})(?:\/([0-9a-f]{6,}))?/i);
  if (match) return { id: match[1], hash: match[2] || '' };
  match = text.match(/^(\d{5,})$/);
  return match ? { id: match[1], hash: '' } : null;
}

async function vimeoInfo({ id, hash }) {
  const url = `https://vimeo.com/${id}${hash ? `/${hash}` : ''}`;
  const response = await fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}&width=640`);
  if (!response.ok) throw new Error(String(response.status));
  return response.json();
}

async function addVimeo(value) {
  const parsed = parseVimeo(value);
  if (!parsed) {
    toast('Não reconheci esse link. Use o endereço do vídeo no Vimeo, como vimeo.com/123456789.', 'is-error');
    return false;
  }
  const item = { uid: uid(), tipo: 'vimeo', ...parsed, orientacao: 'vertical', titulo: '', thumb: '' };
  state.galeria.push(item);
  renderList('galeria');
  changed();
  try {
    const info = await vimeoInfo(parsed);
    Object.assign(item, { titulo: info.title || '', thumb: info.thumbnail_url || '', orientacao: info.width > info.height ? 'horizontal' : 'vertical' });
    renderList('galeria');
    changed();
  } catch {
    toast('Vídeo adicionado, mas o Vimeo não liberou as informações (pode ser privado). Confira a orientação.', 'is-error');
  }
  return true;
}

// ——— Rascunho salvo no navegador (IndexedDB) ———
const drafts = (() => {
  let dbPromise;
  const open = () =>
    (dbPromise ||= new Promise((resolve, reject) => {
      const request = indexedDB.open('muma-admin', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('rascunhos');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }));
  const run = async (mode, action) => {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('rascunhos', mode);
      const request = action(tx.objectStore('rascunhos'));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
    });
  };
  return {
    load: () => run('readonly', (store) => store.get('atual')),
    save: (value) => run('readwrite', (store) => store.put(value, 'atual')),
    clear: () => run('readwrite', (store) => store.delete('atual')),
  };
})();

let saveTimer;
function scheduleSave() {
  $('#saveState').textContent = 'Salvando rascunho…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await drafts.save(state);
      $('#saveState').textContent = 'Rascunho salvo neste navegador';
    } catch (error) {
      console.error(error);
      $('#saveState').textContent = 'Não foi possível salvar o rascunho';
    }
  }, 600);
}

// ——— Montagem do projeto (mesmo formato que o site lê) ———
function assemble() {
  const images = [];
  const add = (img, base) => {
    if (!img) return undefined;
    const file = `${base}.webp`;
    images.push({ img, file });
    return file;
  };
  const capa = add(state.capa, 'capa');
  const card = add(state.card, 'card');
  const bastidores = state.bastidores.map((img, i) => add(img, `bts-${pad(i + 1)}`));
  let n = 0;
  const midias = state.galeria.map((item) =>
    item.tipo === 'vimeo'
      ? { tipo: 'vimeo', id: item.id, ...(item.hash ? { hash: item.hash } : {}), orientacao: item.orientacao }
      : { tipo: 'imagem', arquivo: add(item, pad(++n)), ...(item.legenda.trim() ? { legenda: item.legenda.trim() } : {}) },
  );

  const projeto = {
    titulo: state.titulo.trim(),
    cliente: state.cliente.trim(),
    ano: state.ano.trim(),
    categoria: state.categoria.trim(),
    subtitulo: state.subtitulo.trim(),
    servicos: [...state.servicos],
    creditos: state.creditos.map((c) => ({ funcao: c.funcao.trim(), nome: c.nome.trim() })).filter((c) => c.funcao && c.nome),
    descricao: paragraphs(state.descricao),
    capa: capa || '',
    ...(card ? { card } : {}),
    bastidores,
    midias,
    criadoEm: state.criadoEm,
  };
  return { projeto, images, slug: currentSlug() };
}

// ——— Revisão ———
function collectIssues() {
  const { projeto, images, slug } = assemble();
  const files = new Set(images.map((i) => i.file));
  const { errors, warnings } = validateProject(projeto, slug, (file) => files.has(file));
  if (projeto.titulo && !slug) errors.push('Não foi possível criar o endereço da página a partir do título. Preencha o endereço.');
  const incompleteCredits = state.creditos.filter((c) => Boolean(c.funcao.trim()) !== Boolean(c.nome.trim())).length;
  if (incompleteCredits) warnings.push('Há créditos com função ou nome em branco: eles não entram no pacote.');

  if (state.capa && state.capa.w <= state.capa.h) warnings.push('A capa não é horizontal: no topo da página ela aparece recortada em faixa larga.');
  if (state.card && state.card.w > state.card.h) warnings.push('A imagem do card é horizontal: na grade da home ela é recortada na vertical.');
  if (!state.card && state.capa && state.capa.w > state.capa.h) warnings.push('Sem imagem de card: a home vai recortar a capa horizontal na vertical. Uma foto vertical costuma ficar melhor.');
  if (!state.bastidores.length) warnings.push('Sem bastidores: o efeito “backstage” não aparece no card da home.');
  if (!projeto.descricao.length) warnings.push('A descrição está vazia.');
  if (!projeto.categoria) warnings.push('Sem categoria: ela aparece no card e no topo da página.');
  if (!/^\d{4}$/.test(projeto.ano)) warnings.push('Ano vazio ou fora do formato (ex: 2025).');
  if (!projeto.midias.length) warnings.push('Galeria vazia: a página vai mostrar só a capa e os bastidores.');
  const low = allImages().filter((img) => Math.max(img.origW, img.origH) < MIN_RESOLUTION).length;
  if (low) warnings.push(`${low} ${low > 1 ? 'imagens têm' : 'imagem tem'} menos de ${MIN_RESOLUTION}px no lado maior e ${low > 1 ? 'podem' : 'pode'} ficar sem nitidez.`);
  if (allImages().some((img) => img.gif)) warnings.push('GIFs viram imagem parada. Para movimento, suba um vídeo no Vimeo.');
  if (slug && state.origem !== slug && siteProjects.some((p) => p.slug === slug)) {
    warnings.push(`Já existe um projeto publicado em /projetos/${slug}/: este pacote vai substituí-lo.`);
  }
  return { errors, warnings, slug };
}

function renderChecklist() {
  const { errors, warnings, slug } = collectIssues();
  const items = [...errors.map((t) => ['is-error', t]), ...warnings.map((t) => ['is-warn', t])];
  $('#checklist').innerHTML = items.length
    ? items.map(([cls, text]) => `<li class="${cls}">${esc(text)}</li>`).join('')
    : '<li class="is-ok">Tudo certo para gerar o pacote.</li>';
  const count = $('#checkCount');
  count.dataset.state = errors.length ? 'error' : warnings.length ? 'warn' : 'ok';
  count.textContent = errors.length
    ? `${errors.length} pendência${errors.length > 1 ? 's' : ''}`
    : warnings.length
      ? `${warnings.length} aviso${warnings.length > 1 ? 's' : ''}`
      : 'pronto';
  $('#slugPreview').textContent = `mumaestudio.com.br/projetos/${slug || '…'}/`;
  if (!state.slugManual) $('#f-slug').value = slug;
  return { errors, warnings };
}

// ——— Pré-visualização com o CSS e o JS reais do site ———
const frame = $('#previewFrame');
let view = 'pagina';
let device = 'desktop';
let lastPreview = '';
let previewTimer;

const PREVIEW_STYLE = `
  .js [data-reveal] { opacity: 1 !important; transform: none !important; }
  .project-head { padding-top: 56px; }
  .admin-cards { padding-block: 48px; }
  .admin-cards .cards { grid-template-columns: minmax(0, 1fr) minmax(0, 2fr); align-items: start; }
  .admin-cards .card--wide { grid-column: auto; }
  .admin-cards .card-media { height: auto; }
  .admin-note { margin-top: 28px; font-size: 14px; color: rgba(12, 9, 51, .5); }
  .admin-empty { display: grid; place-items: center; min-height: 100vh; padding: 24px; text-align: center; font: 500 17px/1.4 "TWK Lausanne", Arial, sans-serif; color: rgba(12, 9, 51, .5); }
  @media (max-width: 600px) { .admin-cards .cards { grid-template-columns: 1fr; } }
`;

function renderPreview() {
  const { projeto, images, slug } = assemble();
  const files = new Map(images.map(({ img, file }) => [file, img]));
  const p = normalizeProject(projeto, slug || 'novo-projeto');
  const image = (_, file, { alt = '', cls = '' } = {}) => {
    const img = files.get(file);
    return img ? `<img${cls ? ` class="${cls}"` : ''} src="${urlOf(img.full)}" width="${img.w}" height="${img.h}" alt="${esc(alt)}">` : '';
  };
  const ratio = (_, file) => {
    const img = files.get(file);
    return img ? (img.w / img.h).toFixed(4) : '1';
  };
  const empty = (message) => `<div class="admin-empty">${esc(message)}</div>`;

  let body;
  if (view === 'card') {
    body = p.capa
      ? `<div class="wrap admin-cards"><div class="cards">${renderCard(p, { image })}${renderCard(p, { image, wide: true })}</div>
         <p class="admin-note">À esquerda, o card na grade; à direita, como ele aparece quando é o primeiro projeto da lista.</p></div>`
      : empty('Adicione a capa para ver o card da home.');
  } else if (!projectTemplate) {
    body = empty('Não foi possível carregar o modelo da página. Abra o admin pelo endereço do site.');
  } else {
    const blocks = renderProjectBlocks(p, { image, ratio });
    body = fillTemplate(projectTemplate, {
      root: '',
      ...blocks,
      titulo: blocks.titulo || 'Título do projeto',
      cliente: blocks.cliente || 'Cliente',
      nextUrl: '#',
      nextTitulo: 'Próximo <em>projeto</em>',
      nextCliente: 'Cliente',
      nextImagem: blocks.capa,
    });
  }

  const html = `<!doctype html><html lang="pt-BR" class="js"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><base href="${SITE}" target="_blank"><link rel="stylesheet" href="css/site.css"><style>${PREVIEW_STYLE}</style></head><body>${body}<script src="js/site.js"><\/script></body></html>`;
  if (html === lastPreview) return;
  lastPreview = html;
  const scrollY = frame.contentWindow?.scrollY || 0;
  frame.onload = () => frame.contentWindow?.scrollTo(0, scrollY);
  frame.srcdoc = html;
}

function fitPreview() {
  const stage = $('.preview-stage');
  const width = device === 'mobile' ? 390 : 1360;
  const scale = Math.min(1, (stage.clientWidth - 32) / width);
  frame.style.width = `${width}px`;
  frame.style.height = `${(stage.clientHeight - 16) / scale}px`;
  frame.style.transform = `translateX(-50%) scale(${scale})`;
}

// ——— Interface ———
function changed() {
  renderChecklist();
  scheduleSave();
  clearTimeout(previewTimer);
  previewTimer = setTimeout(renderPreview, 450);
}

function renderServices() {
  const all = [...new Set([...siteServices, ...state.servicos])];
  $('#servicos').innerHTML = all
    .map((s) => {
      const on = state.servicos.includes(s);
      return `<button type="button" class="chip${on ? ' is-on' : ''}" data-servico="${esc(s)}" aria-pressed="${on}">${esc(s)}</button>`;
    })
    .join('');
}

function renderCredits() {
  $('#creditos').innerHTML = state.creditos.length
    ? state.creditos
        .map(
          (c) => `<div class="credit" data-uid="${c.uid}">
            <input class="input input--sm" data-k="funcao" value="${esc(c.funcao)}" placeholder="Função" aria-label="Função">
            <input class="input input--sm" data-k="nome" value="${esc(c.nome)}" placeholder="Nome" aria-label="Nome">
            <button class="icon-btn" type="button" data-remove aria-label="Remover crédito">✕</button>
          </div>`,
        )
        .join('')
    : '<p class="empty">Nenhum crédito ainda.</p>';
}

function renderSlot(key) {
  const slot = $(`[data-slot="${key}"]`);
  const img = state[key];
  slot.classList.toggle('has-image', Boolean(img));
  $('.slot-preview', slot).innerHTML = img ? `<img src="${urlOf(img.sm)}" alt="">` : '';
  $('.slot-meta', slot).textContent = img ? `${img.origW}×${img.origH}px · ${orientation(img)}` : '';
}

function renderList(key) {
  const items = state[key];
  $(`[data-list="${key}"]`).innerHTML = items
    .map((item) => {
      if (item.tipo === 'vimeo') {
        return `<li class="item item--video" data-uid="${item.uid}">
          <span class="item-handle" aria-hidden="true">⋮⋮</span>
          <div class="item-thumb">${item.thumb ? `<img src="${esc(item.thumb)}" alt="">` : '▶'}</div>
          <div class="item-info">
            <strong>${esc(item.titulo || `Vídeo ${item.id}`)}</strong>
            <span><span class="item-badge item-badge--video">vídeo</span>Vimeo ${esc(item.id)}${item.hash ? ' · não listado' : ''}</span>
            <select class="input input--sm" data-k="orientacao" aria-label="Orientação do vídeo">
              <option value="vertical"${item.orientacao === 'vertical' ? ' selected' : ''}>Vertical (9:16)</option>
              <option value="horizontal"${item.orientacao === 'horizontal' ? ' selected' : ''}>Horizontal (16:9)</option>
            </select>
          </div>
          <button class="icon-btn" type="button" data-remove aria-label="Remover vídeo">✕</button>
        </li>`;
      }
      const low = Math.max(item.origW, item.origH) < MIN_RESOLUTION;
      return `<li class="item" data-uid="${item.uid}">
        <span class="item-handle" aria-hidden="true">⋮⋮</span>
        <div class="item-thumb"><img src="${urlOf(item.sm)}" alt=""></div>
        <div class="item-info">
          <strong>${esc(item.nome)}</strong>
          <span>${item.origW}×${item.origH}px · ${orientation(item)}${low ? ' · <b class="low">baixa resolução</b>' : ''}</span>
          ${key === 'galeria' ? `<input class="input input--sm" data-k="legenda" value="${esc(item.legenda || '')}" placeholder="Legenda (opcional)" aria-label="Legenda">` : ''}
        </div>
        <button class="icon-btn" type="button" data-remove aria-label="Remover imagem">✕</button>
      </li>`;
    })
    .join('');
  $(`[data-count="${key}"]`).textContent = items.length ? `${items.length} ${items.length > 1 ? 'itens' : 'item'}` : '';
}

function renderAll() {
  $$('[data-field]').forEach((input) => {
    input.value = state[input.dataset.field] || '';
  });
  $('#f-slug').value = currentSlug();
  renderServices();
  renderCredits();
  renderSlot('capa');
  renderSlot('card');
  renderList('bastidores');
  renderList('galeria');
  lastPreview = '';
  changed();
}

function setupDrop(el, multiple, onFiles) {
  const pick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,.heic,.heif';
    input.multiple = multiple;
    input.onchange = () => input.files.length && onFiles([...input.files]);
    input.click();
  };
  el.addEventListener('click', (event) => {
    if (!event.target.closest('button, input, select')) pick();
  });
  el.addEventListener('keydown', (event) => {
    if ((event.key === 'Enter' || event.key === ' ') && event.target === el) {
      event.preventDefault();
      pick();
    }
  });
  el.addEventListener('dragover', (event) => {
    event.preventDefault();
    el.classList.add('is-over');
  });
  el.addEventListener('dragleave', () => el.classList.remove('is-over'));
  el.addEventListener('drop', (event) => {
    event.preventDefault();
    el.classList.remove('is-over');
    const files = [...event.dataTransfer.files];
    if (files.length) onFiles(multiple ? files : files.slice(0, 1));
  });
}

function highlightSelection(input) {
  const { selectionStart: start, selectionEnd: end, value } = input;
  if (start === end) {
    toast('Selecione primeiro o trecho que quer destacar.');
    return;
  }
  input.value = `${value.slice(0, start)}*${value.slice(start, end)}*${value.slice(end)}`;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.focus();
  input.setSelectionRange(start, end + 2);
}

// ——— Abrir projetos ———
async function loadProjectData(data, slug, getBlob, origem = '') {
  const missing = [];
  const loadImage = async (file) => {
    if (!file) return null;
    const full = await getBlob(file);
    if (!full) {
      missing.push(file);
      return null;
    }
    const source = await decode(full);
    const w = source.width || source.naturalWidth;
    const h = source.height || source.naturalHeight;
    const sm = (await getBlob(file.replace(/\.webp$/, '-sm.webp'))) || (await encode(source, MAX_SM)).blob;
    source.close?.();
    return { uid: uid(), tipo: 'imagem', full, sm, w, h, origW: w, origH: h, nome: file, gif: false, legenda: '' };
  };

  setBusy('Carregando projeto…');
  try {
    const next = {
      ...emptyState(),
      titulo: data.titulo || '',
      slug,
      slugManual: true,
      cliente: data.cliente || '',
      ano: String(data.ano || ''),
      categoria: data.categoria || '',
      subtitulo: data.subtitulo || '',
      descricao: [].concat(data.descricao || []).join('\n\n'),
      servicos: [...(data.servicos || [])],
      creditos: (data.creditos || []).map((c) => ({ uid: uid(), funcao: c.funcao || '', nome: c.nome || '' })),
      criadoEm: data.criadoEm || new Date().toISOString(),
      origem,
    };
    next.capa = await loadImage(data.capa);
    next.card = await loadImage(data.card);
    for (const file of [].concat(data.bastidores || [])) {
      const img = await loadImage(file);
      if (img) next.bastidores.push(img);
    }
    for (const m of data.midias || []) {
      if (m.tipo === 'imagem') {
        const img = await loadImage(m.arquivo);
        if (img) next.galeria.push({ ...img, legenda: m.legenda || '' });
      } else if (m.tipo === 'vimeo') {
        next.galeria.push({ uid: uid(), tipo: 'vimeo', id: String(m.id), hash: m.hash || '', orientacao: m.orientacao || 'vertical', titulo: '', thumb: '' });
      }
    }
    state = next;
    renderAll();
    if (missing.length) toast(`Arquivos não encontrados no pacote: ${missing.join(', ')}`, 'is-error');
    else toast(`“${plain(state.titulo)}” carregado.`);

    // miniaturas dos vídeos, sem travar a abertura
    state.galeria
      .filter((item) => item.tipo === 'vimeo')
      .forEach(async (item) => {
        try {
          const info = await vimeoInfo(item);
          Object.assign(item, { titulo: info.title || '', thumb: info.thumbnail_url || '' });
          renderList('galeria');
        } catch {
          // sem miniatura
        }
      });
  } finally {
    setBusy('');
  }
}

async function openZip(file) {
  try {
    const zip = await JSZip.loadAsync(file);
    const entry = Object.values(zip.files).find((f) => !f.dir && /(^|\/)projeto\.json$/.test(f.name));
    if (!entry) throw new Error('Esse .zip não tem projeto.json.');
    const base = entry.name.slice(0, -'projeto.json'.length);
    const slug = base.replace(/\/$/, '').split('/').pop() || file.name.replace(/\.zip$/i, '').replace(/^projeto-/, '');
    const data = JSON.parse(await entry.async('string'));
    const getBlob = async (name) => {
      const found = zip.file(base + name);
      return found ? new Blob([await found.async('arraybuffer')], { type: 'image/webp' }) : null;
    };
    await loadProjectData(data, slug, getBlob, siteProjects.some((p) => p.slug === slug) ? slug : '');
  } catch (error) {
    console.error(error);
    toast(`Não foi possível abrir o pacote: ${error.message}`, 'is-error');
  }
}

async function openFromSite(slug) {
  const dir = `${SITE}assets/projetos/${slug}/`;
  try {
    const response = await fetch(`${dir}projeto.json`, { cache: 'no-store' });
    if (!response.ok) throw new Error('projeto não encontrado');
    const data = await response.json();
    const getBlob = async (name) => {
      const file = await fetch(dir + name);
      return file.ok ? file.blob() : null;
    };
    await loadProjectData(data, slug, getBlob, slug);
  } catch (error) {
    console.error(error);
    toast(`Não foi possível abrir o projeto: ${error.message}`, 'is-error');
  }
}

function renderSiteList(filter = '') {
  const term = slugify(filter);
  const items = siteProjects.filter((p) => !term || slugify(`${p.titulo} ${p.cliente}`).includes(term));
  $('#siteList').innerHTML = items.length
    ? items.map((p) => `<li><button type="button" data-slug="${esc(p.slug)}"><span>${esc(plain(p.titulo))}</span><small>${esc(p.cliente)} · ${esc(p.ano)}</small></button></li>`).join('')
    : '<li class="empty">Nenhum projeto encontrado.</li>';
}

const confirmReplace = () => !hasContent() || window.confirm('Isso substitui o rascunho atual. Continuar?');

// ——— Exportação ———
async function exportPackage(force = false) {
  const { errors, warnings } = renderChecklist();
  if (errors.length || (warnings.length && !force)) {
    $('#exportTitle').textContent = errors.length ? 'Faltam alguns itens' : 'Confira antes de gerar';
    $('#exportList').innerHTML = [...errors.map((t) => `<li class="is-error">${esc(t)}</li>`), ...warnings.map((t) => `<li class="is-warn">${esc(t)}</li>`)].join('');
    $('#btnForce').hidden = errors.length > 0;
    $('#dlgExport').showModal();
    return;
  }

  const { projeto, images, slug } = assemble();
  const buttons = $$('[data-export]');
  buttons.forEach((b) => { b.disabled = true; });
  setBusy('Gerando pacote…');
  try {
    const zip = new JSZip();
    const folder = zip.folder(slug);
    images.forEach(({ img, file }) => {
      folder.file(file, img.full);
      folder.file(file.replace(/\.webp$/, '-sm.webp'), img.sm);
    });
    folder.file('projeto.json', `${JSON.stringify(projeto, null, 2)}\n`);
    const blob = await zip.generateAsync({ type: 'blob' });

    const name = `projeto-${slug}.zip`;
    const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 20000);

    const replacing = siteProjects.some((p) => p.slug === slug);
    $('#doneName').textContent = name;
    $('#doneCmd').textContent = `node tools/importar.mjs ${name}${replacing ? ' --substituir' : ''}`;
    $('#dlgDone').showModal();
  } catch (error) {
    console.error(error);
    toast('Erro ao gerar o pacote. Tente de novo.', 'is-error');
  } finally {
    setBusy('');
    buttons.forEach((b) => { b.disabled = false; });
  }
}

// ——— Eventos ———
function setupEvents() {
  $$('[data-field]').forEach((input) => {
    input.addEventListener('input', () => {
      state[input.dataset.field] = input.value;
      changed();
    });
  });

  const slugInput = $('#f-slug');
  slugInput.addEventListener('input', () => {
    state.slug = slugInput.value;
    state.slugManual = slugInput.value.trim() !== '';
    changed();
  });
  slugInput.addEventListener('change', () => {
    slugInput.value = currentSlug();
    state.slug = slugInput.value;
    changed();
  });

  $$('[data-highlight]').forEach((button) => {
    button.addEventListener('click', () => highlightSelection($(`#${button.dataset.highlight}`)));
  });

  // serviços
  $('#servicos').addEventListener('click', (event) => {
    const chip = event.target.closest('[data-servico]');
    if (!chip) return;
    const name = chip.dataset.servico;
    const selected = new Set(state.servicos);
    if (selected.has(name)) selected.delete(name);
    else selected.add(name);
    state.servicos = [...new Set([...siteServices, ...state.servicos, name])].filter((s) => selected.has(s));
    renderServices();
    changed();
  });
  const addService = () => {
    const name = $('#novoServico').value.trim();
    if (!name) return;
    if (!state.servicos.includes(name)) state.servicos.push(name);
    $('#novoServico').value = '';
    renderServices();
    changed();
  };
  $('#btnServico').addEventListener('click', addService);
  $('#novoServico').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addService();
    }
  });

  // créditos
  $$('[data-credito]').forEach((button) => {
    button.addEventListener('click', () => {
      state.creditos.push({ uid: uid(), funcao: button.dataset.credito, nome: '' });
      renderCredits();
      const rows = $$('.credit');
      $(button.dataset.credito ? '[data-k="nome"]' : '[data-k="funcao"]', rows[rows.length - 1]).focus();
      changed();
    });
  });
  $('#creditos').addEventListener('input', (event) => {
    const row = event.target.closest('[data-uid]');
    const credit = row && state.creditos.find((c) => c.uid === row.dataset.uid);
    if (!credit) return;
    credit[event.target.dataset.k] = event.target.value;
    changed();
  });
  $('#creditos').addEventListener('click', (event) => {
    if (!event.target.closest('[data-remove]')) return;
    const row = event.target.closest('[data-uid]');
    state.creditos = state.creditos.filter((c) => c.uid !== row.dataset.uid);
    renderCredits();
    changed();
  });

  // capa e card
  ['capa', 'card'].forEach((key) => {
    const slot = $(`[data-slot="${key}"]`);
    setupDrop(slot, false, (files) =>
      addImages(files, key === 'capa' ? MAX_COVER : MAX_SIDE, (img) => {
        state[key] = img;
        renderSlot(key);
      }),
    );
    $('[data-slot-remove]', slot).addEventListener('click', () => {
      state[key] = null;
      renderSlot(key);
      changed();
    });
  });

  // bastidores e galeria
  ['bastidores', 'galeria'].forEach((key) => {
    const list = $(`[data-list="${key}"]`);
    setupDrop($(`[data-drop="${key}"]`), true, (files) =>
      addImages(files, MAX_SIDE, (img) => {
        state[key].push(img);
        renderList(key);
      }),
    );
    new Sortable(list, {
      animation: 160,
      filter: 'input, select, button',
      preventOnFilter: false,
      onEnd: () => {
        const order = $$('[data-uid]', list).map((el) => el.dataset.uid);
        state[key].sort((a, b) => order.indexOf(a.uid) - order.indexOf(b.uid));
        changed();
      },
    });
    list.addEventListener('input', (event) => {
      const row = event.target.closest('[data-uid]');
      const item = row && state[key].find((i) => i.uid === row.dataset.uid);
      if (!item || !event.target.dataset.k) return;
      item[event.target.dataset.k] = event.target.value;
      changed();
    });
    list.addEventListener('change', (event) => {
      if (event.target.dataset.k === 'orientacao') changed();
    });
    list.addEventListener('click', (event) => {
      if (!event.target.closest('[data-remove]')) return;
      const row = event.target.closest('[data-uid]');
      state[key] = state[key].filter((i) => i.uid !== row.dataset.uid);
      renderList(key);
      changed();
    });
  });

  const vimeoInput = $('#vimeoLink');
  const submitVimeo = async () => {
    if (!vimeoInput.value.trim()) return;
    if (await addVimeo(vimeoInput.value)) vimeoInput.value = '';
  };
  $('#btnVimeo').addEventListener('click', submitVimeo);
  vimeoInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      submitVimeo();
    }
  });

  // pré-visualização
  $$('[data-view]').forEach((button) => {
    button.addEventListener('click', () => {
      view = button.dataset.view;
      $$('[data-view]').forEach((b) => b.classList.toggle('is-on', b === button));
      renderPreview();
    });
  });
  $$('[data-device]').forEach((button) => {
    button.addEventListener('click', () => {
      device = button.dataset.device;
      $$('[data-device]').forEach((b) => b.classList.toggle('is-on', b === button));
      fitPreview();
    });
  });
  new ResizeObserver(fitPreview).observe($('.preview-stage'));

  // barra superior
  $('#btnNovo').addEventListener('click', async () => {
    if (!confirmReplace()) return;
    state = emptyState();
    renderAll();
    await drafts.clear().catch(() => {});
  });

  const menu = $('#menuAbrir');
  const toggleMenu = (open) => {
    menu.hidden = !open;
    $('#btnAbrir').setAttribute('aria-expanded', String(open));
  };
  $('#btnAbrir').addEventListener('click', (event) => {
    event.stopPropagation();
    toggleMenu(menu.hidden);
  });
  document.addEventListener('click', () => toggleMenu(false));
  menu.addEventListener('click', (event) => {
    const option = event.target.closest('[data-open]');
    if (!option) return;
    toggleMenu(false);
    if (!confirmReplace()) return;
    if (option.dataset.open === 'zip') $('#zipInput').click();
    else {
      if (!siteProjects.length) {
        toast('A lista de projetos do site não carregou. Abra o admin pelo endereço do site.', 'is-error');
        return;
      }
      $('#siteSearch').value = '';
      renderSiteList();
      $('#dlgSite').showModal();
      $('#siteSearch').focus();
    }
  });
  $('#zipInput').addEventListener('change', (event) => {
    const [file] = event.target.files;
    if (file) openZip(file);
    event.target.value = '';
  });
  $('#siteSearch').addEventListener('input', (event) => renderSiteList(event.target.value));
  $('#siteList').addEventListener('click', (event) => {
    const button = event.target.closest('[data-slug]');
    if (!button) return;
    $('#dlgSite').close();
    openFromSite(button.dataset.slug);
  });

  $$('[data-export]').forEach((button) => button.addEventListener('click', () => exportPackage()));
  $('#btnForce').addEventListener('click', () => {
    $('#dlgExport').close();
    exportPackage(true);
  });
  document.addEventListener('click', (event) => {
    const close = event.target.closest('[data-close]');
    if (close) close.closest('dialog').close();
  });
}

// ——— Início ———
async function init() {
  setupEvents();
  const [siteData, index, template] = await Promise.allSettled([
    fetch(`${SITE}data/site.json`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
    fetch(`${SITE}projetos/index.json`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
    fetch('templates/projeto.html', { cache: 'no-store' }).then((r) => (r.ok ? r.text() : Promise.reject(r.status))),
  ]);
  if (siteData.status === 'fulfilled' && Array.isArray(siteData.value.servicos)) {
    siteServices = siteData.value.servicos.map((s) => plain(s.nome));
  }
  if (index.status === 'fulfilled') {
    siteProjects = index.value;
    $('#lista-clientes').innerHTML = [...new Set(siteProjects.map((p) => p.cliente))].map((c) => `<option value="${esc(c)}">`).join('');
  }
  if (template.status === 'fulfilled') projectTemplate = template.value.match(/<main[\s\S]*<\/main>/)?.[0] || null;

  try {
    const draft = await drafts.load();
    if (draft) state = { ...emptyState(), ...draft };
  } catch (error) {
    console.warn('Rascunho indisponível', error);
  }
  renderAll();
  fitPreview();
  $('#saveState').textContent = hasContent() ? 'Rascunho recuperado' : '';
}

init();
