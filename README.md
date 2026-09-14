# Site Muma Estúdio Criativo

Site estático publicado pelo GitHub Pages em [mumaestudio.com.br](https://mumaestudio.com.br), atualizado automaticamente a cada push na `main`.

## Estrutura

```
index.html                  gerado · home
projetos/<slug>/index.html  gerado · uma página por projeto
404.html, sitemap.xml       gerados
portfolio.html, case-*.html gerados · redirecionam os endereços antigos

data/site.json              destaques do topo da home + ordem dos projetos
assets/projetos/<slug>/     projeto.json + imagens de cada projeto
assets/estudio/             fotos da equipe
assets/images/clientes/     logos de clientes
assets/fonts/, assets/logos/, assets/icons/

css/site.css                estilos
js/site.js                  interações (nav, lente de bastidor, entradas)

tools/build.mjs             gerador do site (Node, sem dependências)
tools/templates/            HTML da home, do projeto e partes compartilhadas
tools/admin.html            ferramenta para montar o pacote de um novo projeto
context/                    guia de marca e referências
```

Os arquivos marcados como **gerados** não devem ser editados à mão: altere os templates ou os dados e rode o build.

## Rodar o build

```bash
node tools/build.mjs
```

Para visualizar localmente: `python -m http.server 8321` e abra http://localhost:8321.

## Adicionar ou editar um projeto

1. Abra o admin em **mumaestudio.com.br/tools/admin.html** (ou `http://localhost:8321/tools/admin.html` com o servidor local). Aberto direto do disco ele não funciona.
2. Preencha as informações e arraste capa, card, bastidores, fotos e links do Vimeo. A prévia ao lado usa o CSS real do site, e o rascunho fica salvo no navegador.
3. Clique em **Gerar pacote**. A revisão aponta pendências e avisos antes de baixar o `.zip`, que já traz tudo: imagens otimizadas (normal + leve) e o `projeto.json`.
4. Na pasta do site: `node tools/importar.mjs projeto-<slug>.zip` (com `--substituir` para atualizar um projeto existente). O script valida o pacote, copia para `assets/projetos/<slug>/` e roda o build.
5. Confira e faça commit + push.

Projetos novos entram no início da grade, do mais recente ao mais antigo, sem editar nada. Para fixar uma ordem, liste os slugs em `data/site.json` → `projetos`. Para corrigir um projeto publicado, use **Abrir → Projeto publicado no site** no admin.

### Formato do `projeto.json`

```json
{
  "titulo": "Dia do *Koni*",
  "cliente": "Koni",
  "ano": "2025",
  "categoria": "campanha · still",
  "subtitulo": "Frase curta de impacto.",
  "servicos": ["Direção criativa", "Fotografia"],
  "creditos": [{ "funcao": "Fotografia", "nome": "Alinne (Estúdio Muma)" }],
  "descricao": ["Primeiro parágrafo.", "Segundo parágrafo com *destaque*."],
  "capa": "capa.webp",
  "card": "02.webp",
  "bastidores": ["bts-01.webp"],
  "midias": [
    { "tipo": "vimeo", "id": "1094205487", "orientacao": "vertical", "player": true },
    { "tipo": "imagem", "arquivo": "01.webp", "legenda": "opcional" }
  ]
}
```

- `*texto*` vira destaque na cor da marca.
- `card` é opcional (imagem vertical da grade da home); sem ele, usa a capa.
- O primeiro item de `bastidores` aparece na lente da home.
- Vídeos do Vimeo usam o player do site (play/pause, volume, abrir no Vimeo): o primeiro começa sozinho sem som e, ao terminar, o próximo toca. O `controls=0` do Vimeo só esconde a interface deles em contas pagas (Plus ou superior).
- Imagens em `.webp`; cada uma pode ter a versão leve `nome-sm.webp` ao lado (o admin gera as duas).
- A galeria monta as linhas sozinha, mantendo a proporção original de cada foto.

## Serviços da home

Ficam em `data/site.json` → `servicos`: nome, descrição curta e, opcionalmente, `projeto` + `imagem` para a foto que acompanha o cursor.

## Formulários (orçamento e trabalhe conosco)

Os popups enviam para o endereço em `data/site.json` → `formulario`.

**Google Apps Script (recomendado — o e-mail da Muma é Google Workspace).** O envio sai da própria conta da Muma, sem serviço de terceiros:

1. Entre em [script.google.com](https://script.google.com) com a conta `oi@mumaestudio.com.br` e crie um projeto.
2. Cole o conteúdo de `tools/formulario/google-apps-script.gs` e salve.
3. **Implantar → Nova implantação → App da Web**, executar como **Eu**, acesso **Qualquer pessoa**. Autorize o Gmail.
4. Copie a URL terminada em `/exec` para `formulario` em `data/site.json`, rode o build e publique.

**FormSubmit (em uso até a troca)** — endereço `https://formsubmit.co/ajax/oi@mumaestudio.com.br`, sem conta:

- **Ativação:** no primeiro envio, o FormSubmit manda um e-mail de confirmação para `oi@mumaestudio.com.br`. É preciso clicar em "Activate Form"; só depois disso as mensagens passam a chegar.
- **Filtros:** os assuntos começam com `[Site Muma] Orçamento` ou `[Site Muma] Trabalhe conosco`, prontos para regras de caixa de entrada. Responder o e-mail responde direto para quem enviou.
- **Anti-spam:** campo invisível, tempo mínimo de preenchimento e limite de 3 envios a cada 10 minutos por navegador.
- Após ativar, o FormSubmit oferece um endereço aleatório que substitui o e-mail em `formulario`, para ele não aparecer no código.
