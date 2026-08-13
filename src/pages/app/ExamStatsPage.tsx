import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GraduationCap, Layers, ListOrdered, ClipboardList } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, Legend,
  PieChart, Pie
} from 'recharts';
import { getQuestions, getAreas, getThemes } from '../../services/firebaseService';
import { Question, Area, Theme } from '../../types';
import { CheckboxMultiSelect } from '../../components/CheckboxMultiSelect';

const PIE_COLORS = ['#05413b', '#418f87', '#FFCB70', '#079551', '#a855f7', '#f472b6', '#f97316', '#10b981', '#6366f1', '#E20018'];

type ExamType = 'TEOT' | 'TARO' | 'OUTROS';

// Extrai tipo de prova + ano do campo livre `sourceExam` (ex.: "TEOT 2023",
// "TARO 2019"). Valores que não seguem esse padrão (ex.: "BANCO PRÓPRIO",
// "SBOT") caem em OUTROS/ano nulo e ficam de fora dos gráficos por ano.
function parseSourceExam(sourceExam: string): { type: ExamType; year: number | null } {
  const normalized = (sourceExam || '').trim().toUpperCase();
  const match = normalized.match(/^(TEOT|TARO)\s*(\d{4})?/);
  if (!match) return { type: 'OUTROS', year: null };
  const type = match[1] as ExamType;
  const year = match[2] ? parseInt(match[2], 10) : null;
  return { type, year };
}

const EXAM_TYPE_COLOR: Record<ExamType, string> = {
  TEOT: '#079551',
  TARO: '#FFCB70',
  OUTROS: '#7680ac'
};

