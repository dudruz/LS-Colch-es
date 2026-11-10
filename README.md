# LS Colchões · site e painel v2

Site da loja e painel administrativo em **HTML/JS puro + Supabase**, publicado no **GitHub Pages**. Não tem etapa de build: os arquivos sobem como estão.

| Parte | Endereço | O que é |
|---|---|---|
| Site | `/` | Início, Colchões (catálogo), Produto, A Loja e Contato |
| Painel | `/painel/` | Login e app único: Visão geral, Vendas, CRM, Entregas, Estoque, Metas, Produtos, Gestão do site e Equipe |

---

## Estrutura

```
index.html, catalogo.html, produto.html, loja.html, contato.html, 404.html
painel/index.html            painel (login + app)
assets/
  css/site.css               visual do site (brandbook)
  css/painel.css             visual do painel (tema escuro)
  img/                       logos oficiais e padrões de onda e costura
  img/fotos/                 fotos da loja  ← você coloca (lista abaixo)
  js/config.js               URL e chave pública do Supabase, logo Ortobom, Pixel e GA4  ← preencher
  js/supabase.js             cliente do Supabase
  js/api.js                  todas as chamadas do site e do painel
  js/html.js                 montagem de HTML segura (escapa tudo) e ícones
  js/site/                   comum.js (topo, rodapé, cards), home.js, catalogo.js, produto.js
  js/painel/                 app.js (login, menu, rotas), ui.js (modal, gaveta, avisos)
  js/painel/secoes/          inicio, vendas, crm, entregas, estoque, metas, produtos, site, equipe
ferramentas/teste-api.html   testa o banco sem as telas
supabase/
  migrations/                banco v2, rodar em ordem (01 → 04)
  seed.sql                   tamanhos, categorias, configuração e banners iniciais
  dados_exemplo.sql          9 produtos de exemplo, SÓ no projeto de teste
  migracao/                  como trazer os dados do banco antigo
.nojekyll                    faz o GitHub Pages servir os arquivos como estão
```

---

## Passo a passo (projeto de teste)

