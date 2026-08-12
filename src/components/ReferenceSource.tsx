import React from 'react';
import { Reference } from '../types';

interface ReferenceSourceProps {
  reference?: Reference | null;
}

// Bloco "Fonte: {referenceName}" exibido logo após o comentário do gabarito
// (separado dele por uma linha em branco), com {referenceName} como
// hiperlink para o PDF de download direto do livro (referenceUrlDownload).
// Ausente quando a questão não tem referência vinculada
// (QuestionAnswer.referenceId). Usada em QuestionPreviewModal, ExamViewPage
// e ExamResultPage.
export const ReferenceSource: React.FC<ReferenceSourceProps> = ({ reference }) => {
  if (!reference) return null;

  return (
    <p className="mt-4 text-slate-300 leading-relaxed">
      Fonte:{' '}
      <a
        href={reference.referenceUrlDownload}
        target="_blank"
        rel="noopener noreferrer"
        className="text-teal-400 underline hover:text-teal-300"
      >
        {reference.referenceName}
      </a>
    </p>
  );
};
