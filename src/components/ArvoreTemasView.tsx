import React, { useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronRight, Play, BookCheck, Layers, Sparkles, Filter } from 'lucide-react';
import { AreaTema, UserStats } from '../types';

interface ArvoreTemasViewProps {
  arvoreData: AreaTema[];
  onSelectTema: (area: string, tema: string) => void;
  stats: UserStats;
}

export const ArvoreTemasView: React.FC<ArvoreTemasViewProps> = ({
  arvoreData,
  onSelectTema,
  stats
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAreaFilter, setSelectedAreaFilter] = useState<string>('Todas');
  const [expandedAreas, setExpandedAreas] = useState<Record<string, boolean>>(() => {
    // Expand first 2 areas by default
    const initial: Record<string, boolean> = {};
    arvoreData.slice(0, 3).forEach(a => { initial[a.Área] = true; });
    return initial;
  });

  const toggleArea = (areaName: string) => {
    setExpandedAreas(prev => ({
      ...prev,
      [areaName]: !prev[areaName]
    }));
  };

  const expandAll = () => {
    const all: Record<string, boolean> = {};
    arvoreData.forEach(a => { all[a.Área] = true; });
    setExpandedAreas(all);
  };

  const collapseAll = () => {
    setExpandedAreas({});
  };

  // Filtered tee
  const filteredData = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return arvoreData
      .filter(a => selectedAreaFilter === 'Todas' || a.Área === selectedAreaFilter)
      .map(areaObj => {
        const matchingTemas = areaObj.temas.filter(t =>
          t.toLowerCase().includes(term) || areaObj.Área.toLowerCase().includes(term)
        );
        return {
          ...areaObj,
          filteredTemas: matchingTemas
        };
      })
      .filter(areaObj => areaObj.filteredTemas.length > 0);
  }, [arvoreData, searchTerm, selectedAreaFilter]);

  const totalTemas = useMemo(() => {
    return arvoreData.reduce((acc, curr) => acc + curr.temas.length, 0);
  }, [arvoreData]);

  return (
    <div className="space-y-6">
      
      {/* Banner / Header Card */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/10 rounded-full filter blur-3xl pointer-events-none -mr-20 -mt-20" />
        
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center space-x-2 text-teal-400 text-xs font-bold uppercase tracking-wider mb-1">
              <Layers className="w-4 h-4" />
              <span>Matriz Curricular SBOT / TEOT</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white font-outfit">
              Árvore de Temas Ortopédicos
            </h1>
            <p className="text-slate-400 text-sm mt-1 max-w-2xl">
              Navegue pelos <strong className="text-teal-300">{arvoreData.length} Grandes Áreas</strong> e <strong className="text-teal-300">{totalTemas} Tópicos oficiais</strong> cobrados na prova do TEOT. Escolha qualquer tema para iniciar o treino imediato.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={expandAll}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700 transition"
            >
              Expandir Todos
            </button>
            <button
              onClick={collapseAll}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700 transition"
            >
              Recolher
            </button>
          </div>
        </div>

        {/* Search & Area Filter bar */}
        <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar tema ou área (ex: LCA, Ponseti, Osteossarcoma, Fratura do Colo...)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500/80 focus:ring-1 focus:ring-teal-500/80 transition"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-200"
              >
                Limpar
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-slate-400 hidden sm:block" />
            <select
              value={selectedAreaFilter}
              onChange={(e) => setSelectedAreaFilter(e.target.value)}
              className="bg-slate-950/80 border border-slate-700/80 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-teal-500 w-full sm:w-auto"
            >
              <option value="Todas">Todas as Áreas ({arvoreData.length})</option>
              {arvoreData.map((a) => (
                <option key={a.Área} value={a.Área}>
                  {a.Área} ({a.temas.length})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Specialty Areas Accordion / List */}
      <div className="space-y-4">
        {filteredData.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
            <BookCheck className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-300">Nenhum tema encontrado</h3>
            <p className="text-sm text-slate-500 mt-1">Tente ajustar o termo de busca ou selecione "Todas as Áreas".</p>
          </div>
        ) : (
          filteredData.map((areaObj) => {
            const isExpanded = expandedAreas[areaObj.Área] || searchTerm.trim().length > 0;
            const topicCount = areaObj.temas.length;

            return (
              <div
                key={areaObj.Área}
                className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden transition-all duration-200 hover:border-slate-700/80"
              >
                {/* Area Header Bar */}
                <div
                  onClick={() => toggleArea(areaObj.Área)}
                  className="flex items-center justify-between p-4 sm:p-5 bg-slate-900/90 cursor-pointer hover:bg-slate-800/40 transition select-none"
                >
                  <div className="flex items-center space-x-3">
                    <button className="text-slate-400 hover:text-teal-400 transition">
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-teal-400" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-slate-400" />
                      )}
                    </button>
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-white font-outfit">
                        {areaObj.Área}
                      </h3>
                      <p className="text-xs text-slate-400">
                        {topicCount} tópicos cobrados no TEOT
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                      {areaObj.filteredTemas.length} / {topicCount} temas
                    </span>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Select random topic from this area
                        const randomTema = areaObj.temas[Math.floor(Math.random() * areaObj.temas.length)];
                        onSelectTema(areaObj.Área, randomTema);
                      }}
                      className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-teal-500/20 text-teal-300 border border-teal-500/40 hover:bg-teal-500/30 transition shadow-sm"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                      <span>Simular Área</span>
                    </button>
                  </div>
                </div>

                {/* Topics Grid */}
                {isExpanded && (
                  <div className="p-4 sm:p-5 bg-slate-950/50 border-t border-slate-800/80">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {areaObj.filteredTemas.map((tema) => {
                        const key = `${areaObj.Área}-${tema}`;
                        const topicStat = stats.topicStats?.[key];
                        const solvedCount = topicStat?.solved || 0;
                        const correctCount = topicStat?.correct || 0;
                        const topicAccuracy = solvedCount > 0 ? Math.round((correctCount / solvedCount) * 100) : 0;

                        return (
                          <div
                            key={tema}
                            onClick={() => onSelectTema(areaObj.Área, tema)}
                            className="group flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-teal-500/50 hover:bg-slate-850/80 transition duration-150 cursor-pointer shadow-sm"
                          >
                            <div className="flex items-start space-x-2.5 min-w-0 pr-2">
                              <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${
                                solvedCount > 0
                                  ? topicAccuracy >= 70 ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-amber-400'
                                  : 'bg-slate-700'
                              }`} />
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-slate-200 group-hover:text-teal-300 transition line-clamp-2">
                                  {tema}
                                </p>
                                {solvedCount > 0 ? (
                                  <p className="text-[11px] text-slate-400 mt-0.5">
                                    {correctCount}/{solvedCount} corretas ({topicAccuracy}%)
                                  </p>
                                ) : (
                                  <p className="text-[11px] text-slate-400 mt-0.5">
                                    Pendente
                                  </p>
                                )}
                              </div>
                            </div>

                            <button className="shrink-0 p-1.5 rounded-lg bg-slate-800 text-slate-400 group-hover:text-teal-300 group-hover:bg-teal-500/20 transition">
                              <Play className="w-3.5 h-3.5 fill-current" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
