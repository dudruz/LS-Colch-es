// =====================================================================
// Conteúdo fixo das páginas de SEO: loja, cidades atendidas e guias.
// Editar aqui e rodar `node ferramentas/seo/gerar.mjs` (ou esperar o
// GitHub Action diário) para atualizar as páginas.
// =====================================================================

export const SITE = 'https://lscolchoes.com.br';

export const LOJA = {
  nome: 'LS Colchões',
  razao: 'LS COLCHOES LTDA',
  cnpj: '68.020.458/0001-46',
  rua: 'Av. Pref. João Daher, 1277, loja 3',
  bairro: 'Lundcéia',
  cidade: 'Lagoa Santa',
  uf: 'MG',
  cep: '33239-050',
  telefone: '+55 31 97180-1487',
  instagram: 'https://instagram.com/ls_colchoes',
  perfilGoogle: 'https://g.page/r/CVqLJ9wR-j5eEAE/review',
  horarios: [
    { dias: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], abre: '09:00', fecha: '19:00' },
    { dias: ['Saturday'], abre: '08:30', fecha: '13:00' }
  ]
};

/** Cidades da área de atendimento (as mesmas 20 do Perfil da Empresa no Google). */
export const AREA_ATENDIMENTO = [
  'Lagoa Santa', 'Vespasiano', 'Confins', 'São José da Lapa', 'Pedro Leopoldo', 'Santa Luzia', 'Jaboticatubas',
  'Matozinhos', 'Ribeirão das Neves', 'Belo Horizonte', 'Capim Branco', 'Prudente de Morais', 'Sabará',
  'Taquaraçu de Minas', 'Funilândia', 'Caeté', 'Contagem', 'Nova Lima', 'Sete Lagoas', 'Baldim'
];

// ---------------------------------------------------------------------
// Páginas de cidade. "km" = distância aproximada em linha reta até a loja.
// "sobre" precisa ser diferente em cada cidade (texto real, nada copiado).
// ---------------------------------------------------------------------
export const CIDADES = [
  {
    slug: 'vespasiano', nome: 'Vespasiano', km: 8,
    sobre: 'Vespasiano é vizinha de Lagoa Santa: a loja fica a uns 8 km, pela MG-010. Dá para passar no showroom no fim da tarde ou no sábado de manhã, deitar nos modelos e já sair com a entrega combinada.'
  },
  {
    slug: 'confins', nome: 'Confins', km: 10,
    sobre: 'De Confins, a cidade do aeroporto, até o showroom são uns 10 km pela MG-010. É perto o bastante para testar os colchões com calma antes de decidir, sem precisar ir até BH.'
  },
  {
    slug: 'sao-jose-da-lapa', nome: 'São José da Lapa', km: 10,
    sobre: 'São José da Lapa fica a uns 10 km da loja. Numa visita só ao showroom, com os modelos montados, dá para resolver tamanho, firmeza e base.'
  },
  {
    slug: 'pedro-leopoldo', nome: 'Pedro Leopoldo', km: 16,
    sobre: 'Pedro Leopoldo está a uns 16 km da loja. Para quem prefere resolver pelo celular, o consultor manda fotos, vídeos e medidas pelo WhatsApp e monta o orçamento sem você sair de casa.'
  },
  {
    slug: 'santa-luzia', nome: 'Santa Luzia', km: 17,
    sobre: 'De Santa Luzia até o showroom são uns 17 km. A LS já atende clientes da cidade e combina a entrega pelo WhatsApp, com o modelo e o tamanho conferidos antes.'
  },
  {
    slug: 'jaboticatubas', nome: 'Jaboticatubas', km: 20,
    sobre: 'Jaboticatubas, no caminho da Serra do Cipó, fica a uns 20 km da loja. Vale para casa e também para pousada ou casa de temporada: dá para montar um pedido com vários tamanhos de uma vez.'
  },
  {
    slug: 'matozinhos', nome: 'Matozinhos', km: 21,
    sobre: 'Matozinhos está a uns 21 km do showroom, e a LS já entrega para clientes da cidade. Se ficar na dúvida entre dois modelos, o consultor compara os dois por vídeo antes de você vir à loja.'
  },
  {
    slug: 'ribeirao-das-neves', nome: 'Ribeirão das Neves', km: 26,
    sobre: 'Ribeirão das Neves fica a uns 26 km da loja. O atendimento começa pelo WhatsApp: você conta como dorme, o consultor indica os modelos que fazem sentido e explica o que muda entre eles.'
  },
  {
    slug: 'belo-horizonte', nome: 'Belo Horizonte', km: 22, regiao: 'Venda Nova, Pampulha e região norte',
    sobre: 'Da região norte de BH, como Venda Nova e Pampulha, até a loja são uns 22 a 26 km pela Linha Verde. Em vez de rodar shopping atrás de colchão, você testa os modelos num showroom tranquilo, com um consultor só para você.'
  },
  {
    slug: 'sete-lagoas', nome: 'Sete Lagoas', km: 41,
    sobre: 'Sete Lagoas está a uns 41 km da loja. Para quem vem de lá, o ideal é chamar no WhatsApp antes: o consultor separa os modelos que combinam com você, e a visita rende muito mais.'
  }
];

