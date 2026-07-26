import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// Load arvore_temas.json
const arvorePath = path.join(process.cwd(), 'arvore_temas.json');
let arvoreTemasData: any[] = [];
try {
  if (fs.existsSync(arvorePath)) {
    const raw = fs.readFileSync(arvorePath, 'utf-8');
    arvoreTemasData = JSON.parse(raw);
  }
} catch (e) {
  console.error('Error loading arvore_temas.json:', e);
}

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', areasCount: arvoreTemasData.length });
});

app.get('/api/topics', (req, res) => {
  res.json(arvoreTemasData);
});

// Helper to generate fallback local questions for TEOT
function generateFallbackQuestions(area: string, tema: string, count: number) {
  const sampleTemplates = [
    {
      enunciado: `Paciente do sexo masculino, 34 anos, vítima de trauma de alta energia (acidente motociclístico), dá entrada no pronto-socorro com queixa de dor intensa, deformidade e limitação funcional na região relacionada ao tema "${tema}". Ao exame físico e radiográfico, observa-se achado característico referente a ${tema.toLowerCase()}.`,
      opcoes: [
        `Conduta conservadora com imobilização gessada e acompanhamento ambulatorial semanal.`,
        `Tratamento cirúrgico com redução aberta e fixação interna rígida antecedida de descompressão cirúrgica se necessário.`,
        `Infiltração local com corticoide de depósito e reabilitação fisioterápica precoce.`,
        `Arthrodese primária de urgência devido à alta taxa de pseudoartrose relatada na literatura.`
      ],
      respostaCorreta: 1,
      explicacao: `No tema de ${tema} (${area}), a conduta de escolha para pacientes jovens com lesões desalinhadas ou traumáticas de alta energia envolve a estabilização anatômica rígida e restabelecimento dos eixos mecânicos, visando prevenir complicações como rigidez articular e osteoartrose secundária. Referência: Campbell's Operative Orthopaedics.`,
      pontosChave: [
        'Anatomia e biomecânica do alinhamento articular',
        'Indicações cirúrgicas vs conservadoras em traumatologia ortopédica',
        'Prevenção de complicações tardias (pseudoartrose e rigidez)'
      ]
    },
    {
      enunciado: `Sobre o exame físico, quadro clínico e diagnóstico diferencial no tema de "${tema}" (${area}), assinale a alternativa CORRETA em conformidade com as diretrizes da Sociedade Brasileira de Ortopedia e Traumatologia (SBOT):`,
      opcoes: [
        `O teste funcional específico apresenta alta sensibilidade, porém o exame padrão-ouro inicial para triagem é a radiografia simples nas incidências apropriadas.`,
        `A ressonância magnética é mandatória antes de qualquer avaliação clínica radiográfica simples inicial.`,
        `A conduta inicial em casos agudos consiste na aplicação imediata de calor local e carga total sem auxílio.`,
        `O quadro clínico independe da faixa etária ou do mecanismo de lesão envolvido.`
      ],
      respostaCorreta: 0,
      explicacao: `A investigação do tema ${tema} deve sempre iniciar pela anamnese detalhada, exame físico dirigido com testes ortopédicos específicos e radiografia simples de boa qualidade em pelo menos dois planos ortogonais. Exames avançados como TC ou RM são solicitados de forma complementar quando necessários para o planejamento cirúrgico ou detalhamento de partes moles.`,
      pontosChave: [
        'Propedeutica ortopédica e sequenciamento de exames',
        'Exame físico específico e testes de estresse',
        'Raciocínio clínico ortopédico no TEOT'
      ]
    },
    {
      enunciado: `Qual das seguintes complicações e aspectos anatômicos e cirúrgicos relacionados a "${tema}" representa a principal preocupação descrita na literatura clássica (Rockwood & Green / Campbell)?`,
      opcoes: [
        `Lesão do nervo radial com incapacidade de extensão do punho e dedos.`,
        `Síndrome compartimental, osteonecrose avascular ou consolidação viciosa a depender do desvio e vascularização local.`,
        `Rotura espontânea do tendão patelar em 90% dos casos tratados cirurgicamente.`,
        `Infecção bacteriana fúngica oportunista por Aspergillus spp.`
      ],
      respostaCorreta: 1,
      explicacao: `Nas afecções da área de ${area}, em especial relacionadas a ${tema}, o suprimento vascular e a pressão compartimental são determinantes para o prognóstico. Complicações como necrose avascular, síndrome compartimental aguda e pseudoartrose devem ser ativamente investigadas e prevenidas.`,
      pontosChave: [
        'Vascularização e suprimento sanguíneo regional',
        'Avaliação neurovascular detalhada',
        'Prevenção de síndrome compartimental'
      ]
    }
  ];

  const questions = [];
  for (let i = 0; i < count; i++) {
    const tmpl = sampleTemplates[i % sampleTemplates.length];
    questions.push({
      id: `q-loc-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 5)}`,
      area,
      tema,
      dificuldade: i % 2 === 0 ? 'Média' : 'Difícil',
      enunciado: `${tmpl.enunciado} [Questão TEOT - ${area}]`,
      opcoes: tmpl.opcoes,
      respostaCorreta: tmpl.respostaCorreta,
      explicacao: tmpl.explicacao,
      pontosChave: tmpl.pontosChave,
      referencia: `Tratado de Ortopedia e Traumatologia SBOT / Campbell ${area}`
    });
  }

  return questions;
}

