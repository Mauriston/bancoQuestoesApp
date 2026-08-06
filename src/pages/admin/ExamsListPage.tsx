import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FileCheck, Plus, Trash2, Eye, Power, PowerOff, Pencil
} from 'lucide-react';
import { getExams, deleteExam, updateExamActiveStatus, isExamActive, getAllAttempts } from '../../services/firebaseService';
import { Exam } from '../../types';
import { formatDate } from '../../utils/helpers';

export const ExamsListPage: React.FC = () => {
  const navigate = useNavigate();
  const [exams, setExams] = useState<Exam[]>([]);
  // Nº de tentativas por prova — usado só para decidir se a prova pode ser
  // editada (inativa + zero tentativas registradas). Ver isEditable().
  const [attemptCountByExamId, setAttemptCountByExamId] = useState<Record<string, number>>({});
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {exams.map((ex) => (
              <div
                key={ex.id}
                onClick={() => navigate(`/admin/exams/${ex.id}`)}
                className="bg-slate-950 border border-slate-800/80 rounded-2xl p-5 shadow-lg flex flex-col justify-between hover:border-slate-700 transition-all cursor-pointer"
                title="Clique para visualizar a prova completa"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                      isExamActive(ex)
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                      {isExamActive(ex) ? 'Ativa' : 'Inativa'}
                    </span>
                    <span className="text-[11px] text-slate-500">{formatDate(ex.createdAt)}</span>
                  </div>

                  <h3 className="text-sm font-bold text-[#050f41] line-clamp-2">
                    {ex.name}
                  </h3>

                  {ex.description && (
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                      {ex.description}
                    </p>
                  )}

                  <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400 space-y-1">
                    <p>• Questões: <strong className="text-slate-200">{ex.questionCount}</strong></p>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <Link
                    to={`/admin/exams/${ex.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Ver Prova</span>
                  </Link>

                  <div className="flex items-center gap-3">
                    {isEditable(ex) && (
                      <Link
                        to={`/admin/exams/${ex.id}/edit`}
                        onClick={(e) => e.stopPropagation()}
                        title="Editar dados e questões desta prova"
                        className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>Editar</span>
                      </Link>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleToggleActive(ex); }}
                      disabled={togglingId === ex.id}
                      className={`text-xs font-semibold flex items-center gap-1 disabled:opacity-40 ${
                        isExamActive(ex) ? 'text-amber-400 hover:text-amber-400' : 'text-emerald-400 hover:text-emerald-300'
                      }`}
                    >
                      {isExamActive(ex) ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                      <span>{isExamActive(ex) ? 'Desativar' : 'Ativar'}</span>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(ex.id); }}
                      className="text-xs font-semibold text-red-400 hover:text-red-300 flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Excluir</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};
