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

## Adicionar um projeto

1. Abra `tools/admin.html` no navegador, preencha os dados, arraste capa, bastidores e galeria e clique em **Gerar pacote .zip**.
2. Descompacte o pacote em `assets/projetos/` (vira `assets/projetos/<slug>/`).
3. Adicione o `<slug>` na lista `projetos` de `data/site.json`, na posição desejada. Para aparecer no topo da home, inclua também em `destaques`.
4. Rode `node tools/build.mjs`, confira localmente e faça commit + push.

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
- Vídeos do Vimeo tocam em loop mudo; com `"player": true` aparecem com som e controles.
- Imagens em `.webp`; cada uma pode ter a versão leve `nome-sm.webp` ao lado (o admin gera as duas).
