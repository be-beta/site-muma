// Muma Estúdio Criativo — interações do site
(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Nav: some ao rolar para baixo, volta ao rolar para cima
  const nav = document.querySelector('.nav');
  if (nav) {
    let lastY = window.scrollY;
    window.addEventListener('scroll', () => {
      const y = window.scrollY;
      nav.classList.toggle('is-hidden', y > lastY && y > 200);
      lastY = y;
    }, { passive: true });
    nav.addEventListener('focusin', () => nav.classList.remove('is-hidden'));
  }

  // Elementos entram suavemente ao aparecer na tela
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

  // Lente de bastidor: acompanha o mouse sobre a imagem do projeto
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

  // Logotipo com variações: troca uma letra ao passar o mouse
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

  // Copiar e-mail
  document.querySelectorAll('[data-copy]').forEach((button) => {
    const label = button.textContent;
    button.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(button.dataset.copy);
        button.textContent = 'copiado!';
        button.classList.add('is-copied');
      } catch {
        button.textContent = button.dataset.copy;
      }
      setTimeout(() => {
        button.textContent = label;
        button.classList.remove('is-copied');
      }, 1800);
    });
  });
})();
