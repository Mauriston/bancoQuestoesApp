import React, { useState } from 'react';
import { AlertTriangle, ExternalLink, ZoomIn } from 'lucide-react';
import { extractYouTubeId } from '../utils/mediaUrls';

interface CommentMediaProps {
  url: string;
}

// Mídia opcional anexada ao comentário do gabarito (campo `commentMediaUrl`
// de QuestionAnswer) — um vídeo do YouTube incorporado ou uma imagem,
// dependendo do formato da URL. Usada em QuestionPreviewModal,
// ExamResultPage e ExamViewPage.
export const CommentMedia: React.FC<CommentMediaProps> = ({ url }) => {
  const [imageError, setImageError] = useState(false);
  // Modal de ampliação ao clicar na imagem — mesmo padrão de QuestionImage.
  const [isZoomed, setIsZoomed] = useState(false);
  const youTubeId = extractYouTubeId(url);

  if (youTubeId) {
    return (
      <div className="mt-3 mx-auto rounded-xl overflow-hidden border border-slate-800 bg-slate-950 aspect-video max-w-md">
        <iframe
          src={`https://www.youtube.com/embed/${youTubeId}`}
          title="Vídeo do comentário do gabarito"
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  if (imageError) {
    return (
      <div className="mt-3 p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>Não foi possível carregar a mídia do comentário.</span>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 font-semibold transition-colors shrink-0"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>Abrir link</span>
        </a>
      </div>
    );
  }

  return (
    <>
      <div className="mt-3 p-2 rounded-xl bg-slate-950 border border-slate-800 block w-fit mx-auto max-w-full">
        <div className="relative group cursor-pointer" onClick={() => setIsZoomed(true)}>
          <img
            src={url}
            alt="Mídia do comentário do gabarito"
            className="max-h-72 w-auto object-contain rounded-lg mx-auto"
            onError={() => setImageError(true)}
          />
          <div className="absolute inset-0 bg-[#05413b]/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center text-white text-xs gap-1.5 font-semibold">
            <ZoomIn className="w-4 h-4" />
            <span>Clique para ampliar</span>
          </div>
        </div>
      </div>

      {/* Modal de ampliação de imagem */}
      {isZoomed && (
        <div
          className="fixed inset-0 z-50 bg-[#05413b]/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setIsZoomed(false)}
        >
          <div className="relative max-w-4xl w-full max-h-[90vh] flex items-center justify-center">
            <img
              src={url}
              alt="Mídia do comentário do gabarito"
              className="max-h-[85vh] max-w-full rounded-2xl shadow-2xl object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
};
