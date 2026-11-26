// Site · páginas estáticas geradas para SEO (categorias, cidades e guias).
// O conteúdo já vem pronto no HTML; aqui só entram topo, rodapé, WhatsApp e animações.
import { iniciarPagina } from './comum.js';

iniciarPagina(document.body.dataset.pagina || '');
