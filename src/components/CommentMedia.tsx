import React, { useState } from 'react';
import { AlertTriangle, ExternalLink } from 'lucide-react';

interface CommentMediaProps {
  url: string;
}

// Aceita links do youtube.com/watch, youtu.be, youtube.com/embed e
// youtube.com/shorts. Qualquer outra URL é tratada como imagem.
function extractYouTubeId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\.|^m\./, '');

    if (host === 'youtu.be') {
      return parsed.pathname.slice(1) || null;
    }
    if (host === 'youtube.com') {
      if (parsed.pathname === '/watch') return parsed.searchParams.get('v');
      if (parsed.pathname.startsWith('/embed/')) return parsed.pathname.split('/')[2] || null;
      if (parsed.pathname.startsWith('/shorts/')) return parsed.pathname.split('/')[2] || null;
    }
  } catch {
    return null;
  }
  return null;
}

// Mídia opcional anexada ao comentário do gabarito (campo `commentMediaUrl`
// de QuestionAnswer) — um vídeo do YouTube incorporado ou uma imagem,
// dependendo do formato da URL. Usada em QuestionPreviewModal,
// ExamResultPage e ExamViewPage.
export const CommentMedia: React.FC<CommentMediaProps> = ({ url }) => {
  const [imageError, setImageError] = useState(false);
  const youTubeId = extractYouTubeId(url);

  if (youTubeId) {
    return (
      <div className="mt-3 rounded-xl overflow-hidden border border-slate-800 bg-slate-950 aspect-video max-w-md">
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
    <div className="mt-3 p-2 rounded-xl bg-slate-950 border border-slate-800 inline-block max-w-full">
      <img
        src={url}
        alt="Mídia do comentário do gabarito"
        className="max-h-72 w-auto object-contain rounded-lg mx-auto"
        onError={() => setImageError(true)}
      />
    </div>
  );
};
