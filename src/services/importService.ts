import { doc, writeBatch, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Area, Theme, Question, QuestionAnswer, QuestionBankJsonRaw } from '../types';
import { normalizeText, generateId } from '../utils/helpers';
import { getThemes } from './firebaseService';

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

export interface SubAreaMigrationProgress {
  processedCount: number;
  totalCount: number;
}

export interface SubAreaMigrationResult {
  matched: number;
  unmatched: string[]; // "Área > Tema" que não bateu com nenhum tema existente
  skippedAreas: string[]; // áreas sem agrupamento por subárea (ex.: Anatomia)
}

// Grava o campo `subArea` nos documentos de `themes` já existentes, a partir
// de uma árvore Área → Subárea → Temas (ver reference/arvore_temas_subareas.json).
// Os IDs de tema são determinísticos (`theme_<nome-normalizado>`, gerados em
// importQuestionBankJson) — por isso dá para localizar o documento certo só
// pelo nome do tema, sem precisar cruzar com o ID da área. Só atualiza temas
// que já existem (nunca cria um tema novo); qualquer nome sem correspondência
// exata volta na lista `unmatched` para reconciliação manual.
export async function applyThemeSubAreas(
  treeJson: any[],
  onProgress?: (progress: SubAreaMigrationProgress) => void
): Promise<SubAreaMigrationResult> {
  if (!Array.isArray(treeJson)) {
    throw new Error("Estrutura JSON inválida: esperado um array de áreas.");
  }

  const existingThemes = await getThemes();
  const existingIds = new Set(existingThemes.map(t => t.id));

  const unmatched: string[] = [];
  const skippedAreas: string[] = [];
  let matched = 0;
  let processedCount = 0;

  const totalCount = treeJson.reduce((sum: number, areaItem: any) => {
    const subAreas = areaItem['subáreas'] || areaItem.subareas || areaItem.subAreas;
    if (!Array.isArray(subAreas)) return sum;
    return sum + subAreas.reduce((s: number, sub: any) => s + (Array.isArray(sub.temas) ? sub.temas.length : 0), 0);
  }, 0);

  let batch = writeBatch(db);
  let opCount = 0;

  const commitIfNeeded = async () => {
    if (opCount >= 180) {
      await batch.commit();
      batch = writeBatch(db);
      opCount = 0;
    }
  };

  for (const areaItem of treeJson) {
    const areaName = (areaItem['Área'] || areaItem.Area || areaItem.area || '').trim();
    const subAreas = areaItem['subáreas'] || areaItem.subareas || areaItem.subAreas;

    if (!Array.isArray(subAreas)) {
      // Áreas sem agrupamento por subárea (Anatomia, Ciência Básica) — não
      // há nada para gravar, mas registramos para deixar claro que foram
      // vistas e puladas de propósito, não esquecidas.
      if (areaName) skippedAreas.push(areaName);
      continue;
    }

    for (const sub of subAreas) {
      const subAreaName = (sub['subárea'] || sub.subarea || sub.subArea || '').trim();
      const temas: string[] = Array.isArray(sub.temas) ? sub.temas : [];

      for (const temaNameRaw of temas) {
        const temaName = (temaNameRaw || '').trim();
        processedCount++;

        const temaNorm = normalizeText(temaName);
        const themeId = `theme_${temaNorm.replace(/[^a-z0-9]/g, '_')}`;

        if (existingIds.has(themeId)) {
          batch.set(doc(db, 'themes', themeId), {
            subArea: subAreaName,
            updatedAt: serverTimestamp()
          }, { merge: true });
          opCount++;
          matched++;
          await commitIfNeeded();
        } else {
          unmatched.push(`${areaName} > ${temaName}`);
        }

        onProgress?.({ processedCount, totalCount });
      }
    }
  }

  if (opCount > 0) {
    await batch.commit();
  }

  return { matched, unmatched, skippedAreas };
}
