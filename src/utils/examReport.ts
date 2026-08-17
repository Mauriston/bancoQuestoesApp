// Ponte entre o template puro do relatório em PDF (compartilhado com a
// Cloud Function que gera o PDF no servidor — ver src/reportTemplate.ts e
// functions/src/index.ts) e o navegador.

import { buildReportDocument, ExamReportData } from '../reportTemplate';

export * from '../reportTemplate';

// Abre o relatório numa nova aba e injeta o HTML pronto para impressão —
// usado como prévia/alternativa ao PDF gerado no servidor (ver
// src/services/examReportService.ts). Deve ser chamado diretamente a
// partir de um handler de clique do usuário — alguns navegadores bloqueiam
// window.open() fora desse contexto.
export function openExamReport(data: ExamReportData): void {
  const iconUrl = `${window.location.origin}/icons/icon-512.png`;
  const win = window.open('', '_blank');
  if (!win) {
    alert('Não foi possível abrir o relatório. Verifique se o navegador está bloqueando pop-ups para este site.');
    return;
  }
  win.document.open();
  win.document.write(buildReportDocument(data, iconUrl));
  win.document.close();
}
