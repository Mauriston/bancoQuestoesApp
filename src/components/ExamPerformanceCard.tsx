import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FileCheck, Search } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell, LabelList } from 'recharts';
import { Attempt, Exam } from '../types';
import { scoreColorHex } from '../utils/helpers';

interface ExamPerformanceCardProps {
  exams: Exam[];
  attempts: Attempt[];
  userNameById: Record<string, string>;
}

const attemptSeconds = (a: Attempt): number => {
  const t: any = a.completedAt || a.startedAt;
  if (!t) return 0;
  if (typeof t === 'object' && 'seconds' in t) return t.seconds;
  const ms = new Date(t).getTime();
  return Number.isNaN(ms) ? 0 : ms / 1000;
};

// Card "Desempenho por Prova": barras horizontais por usuário (como o
// ranking geral) para UMA prova escolhida num autocomplete. A lista de
// usuários e a ordem das barras são fixas entre provas, para que a troca de
// seleção anime o comprimento de cada barra em vez de recriar o gráfico.
export const ExamPerformanceCard: React.FC<ExamPerformanceCardProps> = ({ exams, attempts, userNameById }) => {
  const completed = useMemo(() => attempts.filter(a => a.status === 'completed'), [attempts]);

  // Provas ordenadas da mais recentemente realizada para a mais antiga; as
  // sem nenhuma tentativa concluída vão para o fim, em ordem alfabética.
  const sortedExams = useMemo(() => {
    const lastByExam: Record<string, number> = {};
    completed.forEach(a => { lastByExam[a.examId] = Math.max(lastByExam[a.examId] || 0, attemptSeconds(a)); });
    return [...exams].sort((a, b) => {
      const la = lastByExam[a.id] || 0;
      const lb = lastByExam[b.id] || 0;
      return lb - la || a.name.localeCompare(b.name);
    });
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

  // Um ponto por usuário que já concluiu alguma prova (ordem alfabética,
  // fixa). O valor é o aproveitamento na tentativa concluída mais recente da
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
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [completed, userNameById, selectedExamId]);

  const hasAnyScore = chartData.some(d => d.done);
  const chartHeight = Math.max(160, chartData.length * 52);

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
              <p className="px-3 py-2 text-xs text-slate-500">Nenhuma prova encontrada.</p>
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
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 44, bottom: 4, left: 4 }} barCategoryGap="28%">
              <XAxis type="number" domain={[0, 100]} tick={{ fill: '#6B7680', fontSize: 11 }} unit="%" />
              <YAxis type="category" dataKey="name" width={140} tick={{ fill: '#2C3A47', fontSize: 14, fontWeight: 700 }} interval={0} />
              <Tooltip
                formatter={(value: any, _n: any, item: any) => [item?.payload?.done ? `${value}%` : 'Sem tentativa', 'Desempenho']}
                contentStyle={{ background: '#23303B', border: '1px solid #2C3A47', borderRadius: 12, fontSize: 12 }}
                labelStyle={{ color: '#D8DBDD' }}
              />
              <Bar dataKey="score" radius={[0, 6, 6, 0]} isAnimationActive animationDuration={700} animationEasing="ease-out">
                {chartData.map(entry => (
                  <Cell key={entry.userId} fill={entry.done ? scoreColorHex(entry.score) : '#D8DBDD'} />
                ))}
                <LabelList
                  dataKey="score"
                  position="right"
                  formatter={(value: any, ..._rest: any[]) => `${value}%`}
                  content={(props: any) => {
                    const { x, y, width, height, index } = props;
                    const entry = chartData[index];
                    if (!entry) return null;
                    return (
                      <text x={x + width + 8} y={y + height / 2} dominantBaseline="central" fill="#2C3A47" fontSize={13} fontWeight={700}>
                        {entry.done ? `${entry.score}%` : '—'}
                      </text>
                    );
                  }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  );
};
