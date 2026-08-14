const fs = require('fs');

const indexHtml = fs.readFileSync('index.html', 'utf8');

// Extract contactModal and careerModal
const contactMatch = indexHtml.match(/<div class="modal-overlay" id="contactModal">[\s\S]*?<\/form>\s*<div class="modal-success"[^>]*>[\s\S]*?<\/div>\s*<div class="modal-error"[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/);
const careerMatch = indexHtml.match(/<div class="modal-overlay" id="careerModal">[\s\S]*?<\/form>\s*<div class="modal-success"[^>]*>[\s\S]*?<\/div>\s*<div class="modal-error"[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/);

if (!contactMatch) {
    console.error("Could not find contact modal in index.html");
    process.exit(1);
}

const modalsHtml = `\n  <!-- MODALS INJECTED GLOBALLY -->\n  ${contactMatch[0]}\n  ${careerMatch ? careerMatch[0] : ''}\n`;

const filesToUpdate = [
    'portfolio.html',
    'case-koni.html',
    'case-minha_cabana.html',
    'case-banco-de-imagens.html',
    'case-coleo-de-pratos.html',
    'landing_page.html'
];

filesToUpdate.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    // Check if it already has contactModal
    if (content.includes('id="contactModal"')) {
        console.log(`Skipping ${file}, modal already exists.`);
        return;
    }
    // Inject before <!-- Scripts -->
    content = content.replace(/<!-- Scripts -->/, modalsHtml + '\n  <!-- Scripts -->');
    fs.writeFileSync(file, content);
    console.log(`Injected modals into ${file}`);
});