app.post('/api/generate-questions', async (req, res) => {
  const { area, tema, count = 3, dificuldade = 'teot' } = req.body;

  if (!area || !tema) {
    return res.status(400).json({ error: 'Área e Tema são obrigatórios.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.log('[AI Question Gen] GEMINI_API_KEY not found. Using structured TEOT fallback generator.');
    const fallback = generateFallbackQuestions(area, tema, Number(count));
    return res.json({ questions: fallback, source: 'local-database' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Você é um preceptor sênior da Sociedade Brasileira de Ortopedia e Traumatologia (SBOT) e examinador da prova do Título de Especialista em Ortopedia e Traumatologia (TEOT).
Gere exatamente ${count} questões de alto nível sobre a área "${area}" e o tema específico "${tema}".
Nível de dificuldade: ${dificuldade.toUpperCase()} (estilo prova TEOT/Tarso/SBOT).

Regras obrigatórias:
1. Cada questão deve ser baseada em caso clínico realista ou conceito fundamental de anatomia, biomecânica, classificação ou conduta ortopédica.
2. Forneça exatamente 4 opções de resposta (A, B, C, D).
3. A resposta correta deve ser o índice numérico (0 para A, 1 para B, 2 para C, 3 para D).
4. Forneça uma explicação cirúrgica/médica detalhada e fundamentada na literatura de referência (Campbell, Rockwood, Tachdjian, Hoppenfeld, DeLee & Drez, Netter, etc).
5. Forneça 2 a 4 pontos-chave para revisão rápida.

Retorne ESTRITAMENTE um JSON válido com o seguinte formato, sem formatação markdown em volta:
{
  "questions": [
    {
      "enunciado": "Texto da questão / caso clínico...",
      "opcoes": [
        "Opção A",
        "Opção B",
        "Opção C",
        "Opção D"
      ],
      "respostaCorreta": 0,
      "explicacao": "Explicação completa...",
      "pontosChave": ["Ponto 1", "Ponto 2"],
      "referencia": "Campbell's Operative Orthopaedics, 14th ed."
    }
  ]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.7,
      }
    });

    const text = response.text || '';
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanText);

    if (parsed.questions && Array.isArray(parsed.questions)) {
      const formatted = parsed.questions.map((q: any, index: number) => ({
        id: `q-gem-${Date.now()}-${index}`,
        area,
        tema,
        dificuldade: dificuldade === 'teot' ? 'TEOT/SBOT' : dificuldade,
        enunciado: q.enunciado,
        opcoes: q.opcoes,
        respostaCorreta: typeof q.respostaCorreta === 'number' ? q.respostaCorreta : 0,
        explicacao: q.explicacao,
        pontosChave: q.pontosChave || [],
        referencia: q.referencia || 'Literatura de Referência SBOT'
      }));
      return res.json({ questions: formatted, source: 'gemini-2.5-flash' });
    }

    throw new Error('Formato retornado pelo modelo é inválido.');
  } catch (error: any) {
    console.warn('[AI Question Gen] Gemini generation failed or unavailable:', error?.message || error);
    const fallback = generateFallbackQuestions(area, tema, Number(count));
    return res.json({ questions: fallback, source: 'local-fallback' });
  }
});

// Serve frontend assets
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Banco de Questões server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
