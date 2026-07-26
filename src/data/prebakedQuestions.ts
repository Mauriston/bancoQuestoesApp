import { Question, Flashcard } from '../types';

export const HIGH_YIELD_QUESTIONS: any[] = [
  {
    id: 'hy-onc-1',
    area: 'Oncologia Ortopédica',
    tema: 'Osteossarcomas',
    dificuldade: 'TEOT/SBOT',
    enunciado: 'Paciente do sexo masculino, 16 anos, refere dor contínua e aumento de volume doloroso em região metafisária do fêmur distal direito há 3 meses, com piora noturna. As radiografias mostram lesão lítica permeativa com reação periosteal do tipo "triângulo de Codman" e imagem em "raios de sol". Qual é o achado anatomopatológico patognomônico e a conduta neoadjuvante padronizada?',
    opcoes: [
      'Células gigantes multinucleadas em estroma fibroso simples; Amputação transfemoral imediata.',
      'Produção de osteoide imaturo (matriz óssea) diretamente por células estromais malignas; Quimioterapia neoadjuvante seguida de ressecção ampla e reconstrução.',
      'Cartilagem hialina lobulada com calcificações em "pipoca"; Curetagem e enxertia óssea.',
      'Pequenas células redondas e azuis com rosetas de Homer-Wright; Radioterapia exclusiva.'
    ],
    respostaCorreta: 1,
    explicacao: 'O Osteossarcoma osteossarcomatoso convencional é o tumor ósseo maligno primário mais frequente na infância/adolescência. O diagnóstico histológico exige a identificação de estroma osteoide maligno produzido diretamente por osteoblastos atípicos. O protocolo atual engloba quimioterapia neoadjuvante (pré-operatória), ressecção cirúrgica com margem ampla e quimioterapia adjuvante.',
    pontosChave: [
      'Pico de incidência na 2ª década em metáfises de ossos longos (fêmur distal / tíbia proximal)',
      'Sinais radiográficos de agressividade: Triângulo de Codman e imagem em raios de sol',
      'Histologia: produção direta de osteoide tumoral por células anoplásicas'
    ],
    referencia: 'Campbell\'s Operative Orthopaedics - Tumor Chapter'
  },
  {
    id: 'hy-joe-1',
    area: 'Cirurgia do Joelho',
    tema: 'Lesões do LCA',
    dificuldade: 'TEOT/SBOT',
    enunciado: 'Atleta profissional de futebol feminino sofreu entorse do joelho esquerdo em valgo e rotação externa durante mudança de direção. Evoluiu com hemartrose volumosa imediata. Ao exame, apresenta Pivot-Shift grau 3 e Lachman positivo com parada macia. Qual feixe do Ligamento Cruzado Anterior (LCA) é primariamente responsável pelo controle da rotação tibial interna perto da extensão?',
    opcoes: [
      'Feixe Anteromedial (AM)',
      'Feixe Posterolateral (PL)',
      'Feixe Anterolateral (AL)',
      'Ligamento Meniscofemoral de Wrisberg'
    ],
    respostaCorreta: 1,
    explicacao: 'O LCA possui dois feixes funcionais: o feixe Anteromedial (AM) e o feixe Posterolateral (PL). O feixe PL é tenso próximo à extensão total e é o principal responsável pela estabilidade rotacional (evitando a subluxação rotatória detectada no teste do Pivot-Shift). O feixe AM é mais tenso em flexão e controla a translação anterior mecânica.',
    pontosChave: [
      'Feixe AM: tenso em flexão (estabilidade translacional anterior)',
      'Feixe PL: tenso em extensão (estabilidade rotacional - Pivot Shift)',
      'Mecanismo clássico: Valgo + Rotação Externa + Flexão moderada'
    ],
    referencia: 'Insall & Scott Surgery of the Knee'
  },
  {
    id: 'hy-ped-1',
    area: 'Ortopedia Pediátrica',
    tema: 'Pé torto congênito e técnica de Ponseti',
    dificuldade: 'TEOT/SBOT',
    enunciado: 'Recém-nascido com Pé Torto Congênito (PTC) idiopático unilateral é levado à consulta ortopédica para início do tratamento pela técnica de Ponseti. Qual é a sequência estrita de correção das deformidades do PTC durante as trocas gessadas seriadas?',
    opcoes: [
      'Equino -> Varo -> Aduto -> Cavo',
      'Cavo (corrigido alinhando o antepé com o retropé) -> Aduto e Varo (em abdução sob o tálus) -> Equino (por tenotomia percutânea do tendão de Aquiles)',
      'Aduto -> Equino -> Cavo -> Varo',
      'Varo -> Equino -> Cavo -> Tenotomia do tibial anterior'
    ],
    respostaCorreta: 1,
    explicacao: 'A técnica de Ponseti fundamenta-se na regra mnemônica CAVE (Cavo, Aduto, Varo, Equino). A primeira manobra corrige o CAVO elevando o primeiro raio para alinhar o antepé com o retropé. Em seguida, o pé é progressivamente abduzido sob a cabeça do tálus, corrigindo simultaneamente o ADUTO e o VARO. O EQUINO é a última deformidade corrigida e requer tenotomia percutânea do tendão de Aquiles em ~90% dos casos.',
    pontosChave: [
      'Mnemônico das deformidades: CAVE (Cavo, Aduto, Varo, Equino)',
      'Primeiro raio elevado no 1º gesso para alinhar antepé com retropé',
      'O fulcro de correção é a cabeça do tálus (nunca a articulação calcaneocuboide)'
    ],
    referencia: 'Ponseti IV. Congenital Clubfoot: Fundamentals of Treatment'
  },
  {
    id: 'hy-col-1',
    area: 'Cirurgia da Coluna',
    tema: 'Fraturas da coluna toracolombar',
    dificuldade: 'TEOT/SBOT',
    enunciado: 'Em um paciente com fratura de coluna toracolombar do tipo explosão (burst fracture), segundo a classificação de Denis de três colunas, quais colunas anatômicas estão comprometidas?',
    opcoes: [
      'Apenas a Coluna Anterior',
      'Coluna Anterior e Coluna Média',
      'Coluna Média e Coluna Posterior exclusivamente',
      'Coluna Anterior, Média e Posterior obrigatoriamente'
    ],
    respostaCorreta: 1,
    explicacao: 'Segundo o modelo de 3 colunas de Denis: A Coluna Anterior compreende o ligamento longitudinal anterior, metade anterior do corpo e disco. A Coluna Média compreende a metade posterior do corpo, disco e ligamento longitudinal posterior. A Coluna Posterior compreende pedículos, facetas, lâminas e ligamentos posteriores. Nas fraturas do tipo explosão, ocorre compressão axial resultando em rotura da Coluna Anterior E da Coluna Média (com retropulsão de fragmento ósseo para o canal canal vertebral).',
    pontosChave: [
      'Denis: 3 colunas (Anterior, Média e Posterior)',
      'Fratura Explosão (Burst): envolve obrigatoriamente Coluna Anterior + Coluna Média',
      'Risco neurológico por retropulsão do fragmento posterior do corpo vertebral'
    ],
    referencia: 'Denis F. The three column spine and its significance in the classification of acute thoracolumbar spine injuries.'
  },
  {
    id: 'hy-qua-1',
    area: 'Cirurgia do quadril',
    tema: 'Fraturas do Colo do Fêmur ',
    dificuldade: 'TEOT/SBOT',
    enunciado: 'Paciente do sexo feminino, 78 anos, com diagnóstico de fratura intracapsular do colo do fêmur direito. Na radiografia bacia AP, observa-se desvio completo com desalinhamento total das trabéculas ósseas (Classificação de Garden IV). Qual é o tratamento cirúrgico consagrado para esta paciente idosa com demanda funcional moderada?',
    opcoes: [
      'Fixação interna com 3 parafusos canulados em triângulo invertido.',
      'Artroplastia (Parcial ou Total de Quadril a depender da expectativa de vida e acetábulo).',
      'Osteotomia valgisante de intertrocantérica.',
      'Tratamento conservador com tração cutânea por 6 semanas.'
    ],
    respostaCorreta: 1,
    explicacao: 'As fraturas do colo do fêmur em idosos dividem-se em não desviadas (Garden I e II) e desviadas (Garden III e IV). Nas desviadas em idosos, devido ao alto risco de necrose avascular da cabeça femoral (fornecimento pelos ramos retinaculares da artéria circumflexa femoral medial) e falha de fixação, a indicação de escolha é a Artroplastia de Quadril.',
    pontosChave: [
      'Garden I (incompleta/impactada em valgo) e Garden II (completa sem desvio)',
      'Garden III (completa com desvio parcial) e Garden IV (completa com desvio total)',
      'Vascularização arterial do colo: ramos da artéria circumflexa femoral medial'
    ],
    referencia: 'Rockwood & Green\'s Fractures in Adults'
  },
  {
    id: 'hy-mao-1',
    area: 'Cirurgia da Mão',
    tema: 'Fratura do escafoide',
    dificuldade: 'TEOT/SBOT',
    enunciado: 'Jovem de 22 anos cai sobre a mão espalmada em hiperextensão do punho. Apresenta dor palpatória e edema na tabaqueira anatômica e dor à compressão axial do polegar. A radiografia inicial não demonstra fratura nítida. Qual a conduta correta?',
    opcoes: [
      'Alta com analgesia simples e liberação para atividades físicas.',
      'Imobilização gessada espica de polegar por 2 semanas e repetição do exame radiográfico e/ou RM.',
      'Gesso curto de antebraço excluindo o polegar por 12 semanas.',
      'Fixação cirúrgica imediata de urgência sem novos exames.'
    ],
    respostaCorreta: 1,
    explicacao: 'Suspeita clínica de fratura de escafoide com radiografia inicial negativa deve ser imobilizada imediatamente com gesso espica de polegar (ou tala) por 10 a 14 dias, momento em que a reabsorção óssea torna a linha de fratura visível na radiografia. Alternativamente, a Ressonância Magnética precoce confirma ou descarta a fratura.',
    pontosChave: [
      'Sinais clínicos: dor na tabaqueira anatômica e tubérculo do escafoide',
      'Vascularização retrógrada (risco de osteonecrose no polo proximal)',
      'Fratura oculta inicial exige imobilização e reavaliação em 2 semanas'
    ],
    referencia: 'Green\'s Operative Hand Surgery'
  },
  {
    id: 'hy-omb-1',
    area: 'Cirurgia do Ombro e Cotovelo',
    tema: 'Fraturas Proximais do Úmero',
    dificuldade: 'TEOT/SBOT',
    enunciado: 'Segundo a Classificação de Neer para fraturas do úmero proximal, um fragmento anatômico (cabeça, tubérculo maior, tubérculo menor ou diáfise) só é considerado uma "PARTE" desviada quando atinge quais critérios mínimos?',
    opcoes: [
      'Desvio maior que 0.5 cm ou angulação superior a 10 graus.',
      'Desvio maior que 1,0 cm (ou 0,5 cm para o tubérculo maior) OU angulação maior que 45 graus.',
      'Qualquer traço visível independentemente do desvio.',
      'Desvio maior que 2,0 cm e rotação de 90 graus.'
    ],
    respostaCorreta: 1,
    explicacao: 'A classificação de Neer baseia-se em 4 partes anatômicas: Colo Anatômico, Colo Cirúrgico, Tubérculo Maior e Tubérculo Menor. Para ser considerada uma "PARTE" desviada, o fragmento deve ter desvio anatômico > 1 cm (exceção de 0.5 cm para o tubérculo maior devido à tração do manguito) ou angulação > 45°.',
    pontosChave: [
      '4 partes potenciais: Cabeça, T. Maior, T. Menor e Diáfise',
      'Critério de desvio: >1cm de translação ou >45° de angulação',
      'Exceção: Tubérculo Maior desviado em >0,5cm já é considerado desvio significativo'
    ],
    referencia: 'Neer CS 2nd. Displaced proximal humeral fractures.'
  },
  {
    id: 'hy-bas-1',
    area: 'Ciência Básica',
    tema: 'Consolidação de Fraturas',
    dificuldade: 'TEOT/SBOT',
    enunciado: 'A consolidação óssea secundária (ou indireta) ocorre em ambiente de estabilidade relativa (ex: haste intramedular ou gesso). Qual é a sequência cronológica correta de suas fases histológicas?',
    opcoes: [
      'Remodelamento -> Calo Duro -> Hematoma -> Calo Mole',
      'Fase Inflamatória (Hematoma) -> Calo Mole (Cartilaginoso) -> Calo Duro (Ossificação) -> Remodelamento Ósseo',
      'Ossificação Intramembranosa imediata -> Reabsorção osteoclástica -> Fibrose',
      'Calo Rígido Haversiano -> Fibrocartilagem -> Hematoma'
    ],
    respostaCorreta: 1,
    explicacao: 'A consolidação secundária/indireta evolui em 4 fases distintas: 1. Inflamatória e formação do hematoma de fratura (0-7 dias); 2. Calo mole fibrocartilaginoso (2-3 semanas); 3. Calo duro com ossificação endocondral (3-4 meses); 4. Remodelamento ósseo (meses a anos) segundo a Lei de Wolff.',
    pontosChave: [
      'Estabilidade Relativa -> Consolidação Secundária (com formação de calo ósseo)',
      'Estabilidade Absoluta (Placa de compressão) -> Consolidação Primária (sem calo visível)',
      'Ossificação endocondral substitui a matriz fibrocartilaginosa do calo mole'
    ],
    referencia: 'Basic Science of Musculoskeletal System - AAOS / AO Principles'
  },
  {
    id: 'hy-pe-1',
    area: 'Cirurgia do Pé e Tornozelo',
    tema: 'Fraturas do Calcâneo',
    dificuldade: 'TEOT/SBOT',
    enunciado: 'Nas fraturas intra-articulares do calcâneo, a radiografia em perfil do pé permite mensurar o Ângulo de Böhler. Qual é o valor de referência normal deste ângulo e o que sua diminuição indica?',
    opcoes: [
      'Normal de 0° a 10°; sua diminuição indica valgo do retropé.',
      'Normal de 20° a 40°; sua diminuição indica colapso da faceta articular posterior do calcâneo e perda da altura óssea.',
      'Normal de 60° a 80°; sua diminuição indica luxação de Lisfranc.',
      'Normal de 100° a 120°; sua diminuição indica entorse syndesmal.'
    ],
    respostaCorreta: 1,
    explicacao: 'O Ângulo de Böhler é formado pela intersecção de duas linhas na radiografia lateral do calcâneo: uma do ponto mais alto do processo anterior ao ponto mais alto da faceta articular posterior, e outra desta faceta ao ponto mais alto da tuberosidade posterior. Valor normal: 20° a 40°. O colapso do calcâneo reduz este ângulo.',
    pontosChave: [
      'Ângulo de Böhler normal: 20° a 40°',
      'Ângulo de Gissane normal: 120° a 145°',
      'Diminuição de Böhler = achatamento do calcâneo e afundamento articular'
    ],
    referencia: 'Mann\'s Surgery of the Foot and Ankle'
  },
  {
    id: 'hy-ana-1',
    area: 'Anatomia',
    tema: 'Anatomia do plexo braquial',
    dificuldade: 'TEOT/SBOT',
    enunciado: 'Um paciente vítima de ferimento por arma branca na região axilar apresenta déficit na flexão do cotovelo e hipoestesia na face lateral do antebraço. Qual nervo periférico do plexo braquial (origem do fascículo lateral) foi lesado?',
    opcoes: [
      'Nervo Radial',
      'Nervo Musculocutâneo',
      'Nervo Axilar',
      'Nervo Ulnar'
    ],
    respostaCorreta: 1,
    explicacao: 'O Nervo Musculocutâneo origina-se do Fascículo Lateral do plexo braquial (raízes C5, C6, C7). Ele perfura o músculo coracobraquial e inerva os músculos do compartimento anterior do braço (coracobraquial, bíceps braquial e braquial), sendo responsável pela flexão do cotovelo e supinação. Continua distalmente como nervo cutâneo lateral do antebraço.',
    pontosChave: [
      'Origem: Fascículo Lateral (C5, C6, C7)',
      'Perfura o músculo Coracobraquial',
      'Domo sensitivo: Nervo Cutâneo Lateral do Antebraço'
    ],
    referencia: 'Hoppenfeld - Propedêutica Ortopédica / Netter Anatomia'
  }
];

