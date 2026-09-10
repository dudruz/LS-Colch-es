LS COLCHÕES — SITE EM HTML, CSS E JAVASCRIPT
==============================================

ARQUIVOS PRINCIPAIS
- index.html            → estrutura e conteúdo do site
- style.css             → identidade visual, responsividade e animações
- script.js             → menu, produtos, promoções e feedback
- products.js           → catálogo de reserva, usado só se o banco não estiver configurado
- config.js             → chaves do banco de dados + senha do painel
- admin.html / admin.js → painel do dono: produtos, promoções e avaliações
- setup.sql             → script único que cria tudo no Supabase (tabelas, permissões, bucket de fotos e os 34 produtos da planilha)
- assets/               → logo e ícone do site

COMO ABRIR
Abra o arquivo index.html em um navegador.

COMO PUBLICAR
Envie todos os arquivos e a pasta assets para a raiz da hospedagem, mantendo
essa mesma estrutura. O site não precisa de Node.js, npm, React ou build.

--------------------------------------------------------------
1) PRODUTOS, PROMOÇÕES E FEEDBACK — TUDO PELO PAINEL /admin.html
--------------------------------------------------------------
Como o site é só HTML/CSS/JS (sem servidor próprio), produtos, promoções
e avaliações usam o Supabase: um banco de dados gratuito que qualquer
pessoa cria em poucos minutos, sem precisar programar. Depois de
configurado, o dono cadastra e edita tudo isso direto pelo navegador,
em seusite.com.br/admin.html — sem mexer em código.

PASSO A PASSO:

1. Crie uma conta grátis em https://supabase.com e crie um novo projeto
   (escolha uma senha de banco e a região "South America" se disponível).

2. No painel do projeto, vá em "SQL Editor" → "New query", abra o
   arquivo setup.sql (que está junto com o site), cole o conteúdo
   inteiro e clique em "Run".

   Esse arquivo sozinho já faz tudo:
   - cria as 3 tabelas (produtos, promocoes, feedbacks)
   - libera o painel para ler/escrever nelas
   - cria o bucket de fotos "produtos-fotos" como público
   - carrega os 34 produtos da sua planilha (só roda essa parte se a
     tabela "produtos" ainda estiver vazia, então é seguro rodar o
     arquivo de novo no futuro sem duplicar nada)

   Só se o passo do bucket der erro (alguns projetos novos do Supabase
   pedem para criar o bucket pela tela): vá em "Storage" → "New
   bucket", crie um chamado exatamente produtos-fotos, marque "Public
   bucket", e rode de novo só a parte final do setup.sql (as duas
   "create policy" de storage.objects).

3. Vá em "Project Settings" → "API". Copie a "Project URL" e a chave
   "anon public".

4. Abra o arquivo config.js e cole os dois valores:

   const SUPABASE_URL = "https://xxxxxxxxxxxx.supabase.co";
   const SUPABASE_ANON_KEY = "eyJhbGciOi...";

5. Ainda em config.js, troque ADMIN_PASSWORD por uma senha sua (já
   está com "Bela2669" por padrão).

6. Publique o site (com o config.js atualizado) e acesse
   seusite.com.br/admin.html. De lá dá para:
   - cadastrar, editar nome/categoria/preço/foto, ocultar ou excluir produtos
   - criar, ativar/desativar ou excluir promoções
   - ver e excluir as avaliações enviadas pelos clientes

Sobre as fotos: o preço nunca aparece no site público — só nome,
categoria e foto (quando tiver). O preço fica só no /admin.html, só
para os consultores consultarem.

Enquanto o Supabase não estiver configurado, a aba Produtos do site
mostra o catálogo de reserva (o arquivo products.js, sem fotos), e as
seções de Promoções e Feedback ficam com uma mensagem padrão avisando
que ainda não estão disponíveis.

AVISO DE SEGURANÇA (importante):
A senha do painel e a chave do Supabase ficam no código do site, então
qualquer pessoa com conhecimento técnico consegue lê-las e mexer direto
no banco. Isso é aceitável para produtos, promoções e avaliações
(conteúdo público e de baixo risco), mas NÃO guarde nada sensível
nessas tabelas (dados de clientes, pagamentos, senhas etc.). Se no
futuro quiser algo mais seguro, dá para evoluir isso para um backend
próprio com autenticação de verdade — é só avisar.

--------------------------------------------------------------
2) SEÇÃO "COMO CHEGAR"
--------------------------------------------------------------
Em index.html, procure pela seção com id="como-chegar" e atualize:
- o endereço real da loja (2 lugares: texto e o link do Google Maps)
- o horário de funcionamento real

O número de WhatsApp já está configurado: (31) 97180-1487.

O mapa já busca "LS Colchões Lagoa Santa MG" automaticamente — depois
que a loja estiver com endereço confirmado no Google Maps/Google
Meu Negócio, o pino vai aparecer certo sem precisar mexer no código.

O link do Instagram está configurado para:
https://www.instagram.com/ls_colchoes/
