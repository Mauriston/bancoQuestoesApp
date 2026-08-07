import React, { useState } from 'react';
import {
  UploadCloud, FileJson, CheckCircle2, AlertCircle, RefreshCw, Sparkles, BookOpen, GitBranch
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { importQuestionBankJson, ImportProgress, applyThemeSubAreas, SubAreaMigrationResult } from '../../services/importService';
import arvoreLocalJson from '../../../arvore_temas.json';
import subAreaTreeJson from '../../../reference/arvore_temas_subareas.json';
import { BulkImagesSection } from './BulkImagesPage';

export const ImportPage: React.FC = () => {
  const { currentUser } = useAuth();
  
  const [jsonFile, setJsonFile] = useState<File | null>(null);
  const [jsonPreview, setJsonPreview] = useState<any>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  // Atualização de Subáreas dos Temas — reaproveita o mesmo fluxo de
  // upload/prévia acima, mas grava só o campo `subArea` em temas já
  // existentes (não cria áreas/temas/questões novas).
  const [subAreaFile, setSubAreaFile] = useState<File | null>(null);
  const [subAreaPreview, setSubAreaPreview] = useState<any>(null);
  const [applyingSubAreas, setApplyingSubAreas] = useState(false);
  const [subAreaProgress, setSubAreaProgress] = useState<{ phase: 'temas' | 'questoes'; processedCount: number; totalCount: number } | null>(null);
  const [subAreaResult, setSubAreaResult] = useState<SubAreaMigrationResult | null>(null);
  const [subAreaError, setSubAreaError] = useState<string | null>(null);

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

  const handleSubAreaFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSubAreaFile(file);
    setSubAreaResult(null);
    setSubAreaError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        setSubAreaPreview(parsed);
      } catch (err) {
        alert("Arquivo JSON inválido.");
        setSubAreaPreview(null);
      }
    };
    reader.readAsText(file);
  };

  const handleLoadBundledSubAreaTree = () => {
    setSubAreaFile(null);
    setSubAreaPreview(subAreaTreeJson);
    setSubAreaResult(null);
    setSubAreaError(null);
  };

  const handleApplySubAreas = async () => {
    if (!subAreaPreview) return;

    setApplyingSubAreas(true);
    setSubAreaResult(null);
    setSubAreaError(null);

    try {
      const res = await applyThemeSubAreas(subAreaPreview, (p) => setSubAreaProgress(p));
      setSubAreaResult(res);
    } catch (err: any) {
      setSubAreaError(err.message || "Erro desconhecido ao atualizar subáreas.");
    } finally {
      setApplyingSubAreas(false);
      setSubAreaProgress(null);
    }
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
          Importar
        </h1>
      </div>

      <div>
        <h2 className="text-lg font-bold text-[#050f41] flex items-center gap-2 mb-1">
          Importação do Banco de Questões (JSON)
        </h2>
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

      {/* Atualização de Subáreas dos Temas — grava o campo `subArea` (ex.:
          "Ortopedia"/"Traumatologia") em temas já cadastrados, a partir de
          uma árvore Área → Subárea → Temas. Não cria áreas/temas/questões
          novas; só atualiza temas cujo ID já existe no Firestore. */}
      <div className="pt-4 border-t border-slate-800 space-y-4">
        <h2 className="text-lg font-bold text-[#050f41] flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-cyan-400" />
          Atualizar Subáreas dos Temas
        </h2>
        <p className="text-xs text-slate-400 -mt-2">
          Grava o agrupamento por subárea (ex.: Ortopedia/Traumatologia) nos temas já cadastrados, sem criar nada novo.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#050f41] flex items-center gap-2 mb-2">
                <FileJson className="w-4 h-4 text-cyan-400" />
                Upload de Árvore de Subáreas (JSON)
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                Selecione um arquivo `.json` no formato Área → Subárea → Temas.
              </p>
              <input
                type="file"
                accept=".json"
                onChange={handleSubAreaFileChange}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300"
              />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#050f41] flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-teal-400" />
                Usar Árvore Padrão de Subáreas
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                Carregar a estrutura oficial de subáreas inclusa (Ortopedia/Traumatologia, exceto Anatomia, Ciência Básica e Oncologia).
              </p>
              <button
                onClick={handleLoadBundledSubAreaTree}
                className="px-4 py-2 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/40 text-xs font-semibold"
              >
                Carregar Árvore Integrada
              </button>
            </div>
          </div>
        </div>

        {subAreaPreview && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-[#050f41]">Pré-visualização</h3>
              <span className="text-[11px] font-bold uppercase px-2.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {Array.isArray(subAreaPreview) ? `${subAreaPreview.length} áreas carregadas` : 'JSON carregado'}
              </span>
            </div>

            {subAreaProgress && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-slate-300">
                  <span>{subAreaProgress.phase === 'temas' ? 'Atualizando temas...' : 'Atualizando questões do banco...'}</span>
                  <span className="font-bold text-cyan-400">{subAreaProgress.processedCount} / {subAreaProgress.totalCount}</span>
                </div>
                <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="bg-cyan-500 h-full transition-all duration-200"
                    style={{ width: `${Math.round((subAreaProgress.processedCount / (subAreaProgress.totalCount || 1)) * 100)}%` }}
                  />
                </div>
              </div>
            )}

            {subAreaError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{subAreaError}</span>
              </div>
            )}

            {subAreaResult && (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{subAreaResult.matched} tema(s) e {subAreaResult.matchedQuestions} questão(ões) atualizados com sucesso.</span>
                </div>

                {subAreaResult.skippedAreas.length > 0 && (
                  <p className="text-[11px] text-slate-500">
                    Áreas sem subárea (ignoradas de propósito): {subAreaResult.skippedAreas.join(', ')}.
                  </p>
                )}

                {subAreaResult.unmatched.length > 0 && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs">
                    <p className="font-bold text-amber-400 mb-1.5 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {subAreaResult.unmatched.length} tema(s) sem correspondência no banco:
                    </p>
                    <ul className="text-amber-300/90 space-y-0.5 max-h-40 overflow-y-auto">
                      {subAreaResult.unmatched.map((name, i) => <li key={i}>• {name}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={handleApplySubAreas}
                disabled={applyingSubAreas}
                className="flex items-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-2.5 px-5 rounded-xl text-xs shadow-lg shadow-cyan-500/20 disabled:opacity-50"
              >
                {applyingSubAreas ? <RefreshCw className="w-4 h-4 animate-spin" /> : <GitBranch className="w-4 h-4" />}
                <span>{applyingSubAreas ? 'Atualizando...' : 'Aplicar Subáreas no Firestore'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-slate-800">
        <BulkImagesSection />
      </div>

    </div>
  );
};
