import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FileCheck, Search } from 'lucide-react';
import { Attempt, Exam } from '../types';
import { scoreColorHex } from '../utils/helpers';

interface ExamPerformanceCardProps {
  exams: Exam[];
  attempts: Attempt[];
  userNameById: Record<string, string>;
}

// Geometria do gráfico, espelhando a do RankingChart (recharts) para que as
// barras dos dois cards fiquem alinhadas: altura mínima 160 / 52px por usuário,
// margens 4px, eixo X de 30px, coluna de nomes de 140px e 44px à direita.
const MARGIN = 4;
const AXIS_H = 30;
const NAME_W = 140;
const RIGHT_M = 44;
const TICKS = [0, 25, 50, 75, 100];

const attemptSeconds = (a: Attempt): number => {
  const t: any = a.completedAt || a.startedAt;
  if (!t) return 0;
  if (typeof t === 'object' && 'seconds' in t) return t.seconds;
  const ms = new Date(t).getTime();
  return Number.isNaN(ms) ? 0 : ms / 1000;
};

// Card "Desempenho por Prova": barras horizontais por usuário (como o
// ranking geral) para UMA prova escolhida num autocomplete, ordenados do
// maior para o menor desempenho. A lista de usuários é a mesma entre provas,
// então a troca de seleção anima as barras em vez de recriar o gráfico.
export const ExamPerformanceCard: React.FC<ExamPerformanceCardProps> = ({ exams, attempts, userNameById }) => {
  const completed = useMemo(() => attempts.filter(a => a.status === 'completed'), [attempts]);

  // Só provas com resultados lançados (ao menos uma tentativa concluída),
  // da mais recentemente realizada para a mais antiga.
  const sortedExams = useMemo(() => {
    const lastByExam: Record<string, number> = {};
    completed.forEach(a => { lastByExam[a.examId] = Math.max(lastByExam[a.examId] || 0, attemptSeconds(a)); });
    return exams
      .filter(e => e.id in lastByExam)
      .sort((a, b) => lastByExam[b.id] - lastByExam[a.id] || a.name.localeCompare(b.name));
  }, [exams, completed]);

  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Seleção inicial: a prova realizada mais recentemente.
  useEffect(() => {
    if (!selectedExamId && sortedExams.length > 0) {
      setSelectedExamId(sortedExams[0].id);
    }
  }, [sortedExams, selectedExamId]);

  const selectedExam = sortedExams.find(e => e.id === selectedExamId) || null;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const matches = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sortedExams.filter(e => !term || e.name.toLowerCase().includes(term));
  }, [sortedExams, search]);

  // Um ponto por usuário que já concluiu alguma prova, em ordem decrescente de
  // desempenho na prova escolhida. O valor é o aproveitamento na tentativa concluída mais recente da
  // prova escolhida; sem tentativa nela, 0 com rótulo "—".
  const chartData = useMemo(() => {
    const names: Record<string, string> = {};
    completed.forEach(a => { names[a.userId] = a.userName || userNameById[a.userId] || 'Usuário'; });

    const latestByUser: Record<string, Attempt> = {};
    completed.filter(a => a.examId === selectedExamId).forEach(a => {
      const prev = latestByUser[a.userId];
      if (!prev || attemptSeconds(a) > attemptSeconds(prev)) latestByUser[a.userId] = a;
    });

    return Object.entries(names)
      .map(([userId, name]) => {
        const att = latestByUser[userId];
        return { userId, name, score: att ? (att.scorePercentage || 0) : 0, done: !!att };
      })
      // Maior desempenho primeiro; quem não fez a prova vai para o fim.
      .sort((a, b) => Number(b.done) - Number(a.done) || b.score - a.score || a.name.localeCompare(b.name));
  }, [completed, userNameById, selectedExamId]);

  const hasAnyScore = chartData.some(d => d.done);
  const chartHeight = Math.max(160, chartData.length * 52);
  const plotH = chartHeight - MARGIN * 2 - AXIS_H;
  const band = plotH / Math.max(1, chartData.length);
  const barH = band * 0.44; // barCategoryGap 28% de cada lado, como no recharts

  // Linhas renderizadas numa ordem estável (por userId) e posicionadas por
  // `translateY` conforme o ranking: ao trocar a prova, o nome e a barra de
  // cada usuário deslizam para a nova posição enquanto a barra muda de largura.
  const rankByUser = useMemo(
    () => Object.fromEntries(chartData.map((d, i) => [d.userId, i])) as Record<string, number>,
    [chartData]
  );
  const stableRows = useMemo(() => [...chartData].sort((a, b) => a.userId.localeCompare(b.userId)), [chartData]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
      <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
        <FileCheck className="w-4 h-4 text-cyan-500" />
        Desempenho por Prova
      </h2>

      <div className="relative max-w-md" ref={containerRef}>
        <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
        <input
          type="text"
          placeholder="Pesquisar prova..."
          value={open ? search : (selectedExam?.name || '')}
          onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => { setSearch(''); setOpen(true); }}
          className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
        />
        {open && (
          <div className="absolute z-20 mt-1.5 w-full max-h-56 overflow-y-auto bg-slate-950 border border-slate-800 rounded-xl shadow-2xl p-1">
            {matches.length === 0 ? (
              <p className="px-3 py-2 text-xs text-slate-500">
                {sortedExams.length === 0 ? 'Nenhuma prova com resultados lançados.' : 'Nenhuma prova encontrada.'}
              </p>
            ) : matches.map(e => (
              <button
                key={e.id}
                type="button"
                onClick={() => { setSelectedExamId(e.id); setSearch(''); setOpen(false); }}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-slate-800 truncate ${
                  e.id === selectedExamId ? 'text-cyan-400 font-semibold' : 'text-slate-200'
                }`}
              >
                {e.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {chartData.length === 0 ? (
        <p className="text-xs text-slate-500 italic py-6 text-center">Sem provas concluídas ainda.</p>
      ) : (
        <>
          {!hasAnyScore && (
            <p className="text-[11px] text-slate-500 italic">Nenhum usuário concluiu esta prova ainda.</p>
          )}
          <div className="relative w-full" style={{ height: chartHeight }}>
            {/* Linhas: nome + barra, animadas por transform/width */}
            <div className="absolute" style={{ left: MARGIN, right: RIGHT_M, top: MARGIN, height: plotH }}>
              {stableRows.map(entry => (
                <div
                  key={entry.userId}
                  title={entry.done ? `${entry.name}: ${entry.score}%` : `${entry.name}: sem tentativa`}
                  className="absolute left-0 right-0 flex items-center transition-transform duration-700 ease-out"
                  style={{ top: 0, height: band, transform: `translateY(${(rankByUser[entry.userId] || 0) * band}px)` }}
                >
                  <span
                    className="shrink-0 pr-2 text-right text-sm font-bold text-slate-100 truncate"
                    style={{ width: NAME_W }}
                  >
                    {entry.name}
                  </span>
                  <div className="relative flex-1 h-full">
                    <div
                      className="absolute left-0 rounded-r-md transition-[width,background-color] duration-700 ease-out"
                      style={{
                        top: (band - barH) / 2,
                        height: barH,
                        width: `${entry.done ? entry.score : 0}%`,
                        backgroundColor: entry.done ? scoreColorHex(entry.score) : '#D8DBDD'
                      }}
                    />
                    <span
                      className="absolute top-1/2 -translate-y-1/2 text-[13px] font-bold text-slate-100 whitespace-nowrap transition-[left] duration-700 ease-out"
                      style={{ left: `calc(${entry.done ? entry.score : 0}% + 8px)` }}
                    >
                      {entry.done ? `${entry.score}%` : '—'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Eixos: linha vertical, linha horizontal e marcas de 0 a 100% */}
            <div className="absolute w-px bg-slate-400" style={{ left: MARGIN + NAME_W, top: MARGIN, height: plotH }} />
            <div className="absolute" style={{ left: MARGIN + NAME_W, right: RIGHT_M, top: MARGIN + plotH }}>
              <div className="h-px bg-slate-400" />
              {TICKS.map(t => (
                <span
                  key={t}
                  className="absolute text-[11px] text-slate-400 -translate-x-1/2"
                  style={{ left: `${t}%`, top: 6 }}
                >
                  {t}%
                </span>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
