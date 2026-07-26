import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  FileCheck, Plus, Clock, Users, Trash2, Eye, Calendar, Sparkles, CheckCircle2 
} from 'lucide-react';
import { getExams, deleteExam } from '../../services/firebaseService';
import { Exam } from '../../types';
import { formatDate } from '../../utils/helpers';

export const ExamsListPage: React.FC = () => {
  const navigate = useNavigate();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchExamsList = async () => {
    setLoading(true);
    try {
      const list = await getExams();
      setExams(list);
    } catch (err) {
      console.error("Erro ao carregar provas:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExamsList();
  }, []);

  const handleDelete = async (examId: string) => {
    if (!confirm("Tem certeza que deseja excluir esta prova?")) return;
    try {
      await deleteExam(examId);
      await fetchExamsList();
    } catch (err) {
      alert("Erro ao excluir prova.");
    }
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
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
                className="bg-slate-950 border border-slate-800/80 rounded-2xl p-5 shadow-lg flex flex-col justify-between hover:border-slate-700 transition-all"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      {ex.status === 'published' ? 'Publicada' : 'Rascunho'}
                    </span>
                    <span className="text-[11px] text-slate-500">{formatDate(ex.createdAt)}</span>
                  </div>

                  <h3 className="text-sm font-bold text-white line-clamp-2">
                    {ex.name}
                  </h3>

                  {ex.description && (
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                      {ex.description}
                    </p>
                  )}

                  <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400 space-y-1">
                    <p>• Questões: <strong className="text-slate-200">{ex.questionCount}</strong></p>
                    <p>• Duração: <strong className="text-slate-200">{ex.durationMinutes ? `${ex.durationMinutes} min` : 'Sem limite'}</strong></p>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                  <button
                    onClick={() => handleDelete(ex.id)}
                    className="text-xs font-semibold text-red-400 hover:text-red-300 flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Excluir</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};
