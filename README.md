# LS-Colch-es
## Painel V5 + Supabase

O site público continua em `index.html`. A área interna fica em `painel.html` e usa Supabase Auth.
1. Execute `setup.sql` no SQL Editor do Supabase.
2. Em Authentication → Users, crie os e-mails/senhas da equipe.
3. O `config.js` já contém a URL e a chave pública do projeto deste site.
4. Publique os arquivos no GitHub Pages.
5. Acesse `/painel.html` para entrar.

O painel V5 não usa localStorage como fonte de dados. O registro `ls_dashboard_state/main` é compartilhado e o Supabase Realtime propaga alterações para os usuários conectados.
