import { doc, writeBatch, serverTimestamp, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Area, Theme, Question, QuestionAnswer, QuestionBankJsonRaw } from '../types';
import { normalizeText, generateId } from '../utils/helpers';
import { getThemes, getGroups } from './firebaseService';

export interface ImportProgress {
  currentStep: string;
  processedCount: number;
  totalCount: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  errors: string[];
}

export async function importQuestionBankJson(
  jsonData: any,
  importedBy: string,
  onProgress?: (progress: ImportProgress) => void
): Promise<{ created: number; updated: number; errors: string[] }> {
  const errors: string[] = [];
  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  // Extract data items array
  let rawDataItems: any[] = [];
  if (Array.isArray(jsonData)) {
    rawDataItems = jsonData;
  } else if (jsonData && Array.isArray(jsonData.dados)) {
    rawDataItems = jsonData.dados;
  } else if (jsonData && typeof jsonData === 'object') {
    rawDataItems = [jsonData];
  }

  if (rawDataItems.length === 0) {
    throw new Error("Estrutura JSON inválida ou sem itens no campo 'dados'.");
  }

  // Count total questions for progress tracking
  let totalQuestionsCount = 0;
  rawDataItems.forEach((areaItem: any) => {
    const temas = areaItem.temas || areaItem.Temas || [];
    if (Array.isArray(temas)) {
      temas.forEach((temaItem: any) => {
        if (typeof temaItem === 'object' && temaItem !== null) {
          const questions = temaItem.questoes || temaItem.Questoes || [];
          if (Array.isArray(questions)) {
            totalQuestionsCount += questions.length;
          }
        }
      });
    }
  });

  let processedCount = 0;

  let currentBatch = writeBatch(db);
  let batchOpCount = 0;

  async function checkAndCommitBatch() {
    if (batchOpCount >= 180) { // Keep safety margin below 500 limit
      await currentBatch.commit();
      currentBatch = writeBatch(db);
      batchOpCount = 0;
    }
  }

  // Track created areas & themes in memory
  const areaMap = new Map<string, { id: string; name: string }>();
  const themeMap = new Map<string, { id: string; name: string; areaId: string }>();

  // Process each Area
  for (const areaItem of rawDataItems) {
    const areaName = (areaItem["Área"] || areaItem.Area || areaItem.area || areaItem.name || 'Área Geral').trim();
    const areaNorm = normalizeText(areaName);
    const areaId = `area_${areaNorm.replace(/[^a-z0-9]/g, '_')}`;

    if (!areaMap.has(areaNorm)) {
      areaMap.set(areaNorm, { id: areaId, name: areaName });
      
      const areaRef = doc(db, 'areas', areaId);
      currentBatch.set(areaRef, {
        id: areaId,
        name: areaName,
        normalizedName: areaNorm,
        questionCount: 0,
        active: true,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp()
      }, { merge: true });
      batchOpCount++;
      await checkAndCommitBatch();
    }

    const temas = areaItem.temas || areaItem.Temas || [];
    if (!Array.isArray(temas)) continue;

    // Process each Theme
    for (const temaItem of temas) {
      let temaName = '';
      let questionsList: any[] = [];

      if (typeof temaItem === 'string') {
        temaName = temaItem.trim();
      } else if (typeof temaItem === 'object' && temaItem !== null) {
        temaName = (temaItem.Tema || temaItem.tema || temaItem.name || 'Tema Geral').trim();
        questionsList = temaItem.questoes || temaItem.Questoes || [];
      }

      if (!temaName) continue;

      const temaNorm = normalizeText(temaName);
      const themeKey = `${areaId}_${temaNorm}`;
      const themeId = `theme_${temaNorm.replace(/[^a-z0-9]/g, '_')}`;

      if (!themeMap.has(themeKey)) {
        themeMap.set(themeKey, { id: themeId, name: temaName, areaId });

        const themeRef = doc(db, 'themes', themeId);
        currentBatch.set(themeRef, {
          id: themeId,
          areaId,
          name: temaName,
          normalizedName: temaNorm,
          questionCount: 0,
          active: true,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp()
        }, { merge: true });
        batchOpCount++;
        await checkAndCommitBatch();
      }

      // Process Questions
      for (const qItem of questionsList) {
        processedCount++;
        
        try {
          const rawId = (qItem.ID || qItem.id || generateId('q')).toString().trim();
          const sourceExam = (qItem.Prova || qItem.prova || 'SBOT').trim();
          const statement = (qItem.Enunciado || qItem.enunciado || '').trim();
          
          const rawAlts = qItem.Alternativas || qItem.alternativas || {};
          const alternatives = {
            A: (rawAlts.A || rawAlts.a || '').trim(),
            B: (rawAlts.B || rawAlts.b || '').trim(),
            C: (rawAlts.C || rawAlts.c || '').trim(),
            D: (rawAlts.D || rawAlts.d || '').trim()
          };

          const rawSol = qItem.Solucao || qItem.solucao || {};
          let gabarito: "A" | "B" | "C" | "D" = (rawSol.Gabarito || rawSol.gabarito || 'A').toUpperCase() as any;
          if (!['A', 'B', 'C', 'D'].includes(gabarito)) gabarito = 'A';

          const solutionText = (rawSol.Texto || rawSol.texto || '').trim();
          const comments = (qItem.Comentários || qItem.comentarios || '').trim();
          const imageUrl = qItem.Imagem || qItem.imagem || null;

          if (!statement) {
            skippedCount++;
            continue;
          }

          // Public question document
          const qRef = doc(db, 'questions', rawId);
          const questionPayload: Question = {
            id: rawId,
            areaId,
            areaName,
            themeId,
            themeName: temaName,
            sourceExam,
            statement,
            alternatives,
            imageUrl: imageUrl || null,
            active: true,
            updatedAt: serverTimestamp() as any,
            createdAt: serverTimestamp() as any
          };

          currentBatch.set(qRef, questionPayload, { merge: true });
          batchOpCount++;

          // Protected answer key
          const ansRef = doc(db, 'questionAnswers', rawId);
          const answerPayload: QuestionAnswer = {
            questionId: rawId,
            correctAlternative: gabarito,
            solutionText,
            comments,
            updatedAt: serverTimestamp() as any
          };

          currentBatch.set(ansRef, answerPayload, { merge: true });
          batchOpCount++;

          createdCount++;

          await checkAndCommitBatch();

          if (onProgress) {
            onProgress({
              currentStep: `Processando questão ${processedCount} de ${totalQuestionsCount}...`,
              processedCount,
              totalCount: totalQuestionsCount,
              createdCount,
              updatedCount,
              skippedCount,
              errors
            });
          }
        } catch (err: any) {
          errors.push(`Erro na questão ${processedCount}: ${err.message}`);
        }
      }
    }
  }

  // Commit remaining batch
  if (batchOpCount > 0) {
    await currentBatch.commit();
  }

  // Save import log
  const importLogId = generateId('imp');
  await writeBatch(db).set(doc(db, 'imports', importLogId), {
    id: importLogId,
    importedBy,
    importedAt: serverTimestamp(),
    totalAreas: areaMap.size,
    totalThemes: themeMap.size,
    totalQuestions: processedCount,
    createdQuestions: createdCount,
    updatedQuestions: updatedCount,
    errors,
    status: errors.length === 0 ? 'success' : 'partial'
  }).commit();

  return { created: createdCount, updated: updatedCount, errors };
}

