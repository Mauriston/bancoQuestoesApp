import React, { useState } from 'react';
import { Zap, RotateCw, CheckCircle2, XCircle, Sparkles, Plus, BookOpen, Layers } from 'lucide-react';
import { Flashcard, AreaTema } from '../types';
import { SAMPLE_FLASHCARDS } from '../data/prebakedQuestions';

interface FlashcardsViewProps {
  arvoreData: AreaTema[];
}

export const FlashcardsView: React.FC<FlashcardsViewProps> = ({ arvoreData }) => {
  const [cards, setCards] = useState<Flashcard[]>(SAMPLE_FLASHCARDS);
  const [selectedArea, setSelectedArea] = useState<string>('Todas');
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [masteredIds, setMasteredIds] = useState<Set<string>>(new Set());

  // Filtered cards
  const filteredCards = cards.filter(c => selectedArea === 'Todas' || c.area === selectedArea);
  const activeCard = filteredCards[currentIndex] || filteredCards[0];

  const handleNext = () => {
    setIsFlipped(false);
    if (filteredCards.length > 0) {
      setCurrentIndex((prev) => (prev + 1) % filteredCards.length);
    }
  };

  const handleMarkMastered = () => {
    if (!activeCard) return;
    setMasteredIds(prev => new Set(prev).add(activeCard.id));
    handleNext();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      
      {/* Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-6 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-amber-400 text-xs font-bold uppercase tracking-wider mb-1">
              <Zap className="w-4 h-4" />
              <span>Memorização Espaçada • TEOT</span>
            </div>
            <h1 className="text-2xl font-extrabold text-white font-outfit">
              Flashcards de Alto Rendimento
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Revise conceitos vitais, classificações numéricas e testes do exame físico em cartões rápidos.
            </p>
          </div>

          <div className="bg-slate-950/80 px-4 py-2 rounded-2xl border border-slate-800 text-center shrink-0">
            <span className="text-xs text-slate-400 block">Dominados</span>
            <span className="text-lg font-bold text-emerald-400 font-outfit">
              {masteredIds.size} / {cards.length}
            </span>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="mt-4 pt-4 border-t border-slate-800 flex items-center space-x-3">
          <Layers className="w-4 h-4 text-slate-400 hidden sm:block" />
          <select
            value={selectedArea}
            onChange={(e) => {
              setSelectedArea(e.target.value);
              setCurrentIndex(0);
              setIsFlipped(false);
            }}
            className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400 flex-1 sm:flex-none"
          >
            <option value="Todas">Todas as Áreas ({cards.length} cards)</option>
            {arvoreData.map(a => (
              <option key={a.Área} value={a.Área}>{a.Área}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Flashcard Flip Box */}
      {filteredCards.length > 0 && activeCard ? (
        <div className="space-y-6">
          
          <div
            onClick={() => setIsFlipped(!isFlipped)}
            className="min-h-[320px] bg-slate-900 border-2 border-slate-800 hover:border-amber-500/40 rounded-3xl p-8 flex flex-col justify-between cursor-pointer transition-all duration-300 shadow-2xl relative select-none"
          >
            {/* Top Indicator */}
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 rounded-full bg-slate-800 text-slate-300 text-xs font-bold border border-slate-700">
                {activeCard.area} • {activeCard.tema}
              </span>
              <span className="text-xs text-amber-400 font-semibold flex items-center space-x-1">
                <RotateCw className="w-3.5 h-3.5" />
                <span>Clique para virar</span>
              </span>
            </div>

            {/* Main Content */}
            <div className="py-8 text-center my-auto space-y-4">
              {!isFlipped ? (
                <div>
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-widest block mb-2">PERGUNTA / CONCEITO</span>
                  <h3 className="text-xl sm:text-2xl font-bold text-white font-sans leading-relaxed">
                    {activeCard.frente}
                  </h3>
                </div>
              ) : (
                <div className="animate-in fade-in zoom-in-95 duration-200">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest block mb-2">RESPOSTA & CLASSIFICAÇÃO</span>
                  <p className="text-base sm:text-lg text-emerald-200 font-medium leading-relaxed">
                    {activeCard.verso}
                  </p>

                  {activeCard.detalhes && (
                    <p className="text-xs text-slate-400 mt-4 p-3 rounded-xl bg-slate-950 border border-slate-800">
                      💡 {activeCard.detalhes}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Progress */}
            <div className="flex items-center justify-between text-xs text-slate-500 border-t border-slate-800/60 pt-3">
              <span>Cartão {currentIndex + 1} de {filteredCards.length}</span>
              <span>{isFlipped ? 'Lado B (Resposta)' : 'Lado A (Pergunta)'}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center space-x-4">
            <button
              onClick={handleNext}
              className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm border border-slate-700 transition flex items-center space-x-2 cursor-pointer"
            >
              <RotateCw className="w-4 h-4" />
              <span>Próximo Cartão</span>
            </button>

            <button
              onClick={handleMarkMastered}
              className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition shadow-lg shadow-emerald-500/20 flex items-center space-x-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Marcar como Dominado</span>
            </button>
          </div>

        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center text-slate-400">
          Nenhum flashcard disponível para esta área.
        </div>
      )}

    </div>
  );
};