// ---------------------------------------------------------------------
// Guias (conteúdo de pesquisa: medidas, tipos de colchão, como escolher)
// Cada seção: { h2, html }. "faq" vira FAQPage no schema.
// ---------------------------------------------------------------------
export const GUIAS = [
  {
    slug: 'medidas-de-colchao',
    titulo: 'Medidas de colchão: solteiro, viúva, casal, queen e king',
    h1: 'Medidas de colchão: guia de tamanhos',
    descricao: 'Tabela com as medidas de colchão solteiro, viúva, casal, queen e king, como medir a sua cama e quanto espaço deixar no quarto.',
    intro: 'Antes de escolher modelo e firmeza, acerte o tamanho. Aqui estão as medidas padrão que a LS trabalha e um jeito simples de conferir a sua cama.',
    secoes: [
      { h2: 'Tabela de medidas', tabelaTamanhos: true },
      { h2: 'Como medir a sua cama', html: '<p>Meça a parte interna da cama ou o tampo do box que você já tem: largura de um lado ao outro e comprimento da cabeceira até os pés. Se for trocar só o colchão, ele precisa ter a mesma medida do box. Se for trocar tudo, vale medir o quarto também.</p><p>Na dúvida, mande uma foto da cama com a fita métrica no WhatsApp que o consultor confere para você.</p>' },
      { h2: 'Quanto espaço deixar no quarto', html: '<p>Uma referência confortável é deixar uns 60 cm livres nas laterais e no pé da cama para circular, abrir guarda-roupa e arrumar a cama. Em quarto pequeno, o casal costuma caber melhor que o queen. Se a cama encosta numa parede, o queen pode caber onde parecia não caber.</p>' },
      { h2: 'Altura do colchão e da cama', html: '<p>A altura do colchão muda conforme o modelo, de uns 12 cm nos de espuma mais simples até mais de 30 cm nos de molas com pillow top. Somando a base, confira se a altura final fica boa para sentar e levantar, e se o lençol de elástico que você tem cobre a altura nova.</p>' }
    ],
    faq: [
      ['Qual a diferença entre colchão casal e queen?', 'O queen (158 × 198 cm) é 20 cm mais largo e 10 cm mais comprido que o casal (138 × 188 cm). Para quem tem mais de 1,80 m ou divide a cama com criança ou pet, o queen costuma fazer diferença.'],
      ['Qual é a medida do colchão king?', 'O king padrão no Brasil mede 193 × 203 cm. É o maior tamanho que a LS trabalha.'],
      ['Colchão viúva é o mesmo que solteirão?', 'Não. O viúva mede 128 × 188 cm, bem mais largo que o solteiro (88 × 188 cm). É uma boa opção para quarto pequeno quando o solteiro fica apertado.'],
      ['Posso colocar um colchão queen num box casal?', 'Não é indicado. O colchão precisa ter a mesma medida da base para ficar firme e não estragar as laterais.']
    ]
  },
  {
    slug: 'molas-ensacadas-ou-espuma',
    titulo: 'Colchão de molas ensacadas ou de espuma: qual escolher?',
    h1: 'Molas ensacadas ou espuma: qual colchão escolher?',
    descricao: 'Entenda a diferença entre colchão de molas ensacadas, molas interligadas e espuma, o que é densidade e qual combina com o seu jeito de dormir.',
    intro: 'Não existe um tipo melhor para todo mundo. Cada construção tem um jeito de sustentar o corpo, e a escolha certa depende de como você dorme, do seu peso e de quem divide a cama com você.',
    secoes: [
      { h2: 'Colchão de molas ensacadas', html: '<p>Cada mola fica dentro de um saquinho próprio e trabalha sozinha. O colchão acompanha melhor o formato do corpo e quase não passa movimento de um lado para o outro: quando alguém se vira, quem está ao lado continua dormindo. O miolo de molas também deixa o ar circular, então ele tende a esquentar menos.</p><p>Costuma ser a escolha de casais, principalmente com pesos diferentes, e de quem sente calor à noite.</p>' },
      { h2: 'Colchão de molas interligadas', html: '<p>Nas molas interligadas (tipo Bonnel), as molas são presas umas às outras. O colchão fica firme e resistente, mas o movimento passa mais de um lado para o outro. Costuma ter um preço mais baixo que o de molas ensacadas.</p>' },
      { h2: 'Colchão de espuma', html: '<p>O colchão de espuma tem o miolo inteiro de espuma, em uma ou mais camadas. É mais leve, silencioso e geralmente mais em conta. A <strong>densidade</strong> (D23, D28, D33, D45…) indica quanto material tem em cada metro cúbico de espuma e está ligada ao peso que o colchão aguenta. Quanto maior o peso de quem dorme, maior a densidade indicada.</p><p>Densidade não é o mesmo que firmeza: dois colchões de mesma densidade podem ter sensações diferentes. Cada colchão traz na etiqueta o peso suportado por pessoa, e o consultor confere isso com você.</p>' },
      { h2: 'E os colchões com gel, pillow top e camadas de conforto?', html: '<p>Por cima do miolo, muitos colchões têm camadas de conforto: pillow top, espumas mais macias ou espumas com gel, que ajudam a dissipar o calor. Elas mudam a sensação na hora de deitar, do mais macio ao mais firme, sem mudar o tipo de sustentação do miolo.</p>' }
    ],
    faq: [
      ['Colchão de molas ensacadas é bom para casal?', 'Costuma ser a melhor escolha para casal, porque as molas trabalham separadas e quase não passam movimento de um lado para o outro.'],
      ['O que significa D33 ou D45 no colchão de espuma?', 'É a densidade da espuma, em quilos por metro cúbico. Ela está ligada ao peso que o colchão aguenta: quanto maior a densidade, mais peso ele suporta. A etiqueta de cada colchão mostra o peso indicado por pessoa.'],
      ['Colchão de espuma esquenta mais?', 'Em geral a espuma retém um pouco mais de calor que as molas. Modelos com gel ou com miolo de molas ensacadas tendem a ser mais frescos.'],
      ['Qual dura mais, molas ou espuma?', 'Depende mais da qualidade e do uso correto do que do tipo. Densidade adequada ao peso, base certa e girar o colchão quando o modelo permite ajudam a durar mais.']
    ]
  },
  {
    slug: 'como-escolher-colchao',
    titulo: 'Como escolher colchão: guia em 5 passos',
    h1: 'Como escolher colchão em 5 passos',
    descricao: 'Tamanho, posição de dormir, firmeza, quem divide a cama e o teste na loja: um passo a passo simples para escolher o colchão certo.',
    intro: 'Comprar colchão não precisa ser complicado. Seguindo estes cinco passos, você chega na loja (ou no WhatsApp) sabendo o que perguntar.',
    secoes: [
      { h2: '1. Defina o tamanho', html: '<p>Comece pela medida da cama e do quarto. Veja a tabela completa no <a href="/guia/medidas-de-colchao/">guia de medidas de colchão</a>.</p>' },
      { h2: '2. Pense na posição em que você dorme', html: '<p><strong>De lado:</strong> costuma ir bem com um colchão médio, que deixa ombro e quadril afundarem um pouco. <strong>De barriga para cima:</strong> médio a firme, para o quadril não afundar demais. <strong>De bruços:</strong> geralmente mais firme. São referências, não regras: o teste na loja é que confirma.</p>' },
      { h2: '3. Escolha a firmeza pelo conforto, não pela fama', html: '<p>Firme não quer dizer melhor. O colchão certo segura o corpo sem formar pontos de pressão. Se você tem dor ou alguma condição na coluna, converse com seu médico ou fisioterapeuta, e conte para o consultor na hora do teste.</p>' },
      { h2: '4. Considere quem divide a cama', html: '<p>Casal com pesos ou horários diferentes sente menos o movimento do outro em colchão de molas ensacadas. Quem sente calor pode preferir molas ou espumas com gel. Entenda as diferenças no guia <a href="/guia/molas-ensacadas-ou-espuma/">molas ensacadas ou espuma</a>.</p>' },
      { h2: '5. Teste com calma antes de decidir', html: '<p>Deite de verdade, na posição em que você dorme, por alguns minutos em cada modelo. Se for casal, deitem juntos. No showroom da LS, em Lagoa Santa, os modelos ficam montados para isso, com um consultor ao lado para comparar.</p>' }
    ],
    faq: [
      ['Qual a firmeza ideal de colchão?', 'Depende do seu peso e da posição em que você dorme. Em geral, quem dorme de lado vai bem com colchão médio, e quem dorme de barriga para cima ou de bruços prefere algo mais firme. O teste na loja confirma.'],
      ['Preciso trocar a base junto com o colchão?', 'Se a base está firme, sem afundados e na mesma medida, não precisa. Base empenada ou quebrada estraga o colchão novo, então vale conferir.'],
      ['Quanto tempo devo testar um colchão na loja?', 'Alguns minutos em cada modelo, deitado na posição em que você dorme. Sentar na beirada não mostra como o colchão sustenta o corpo.'],
      ['A LS ajuda a escolher pelo WhatsApp?', 'Sim. Conte como você dorme, seu tamanho de cama e o que incomoda no colchão atual que o consultor indica os modelos e manda fotos e vídeos.']
    ]
  }
];
