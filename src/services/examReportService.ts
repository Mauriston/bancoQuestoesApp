import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import { shareOrDownloadFile } from '../utils/fileShare';

export interface ExamReportPdfResult {
  url: string;
  fileName: string;
}

// Chama a Cloud Function generateExamReportPdf (ver functions/src/index.ts),
// que renderiza o mesmo template do relatório (src/reportTemplate.ts) com
// Chromium headless no servidor — sem depender do diálogo de impressão do
// navegador do candidato — salva o PDF no Storage e devolve a URL de
// download. Pode levar alguns segundos (Chromium headless + partida a
// frio da função); o chamador deve mostrar um indicador de carregamento.
//
// A função só gera o PDF na primeira chamada de cada tentativa — chamadas
// seguintes (ex.: se o estado local ainda não sabe que já existe) devolvem
// a mesma URL já salva, sem rodar o Chromium de novo. O chamador deve
// guardar a URL retornada (ver reportPdfUrl em Attempt) e, nas próximas
// vezes, usar viewExamReportPdf diretamente em vez de chamar esta função.
export async function generateAndDownloadExamReportPdf(attemptId: string): Promise<ExamReportPdfResult> {
  const generate = httpsCallable<{ attemptId: string }, ExamReportPdfResult>(functions, 'generateExamReportPdf');
  const result = await generate({ attemptId });
  const { url, fileName } = result.data;
  await shareOrDownloadFile(url, fileName, 'application/pdf');
  return { url, fileName };
}

// Abre o PDF já gerado e salvo no Storage numa nova aba, para visualização
// (o objeto é salvo com Content-Disposition: inline — ver
// functions/src/index.ts — então a maioria dos navegadores renderiza o PDF
// direto na aba em vez de forçar o download).
export function viewExamReportPdf(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer');
}
