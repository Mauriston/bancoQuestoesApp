import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import { shareOrDownloadFile } from '../utils/fileShare';

interface GenerateExamReportPdfResponse {
  url: string;
  fileName: string;
}

// Chama a Cloud Function generateExamReportPdf (ver functions/src/index.ts),
// que renderiza o mesmo template do relatório (src/reportTemplate.ts) com
// Chromium headless no servidor — sem depender do diálogo de impressão do
// navegador do candidato — salva o PDF no Storage e devolve a URL de
// download. Pode levar alguns segundos (Chromium headless + partida a
// frio da função); o chamador deve mostrar um indicador de carregamento.
export async function downloadExamReportPdf(attemptId: string): Promise<void> {
  const generate = httpsCallable<{ attemptId: string }, GenerateExamReportPdfResponse>(
    functions,
    'generateExamReportPdf'
  );
  const result = await generate({ attemptId });
  const { url, fileName } = result.data;
  await shareOrDownloadFile(url, fileName, 'application/pdf');
}
