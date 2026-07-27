import React, { useState } from 'react';
import { ZoomIn, Image as ImageIcon, ExternalLink, AlertTriangle, X } from 'lucide-react';
import { formatImageUrl } from '../utils/helpers';

interface QuestionImageProps {
  src?: string | null;
  alt?: string;
  className?: string;
  maxHeightClass?: string;
  allowZoom?: boolean;
}

export const QuestionImage: React.FC<QuestionImageProps> = ({
  src,
  alt = "Imagem da questão",
  className = "",
  maxHeightClass = "max-h-80",
  allowZoom = true
}) => {
  const [hasError, setHasError] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (!src) return null;

  const formattedUrl = formatImageUrl(src);

  if (hasError) {
    return (
      <div className="my-4 p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-slate-400 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>A imagem da questão não pôde ser carregada diretamente.</span>
        </div>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-400 font-semibold text-xs border border-slate-700 transition shrink-0"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>Abrir imagem em nova aba</span>
        </a>
      </div>
    );
  }

  return (
    <>
      <div className={`my-4 p-3 rounded-2xl bg-slate-950 border border-slate-800 inline-block max-w-full ${className}`}>
        <div 
          className={`relative group ${allowZoom ? 'cursor-pointer' : ''}`}
          onClick={() => allowZoom && setIsModalOpen(true)}
        >
          <img
            src={formattedUrl}
            alt={alt}
            referrerPolicy="no-referrer"
            className={`rounded-xl ${maxHeightClass} w-auto object-contain mx-auto shadow-md transition-transform duration-200 group-hover:scale-[1.01]`}
            onError={() => {
              setHasError(true);
            }}
          />
          {allowZoom && (
            <div className="absolute inset-0 bg-slate-950/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center text-white text-xs gap-1.5 font-bold backdrop-blur-[2px]">
              <ZoomIn className="w-4 h-4 text-teal-400" />
              <span>Ampliar Imagem</span>
            </div>
          )}
        </div>
      </div>

      {/* Lightbox Modal */}
      {isModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setIsModalOpen(false)}
        >
          <div 
            className="relative max-w-5xl w-full max-h-[90vh] bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-2xl flex flex-col items-center justify-center overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between pb-3 mb-2 border-b border-slate-800 px-2">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-teal-400" />
                <span>Visualização Ampliada (Raio-X / Imagem TEOT)</span>
              </span>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-auto max-h-[78vh] w-full flex items-center justify-center p-2 bg-slate-950 rounded-2xl">
              <img
                src={formattedUrl}
                alt={alt}
                referrerPolicy="no-referrer"
                className="max-h-[75vh] w-auto object-contain rounded-xl shadow-2xl"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
