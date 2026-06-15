# Guia e Template de Envio para Novas Campanhas (Muma Estúdio Criativo)

Este guia serve para orientar o envio de arquivos e informações sobre novos projetos/campanhas para indexação no site e criação de páginas dedicadas. Seguir este padrão garante agilidade e consistência visual premium.

\---

## 📁 1. Estrutura de Pastas e Arquivos

Cada nova campanha deve ser enviada em uma pasta zipada com o nome da campanha (ex: `campanha-koni`). Dentro dela, deve haver:

1. Um arquivo `dados.txt` preenchido com as informações textuais e links.
2. Arquivos de fotos e GIFs formatados.
 2a. Para definir a foto de capa nomeie o arquivo como 'capa-[nome_da_campanha]'
 2b. Para definir a foto behind the scene nomeie o arquivo como 'bts-[nome_da_campanha]'
 2c. Para adicionar imagens à página da campanha nomeie o arquivo como 'nome_da_campanha-01'
  2cI. O número final define a ordem da foto verticalmente
  2cII. Se quiser adicionar uma foto ao lado da outra adicione números ao lado do mesmo, como 'campanha-01-1' e 'campanha-01-2'
3. Dica de Otimização:
 3a. Salve as imagens em resolução máxima e passe por compressores online (como tinypng.com) para manter a página rápida e responsiva.
 3b. GIFs animados costumam ter arquivos muito pesados. Se forem muito grandes, podem deixar a página lenta no celular. Recomenda-se exportar os GIFs com compressão ou com até 3 a 5 segundos de duração no máximo.

\---

## 📝 2. Template do Arquivo `dados.txt`

Copie o conteúdo abaixo, crie um arquivo chamado `dados.txt` e preencha as informações:

```text
==================================================================
TEMPLATE DE INFORMAÇÕES DA CAMPANHA
==================================================================

\[TITULO\_DA\_CAMPANHA]
Nome principal que aparecerá na página.
Ex: Dia do Koni

\[SUBTITULO]
Uma frase curta descritiva de impacto.
Ex: Uma experiência gastronômica de fusão em alta velocidade e sofisticação premium.

\[MARCA]
Nome do cliente / marca.
Ex: Koni Store

\[ANO]
Ano de realização do projeto.
Ex: 2025

\[SERVICOS]
Quais serviços Muma foram prestados (separados por vírgula).
Categorias válidas: Direção Criativa, Produção Executiva, Foto \& Vídeo, Edição \& Pós, Arte \& Cenografia, Beauty \& Styling, Casting, Catering Set
Ex: Foto, Set Styling, Casting

\[DIRECAO\_CRIATIVA]
Quem assinou a direção criativa.
Ex: Vicky \& Alinne

\[FOTOGRAFIA]
Quem assinou a fotografia.
Ex: Alinne (Estúdio Muma)

\[CATEGORIA\_URL]
Tipo de projeto. Use uma ou mais palavras-chave:
- campanha (ativa o halo pulsante rosa na galeria!)
- direcao
- producao
- captacao
- pos
- arte
- beauty
- casting
- catering
Ex: campanha, direcao, captacao

\[DESCRICAO\_E\_BRIEFING]
Texto de apresentação do projeto detalhando o briefing, conceito, desafios e resultados. Pode ter múltiplos parágrafos.
Ex: O Koni, referência nacional em culinária japonesa rápida e dinâmica, buscou o Estúdio Muma para...

\[LINK\_VIDEO\_VIMEO]
Se houver vídeo principal hospedado no Vimeo para indexar, cole o link ou o ID aqui.
Ex: https://vimeo.com/1094205487 ou apenas 1094205487

\[ORIENTACAO\_VIDEO\_PRINCIPAL]
Indique se o vídeo principal é vertical ou horizontal. Se for vertical, ele será exibido em proporção vertical (9:16) centralizado.
Valores válidos: vertical, horizontal
Ex: vertical

\[VIDEOS\_EXTRAS\_VIMEO]
Se a campanha possuir outros vídeos verticais para exibir lado a lado (com destaque no hover e sincronização de play automático), cole os IDs ou links separados por vírgula.
Ex: https://vimeo.com/1094211254, https://vimeo.com/1094208876
==================================================================
```

\---

## 🖼️ 3. Regras para Imagens e GIFs

As imagens devem ser enviadas na pasta `imagens/` com nomes padronizados em letras minúsculas e sem acentos, indicando o papel de cada uma:

|Nome do Arquivo|Função / Onde será usado no site|Formato Recomendado|
|-|-|-|
|`work-\[nome-da-campanha].jpg`|**Foto de Capa (Front)**: É a imagem de destaque que aparece na galeria principal.|`.jpg` ou `.png` (otimizada)|
|`bts-\[nome-da-campanha].jpg`|**Backstage / Bastidores**: A foto que se revela quando o usuário passa o mouse na galeria (ou abre o modal).|`.jpg` (otimizada)|
|`inline-\[nome-da-campanha]-01.jpg`|**Imagem Adicional 1**: Foto exibida dentro da página dedicada da campanha.|`.jpg` ou `.png`|
|`inline-\[nome-da-campanha]-02.jpg`|**Imagem Adicional 2**: Outra foto interna da campanha (assim sucessivamente).|`.jpg` ou `.png`|
|`inline-\[nome-da-campanha]-anim.gif`|**GIF Animado**: Um GIF demonstrativo de set ou produto.|`.gif` (otimizado, < 5MB)|

> \[!TIP]
> \*\*Dica de Otimização\*\*: Salve as imagens em resolução máxima de 1920px de largura e passe por compressores online (como tinypng.com) para manter a página rápida e responsiva.

\---

## 💡 4. Dúvidas Frequentes

### A. É simples adicionar GIFs? Existe alguma dificuldade?

**Sim, é muito simples!** Os GIFs funcionam exatamente como fotos normais no site. Para inseri-los, basta carregar o arquivo `.gif` na pasta `assets` e chamá-lo com a tag `<img src="...">`.

* **Única Dificuldade**: GIFs animados costumam ter arquivos muito pesados. Se forem muito grandes, podem deixar a página lenta no celular. **Recomenda-se exportar os GIFs com compressão ou com até 3 a 5 segundos de duração no máximo.**

### B. Como adicionamos vídeos do Vimeo? É uma boa solução?

**Sim, indexar os vídeos do Vimeo é a melhor solução possível!**
O Vimeo comprime o vídeo automaticamente, entrega por streaming de forma veloz e adapta a qualidade à internet do usuário, poupando a hospedagem do site.

Para adicionar um vídeo do Vimeo de forma elegante, responsiva e sem barras pretas na página dedicada da campanha, basta inserir este bloco de código HTML onde desejar na página:

```html
<!-- Container responsivo do Vimeo -->
<div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; border-radius: 16px; border: 1px solid rgba(255,255,255,0.08); box-shadow: 0 20px 40px rgba(0,0,0,0.3);">
  <iframe src="https://player.vimeo.com/video/ID\_DO\_VIDEO?autoplay=1\&loop=1\&background=1\&muted=1" 
          style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" 
          frameborder="0" 
          allow="autoplay; fullscreen; picture-in-picture" 
          allowfullscreen>
  </iframe>
</div>
```

*(Nota: Os parâmetros `autoplay=1\&loop=1\&background=1\&muted=1` fazem o vídeo rodar sozinho, em loop infinito, sem som e sem os controles feios do Vimeo, funcionando exatamente como um GIF, mas com qualidade de vídeo de alta resolução e carregamento ultra-rápido).*