export interface GroupMigrationProgress {
  phase: 'temas' | 'questoes';
  processedCount: number;
  totalCount: number;
}

export interface GroupMigrationResult {
  matched: number;
  matchedQuestions: number;
  unmatched: string[]; // "Área > Tema" que não bateu com nenhum tema existente
  unknownGroups: string[]; // nomes de grupo do JSON sem correspondência em `groups`
}

// Grava `groupId`/`groupName` (agrupamento TEOT — ver Group em types.ts) nos
// documentos de `themes` já existentes E em TODAS as questões de cada tema
// (coleção `questions`, mesma denormalização que existia para o extinto
// campo `subArea`), a partir de uma árvore Área → Grupo → Temas (ver
// reference/areas_grupos_temas.json). Diferente da antiga árvore de
// subáreas, aqui o agrupamento é por Tema, não por Área inteira — uma mesma
// Área pode ter temas em vários Grupos diferentes (ex.: a Área "Coluna" tem
// temas em "Ciência Básica", "Ortopedia Adulto", "Ortopedia Infantil" e
// "Trauma Adulto"). Os IDs de tema são determinísticos
// (`theme_<nome-normalizado>`, gerados em importQuestionBankJson), então dá
// para localizar o documento certo só pelo nome do tema. Só atualiza
// temas/questões que já existem (nunca cria nada novo); qualquer nome de
// tema sem correspondência exata volta na lista `unmatched`.
export async function applyThemeGroups(
  treeJson: any[],
  onProgress?: (progress: GroupMigrationProgress) => void
): Promise<GroupMigrationResult> {
  if (!Array.isArray(treeJson)) {
    throw new Error("Estrutura JSON inválida: esperado um array de entradas Área/Grupo/Temas.");
  }

  const [existingThemes, groups] = await Promise.all([getThemes(), getGroups()]);
  const existingIds = new Set(existingThemes.map(t => t.id));
  const groupIdByNormName = new Map(groups.map(g => [normalizeText(g.name), g.id]));

  const unmatched: string[] = [];
  const unknownGroupsSet = new Set<string>();
  // themeId -> {groupId, groupName}, só para os temas efetivamente
  // encontrados — usado na segunda fase para atualizar as questões do tema.
  const matchedThemeGroups = new Map<string, { groupId: string; groupName: string }>();
  let processedCount = 0;

  const totalCount = treeJson.reduce((sum: number, entry: any) => {
    return sum + (Array.isArray(entry.themeName) ? entry.themeName.length : 0);
  }, 0);

  let batch = writeBatch(db);
  let opCount = 0;

  const commitIfNeeded = async () => {
    if (opCount >= 400) {
      await batch.commit();
      batch = writeBatch(db);
      opCount = 0;
    }
  };

  // Fase 1: temas
  for (const entry of treeJson) {
    const areaName = (entry.areaName || '').trim();
    const groupName = (entry.groupName || '').trim();
    const groupId = groupIdByNormName.get(normalizeText(groupName));
    const temas: string[] = Array.isArray(entry.themeName) ? entry.themeName : [];

    if (!groupId) {
      if (groupName) unknownGroupsSet.add(groupName);
      processedCount += temas.length;
      onProgress?.({ phase: 'temas', processedCount, totalCount });
      continue;
    }

    for (const temaNameRaw of temas) {
      const temaName = (temaNameRaw || '').trim();
      processedCount++;

      const temaNorm = normalizeText(temaName);
      const themeId = `theme_${temaNorm.replace(/[^a-z0-9]/g, '_')}`;

      if (existingIds.has(themeId)) {
        batch.set(doc(db, 'themes', themeId), {
          groupId,
          groupName,
          updatedAt: serverTimestamp()
        }, { merge: true });
        opCount++;
        matchedThemeGroups.set(themeId, { groupId, groupName });
        await commitIfNeeded();
      } else {
        unmatched.push(`${areaName} > ${temaName}`);
      }

      onProgress?.({ phase: 'temas', processedCount, totalCount });
    }
  }

  if (opCount > 0) {
    await batch.commit();
    batch = writeBatch(db);
    opCount = 0;
  }

  // Fase 2: todas as questões de cada tema encontrado — o grosso da carga
  // (milhares de documentos), por isso em lotes maiores. `Theme.questionCount`
  // já é mantido pelas rotinas de escrita de questão, então dá para estimar
  // o total da barra de progresso sem precisar consultar tudo antes.
  let matchedQuestions = 0;
  let questionsProcessed = 0;
  const themeIds = Array.from(matchedThemeGroups.keys());
  const themeById = new Map(existingThemes.map(t => [t.id, t]));
  const estimatedTotalQuestions = themeIds.reduce((sum, id) => sum + (themeById.get(id)?.questionCount || 0), 0);

  for (const themeId of themeIds) {
    const { groupId, groupName } = matchedThemeGroups.get(themeId)!;

    const questionsSnap = await getDocs(query(collection(db, 'questions'), where('themeId', '==', themeId)));
    for (const qDoc of questionsSnap.docs) {
      batch.set(doc(db, 'questions', qDoc.id), {
        groupId,
        groupName,
        updatedAt: serverTimestamp()
      }, { merge: true });
      opCount++;
      matchedQuestions++;
      questionsProcessed++;
      await commitIfNeeded();

      onProgress?.({ phase: 'questoes', processedCount: questionsProcessed, totalCount: Math.max(estimatedTotalQuestions, questionsProcessed) });
    }
  }

  if (opCount > 0) {
    await batch.commit();
  }

  return { matched: matchedThemeGroups.size, matchedQuestions, unmatched, unknownGroups: Array.from(unknownGroupsSet) };
}