export const SAMPLE_FLASHCARDS: Flashcard[] = [
  {
    id: 'fc-1',
    area: 'Ortopedia Pediátrica',
    tema: 'Salter-Harris (Lesões Fisárias)',
    frente: 'Como se caracteriza a lesão Salter-Harris Tipo II?',
    verso: 'Fratura através da placa epifisária (fise) emergindo pela metáfise, levando um fragmento metafisário triangular conhecido como Sinal de Thurston-Holland.',
    detalhes: 'Tipo I: Fise pura | Tipo II: Fise + Metáfise | Tipo III: Fise + Epífise | Tipo IV: Fise + Metáfise + Epífise | Tipo V: Compressão fise'
  },
  {
    id: 'fc-2',
    area: 'Cirurgia do Quadril',
    tema: 'Classificação de Garden (Colo do Fêmur)',
    frente: 'Qual a diferença entre Garden I, II, III e IV?',
    verso: 'Garden I: Incompleta/impactada em valgo; Garden II: Completa não desviada; Garden III: Completa com desvio parcial; Garden IV: Completa com desvio total e perda de contato trabecular.',
    detalhes: 'Garden I e II = Não desviadas | Garden III e IV = Desviadas (alto risco de necrose avascular)'
  },
  {
    id: 'fc-3',
    area: 'Ciência Básica',
    tema: 'Gustilo e Anderson (Fraturas Expostas)',
    frente: 'Quais os critérios da fratura exposta Gustilo Tipo IIIB?',
    verso: 'Exposição com perda substancial de partes moles, contaminação grave, sendo necessário RETALHO para cobertura de tecidos, apesar da cobertura periosteal óssea estar comprometida.',
    detalhes: 'IIIA: Cobertura perióstea adequada sem necessidade de retalhos | IIIB: Requer retalhos | IIIC: Requer reparo vascular independente da ferida'
  },
  {
    id: 'fc-4',
    area: 'Oncologia Ortopédica',
    tema: 'Tumor de Células Gigantes (TCG)',
    frente: 'Qual a localização epifisária típica e faixa etária do TCG?',
    verso: 'Esqueleto maduro (após fechamento da fise, 20-40 anos), localizado na EPIFÍSE de ossos longos (fêmur distal, tíbia proximal e rádio distal).',
    detalhes: 'Imagem em "bolhas de sabão", lesão lítica expansiva sem esclerose marginal. Tratamento: curetagem + adjuvância local.'
  },
  {
    id: 'fc-5',
    area: 'Cirurgia do Ombro e Cotovelo',
    tema: 'Tríade Terrível do Cotovelo',
    frente: 'Quais são os 3 componentes anatomopatológicos da Tríade Terrível?',
    verso: '1. Luxação posterior do cotovelo; 2. Fratura da cabeça do rádio; 3. Fratura do processo coronoide da ulna.',
    detalhes: 'Mecanismo de carga axial em valgo e posterolateral. Exige reconstrução da cabeça do rádio, coronoide e banda lateral do LCL.'
  }
];
