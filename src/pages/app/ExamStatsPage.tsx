import React, { useEffect, useMemo, useState } from 'react';
import { GraduationCap, Layers, ListOrdered, PieChart as PieChartIcon } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, Legend,
  PieChart, Pie
} from 'recharts';
import { getQuestions, getAreas, getThemes } from '../../services/firebaseService';
import { Question, Area, Theme } from '../../types';

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
  TARO: '#FAB932',
  OUTROS: '#7680ac'
};

export const ExamStatsPage: React.FC = () => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);
  const [examTypeFilter, setExamTypeFilter] = useState<'TODOS' | ExamType>('TODOS');
  const [yearFilter, setYearFilter] = useState<number | 'TODOS'>('TODOS');

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
      return true;
    });
  }, [teotTaroQuestions, examTypeFilter, yearFilter]);

  // Distribuição por ano, separada em série TEOT e TARO — base do gráfico
  // de barras agrupadas no topo da página (não é afetada pelo filtro de
  // ano, só pelo de tipo, para servir de visão geral histórica).
  const yearDistribution = useMemo(() => {
    const map: Record<number, { year: number; TEOT: number; TARO: number }> = {};
    teotTaroQuestions.forEach(q => {
      if (!q.year) return;
      if (examTypeFilter !== 'TODOS' && q.type !== examTypeFilter) return;
      if (!map[q.year]) map[q.year] = { year: q.year, TEOT: 0, TARO: 0 };
      map[q.year][q.type as 'TEOT' | 'TARO'] += 1;
    });
    return Object.values(map).sort((a, b) => a.year - b.year);
  }, [teotTaroQuestions, examTypeFilter]);

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

  // Top 10 temas mais cobrados dentro do recorte de filtros atual.
  const topThemes = useMemo(() => {
    const map: Record<string, number> = {};
    filteredQuestions.forEach(q => {
      map[q.themeId] = (map[q.themeId] || 0) + 1;
    });
    return Object.entries(map)
      .map(([themeId, count]) => {
        const theme = themes.find(t => t.id === themeId);
        return {
          themeId,
          name: theme?.name || themeId,
          areaName: areas.find(a => a.id === theme?.areaId)?.name,
          subArea: theme?.subArea,
          count
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [filteredQuestions, themes, areas]);

  // Ortopedia x Traumatologia dentro do recorte de filtros atual — só
  // considera temas com subArea migrado.
  const subAreaDistribution = useMemo(() => {
    const map: Record<string, number> = {};
    filteredQuestions.forEach(q => {
      const subArea = themes.find(t => t.id === q.themeId)?.subArea;
      if (!subArea) return;
      map[subArea] = (map[subArea] || 0) + 1;
    });
    const total = Object.values(map).reduce((s, v) => s + v, 0);
    return Object.entries(map).map(([name, count]) => ({
      name,
      count,
      pct: total > 0 ? Math.round((count / total) * 1000) / 10 : 0
    }));
  }, [filteredQuestions, themes]);

  const totalTeot = teotTaroQuestions.filter(q => q.type === 'TEOT').length;
  const totalTaro = teotTaroQuestions.filter(q => q.type === 'TARO').length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm">Calculando estatísticas do banco de questões...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8 pb-12">

      {/* KPIs gerais: quantas questões o banco tem de cada prova, no total */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="bg-slate-900 border border-[#079551]/30 rounded-2xl p-4 sm:p-6 shadow-xl">
          <p className="text-[11px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wide">Questões de TEOT</p>
          <p className="text-3xl sm:text-4xl font-black text-[#079551] mt-1">{totalTeot}</p>
        </div>
        <div className="bg-slate-900 border border-[#FAB932]/30 rounded-2xl p-4 sm:p-6 shadow-xl">
          <p className="text-[11px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wide">Questões de TARO</p>
          <p className="text-3xl sm:text-4xl font-black text-[#FAB932] mt-1">{totalTaro}</p>
        </div>
      </div>

      {/* Filtros: tipo de prova + ano */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl p-1">
          {(['TODOS', 'TEOT', 'TARO'] as const).map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => setExamTypeFilter(opt)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                examTypeFilter === opt
                  ? 'bg-[#FAB932] text-[#050f41]'
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

        <span className="text-xs text-slate-500 ml-auto">
          {filteredQuestions.length} questão(ões) no recorte selecionado
        </span>
      </div>

      {/* Distribuição histórica por ano — TEOT vs TARO, questões cadastradas no banco */}
      {yearDistribution.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl">
          <h2 className="text-sm font-bold text-[#050f41] mb-1 flex items-center gap-2">
            <ListOrdered className="w-4 h-4 text-teal-400" />
            Questões Cadastradas por Ano
          </h2>
          <p className="text-xs text-slate-400 mb-2">Quantidade de questões do banco, por ano de prova.</p>
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

      {/* Distribuição por área, dentro do recorte de filtros ativo */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl">
        <h2 className="text-sm font-bold text-[#050f41] mb-1 flex items-center gap-2">
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
                    <Cell key={a.areaId} fill={i === 0 ? '#050f41' : '#3548a8'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Ortopedia x Traumatologia, dentro do recorte ativo */}
      {subAreaDistribution.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl">
          <h2 className="text-sm font-bold text-[#050f41] mb-1 flex items-center gap-2">
            <PieChartIcon className="w-4 h-4 text-teal-400" />
            Ortopedia x Traumatologia
          </h2>
          <p className="text-xs text-slate-400 mb-2">Proporção de questões, no recorte selecionado acima.</p>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="h-56 w-56 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={subAreaDistribution}
                    dataKey="count"
                    nameKey="name"
                    innerRadius="55%"
                    outerRadius="90%"
                    paddingAngle={2}
                  >
                    {subAreaDistribution.map((s, i) => (
                      <Cell key={s.name} fill={i === 0 ? '#050f41' : '#FAB932'} />
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
              {subAreaDistribution.map((s, i) => (
                <div key={s.name} className="flex items-center justify-between gap-3 text-sm py-1.5 border-b border-slate-800/60 last:border-0">
                  <span className="flex items-center gap-2 text-slate-300">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: i === 0 ? '#050f41' : '#FAB932' }} />
                    {s.name}
                  </span>
                  <span className="font-bold text-slate-200 shrink-0">{s.count} <span className="text-xs text-slate-500 font-normal">({s.pct}%)</span></span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Top 10 temas mais cobrados, dentro do recorte ativo */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl">
        <h2 className="text-sm font-bold text-[#050f41] mb-1 flex items-center gap-2">
          <Layers className="w-4 h-4 text-teal-400" />
          Temas Mais Cobrados
        </h2>
        <p className="text-xs text-slate-400 mb-3">Top 10 temas com mais questões, no recorte selecionado acima.</p>
        {topThemes.length === 0 ? (
          <p className="text-sm text-slate-500 italic py-4">Nenhuma questão encontrada para este recorte.</p>
        ) : (
          <div className="space-y-2">
            {topThemes.map((t, idx) => {
              const maxCount = topThemes[0].count;
              return (
                <div key={t.themeId} className="py-2 border-b border-slate-800/60 last:border-0">
                  <div className="flex items-center justify-between gap-3 text-sm mb-1.5">
                    <span className="text-slate-300 truncate flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-600 w-4 shrink-0">{idx + 1}º</span>
                      {t.name}
                      {(t.areaName || t.subArea) && (
                        <span className="text-slate-500 font-normal text-xs truncate">
                          · {[t.areaName, t.subArea].filter(Boolean).join(' · ')}
                        </span>
                      )}
                    </span>
                    <span className="font-bold text-[#050f41] shrink-0">{t.count}</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-teal-500"
                      style={{ width: `${maxCount > 0 ? Math.round((t.count / maxCount) * 100) : 0}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};
