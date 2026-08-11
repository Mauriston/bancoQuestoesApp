// ==========================================
// ARQUIVO: src/components/QuestionImage.tsx
// ==========================================
import React, { useState } from 'react';
import { AlertTriangle, ExternalLink, ZoomIn } from 'lucide-react';

interface QuestionImageProps {
  src: string;
  alt?: string;
  allowZoom?: boolean;
  className?: string;
}

export const QuestionImage: React.FC<QuestionImageProps> = ({
  src,
  alt = 'Imagem da questão',
  allowZoom = true,
  className = ''
}) => {
  const [hasError, setHasError] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);

  // Documentação: Função utilitária para tratar URLs de imagem.
  // Garante que caminhos relativos como '/imagens_questoes/...' 
  // sejam convertidos para URLs completas e válidas no navegador.
  const getFullImageUrl = (path: string): string => {
    if (!path) return '';
    
    // Se já for uma URL completa da web (ex: Imgur, Cloudinary)
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }

    // Documentação: Se for um caminho relativo iniciado por '/', junta com a origem do site
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${window.location.origin}${cleanPath}`;
  };

  const formattedSrc = getFullImageUrl(src);

  if (hasError) {
    return (
      <div className="my-4 p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>Não foi possível carregar a imagem diretamente do servidor.</span>
        </div>
        <a
          href={formattedSrc}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 font-semibold transition-colors shrink-0"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>Abrir link da imagem</span>
        </a>
      </div>
    );
  }

  return (
    <>
      {/* mx-auto + block centraliza a imagem quando o container pai ocupa a
          largura toda (ver pedido de centralização em ExamViewPage,
          ExamResultPage, TakeExamPage, QuestionPreviewModal). */}
      <div className={`my-4 p-2 rounded-2xl bg-slate-950 border border-slate-800 block w-fit mx-auto max-w-full ${className}`}>
        <div 
          className={`relative group ${allowZoom ? 'cursor-pointer' : ''}`}
          onClick={() => allowZoom && setIsZoomed(true)}
        >
          <img
            src={formattedSrc}
            alt={alt}
            onError={() => setHasError(true)}
            className="max-h-80 lg:max-h-[28rem] w-auto object-contain rounded-xl mx-auto"
          />
          {allowZoom && (
            <div className="absolute inset-0 bg-[#050f41]/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center text-white text-xs gap-1.5 font-semibold">
              <ZoomIn className="w-4 h-4" />
              <span>Clique para ampliar</span>
            </div>
          )}
        </div>
      </div>

      {/* Modal de ampliação de imagem */}
      {isZoomed && (
        <div 
          className="fixed inset-0 z-50 bg-[#050f41]/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setIsZoomed(false)}
        >
          <div className="relative max-w-4xl w-full max-h-[90vh] flex items-center justify-center">
            <img 
              src={formattedSrc} 
              alt={alt} 
              className="max-h-[85vh] max-w-full rounded-2xl shadow-2xl object-contain" 
            />
          </div>
        </div>
      )}
    </>
  );
};
