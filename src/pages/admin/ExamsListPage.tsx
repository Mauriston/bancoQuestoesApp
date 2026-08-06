import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FileCheck, Plus, Trash2, Power, PowerOff, Pencil, Users
} from 'lucide-react';
import { getExams, deleteExam, updateExamActiveStatus, isExamActive, getAllAttempts } from '../../services/firebaseService';
import { Exam } from '../../types';

function scoreColor(score: number): string {
  if (score >= 60) return 'text-emerald-400';
  if (score >= 50) return 'text-amber-400';
  return 'text-red-400';
}

export const ExamsListPage: React.FC = () => {
  const navigate = useNavigate();
  const [exams, setExams] = useState<Exam[]>([]);
  // Nº de tentativas por prova — usado só para decidir se a prova pode ser
  // editada (inativa + zero tentativas registradas). Ver isEditable().
  const [attemptCountByExamId, setAttemptCountByExamId] = useState<Record<string, number>>({});
  // Nº de usuários distintos que já responderam (concluíram) cada prova, seus
  // nomes (para o tooltip) e a média de desempenho deles — usados no card.
  const [respondentCountByExamId, setRespondentCountByExamId] = useState<Record<string, number>>({});
  const [respondentNamesByExamId, setRespondentNamesByExamId] = useState<Record<string, string[]>>({});
  const [avgScoreByExamId, setAvgScoreByExamId] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchExamsList = async () => {
    setLoading(true);
    try {
      const [list, attempts] = await Promise.all([getExams(), getAllAttempts()]);
      setExams(list);
      const counts: Record<string, number> = {};
      attempts.forEach(a => { counts[a.examId] = (counts[a.examId] || 0) + 1; });
      setAttemptCountByExamId(counts);

      const completed = attempts.filter(a => a.status === 'completed');
      const respondentsByExam: Record<string, Map<string, string>> = {};
      const scoreSumByExam: Record<string, number> = {};
      const scoreCountByExam: Record<string, number> = {};
      completed.forEach(a => {
        if (!respondentsByExam[a.examId]) respondentsByExam[a.examId] = new Map();
        respondentsByExam[a.examId].set(a.userId, a.userName || 'Usuário');
        if (typeof a.scorePercentage === 'number') {
          scoreSumByExam[a.examId] = (scoreSumByExam[a.examId] || 0) + a.scorePercentage;
          scoreCountByExam[a.examId] = (scoreCountByExam[a.examId] || 0) + 1;
        }
      });
      const respondentCounts: Record<string, number> = {};
      const respondentNames: Record<string, string[]> = {};
      Object.entries(respondentsByExam).forEach(([examId, map]) => {
        respondentCounts[examId] = map.size;
        respondentNames[examId] = Array.from(map.values()).sort((a, b) => a.localeCompare(b));
      });
      setRespondentCountByExamId(respondentCounts);
      setRespondentNamesByExamId(respondentNames);

      const avgScores: Record<string, number> = {};
      Object.keys(scoreSumByExam).forEach(examId => {
        avgScores[examId] = Math.round(scoreSumByExam[examId] / scoreCountByExam[examId]);
      });
      setAvgScoreByExamId(avgScores);
    } catch (err) {
      console.error("Erro ao carregar provas:", err);
    } finally {
      setLoading(false);
    }
  };

  // Só é seguro editar (acrescentar/retirar questões, mudar dados básicos)
  // uma prova que ainda ninguém começou a responder — e ela precisa estar
  // inativa, ou um candidato poderia estar com ela em andamento neste exato
  // momento. updateExamContent() no firebaseService repete essa checagem.
  const isEditable = (exam: Exam) => !isExamActive(exam) && !attemptCountByExamId[exam.id];

  useEffect(() => {
    fetchExamsList();
  }, []);

  const handleDelete = async (examId: string) => {
    if (!confirm("Tem certeza que deseja excluir esta prova? As tentativas já realizadas por residentes também serão apagadas do histórico deles.")) return;
    try {
      await deleteExam(examId);
      await fetchExamsList();
    } catch (err: any) {
      alert("Erro ao excluir prova: " + (err?.message || "erro desconhecido."));
    }
  };

  const handleToggleActive = async (exam: Exam) => {
    setTogglingId(exam.id);
    try {
      await updateExamActiveStatus(exam.id, !isExamActive(exam));
      await fetchExamsList();
    } catch (err: any) {
      alert("Erro ao alterar status da prova: " + (err?.message || "erro desconhecido."));
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#050f41] flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-cyan-400" />
            Gerenciamento de Provas & Simulados
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Crie novos simulados, atribua a residentes e gerencie avaliações publicadas.
          </p>
        </div>

        <Link
          to="/admin/exams/new"
          className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-lg shadow-cyan-500/20 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Criar Nova Prova</span>
        </Link>
      </div>

      {/* Exams Grid */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">Carregando lista de provas...</div>
        ) : exams.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            Nenhuma prova cadastrada ainda. Clique no botão acima para criar o primeiro simulado!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {exams.map((ex) => {
              const names = respondentNamesByExamId[ex.id] || [];
              const respondentsTooltip = names.length > 0
                ? `Responderam: ${names.join(', ')}`
                : 'Ninguém respondeu ainda';
              return (
              <div
                key={ex.id}
                onClick={() => navigate(`/admin/exams/${ex.id}`)}
                className="bg-slate-950 border border-slate-800/80 rounded-2xl p-5 shadow-lg flex flex-col justify-between hover:border-slate-700 transition-all cursor-pointer"
                title="Clique para visualizar a prova completa"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-bold text-[#050f41] line-clamp-2 text-left">
                      {ex.name}
                    </h3>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                        isExamActive(ex)
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}>
                        {isExamActive(ex) ? 'Ativa' : 'Inativa'}
                      </span>
                      <span
                        className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 cursor-default"
                        title={respondentsTooltip}
                      >
                        <Users className="w-3.5 h-3.5" />
                        {respondentCountByExamId[ex.id] || 0}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400 mt-1.5">{ex.questionCount} questões</p>

                  {avgScoreByExamId[ex.id] !== undefined && (
                    <p className={`mt-4 text-2xl font-black tracking-tight ${scoreColor(avgScoreByExamId[ex.id])}`}>
                      {avgScoreByExamId[ex.id]}%
                    </p>
                  )}

                  {ex.description && (
                    <p className="text-xs text-slate-400 mt-2 line-clamp-2">
                      {ex.description}
                    </p>
                  )}
                </div>

                <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-end gap-1">
                  {isEditable(ex) && (
                    <Link
                      to={`/admin/exams/${ex.id}/edit`}
                      onClick={(e) => e.stopPropagation()}
                      title="Editar dados e questões desta prova"
                      className="p-2 rounded-lg text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
                    >
                      <Pencil className="w-4 h-4" />
                    </Link>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleToggleActive(ex); }}
                    disabled={togglingId === ex.id}
                    title={isExamActive(ex) ? 'Desativar' : 'Ativar'}
                    className={`p-2 rounded-lg disabled:opacity-40 ${
                      isExamActive(ex) ? 'text-amber-400 hover:bg-amber-500/10' : 'text-emerald-400 hover:bg-emerald-500/10'
                    }`}
                  >
                    {isExamActive(ex) ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(ex.id); }}
                    title="Excluir"
                    className="p-2 rounded-lg text-red-400 hover:bg-red-500/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
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
