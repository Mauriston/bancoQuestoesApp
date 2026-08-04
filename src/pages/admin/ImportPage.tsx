import React, { useState } from 'react';
import { 
  UploadCloud, FileJson, CheckCircle2, AlertCircle, RefreshCw, Sparkles, BookOpen 
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { importQuestionBankJson, ImportProgress } from '../../services/importService';
import arvoreLocalJson from '../../../arvore_temas.json';

export const ImportPage: React.FC = () => {
  const { currentUser } = useAuth();
  
  const [jsonFile, setJsonFile] = useState<File | null>(null);
  const [jsonPreview, setJsonPreview] = useState<any>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setJsonFile(file);
    setResultMessage(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        setJsonPreview(parsed);
      } catch (err) {
        alert("Arquivo JSON inválido.");
        setJsonPreview(null);
      }
    };
    reader.readAsText(file);
  };

  const handleLoadBundledTree = () => {
    setJsonFile(null);
    setJsonPreview(arvoreLocalJson);
    setResultMessage(null);
  };

  const handleExecuteImport = async () => {
    if (!jsonPreview || !currentUser) return;

    setImporting(true);
    setResultMessage(null);

    try {
      const res = await importQuestionBankJson(
        jsonPreview, 
        currentUser.name || currentUser.id,
        (p) => setProgress(p)
      );

      setResultMessage(`Importação concluída com sucesso! ${res.created} registros processados.`);
    } catch (err: any) {
      setResultMessage(`Erro na importação: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      
      <div>
        <h1 className="text-xl font-bold text-[#050f41] flex items-center gap-2">
          <UploadCloud className="w-5 h-5 text-cyan-400" />
          Importação do Banco de Questões (JSON)
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Carregue arquivos JSON de questões TEOT para alimentar o Firestore em lote com segurança.
        </p>
      </div>

      {/* Action Choice Box */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Custom JSON Drop */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#050f41] flex items-center gap-2 mb-2">
              <FileJson className="w-4 h-4 text-cyan-400" />
              Upload de Arquivo JSON
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Selecione um arquivo `.json` contendo áreas, temas e questões.
            </p>
            <input
              type="file"
              accept=".json"
              onChange={handleFileChange}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300"
            />
          </div>
        </div>

        {/* Built-in Tree JSON */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#050f41] flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-teal-400" />
              Usar Banco Padrão TEOT (arvore_temas.json)
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Importar instantaneamente a estrutura oficial de 11 Áreas e 336 Temas inclusa.
            </p>
            <button
              onClick={handleLoadBundledTree}
              className="px-4 py-2 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/40 text-xs font-semibold"
            >
              Carregar Estrutura Integrada
            </button>
          </div>
        </div>

      </div>

      {/* Validation & Import Controls */}
      {jsonPreview && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-[#050f41]">Pré-visualização e Validação do JSON</h3>
            <span className="text-[11px] font-bold uppercase px-2.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Estrutura Válida
            </span>
          </div>

          {progress && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-300">
                <span>{progress.currentStep}</span>
                <span className="font-bold text-cyan-400">{progress.processedCount} / {progress.totalCount}</span>
              </div>
              <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800">
                <div 
                  className="bg-cyan-500 h-full transition-all duration-200"
                  style={{ width: `${Math.round((progress.processedCount / (progress.totalCount || 1)) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {resultMessage && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{resultMessage}</span>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              onClick={handleExecuteImport}
              disabled={importing}
              className="flex items-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-2.5 px-5 rounded-xl text-xs shadow-lg shadow-cyan-500/20 disabled:opacity-50"
            >
              {importing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
              <span>{importing ? 'Importando em Lotes...' : 'Iniciar Importação no Firestore'}</span>
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
