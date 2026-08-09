import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FileCheck, Plus, Trash2, Pencil, Users, Eye
} from 'lucide-react';
import { getExams, deleteExam, updateExamActiveStatus, isExamActive, getAllAttempts } from '../../services/firebaseService';
import { Exam } from '../../types';
import { scoreColorClass } from '../../utils/helpers';

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
        </div>

        <Link
          to="/admin/exams/new"
          className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-lg shadow-cyan-500/20 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Criar Nova Prova</span>
        </Link>
      </div>

      {/* Exams Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">Carregando lista de provas...</div>
        ) : exams.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            Nenhuma prova cadastrada ainda. Clique no botão acima para criar o primeiro simulado!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-3.5">Prova</th>
                  <th className="p-3.5">Questões</th>
                  <th className="p-3.5">Respondentes</th>
                  <th className="p-3.5">Média</th>
                  <th className="p-3.5 text-center">Ativa</th>
                  <th className="p-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {exams.map((ex) => {
                  const names = respondentNamesByExamId[ex.id] || [];
                  const respondentsTooltip = names.length > 0
                    ? `Responderam: ${names.join(', ')}`
                    : 'Ninguém respondeu ainda';
                  return (
                    <tr key={ex.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3.5 font-semibold text-[#050f41] max-w-[280px]">
                        <span className="line-clamp-2">{ex.name}</span>
                      </td>
                      <td className="p-3.5 text-slate-400">{ex.questionCount}</td>
                      <td className="p-3.5 text-slate-400" title={respondentsTooltip}>
                        <span className="inline-flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5" />
                          {respondentCountByExamId[ex.id] || 0}
                        </span>
                      </td>
                      <td className="p-3.5">
                        {avgScoreByExamId[ex.id] !== undefined ? (
                          <span className={`font-bold ${scoreColorClass(avgScoreByExamId[ex.id])}`}>{avgScoreByExamId[ex.id]}%</span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="p-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={isExamActive(ex)}
                          disabled={togglingId === ex.id}
                          onChange={() => handleToggleActive(ex)}
                          title={isExamActive(ex) ? 'Desativar prova' : 'Ativar prova'}
                          aria-label={isExamActive(ex) ? 'Desativar prova' : 'Ativar prova'}
                          className="w-4 h-4 accent-emerald-500 cursor-pointer disabled:opacity-40"
                        />
                      </td>
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => navigate(`/admin/exams/${ex.id}`)}
                            title="Ver prova"
                            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {isEditable(ex) && (
                            <Link
                              to={`/admin/exams/${ex.id}/edit`}
                              title="Editar dados e questões desta prova"
                              className="p-2 rounded-lg text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
                            >
                              <Pencil className="w-4 h-4" />
                            </Link>
                          )}
                          <button
                            onClick={() => handleDelete(ex.id)}
                            title="Excluir"
                            className="p-2 rounded-lg text-red-400 hover:bg-red-500/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};
