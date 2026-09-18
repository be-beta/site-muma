/**
 * Muma — recebe os formulários do site e envia por e-mail pela conta Google da Muma.
 *
 * Como instalar (uma vez só):
 * 1. Entre em https://script.google.com com a conta oi@mumaestudio.com.br e crie um projeto.
 * 2. Cole este arquivo inteiro no lugar do código de exemplo e salve.
 * 3. Implantar → Nova implantação → tipo "App da Web".
 *    Executar como: Eu · Quem pode acessar: Qualquer pessoa. Autorize o acesso ao Gmail.
 * 4. Copie a URL que termina em /exec e coloque em data/site.json → "formulario".
 */

const DESTINO = 'oi@mumaestudio.com.br';
const LIMITE_POR_HORA = 30;

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // campo invisível preenchido = robô
    if (data._honey) return responder({ success: true });

    // limite simples de envios por hora
    const cache = CacheService.getScriptCache();
    const enviados = Number(cache.get('envios') || 0);
    if (enviados >= LIMITE_POR_HORA) return responder({ success: false, message: 'Limite de envios atingido.' });
    cache.put('envios', String(enviados + 1), 3600);

    // assunto sem quebras de linha e campos com tamanho limitado
    const assunto = String(data._subject || '[Site Muma] Contato').replace(/[\r\n]+/g, ' ').slice(0, 180);
    const responderPara = String(data._replyto || '').trim();
    const linhas = Object.keys(data)
      .filter((campo) => campo.charAt(0) !== '_')
      .map((campo) =>
        '<tr><td style="padding:8px 16px 8px 0;color:#6b6883;vertical-align:top;white-space:nowrap">' + escapar(campo) +
        '</td><td style="padding:8px 0;color:#0c0933">' + escapar(String(data[campo]).slice(0, 4000)).replace(/\n/g, '<br>') + '</td></tr>')
      .join('');

    const opcoes = {
      to: DESTINO,
      subject: assunto,
      name: 'Site Muma',
      htmlBody: '<div style="font-family:Arial,sans-serif;font-size:14px"><h2 style="color:#3215ad;font-weight:normal">' +
        escapar(assunto) + '</h2><table style="border-collapse:collapse">' + linhas + '</table></div>',
    };
    if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(responderPara)) opcoes.replyTo = responderPara;

    MailApp.sendEmail(opcoes);
    return responder({ success: true });
  } catch (erro) {
    return responder({ success: false, message: String(erro) });
  }
}

function escapar(valor) {
  return String(valor == null ? '' : valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function responder(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto)).setMimeType(ContentService.MimeType.JSON);
}
