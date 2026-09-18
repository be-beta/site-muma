// Muma Estúdio Criativo — interações do site
(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ——— Nav: some ao rolar para baixo, volta ao rolar para cima ———
  const nav = document.querySelector('.nav');
  if (nav) {
    let lastY = window.scrollY;
    let holdUntil = 0;
    window.addEventListener('scroll', () => {
      const y = window.scrollY;
      if (Date.now() > holdUntil) nav.classList.toggle('is-hidden', y > lastY && y > 200);
      lastY = y;
    }, { passive: true });
    nav.addEventListener('focusin', () => nav.classList.remove('is-hidden'));
    // ao clicar numa âncora, a nav continua visível durante a rolagem suave
    document.addEventListener('click', (event) => {
      if (!event.target.closest('a[href*="#"]')) return;
      holdUntil = Date.now() + 1600;
      nav.classList.remove('is-hidden');
    });
  }

  // ——— Elementos entram suavemente ao aparecer na tela ———
  let pending = [...document.querySelectorAll('[data-reveal]')];
  let ticking = false;
  const reveal = () => {
    ticking = false;
    const limit = window.innerHeight * 0.94;
    pending = pending.filter((el) => {
      if (reduceMotion || el.getBoundingClientRect().top < limit) {
        el.classList.add('is-in');
        return false;
      }
      return true;
    });
    if (!pending.length) {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    }
  };
  const schedule = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(reveal);
  };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  reveal();

  // ——— Proteção das imagens: sem menu de contexto nem arrastar ———
  const PROTECTED = 'img, .tile, .card-media, .gallery-item, .bts-item, .project-cover, .studio-photo, .team-photo, .next-media, .video, .service-preview';
  ['contextmenu', 'dragstart'].forEach((type) => {
    document.addEventListener(type, (event) => {
      if (event.target.closest(PROTECTED)) event.preventDefault();
    });
  });

  // ——— Lente de bastidor: acompanha o mouse sobre a imagem do projeto ———
  document.querySelectorAll('.card-media').forEach((media) => {
    const follow = (event) => {
      if (event.pointerType !== 'mouse') return;
      const rect = media.getBoundingClientRect();
      media.style.setProperty('--x', `${event.clientX - rect.left}px`);
      media.style.setProperty('--y', `${event.clientY - rect.top}px`);
    };
    media.addEventListener('pointerenter', follow);
    media.addEventListener('pointermove', follow);
  });

  // Em telas de toque, o botão "ver bastidor" revela a cena
  document.querySelectorAll('.bts-toggle').forEach((button) => {
    button.addEventListener('click', () => {
      const active = button.closest('.card').classList.toggle('is-bts');
      button.setAttribute('aria-pressed', String(active));
      button.textContent = active ? 'ver campanha' : 'ver bastidor';
    });
  });

  // ——— Serviços: a foto troca no painel ao lado da lista ———
  const preview = document.querySelector('.service-preview');
  const serviceList = document.querySelector('.services-list');
  if (preview && serviceList) {
    const previewImg = preview.querySelector('img');
    const items = [...serviceList.querySelectorAll('.service[data-thumb]')];
    let preloaded = false;
    let timer = 0;
    const show = (thumb) => {
      if (!thumb || previewImg.dataset.atual === thumb) return;
      previewImg.dataset.atual = thumb;
      preview.classList.add('is-changing');
      clearTimeout(timer);
      timer = setTimeout(() => {
        previewImg.removeAttribute('srcset');
        previewImg.src = thumb;
        preview.classList.remove('is-changing');
      }, 140);
    };
    items.forEach((item) => {
      const activate = () => {
        if (!preloaded) {
          items.forEach((other) => { new Image().src = other.dataset.thumb; });
          preloaded = true;
        }
        show(item.dataset.thumb);
      };
      item.addEventListener('pointerenter', activate);
      item.addEventListener('focus', activate);
    });
  }

  // ——— Estúdio: abre a bio de cada integrante ———
  document.querySelectorAll('.member-head').forEach((head) => {
    head.addEventListener('click', () => {
      const member = head.closest('.member');
      const open = !member.classList.contains('is-open');
      document.querySelectorAll('.member.is-open').forEach((other) => {
        other.classList.remove('is-open');
        other.querySelector('.member-head').setAttribute('aria-expanded', 'false');
      });
      member.classList.toggle('is-open', open);
      head.setAttribute('aria-expanded', String(open));
    });
  });

  // ——— Galeria justificada: mantém as proporções e equilibra as linhas ———
  // Divide a sequência de proporções em k linhas com somas o mais parecidas possível
  const partition = (ratios, k) => {
    const n = ratios.length;
    if (k >= n) return ratios.map((_, i) => [i]);
    const prefix = [0];
    ratios.forEach((r, i) => prefix.push(prefix[i] + r));
    const target = prefix[n] / k;
    const cost = Array.from({ length: k + 1 }, () => new Array(n + 1).fill(Infinity));
    const cut = Array.from({ length: k + 1 }, () => new Array(n + 1).fill(0));
    cost[0][0] = 0;
    for (let row = 1; row <= k; row++) {
      for (let end = row; end <= n; end++) {
        for (let start = row - 1; start < end; start++) {
          const value = cost[row - 1][start] + (prefix[end] - prefix[start] - target) ** 2;
          if (value < cost[row][end]) {
            cost[row][end] = value;
            cut[row][end] = start;
          }
        }
      }
    }
    const rows = [];
    for (let row = k, end = n; row > 0; row--) {
      const start = cut[row][end];
      rows.unshift(Array.from({ length: end - start }, (_, i) => start + i));
      end = start;
    }
    return rows;
  };

  const layoutJustified = (box) => {
    const items = [...box.children];
    const ratios = items.map((el) => parseFloat(el.style.getPropertyValue('--ar')) || 1);
    const width = box.clientWidth;
    if (!width) return;
    const gap = parseFloat(getComputedStyle(box).columnGap) || 0;
    const rowAspect = width > 1000 ? 2.6 : width > 600 ? 2 : 1.3;
    const total = ratios.reduce((sum, r) => sum + r, 0);
    const rows = partition(ratios, Math.max(1, Math.round(total / rowAspect)));
    const maxHeight = window.innerHeight * 0.85;

    rows.forEach((row) => {
      const sum = row.reduce((s, i) => s + ratios[i], 0);
      const height = Math.min((width - 0.5 - gap * (row.length - 1)) / sum, maxHeight);
      row.forEach((i) => {
        items[i].style.width = `${ratios[i] * height}px`;
        items[i].style.height = `${height}px`;
      });
    });
    box.style.justifyContent = rows.length === 1 ? 'center' : '';
    box.classList.add('is-laid');
  };

  const justifiedBoxes = [...document.querySelectorAll('.justified')];
  justifiedBoxes.forEach((box) => {
    layoutJustified(box);
    if ('ResizeObserver' in window) new ResizeObserver(() => layoutJustified(box)).observe(box);
  });
  if (!('ResizeObserver' in window)) {
    window.addEventListener('resize', () => justifiedBoxes.forEach(layoutJustified), { passive: true });
  }

  // ——— Vídeos: player próprio sobre o Vimeo ———
  const videoEls = [...document.querySelectorAll('[data-video]')];
  if (videoEls.length) {
    const VIMEO = 'https://player.vimeo.com';
    const players = videoEls.map((el, index) => ({
      el,
      index,
      iframe: el.querySelector('iframe'),
      playing: false,
      muted: true,
      volume: 0.8,
      duration: 0,
    }));

    const send = (player, method, value) => {
      const message = value === undefined ? { method } : { method, value };
      player.iframe.contentWindow?.postMessage(JSON.stringify(message), VIMEO);
    };
    const listen = (player) => ['play', 'pause', 'ended'].forEach((ev) => send(player, 'addEventListener', ev));

    const setPlaying = (player, playing) => {
      player.playing = playing;
      player.el.classList.toggle('is-playing', playing);
      player.el.querySelector('[data-action="toggle"].vbtn').setAttribute('aria-label', playing ? 'Pausar' : 'Reproduzir');
    };
    const setMuted = (player, muted) => {
      player.muted = muted;
      send(player, 'setVolume', muted ? 0 : player.volume);
      send(player, 'setMuted', muted);
      player.el.classList.toggle('is-unmuted', !muted);
      player.el.querySelector('[data-action="mute"]').setAttribute('aria-label', muted ? 'Ativar som' : 'Desativar som');
      player.el.querySelector('.vvolume').value = muted ? 0 : player.volume;
    };

    // Destaque: o vídeo cresce na página com o fundo escurecido
    let featured = null;
    const backdrop = document.createElement('div');
    backdrop.className = 'video-backdrop';
    document.body.append(backdrop);
    const feature = (player, on) => {
      if (on && featured && featured !== player) feature(featured, false);
      player.el.classList.toggle('is-featured', on);
      backdrop.classList.toggle('is-on', on);
      document.body.classList.toggle('has-featured', on);
      player.el.querySelector('[data-action="feature"]').setAttribute('aria-label', on ? 'Sair do destaque' : 'Destacar vídeo');
      featured = on ? player : null;
      if (on) {
        send(player, 'play');
        if (player.muted) setMuted(player, false);
      }
    };
    backdrop.addEventListener('click', () => featured && feature(featured, false));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && featured) feature(featured, false);
    });

    players.forEach((player) => {
      player.iframe.addEventListener('load', () => listen(player));
      listen(player);

      player.el.addEventListener('click', (event) => {
        const control = event.target.closest('[data-action]');
        if (!control) return;
        const action = control.dataset.action;
        if (action === 'toggle') send(player, player.playing ? 'pause' : 'play');
        if (action === 'mute') setMuted(player, !player.muted);
        if (action === 'feature') feature(player, !player.el.classList.contains('is-featured'));
      });

      player.el.querySelector('.vvolume').addEventListener('input', (event) => {
        const value = parseFloat(event.target.value);
        if (value > 0) player.volume = value;
        setMuted(player, value === 0);
      });
    });

    window.addEventListener('message', (event) => {
      if (event.origin !== VIMEO) return;
      let data = event.data;
      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch { return; }
      }
      const player = players.find((p) => p.iframe.contentWindow === event.source);
      if (!player || !data) return;

      switch (data.event) {
        case 'ready':
          listen(player);
          break;
        case 'play':
          setPlaying(player, true);
          players.forEach((other) => { if (other !== player && other.playing) send(other, 'pause'); });
          break;
        case 'pause':
          setPlaying(player, false);
          break;
        case 'ended': {
          setPlaying(player, false);
          send(player, 'setCurrentTime', 0);
          if (players.length > 1) {
            const next = players[(player.index + 1) % players.length];
            setMuted(next, player.muted);
            if (featured === player) feature(next, true);
            else send(next, 'play');
          }
          break;
        }
        default:
      }
    });
  }

  // ——— Popups de orçamento e trabalhe conosco ———
  const openModal = (name) => {
    const dialog = document.getElementById(`modal-${name}`);
    if (!dialog || typeof dialog.showModal !== 'function') return false;
    const form = dialog.querySelector('form');
    form.hidden = false;
    form.reset();
    form.querySelectorAll('.is-invalid').forEach((el) => el.classList.remove('is-invalid'));
    const status = form.querySelector('.form-status');
    status.textContent = '';
    status.classList.remove('is-error');
    dialog.querySelector('.modal-done').hidden = true;
    dialog.dataset.openedAt = String(Date.now());
    dialog.showModal();
    return true;
  };

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-modal]');
    if (trigger && openModal(trigger.dataset.modal)) {
      event.preventDefault();
      return;
    }
    const close = event.target.closest('[data-close]');
    if (close) close.closest('dialog').close();
  });
  document.querySelectorAll('dialog.modal').forEach((dialog) => {
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close(); // clique no fundo escurecido
    });
  });

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const SENT_KEY = 'muma-envios';
  const recentSends = () => {
    try {
      return JSON.parse(localStorage.getItem(SENT_KEY) || '[]').filter((t) => Date.now() - t < 10 * 60 * 1000);
    } catch {
      return [];
    }
  };

  document.querySelectorAll('form[data-form]').forEach((form) => {
    const dialog = form.closest('dialog');
    const status = form.querySelector('.form-status');
    const submit = form.querySelector('[type="submit"]');
    const fail = (message) => {
      status.textContent = message;
      status.classList.add('is-error');
    };
    const finish = () => {
      form.hidden = true;
      dialog.querySelector('.modal-done').hidden = false;
    };

    form.addEventListener('input', (event) => event.target.closest('.field')?.classList.remove('is-invalid'));

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      status.classList.remove('is-error');

      let firstInvalid = null;
      form.querySelectorAll('[required]').forEach((el) => {
        const value = el.value.trim();
        const valid = el.type === 'email' ? EMAIL_RE.test(value) : value !== '';
        el.closest('.field').classList.toggle('is-invalid', !valid);
        if (!valid && !firstInvalid) firstInvalid = el;
      });
      if (firstInvalid) {
        fail('Preencha os campos destacados.');
        firstInvalid.focus();
        return;
      }

      const data = new FormData(form);
      // Anti-spam: campo invisível, tempo mínimo de preenchimento e limite de envios
      if (data.get('_honey')) return finish();
      if (Date.now() - Number(dialog.dataset.openedAt) < 3000) return fail('Foi rápido demais! Confira os dados e envie de novo.');
      const sends = recentSends();
      if (sends.length >= 3) return fail('Recebemos várias mensagens daqui. Tente de novo em alguns minutos.');

      const payload = {};
      form.querySelectorAll('[data-label]').forEach((el) => {
        const label = el.dataset.label;
        if (label in payload) return;
        const value = el.type === 'checkbox' ? data.getAll(el.name).join(', ') : String(data.get(el.name) || '').trim();
        payload[label] = value || '—';
      });
      payload._subject = form.dataset.subject.replace(/\{(\w+)\}/g, (_, key) => String(data.get(key) || '').trim());
      payload._replyto = String(data.get('email')).trim();
      payload._template = 'table';
      payload._captcha = 'false';

      submit.disabled = true;
      status.textContent = 'Enviando…';
      try {
        // Google Apps Script recebe texto simples (evita a checagem de CORS); FormSubmit recebe JSON
        const google = form.dataset.endpoint.includes('script.google.com');
        const response = await fetch(form.dataset.endpoint, {
          method: 'POST',
          headers: google ? { 'Content-Type': 'text/plain;charset=utf-8' } : { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(payload),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || String(result.success) !== 'true') throw new Error(result.message || response.status);
        sends.push(Date.now());
        try { localStorage.setItem(SENT_KEY, JSON.stringify(sends)); } catch { /* sem armazenamento */ }
        finish();
      } catch (error) {
        console.error('Falha no envio do formulário', error);
        const email = document.querySelector('[data-copy]')?.dataset.copy || '';
        fail(`Não conseguimos enviar agora. Tente de novo ou escreva para ${email}.`);
      } finally {
        submit.disabled = false;
        if (!status.classList.contains('is-error')) status.textContent = '';
      }
    });
  });

  // ——— Logotipo com variações: troca uma letra ao passar o mouse ———
  const logo = document.querySelector('.nav-logo');
  if (logo) {
    const letters = [...logo.querySelectorAll('.lp')];
    logo.addEventListener('pointerenter', () => {
      const swapped = letters.filter((l) => l.classList.contains('swap'));
      if (swapped.length >= 2) swapped[0].classList.remove('swap');
      const options = letters.filter((l) => !l.classList.contains('swap'));
      options[Math.floor(Math.random() * options.length)].classList.add('swap');
    });
  }

  // ——— Copiar e-mail ———
  document.querySelectorAll('[data-copy]').forEach((button) => {
    const label = button.querySelector('.copy-label') || button;
    const original = label.textContent;
    button.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(button.dataset.copy);
        label.textContent = 'e-mail copiado!';
        button.classList.add('is-copied');
      } catch {
        label.textContent = button.dataset.copy;
      }
      setTimeout(() => {
        label.textContent = original;
        button.classList.remove('is-copied');
      }, 1800);
    });
  });
})();