### 1. Criar o projeto no Supabase
1. Em [supabase.com](https://supabase.com), crie um projeto novo chamado **ls-colchoes-v2**, na região **South America (São Paulo)**.
2. Guarde a senha do banco num lugar seguro.

### 2. Criar o banco
No **SQL Editor**, cole e rode **um arquivo por vez, nesta ordem**:

1. `supabase/migrations/20261109120000_base.sql`
2. `supabase/migrations/20261109120100_seguranca.sql`
3. `supabase/migrations/20261109120200_funcoes.sql`
4. `supabase/migrations/20261109120300_storage.sql`
5. `supabase/migrations/20261110120000_trafego.sql`
6. `supabase/seed.sql`
7. `supabase/dados_exemplo.sql` (opcional, só no projeto de teste)

Ou rode só o `supabase/instalar_tudo.sql`, que junta tudo isso (menos os dados de exemplo) num arquivo.

> Se usar a Supabase CLI: `supabase link` e depois `supabase db push`.

### 3. Criar os acessos (Dudu e Jean)
1. Em **Authentication → Users → Add user**, crie os dois usuários com e-mail e senha.
2. No SQL Editor, ative os dois como administradores (só essa primeira vez é por SQL):
   ```sql
   select public.definir_papel('email-do-dudu@...', 'admin');
   select public.definir_papel('email-do-jean@...', 'admin');
   ```
3. Em **Authentication → Providers → Email**, desligue "Allow new users to sign up". Assim ninguém cria conta sozinho.
4. Daqui em diante, para pôr alguém novo: convide em **Authentication → Users**, e a pessoa aparece no painel em **Equipe e acessos** como inativa. Lá você escolhe o papel e ativa.

| Papel | Pode |
|---|---|
| `admin` / `gerente` | Tudo: equipe, produtos, site, estoque, metas e comissões |
| `vendedor` | Vendas, CRM, agenda e as próprias metas; vê estoque, não altera |
| `entregador` | Agenda: conclui entregas e muda status; vê o estoque |
| `leitura` | Vê tudo, não altera nada |

Hoje Dudu e Jean têm acesso total (`admin`).

### 4. Ligar o código ao banco
Em **Project Settings → API**, copie a **Project URL** e a **anon public key** para `assets/js/config.js`.

A anon key é pública por natureza e pode ir para o GitHub. **Nunca** coloque a `service_role` key no código.

No mesmo arquivo:
- `LOGO_ORTOBOM`: caminho do logo oficial da Ortobom (ex.: `assets/img/ortobom.svg`). Vazio = mostra "ORTOBOM" em texto.
- `META_PIXEL_ID` e `GA4_ID`: IDs do tráfego pago. Vazio = nada é carregado. Com eles, o site registra `PageView`, `ViewContent` (produto), `Contact` (clique no WhatsApp) e `Lead` (formulário).

### 5. Fotos da loja
Coloque em `assets/img/fotos/` (JPG, até ~400 KB cada). Enquanto não existirem, o site mostra um quadro "Foto: …" no lugar.

| Arquivo | Onde aparece | Tamanho ideal |
|---|---|---|
| `fachada.jpg` | Início e A Loja | 900 × 1200 (vertical) |
| `showroom.jpg` | Início e A Loja | 1200 × 900 |
| `tecido.jpg` | Início e A Loja | 1200 × 900 |
| `equipe.jpg` | A Loja | 800 × 800 |
| `teste.jpg` | A Loja (cliente testando) | 1200 × 900 |
| `cat-colchoes.jpg`, `cat-conjuntos-box.jpg`, `cat-box-bau.jpg`, `cat-travesseiros.jpg` | Categorias do início | 800 × 1000 (vertical) |

Fotos e vídeos de **produtos** e dos **banners** são enviados pelo painel (vão para o Storage do Supabase).

### 6. Testar no computador
```bash
python3 -m http.server 8080
# ou
npx serve .
```
- Site: `http://localhost:8080/`
- Painel: `http://localhost:8080/painel/` (entre com o usuário do Dudu ou do Jean)
- Banco sem telas: `http://localhost:8080/ferramentas/teste-api.html`

### 7. Publicar no GitHub Pages
1. Suba a pasta para o repositório `dudruz/LS-Colch-es` numa branch `v2`, para revisar antes.
2. Depois de juntar com a `main`: em **Settings → Pages**, escolha **Deploy from a branch → main → / (root)**.
3. Para usar `lscolchoes.com.br`: crie um arquivo `CNAME` com o domínio e aponte o DNS para o GitHub Pages. O `404.html` usa caminhos a partir da raiz, então funciona melhor com o domínio próprio.
4. No Supabase, em **Authentication → URL Configuration**: **Site URL** = endereço do site; em **Redirect URLs**, adicione `https://seu-dominio/painel/` (link de "Esqueci minha senha").

---

## Como o painel funciona no dia a dia

| Área | O que dá para fazer |
|---|---|
| **Visão geral** | Faturamento, vendas, ticket, leads e conversão com comparação automática (Hoje, 7 dias, 30 dias, Este mês × mesmo pedaço do mês anterior, Mês passado, Personalizado). Gráfico por dia ou por hora, meta da loja com projeção, funil, origens, mais vendidos, tamanhos, equipe, entregas de hoje, alertas de estoque e últimas vendas. |
| **Tráfego e campanhas** | Investimento, leads, custo por lead, vendas, custo por venda, receita e retorno de cada campanha (Meta e Google). Cliques no WhatsApp do site por campanha, motivos de perda, bairros que mais compram, leads aguardando 1º contato e clientes que não respondem. Gerador do link do anúncio (UTM). |
| **Vendas** | Lista com abas por status, busca e filtros. **Nova venda** (botão no topo de qualquer tela): cliente existente ou novo, itens com preço de tabela/campanha e estoque disponível, desconto, pagamento, parcelas e agendamento. Detalhe da venda: pagamento recebido, agendar entrega, cancelar com motivo. |
| **CRM e leads** | Funil em colunas (arraste o card). Ao soltar em **Vendido**, oferece registrar a venda; em **Perdido**, pede o motivo. Ficha do lead com WhatsApp pronto, responsável, retorno agendado, valor e anotações. Lista de clientes e ficha completa (compras, atendimentos, linha do tempo). Avisa na hora quando chega lead do site. |
| **Entregas e agenda** | Semana e rota do dia. Marcar como concluída **dá baixa no estoque** (desmarcar devolve). Ordem da rota, status, WhatsApp do cliente, mapa e rota completa no Google Maps. |
| **Estoque** | Matriz produto × tamanho com alertas, ajuste com motivo, estoque mínimo, pedidos à Ortobom (sugere o que está abaixo do mínimo) e histórico de movimentações. |
| **Metas e comissões** | Meta da loja e de cada vendedor com o ritmo esperado do dia, projeção, comissão hoje e prevista, histórico de 6 meses, regras de comissão e pagamento do mês anterior. Vendedor vê só os próprios números. |
| **Produtos** | Publicar/ocultar no site, destaque da home, editor com preços por tamanho, preço de campanha, SKU, estoque mínimo, fotos (capa e ordem), ficha técnica e camadas. |
| **Gestão do site** | Banners do topo (foto ou vídeo, botão, período de exibição, ordem), campanha com faixa e contagem regressiva, depoimentos e dados da loja (WhatsApp, endereço, horários, distribuição dos leads). |
| **Equipe e acessos** | Ativar/bloquear contas, papel e % de comissão individual. |

## Como o tráfego pago é medido

1. Todo anúncio leva para o site com o código da campanha no link (`utm_campaign`). O painel gera esse link em **Tráfego e campanhas → Link para anúncio**.
2. O site guarda o código durante a visita. O formulário de contato grava o lead já com a campanha, e cada clique no WhatsApp conta para ela.
3. A mensagem do WhatsApp termina com `(ref: código)`. Quem atende cadastra o lead no CRM escolhendo essa campanha.
4. Campanha nova aparece sozinha no primeiro lead ou clique. Depois é só dar um nome e lançar o investimento do mês.
5. Lead perdido sempre tem motivo: preço, prazo, não respondeu, comprou em outro lugar ou desconhecido.

## O que o banco faz sozinho

| Ação | O que acontece |
|---|---|
| Visitante envia o formulário (`criar_lead_site`) | Cria ou acha o cliente pelo WhatsApp, abre o lead como **Novo**, distribui para um vendedor (rodízio ou fixo) e registra na linha do tempo. Campo escondido contra robô e limite contra spam. |
| Registrar venda (`registrar_venda`) | Numa transação só: cliente, venda e itens com o preço de tabela (ou da campanha), **reserva no estoque**, **agenda a entrega**, marca o lead como **Vendido** e grava na linha do tempo. Vender sem estoque é permitido (fica negativo, com aviso para pedir à fábrica). |
| Concluir entrega (`concluir_entrega`) | Dá **baixa no estoque** e marca a venda como entregue. Desmarcar devolve tudo. |
| Cancelar venda (`cancelar_venda`) | Libera a reserva, cancela a entrega e registra o motivo. |
| Receber pedido da Ortobom (`receber_pedido_fabrica`) | Soma as peças no estoque. |
| Mudar a etapa do lead | Grava a mudança na linha do tempo do cliente. |

"Mais vendidos" mostra a receita bruta dos itens (antes do desconto da venda).

## Segurança
- Todas as tabelas têm **RLS**. O visitante não lê nenhuma tabela direto, só as funções `site_*` e `criar_lead_site`.
- Só a equipe **ativa** entra no painel. Esconder um botão na tela é só conforto: quem barra de verdade é o banco.
- Todo texto que vem do banco é escapado antes de ir para a tela (proteção contra XSS).
- Fotos e vídeos ficam nos buckets públicos `produtos` e `site`; só admin e gerente enviam ou apagam.
- **Backup com dados de clientes nunca vai para o GitHub** (LGPD). O `.gitignore` já bloqueia `backup/`, `*.csv` e `*.dump`.

## Fases
1. ~~Back-end~~
2. ~~Site~~
3. ~~Painel~~
4. **Migração**: trazer clientes, produtos e vendas do banco antigo (ver `supabase/migracao/`).
5. **Virada**: apontar o domínio para a versão nova e manter o banco antigo só como backup.
