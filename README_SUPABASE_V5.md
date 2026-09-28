# LS Colchões — Painel V5 compartilhado

O site público continua no GitHub Pages. O arquivo `painel.html` é a área interna.

## Primeiro uso
1. No Supabase, execute `setup.sql` inteiro no SQL Editor.
2. Em Authentication → Users, crie os e-mails/senhas da equipe.
3. Publique todos os arquivos deste projeto no GitHub Pages.
4. Acesse `painel.html` e entre com um usuário criado no Supabase.

O último backup atualizado foi usado como estado inicial do painel. O painel usa uma única linha `ls_dashboard_state` em JSONB e Supabase Realtime. Como a operação não terá edições simultâneas no mesmo momento, a última gravação fica como estado oficial.

A chave `anon/public` pode ficar no frontend. Nunca coloque `service_role` no GitHub Pages.


### Correção das vendas
O `setup.sql` já contém a correção das vendas 1–15 conforme a planilha atualizada. A venda 16 (Alex) é preservada.


Correção V8: o nome do produto salvo em cada venda é a fonte de verdade para exibição. Se o produto não casar com o cadastro, o painel preserva o texto original e nunca substitui pelo primeiro produto (ex.: FIT 33).