export const ExamStatsPage: React.FC = () => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);
  const [examTypeFilter, setExamTypeFilter] = useState<'TODOS' | ExamType>('TODOS');
  const [yearFilter, setYearFilter] = useState<number | 'TODOS'>('TODOS');
  const [areaFilterIds, setAreaFilterIds] = useState<string[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [qs, areaList, themeList] = await Promise.all([
          getQuestions(),
          getAreas(),
          getThemes()
        ]);
        setQuestions(qs);
        setAreas(areaList);
        setThemes(themeList);
      } catch (err) {
        console.error('Erro ao carregar estatísticas de provas:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Cada questão já classificada por tipo de prova + ano, uma única vez.
  const classified = useMemo(() => {
    return questions.map(q => ({ ...q, ...parseSourceExam(q.sourceExam) }));
  }, [questions]);

  const teotTaroQuestions = useMemo(() => classified.filter(q => q.type === 'TEOT' || q.type === 'TARO'), [classified]);

  // Anos disponíveis para o tipo de prova selecionado no filtro (ou de
  // ambos, se "Todos"), do mais recente para o mais antigo.
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    teotTaroQuestions.forEach(q => {
      if (q.year && (examTypeFilter === 'TODOS' || q.type === examTypeFilter)) years.add(q.year);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [teotTaroQuestions, examTypeFilter]);

  // Reseta o filtro de ano se ele deixar de existir na lista de opções ao
  // trocar o tipo de prova (ex.: TARO 2016 selecionado, muda para TEOT).
  useEffect(() => {
    if (yearFilter !== 'TODOS' && !availableYears.includes(yearFilter)) {
      setYearFilter('TODOS');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examTypeFilter, availableYears]);

  const filteredQuestions = useMemo(() => {
    return teotTaroQuestions.filter(q => {
      if (examTypeFilter !== 'TODOS' && q.type !== examTypeFilter) return false;
      if (yearFilter !== 'TODOS' && q.year !== yearFilter) return false;
      if (areaFilterIds.length > 0 && !areaFilterIds.includes(q.areaId)) return false;
      return true;
    });
  }, [teotTaroQuestions, examTypeFilter, yearFilter, areaFilterIds]);

  // Legenda de filtros ativos exibida dentro do card "Total de Questões".
  const activeFiltersLabel = useMemo(() => {
    const parts: string[] = [];
    if (examTypeFilter !== 'TODOS') parts.push(examTypeFilter);
    if (yearFilter !== 'TODOS') parts.push(String(yearFilter));
    if (areaFilterIds.length > 0) {
      const names = areaFilterIds.map(id => areas.find(a => a.id === id)?.name).filter(Boolean);
      parts.push(`Área: ${names.join(', ')}`);
    }
    return parts.join(' · ');
  }, [examTypeFilter, yearFilter, areaFilterIds, areas]);

  // Distribuição por ano, separada em série TEOT e TARO — base do gráfico
  // no topo da página. Respeita o filtro de tipo e o de área; não é afetada
  // pelo filtro de ano (senão não haveria o que comparar entre anos).
  const yearDistribution = useMemo(() => {
    const map: Record<number, { year: number; TEOT: number; TARO: number }> = {};
    teotTaroQuestions.forEach(q => {
      if (!q.year) return;
      if (examTypeFilter !== 'TODOS' && q.type !== examTypeFilter) return;
      if (areaFilterIds.length > 0 && !areaFilterIds.includes(q.areaId)) return;
      if (!map[q.year]) map[q.year] = { year: q.year, TEOT: 0, TARO: 0 };
      map[q.year][q.type as 'TEOT' | 'TARO'] += 1;
    });
    return Object.values(map).sort((a, b) => a.year - b.year);
  }, [teotTaroQuestions, examTypeFilter, areaFilterIds]);

  // Distribuição por área, respeitando os dois filtros ativos.
  const areaDistribution = useMemo(() => {
    const map: Record<string, number> = {};
    filteredQuestions.forEach(q => {
      map[q.areaId] = (map[q.areaId] || 0) + 1;
    });
    const total = filteredQuestions.length;
    return Object.entries(map)
      .map(([areaId, count]) => ({
        areaId,
        name: areas.find(a => a.id === areaId)?.name || areaId,
        count,
        pct: total > 0 ? Math.round((count / total) * 1000) / 10 : 0
      }))
      .sort((a, b) => b.count - a.count);
  }, [filteredQuestions, areas]);

  // Top 5 temas mais cobrados dentro do recorte de filtros atual.
  const topThemes = useMemo(() => {
    const map: Record<string, number> = {};
    filteredQuestions.forEach(q => {
      map[q.themeId] = (map[q.themeId] || 0) + 1;
    });
    return Object.entries(map)
      .map(([themeId, count]) => {
        const theme = themes.find(t => t.id === themeId);
        return { themeId, name: theme?.name || themeId, count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [filteredQuestions, themes, areas]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm">Calculando estatísticas do banco de questões...</p>
      </div>
    );
  }

  const filterKey = `${examTypeFilter}|${yearFilter}|${areaFilterIds.join(',')}`;

  return (
    <div className="space-y-6 sm:space-y-8 pb-12">

      {/* Título e subtítulo da página */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-[#05413b]">Estatísticas TEOT e TARO</h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Verifique as áreas e temas mais frequentes por prova e ano. TEOT 2021 a 2026 | TARO 2016 - 2026.
        </p>
      </div>

      {/* Filtros: tipo de prova + ano + área */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl p-1">
          {(['TODOS', 'TEOT', 'TARO'] as const).map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => setExamTypeFilter(opt)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                examTypeFilter === opt
                  ? 'bg-[#FFCB70] text-[#05413b]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {opt === 'TODOS' ? 'Todas as Provas' : opt}
            </button>
          ))}
        </div>

        <select
          value={yearFilter}
          onChange={e => setYearFilter(e.target.value === 'TODOS' ? 'TODOS' : parseInt(e.target.value, 10))}
          className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
        >
          <option value="TODOS">Todos os Anos</option>
          {availableYears.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        <CheckboxMultiSelect
          label="Área"
          options={areas.map(a => ({ id: a.id, label: a.name }))}
          selectedIds={areaFilterIds}
          onChange={setAreaFilterIds}
          emptyLabel="Todas as Áreas"
          className="w-44"
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={filterKey}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
          className="space-y-6 sm:space-y-8"
        >
          {/* "Total de Questões" e "Questões por Ano" empilhados na metade
              esquerda; "Temas Mais Cobrados" ocupa a metade direita, com a
              mesma altura dos dois cards da esquerda somados (grid do
              CSS estica os itens da linha por padrão) — só no desktop
              (lg+); no mobile os três continuam empilhados em coluna única. */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
            <div className="flex flex-col gap-6 sm:gap-8">
              {/* Card em destaque com o total de questões no recorte de filtros ativo */}
              <div className="bg-slate-900 border border-teal-500/30 rounded-2xl p-4 sm:p-6 shadow-xl">
                <p className="text-[11px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                  <ClipboardList className="w-3.5 h-3.5 text-teal-400" />
                  Total de Questões
                </p>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={filteredQuestions.length}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.25 }}
                    className="text-3xl sm:text-4xl font-black text-teal-400 mt-1"
                  >
                    {filteredQuestions.length}
                  </motion.p>
                </AnimatePresence>
                {activeFiltersLabel && (
                  <p className="text-[11px] text-slate-500 mt-1">{activeFiltersLabel}</p>
                )}
              </div>

              {/* Distribuição histórica por ano — TEOT vs TARO, questões cadastradas no banco */}
              {yearDistribution.length > 0 && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl">
                  <h2 className="text-sm font-bold text-[#05413b] mb-1 flex items-center gap-2">
                    <ListOrdered className="w-4 h-4 text-teal-400" />
                    Questões por Ano
                  </h2>
                  <div className="h-56 sm:h-72 w-full mt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={yearDistribution} margin={{ top: 4, right: 8, bottom: 4, left: -12 }}>
                        <CartesianGrid stroke="#dbe0f0" vertical={false} />
                        <XAxis dataKey="year" tick={{ fill: '#4b567f', fontSize: 11 }} />
                        <YAxis allowDecimals={false} tick={{ fill: '#7680ac', fontSize: 10 }} />
                        <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#dbe0f0', borderRadius: '12px', fontSize: '12px' }} />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                        {(examTypeFilter === 'TODOS' || examTypeFilter === 'TEOT') && (
                          <Bar dataKey="TEOT" fill={EXAM_TYPE_COLOR.TEOT} radius={[4, 4, 0, 0]} />
                        )}
                        {(examTypeFilter === 'TODOS' || examTypeFilter === 'TARO') && (
                          <Bar dataKey="TARO" fill={EXAM_TYPE_COLOR.TARO} radius={[4, 4, 0, 0]} />
                        )}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>

            {/* Top 5 temas mais cobrados, dentro do recorte ativo — pizza */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl flex flex-col">
              <h2 className="text-sm font-bold text-[#05413b] mb-1 flex items-center gap-2">
                <Layers className="w-4 h-4 text-teal-400" />
                Temas Mais Cobrados
              </h2>
              {topThemes.length === 0 ? (
                <p className="text-sm text-slate-500 italic py-4">Nenhuma questão encontrada para este recorte.</p>
              ) : (
                <div className="flex-1 flex flex-col sm:flex-row items-center gap-4 mt-2">
                  <div className="h-64 w-64 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={topThemes}
                          dataKey="count"
                          nameKey="name"
                          innerRadius="45%"
                          outerRadius="90%"
                          paddingAngle={2}
                        >
                          {topThemes.map((t, i) => (
                            <Cell key={t.themeId} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ backgroundColor: '#ffffff', borderColor: '#dbe0f0', borderRadius: '12px', fontSize: '12px' }}
                          formatter={(value: number, name: string) => [`${value} questões`, name]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 w-full space-y-2">
                    {topThemes.map((t, idx) => (
                      <div key={t.themeId} className="flex items-center justify-between gap-3 text-sm py-1.5 border-b border-slate-800/60 last:border-0">
                        <span className="flex items-center gap-2 text-slate-300 min-w-0">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                          <span className="truncate">{t.name}</span>
                        </span>
                        <span className="font-bold text-slate-200 shrink-0">{t.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Distribuição por área, dentro do recorte de filtros ativo */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl">
            <h2 className="text-sm font-bold text-[#05413b] mb-1 flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-teal-400" />
              Áreas Mais Cobradas
            </h2>
            <p className="text-xs text-slate-400 mb-2">Distribuição de questões por área, no recorte selecionado acima.</p>
            {areaDistribution.length === 0 ? (
              <p className="text-sm text-slate-500 italic py-4">Nenhuma questão encontrada para este recorte.</p>
            ) : (
              <div className="h-64 sm:h-80 w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={areaDistribution} layout="vertical" margin={{ top: 4, right: 32, bottom: 4, left: 4 }}>
                    <CartesianGrid stroke="#dbe0f0" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fill: '#7680ac', fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" width={130} tick={{ fill: '#4b567f', fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#ffffff', borderColor: '#dbe0f0', borderRadius: '12px', fontSize: '12px' }}
                      formatter={(value: number, _n, item: any) => [`${value} questões (${item.payload.pct}%)`, 'Total']}
                    />
                    <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                      {areaDistribution.map((a, i) => (
                        <Cell key={a.areaId} fill={i === 0 ? '#05413b' : '#245e58'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

    </div>
  );
};
