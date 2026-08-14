const fs = require('fs');
const path = require('path');

const configPath = process.argv[2];
const templatePath = process.argv[3];
const targetPath = process.argv[4];

if (!configPath || !templatePath || !targetPath) {
  console.error("Usage: node build-case.js <config.json> <template.html> <output.html>");
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
let html = fs.readFileSync(templatePath, 'utf8');

// 1. Update Title
html = html.replace(/<title>.*?<\/title>/, `<title>${config.title.replace(/<[^>]*>?/gm, '')} · Muma Estúdio Criativo</title>`);

// 2. Update Header/Hero
html = html.replace(/<div class="hero-client">.*?<\/div>/s, `<div class="hero-client">${config.client} · ${config.year || new Date().getFullYear()}</div>`);
html = html.replace(/<h1 class="hero-title[^>]*>.*?<\/h1>/s, `<h1 class="hero-title reveal">${config.title}</h1>`);
html = html.replace(/<p class="hero-desc[^>]*>.*?<\/p>/s, `<p class="hero-desc reveal">${config.description}</p>`);

// 3. Update Meta Grid
const metaHTML = `
  <div class="meta-item">
    <span>Direção Criativa</span>
    <strong>${config.direction || 'Vicky & Alinne'}</strong>
  </div>
  <div class="meta-item">
    <span>Fotografia</span>
    <strong>${config.photo || 'Alinne (Estúdio Muma)'}</strong>
  </div>
  <div class="meta-item">
    <span>Categoria</span>
    <strong>${config.badge || 'campanha'}</strong>
  </div>
`;
html = html.replace(/<div class="meta-grid reveal">.*?<\/div>/s, `<div class="meta-grid reveal">\n${metaHTML}\n      </div>`);

// 4. Update Cover Image
html = html.replace(/<section class="case-cover">.*?<\/section>/s, `
  <section class="case-cover">
    <div class="inner reveal">
      <img src="assets/campaigns/${config.id}/${config.cover}" alt="Capa" class="parallax-img" />
    </div>
  </section>
`);

// 5. Update Gallery (Media Array)
let galleryHTML = `<section class="case-gallery"><div class="inner">`;
if (config.media && config.media.length > 0) {
  config.media.forEach((item, index) => {
    if (item.type === 'image') {
      galleryHTML += `
        <div class="gallery-item ${item.orientation === 'landscape' ? 'landscape' : 'portrait'} reveal">
          <img src="assets/campaigns/${config.id}/${item.src}" alt="Media ${index}" loading="lazy" />
        </div>
      `;
    } else if (item.type === 'vimeo') {
      galleryHTML += `
        <div class="gallery-item ${item.orientation === 'landscape' ? 'landscape' : 'portrait'} reveal">
          <div class="vimeo-wrapper">
            <iframe src="https://player.vimeo.com/video/${item.src}?autoplay=1&loop=1&background=1&muted=1" 
                    frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>
          </div>
        </div>
      `;
    }
  });
}
galleryHTML += `</div></section>`;

// Replace old gallery. Look for <section class="case-showcase-section"> up to the next </section>
html = html.replace(/<section class="case-showcase-section">.*?<\/section>/s, galleryHTML);

// Overwrite the file
fs.writeFileSync(targetPath, html);
console.log(`Generated ${targetPath}`);
