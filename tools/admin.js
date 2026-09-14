// Muma — gera o pacote de um projeto (imagens otimizadas + projeto.json) para o site
document.addEventListener('DOMContentLoaded', () => {
  const MAX_SIDE = 2000; // lado maior da imagem completa
  const SM_SIDE = 900; // versão leve usada nas grades
  const QUALITY = 0.82;

  const $ = (id) => document.getElementById(id);
  const state = { capa: null, card: null, bastidores: [], galeria: [] };

  const form = $('campaignForm');
  const exportBtn = $('exportBtn');

  const slugify = (text) =>
    text
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/\*/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const highlight = (s) => escapeHtml(s).replace(/\*(.+?)\*/g, '<em>$1</em>');
  const paragraphs = (s) => s.split(/\n\s*\n/).map((p) => p.trim().replace(/\s*\n\s*/g, ' ')).filter(Boolean);
  const uid = () => Math.random().toString(36).slice(2, 11);

  // ——— Imagens: redimensiona e converte para WebP ———
  const loadImage = (file) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });

  const toWebp = (img, maxSide) =>
    new Promise((resolve) => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(resolve, 'image/webp', QUALITY);
    });

  async function processImage(file) {
    if (file.type === 'image/gif') {
      alert('GIFs animados viram imagem estática aqui. Para movimento, suba o vídeo no Vimeo e adicione pelo botão "+ Vimeo".');
    }
    const img = await loadImage(file);
    const full = await toWebp(img, MAX_SIDE);
    const sm = await toWebp(img, SM_SIDE);
    return { full, sm, url: URL.createObjectURL(full), orientacao: img.width > img.height ? 'horizontal' : 'vertical' };
  }

  const pickFiles = (multiple, onFiles) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = multiple;
    input.onchange = () => input.files.length && onFiles(input.files);
    input.click();
  };

  // ——— Capa e card (uma imagem cada) ———
  function setupSingle(id, key, onChange) {
    const zone = $(id);
    const preview = zone.querySelector('.preview-container');
    const removeBtn = zone.querySelector('.remove-btn');

    const handle = async (file) => {
      if (!file.type.startsWith('image/')) return;
      zone.style.opacity = '.5';
      try {
        state[key] = await processImage(file);
        preview.innerHTML = `<img src="${state[key].url}" alt="">`;
        zone.classList.add('has-file');
        onChange && onChange();
      } catch (err) {
        console.error(err);
        alert('Não foi possível processar a imagem.');
      }
      zone.style.opacity = '1';
      refresh();
    };

    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('dragover');
      if (e.dataTransfer.files.length) handle(e.dataTransfer.files[0]);
    });
    zone.addEventListener('click', (e) => {
      if (e.target !== removeBtn) pickFiles(false, (files) => handle(files[0]));
    });
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      state[key] = null;
      preview.innerHTML = '';
      zone.classList.remove('has-file');
      onChange && onChange();
      refresh();
    });
  }

  setupSingle('dropCapa', 'capa');
  setupSingle('dropCard', 'card');

  // ——— Listas: bastidores e galeria ———
  function setupList(gridId, dropId, key) {
    const grid = $(gridId);
    const zone = $(dropId);

    new Sortable(grid, {
      animation: 150,
      ghostClass: 'sortable-ghost',
      onEnd: () => {
        const order = [...grid.children].map((el) => el.dataset.id);
        state[key].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
        refresh();
      },
    });

    const addFiles = async (files) => {
      for (const file of files) {
        if (!file.type.startsWith('image/')) continue;
        const item = { id: uid(), tipo: 'imagem', ...(await processImage(file)) };
        state[key].push(item);
        grid.appendChild(renderItem(item, key));
      }
      refresh();
    };

    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('dragover');
      if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
    });
    zone.addEventListener('click', () => pickFiles(true, addFiles));

    return grid;
  }

  function renderItem(item, key) {
    const el = document.createElement('div');
    el.className = 'gallery-item';
    el.dataset.id = item.id;

    if (item.tipo === 'imagem') {
      el.innerHTML = `
        <img class="thumb" src="${item.url}" alt="">
        <div class="info">
          <span class="type">IMAGEM</span>
          <span>${item.orientacao === 'horizontal' ? 'Horizontal' : 'Vertical'}</span>
        </div>
        <button type="button" class="remove-item">✕</button>`;
    } else {
      el.innerHTML = `
        <img class="thumb" src="${item.url || ''}" alt="">
        <div class="info">
          <span class="type">VIMEO · ${item.id_vimeo}</span>
          <select class="vimeo-orientation">
            <option value="vertical" ${item.orientacao === 'vertical' ? 'selected' : ''}>Vertical 9:16</option>
            <option value="horizontal" ${item.orientacao === 'horizontal' ? 'selected' : ''}>Horizontal 16:9</option>
          </select>
          <label><input type="checkbox" class="vimeo-player" ${item.player ? 'checked' : ''}> com som e controles</label>
        </div>
        <button type="button" class="remove-item">✕</button>`;
      el.querySelector('.vimeo-orientation').addEventListener('change', (e) => { item.orientacao = e.target.value; });
      el.querySelector('.vimeo-player').addEventListener('change', (e) => { item.player = e.target.checked; });
    }

    el.querySelector('.remove-item').addEventListener('click', () => {
      state[key] = state[key].filter((i) => i.id !== item.id);
      el.remove();
      refresh();
    });
    return el;
  }

  setupList('btsGrid', 'dropBts', 'bastidores');
  const galleryGrid = setupList('galleryGrid', 'dropGallery', 'galeria');

  $('addVimeoBtn').addEventListener('click', async () => {
    const input = prompt('Cole o link ou o ID do vídeo no Vimeo:');
    if (!input) return;
    const match = input.match(/(\d{6,})/);
    if (!match) {
      alert('Não encontrei o ID do vídeo nesse link.');
      return;
    }
    const item = { id: uid(), tipo: 'vimeo', id_vimeo: match[1], orientacao: 'vertical', player: false, url: '' };
    try {
      const res = await fetch(`https://vimeo.com/api/oembed.json?url=https://vimeo.com/${item.id_vimeo}`);
      if (res.ok) {
        const data = await res.json();
        item.url = data.thumbnail_url;
        item.orientacao = data.width > data.height ? 'horizontal' : 'vertical';
      }
    } catch (err) {
      console.warn('Sem miniatura do Vimeo', err);
    }
    state.galeria.push(item);
    galleryGrid.appendChild(renderItem(item, 'galeria'));
    refresh();
  });

  // ——— Pré-visualização e validação ———
  function refresh() {
    const titulo = $('titulo').value.trim();
    const cliente = $('cliente').value.trim();

    $('previewTitle').innerHTML = titulo ? highlight(titulo) : 'Título do projeto';
    $('previewClient').textContent = cliente || 'Cliente';
    const desc = paragraphs($('descricao').value);
    $('previewDesc').innerHTML = desc.length ? desc.map(highlight).join('<br><br>') : 'A descrição aparecerá aqui.';
    $('previewCover').style.backgroundImage = state.capa ? `url(${state.capa.url})` : 'none';
    $('previewGallery').innerHTML = state.galeria
      .map((item) => `<div class="img-wrap ${item.orientacao === 'horizontal' ? 'landscape' : 'portrait'}">${item.url ? `<img src="${item.url}" alt="">` : ''}${item.tipo === 'vimeo' ? '<div class="vimeo-placeholder">VIMEO</div>' : ''}</div>`)
      .join('');

    exportBtn.disabled = !(titulo && cliente && state.capa);
  }

  form.addEventListener('input', refresh);
  form.addEventListener('change', refresh);

  // ——— Exportação ———
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (exportBtn.disabled) return;
    exportBtn.disabled = true;
    exportBtn.textContent = 'Gerando pacote…';

    try {
      const slug = slugify($('titulo').value);
      const zip = new JSZip();
      const folder = zip.folder(slug);
      const addImage = (name, item) => {
        folder.file(`${name}.webp`, item.full);
        folder.file(`${name}-sm.webp`, item.sm);
        return `${name}.webp`;
      };

      const projeto = {
        titulo: $('titulo').value.trim(),
        cliente: $('cliente').value.trim(),
        ano: $('ano').value.trim(),
        categoria: $('categoria').value.trim(),
        subtitulo: $('subtitulo').value.trim(),
        servicos: $('servicos').value.split(',').map((s) => s.trim()).filter(Boolean),
        creditos: $('creditos').value
          .split('\n')
          .map((line) => line.split(':'))
          .filter((parts) => parts.length > 1)
          .map(([funcao, ...nome]) => ({ funcao: funcao.trim(), nome: nome.join(':').trim() })),
        descricao: paragraphs($('descricao').value),
        capa: addImage('capa', state.capa),
        bastidores: state.bastidores.map((item, i) => addImage(`bts-${String(i + 1).padStart(2, '0')}`, item)),
        midias: [],
      };
      if (state.card) projeto.card = addImage('card', state.card);

      let n = 1;
      for (const item of state.galeria) {
        if (item.tipo === 'imagem') {
          projeto.midias.push({ tipo: 'imagem', arquivo: addImage(String(n++).padStart(2, '0'), item) });
        } else {
          projeto.midias.push({ tipo: 'vimeo', id: item.id_vimeo, orientacao: item.orientacao, ...(item.player ? { player: true } : {}) });
        }
      }

      folder.file('projeto.json', `${JSON.stringify(projeto, null, 2)}\n`);

      const blob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `projeto-${slug}.zip`;
      link.click();
    } catch (err) {
      console.error(err);
      alert('Erro ao gerar o pacote. Veja o console.');
    } finally {
      exportBtn.disabled = false;
      exportBtn.textContent = 'Gerar pacote .zip';
    }
  });

  refresh();
});
