document.addEventListener('DOMContentLoaded', () => {
  // State
  let campaign = {
    title: '',
    client: '',
    mode: 'popup',
    desc: '',
    year: '',
    direction: '',
    photo: '',
    badge: '',
    cover: null, // { file: Blob, type: 'image/webp'|'image/gif', ext: 'webp'|'gif', url: string, orientation: 'landscape'|'portrait' }
    bts: null,
    gallery: [] // Array of { id: string, type: 'image'|'vimeo', file?: Blob, ext?: string, url: string, vimeoId?: string, orientation: 'landscape'|'portrait' }
  };

  const MAX_WIDTH = 2560;
  const WEBP_QUALITY = 0.82;

  // DOM Elements
  const form = document.getElementById('campaignForm');
  const titleInput = document.getElementById('campaignTitle');
  const clientInput = document.getElementById('campaignClient');
  const modeSelect = document.getElementById('campaignMode');
  const descInput = document.getElementById('campaignDesc');
  const yearInput = document.getElementById('campaignYear');
  const dirInput = document.getElementById('campaignDirection');
  const photoInput = document.getElementById('campaignPhoto');
  const badgeInput = document.getElementById('campaignBadge');
  const exportBtn = document.getElementById('exportBtn');

  // Preview Elements
  const prevTitle = document.getElementById('previewTitle');
  const prevClient = document.getElementById('previewClient');
  const prevDesc = document.getElementById('previewDesc');
  const prevCover = document.getElementById('previewCover');
  const prevGallery = document.getElementById('previewGallery');

  // Helper: Slugify
  const slugify = text => text.toString().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');

  // Helper: Parse Markdown
  const parseMarkdown = text => {
    if (!text) return '';
    return text.replace(/\*(.*?)\*/g, '<em>$1</em>').replace(/\n/g, '<br>');
  };

  // Update Live Preview Texts
  const updatePreview = () => {
    campaign.title = titleInput.value;
    campaign.client = clientInput.value;
    campaign.mode = modeSelect.value;
    campaign.desc = descInput.value;
    campaign.year = yearInput.value;
    campaign.direction = dirInput.value;
    campaign.photo = photoInput.value;
    campaign.badge = badgeInput.value;

    prevTitle.textContent = campaign.title || 'Nome da Campanha';
    prevClient.textContent = campaign.client || 'Cliente';
    prevDesc.innerHTML = parseMarkdown(campaign.desc) || 'A descrição aparecerá aqui.';

    checkValidity();
  };

  titleInput.addEventListener('input', updatePreview);
  clientInput.addEventListener('input', updatePreview);
  modeSelect.addEventListener('change', updatePreview);
  descInput.addEventListener('input', updatePreview);
  yearInput.addEventListener('input', updatePreview);
  dirInput.addEventListener('input', updatePreview);
  photoInput.addEventListener('input', updatePreview);
  badgeInput.addEventListener('input', updatePreview);

  // Validate form for Export
  const checkValidity = () => {
    const isValid = campaign.title.trim() !== '' && campaign.client.trim() !== '' && campaign.cover !== null;
    exportBtn.disabled = !isValid;
  };

  // Image Processor
  const processImage = (file) => {
    return new Promise((resolve, reject) => {
      const isGif = file.type === 'image/gif';
      
      if (isGif) {
        if (file.size > 4 * 1024 * 1024) {
          alert('Atenção: O GIF tem mais de 4MB. Recomenda-se otimizar antes de subir.');
        }
        
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        img.onload = () => {
          const orientation = img.width > img.height ? 'landscape' : 'portrait';
          resolve({ file: file, ext: 'gif', url: objectUrl, orientation });
        };
        img.onerror = reject;
        img.src = objectUrl;
        return;
      }

      // Convert JPG/PNG to WebP
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          const orientation = width > height ? 'landscape' : 'portrait';

          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob((blob) => {
            const objectUrl = URL.createObjectURL(blob);
            resolve({ file: blob, ext: 'webp', url: objectUrl, orientation });
          }, 'image/webp', WEBP_QUALITY);
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Setup Dropzones (Cover & BTS)
  const setupSingleDropzone = (id, stateKey, onUpdate) => {
    const el = document.getElementById(id);
    const previewContainer = el.querySelector('.preview-container');
    const removeBtn = el.querySelector('.remove-btn');

    const handleFile = async (file) => {
      if (!file.type.startsWith('image/')) return;
      
      // UI Loading state
      el.style.opacity = '0.5';
      
      try {
        const processed = await processImage(file);
        campaign[stateKey] = processed;
        
        previewContainer.innerHTML = `<img src="${processed.url}" />`;
        el.classList.add('has-file');
        el.style.opacity = '1';
        
        if (onUpdate) onUpdate(processed);
        checkValidity();
      } catch (err) {
        console.error(err);
        alert('Erro ao processar a imagem.');
        el.style.opacity = '1';
      }
    };

    el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('dragover'); });
    el.addEventListener('dragleave', () => el.classList.remove('dragover'));
    el.addEventListener('drop', e => {
      e.preventDefault();
      el.classList.remove('dragover');
      if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    });

    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      campaign[stateKey] = null;
      el.classList.remove('has-file');
      previewContainer.innerHTML = '';
      if (onUpdate) onUpdate(null);
      checkValidity();
    });

    // Click to upload
    el.addEventListener('click', (e) => {
      if (e.target === removeBtn) return;
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = e => { if (e.target.files.length) handleFile(e.target.files[0]); };
      input.click();
    });
  };

  setupSingleDropzone('dropCapa', 'cover', (processed) => {
    if (processed) {
      prevCover.style.backgroundImage = `url(${processed.url})`;
    } else {
      prevCover.style.backgroundImage = 'none';
    }
  });

  setupSingleDropzone('dropBts', 'bts');

  // Setup Gallery Grid (Sortable)
  const galleryGrid = document.getElementById('galleryGrid');
  const dropGallery = document.getElementById('dropGallery');
  
  const sortable = new Sortable(galleryGrid, {
    animation: 150,
    ghostClass: 'sortable-ghost',
    onEnd: () => {
      syncGalleryOrder();
    }
  });

  const syncGalleryOrder = () => {
    const newGallery = [];
    const items = galleryGrid.querySelectorAll('.gallery-item');
    items.forEach(item => {
      const id = item.dataset.id;
      const found = campaign.gallery.find(g => g.id === id);
      if (found) newGallery.push(found);
    });
    campaign.gallery = newGallery;
    renderGalleryPreview();
  };

  const addGalleryItemToDOM = (item) => {
    const div = document.createElement('div');
    div.className = 'gallery-item';
    div.dataset.id = item.id;

    if (item.type === 'image') {
      div.innerHTML = `
        <img class="thumb" src="${item.url}" />
        <div class="info">
          <span class="type">IMAGEM (${item.ext.toUpperCase()})</span>
          <span>Orientação: ${item.orientation === 'landscape' ? 'Horizontal' : 'Vertical'}</span>
        </div>
        <button type="button" class="remove-item">✕</button>
      `;
    } else if (item.type === 'vimeo') {
      div.innerHTML = `
        <img class="thumb" src="${item.url || ''}" />
        <div class="info">
          <span class="type">VIMEO</span>
          <span>ID: ${item.vimeoId}</span>
          <select class="vimeo-orientation" style="width:120px; padding:2px; font-size:11px;">
            <option value="landscape" ${item.orientation === 'landscape' ? 'selected' : ''}>Horizontal 16:9</option>
            <option value="portrait" ${item.orientation === 'portrait' ? 'selected' : ''}>Vertical 9:16</option>
          </select>
        </div>
        <button type="button" class="remove-item">✕</button>
      `;
      
      div.querySelector('.vimeo-orientation').addEventListener('change', (e) => {
        item.orientation = e.target.value;
        renderGalleryPreview();
      });
    }

    div.querySelector('.remove-item').addEventListener('click', () => {
      campaign.gallery = campaign.gallery.filter(g => g.id !== item.id);
      div.remove();
      renderGalleryPreview();
    });

    galleryGrid.appendChild(div);
  };

  const handleGalleryFiles = async (files) => {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;
      
      const processed = await processImage(file);
      const item = {
        id: 'img_' + Math.random().toString(36).substr(2, 9),
        type: 'image',
        ...processed
      };
      campaign.gallery.push(item);
      addGalleryItemToDOM(item);
    }
    renderGalleryPreview();
  };

  dropGallery.addEventListener('dragover', e => { e.preventDefault(); dropGallery.classList.add('dragover'); });
  dropGallery.addEventListener('dragleave', () => dropGallery.classList.remove('dragover'));
  dropGallery.addEventListener('drop', e => {
    e.preventDefault();
    dropGallery.classList.remove('dragover');
    if (e.dataTransfer.files.length) handleGalleryFiles(e.dataTransfer.files);
  });
  dropGallery.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = e => { if (e.target.files.length) handleGalleryFiles(e.target.files); };
    input.click();
  });

  // Add Vimeo Button
  document.getElementById('addVimeoBtn').addEventListener('click', async () => {
    let input = prompt('Cole o link do Vimeo ou o ID do vídeo:');
    if (!input) return;
    
    // Extract ID
    const match = input.match(/(?:vimeo\.com\/|^)(\d+)/);
    const vimeoId = match ? match[1] : input.trim();
    
    if (!/^\d+$/.test(vimeoId)) {
      alert('ID inválido.');
      return;
    }

    const item = {
      id: 'vimeo_' + Math.random().toString(36).substr(2, 9),
      type: 'vimeo',
      vimeoId: vimeoId,
      orientation: 'horizontal', // default
      url: '' // will hold thumbnail
    };

    // Try fetch thumbnail
    try {
      const res = await fetch(`https://vimeo.com/api/oembed.json?url=https://vimeo.com/${vimeoId}`);
      if (res.ok) {
        const data = await res.json();
        item.url = data.thumbnail_url;
        item.orientation = data.width > data.height ? 'landscape' : 'portrait';
      }
    } catch (e) { console.warn('Could not fetch vimeo thumb', e); }

    campaign.gallery.push(item);
    addGalleryItemToDOM(item);
    renderGalleryPreview();
  });

  // Render Gallery Preview
  const renderGalleryPreview = () => {
    prevGallery.innerHTML = '';
    campaign.gallery.forEach(item => {
      const wrap = document.createElement('div');
      wrap.className = 'img-wrap ' + (item.orientation === 'landscape' ? 'landscape' : 'portrait');
      
      if (item.type === 'image') {
        wrap.innerHTML = `<img src="${item.url}">`;
      } else if (item.type === 'vimeo') {
        if (item.url) {
          wrap.innerHTML = `<img src="${item.url}"><div class="vimeo-placeholder">VIMEO PLAY</div>`;
        } else {
          wrap.innerHTML = `<div class="vimeo-placeholder">VIMEO: ${item.vimeoId}</div>`;
        }
      }
      prevGallery.appendChild(wrap);
    });
  };

  // Export Logic
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (exportBtn.disabled) return;

    exportBtn.disabled = true;
    exportBtn.innerHTML = '<span class="loader"></span> Gerando ZIP...';

    try {
      const zip = new JSZip();
      const slug = slugify(campaign.title);
      
      const config = {
        id: slug,
        client: campaign.client.trim(),
        title: campaign.title.trim(),
        description: parseMarkdown(campaign.desc),
        displayMode: campaign.mode,
        year: campaign.year.trim(),
        direction: campaign.direction.trim(),
        photo: campaign.photo.trim(),
        badge: campaign.badge.trim(),
        cover: '',
        bts: '',
        media: []
      };

      // Helper to add blob
      const addBlob = (blob, filename) => {
        return new Promise(resolve => {
          const reader = new FileReader();
          reader.onload = () => {
            zip.file(filename, reader.result.split(',')[1], {base64: true});
            resolve();
          };
          reader.readAsDataURL(blob);
        });
      };

      // Add Cover
      if (campaign.cover) {
        config.cover = `capa-${slug}.${campaign.cover.ext}`;
        await addBlob(campaign.cover.file, config.cover);
      }

      // Add BTS
      if (campaign.bts) {
        config.bts = `bts-${slug}.${campaign.bts.ext}`;
        await addBlob(campaign.bts.file, config.bts);
      }

      // Add Gallery
      let imgCounter = 1;
      for (const item of campaign.gallery) {
        if (item.type === 'image') {
          const filename = `${slug}-${String(imgCounter).padStart(2, '0')}.${item.ext}`;
          imgCounter++;
          await addBlob(item.file, filename);
          config.media.push({
            type: 'image',
            src: filename,
            orientation: item.orientation
          });
        } else if (item.type === 'vimeo') {
          config.media.push({
            type: 'vimeo',
            src: item.vimeoId,
            orientation: item.orientation
          });
        }
      }

      // Add Config JSON
      zip.file('config.json', JSON.stringify(config, null, 2));

      // Generate Zip and Download
      const content = await zip.generateAsync({type:"blob"});
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `campanha-${slug}.zip`;
      link.click();

    } catch (err) {
      console.error(err);
      alert('Erro ao gerar o arquivo ZIP. Veja o console.');
    } finally {
      exportBtn.disabled = false;
      exportBtn.innerHTML = 'Gerar Pacote ZIP';
    }
  });

});
