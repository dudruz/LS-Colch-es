# Migração do banco antigo → banco v2

O script de migração (de-para) depende de como o banco atual está organizado, então ele é escrito **depois** de olhar as tabelas antigas.

## O que é preciso
Uma destas opções:
- **Conector do Supabase ligado nesta conversa** (recomendado): eu leio a estrutura do projeto atual, sem alterar nada, e escrevo o script; ou
- o resultado desta consulta, rodada no SQL Editor do **projeto atual** e colada na conversa:

```sql
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;
```

## Como vai ser feita
1. **Backup do projeto atual** (Database → Backups, ou `pg_dump`), guardado fora do GitHub.
2. Exportar as tabelas antigas em CSV, ou ligar os dois projetos com `postgres_fdw`.
3. Importar no projeto **ls-colchoes-v2** em tabelas temporárias `legado_*`.
4. Rodar `0100_migrar_dados.sql`, que vai levar:
   - clientes (unificados pelo WhatsApp),
   - produtos e tamanhos (viram produto + variações),
   - vendas e itens (com os números antigos preservados em `observacoes`),
   - leads e histórico, se existirem.
5. Conferir os totais: número de clientes, de produtos e de vendas, e o faturamento por mês, antigo × novo.
6. Apagar as tabelas `legado_*`.

O banco atual não é alterado em nenhum momento.
