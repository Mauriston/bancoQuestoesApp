import React, { useState } from 'react';
import {
  UploadCloud, FileJson, CheckCircle2, AlertCircle, RefreshCw, Sparkles, BookOpen, GitBranch
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { importQuestionBankJson, ImportProgress, applyThemeGroups, GroupMigrationResult } from '../../services/importService';
import arvoreLocalJson from '../../../arvore_temas.json';
import groupTreeJson from '../../../reference/areas_grupos_temas.json';
import { BulkImagesSection } from './BulkImagesPage';
import { CsvBulkImportSection } from '../../components/CsvBulkImportSection';

export const ImportPage: React.FC = () => {
  const { currentUser } = useAuth();
  
  const [jsonFile, setJsonFile] = useState<File | null>(null);
  const [jsonPreview, setJsonPreview] = useState<any>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  // Atualização de Grupos (TEOT) dos Temas — reaproveita o mesmo fluxo de
  // upload/prévia acima, mas grava só `groupId`/`groupName` em temas já
  // existentes (não cria áreas/temas/questões novas, nem grupos novos — os 7
  // grupos oficiais já existem na coleção `groups`).
  const [groupFile, setGroupFile] = useState<File | null>(null);
  const [groupPreview, setGroupPreview] = useState<any>(null);
  const [applyingGroups, setApplyingGroups] = useState(false);
  const [groupProgress, setGroupProgress] = useState<{ phase: 'temas' | 'questoes'; processedCount: number; totalCount: number } | null>(null);
  const [groupResult, setGroupResult] = useState<GroupMigrationResult | null>(null);
  const [groupError, setGroupError] = useState<string | null>(null);

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

  const handleGroupFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setGroupFile(file);
    setGroupResult(null);
    setGroupError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        setGroupPreview(parsed);
      } catch (err) {
        alert("Arquivo JSON inválido.");
        setGroupPreview(null);
      }
    };
    reader.readAsText(file);
  };

  const handleLoadBundledGroupTree = () => {
    setGroupFile(null);
    setGroupPreview(groupTreeJson);
    setGroupResult(null);
    setGroupError(null);
  };

  const handleApplyGroups = async () => {
    if (!groupPreview) return;

    setApplyingGroups(true);
    setGroupResult(null);
    setGroupError(null);

    try {
      const res = await applyThemeGroups(groupPreview, (p) => setGroupProgress(p));
      setGroupResult(res);
    } catch (err: any) {
      setGroupError(err.message || "Erro desconhecido ao atualizar grupos.");
    } finally {
      setApplyingGroups(false);
      setGroupProgress(null);
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
        <h1 className="text-xl font-bold text-[#05413b] flex items-center gap-2">
          <UploadCloud className="w-5 h-5 text-cyan-400" />
          Importar
        </h1>
      </div>

      <div>
        <h2 className="text-lg font-bold text-[#05413b] flex items-center gap-2 mb-1">
          Importação do Banco de Questões (JSON)
        </h2>
      </div>

      {/* Action Choice Box */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Custom JSON Drop */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#05413b] flex items-center gap-2 mb-2">
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
            <h3 className="text-sm font-bold text-[#05413b] flex items-center gap-2 mb-2">
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
            <h3 className="text-sm font-bold text-[#05413b]">Pré-visualização e Validação do JSON</h3>
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

      {/* Atualização de Grupos (TEOT) dos Temas — grava `groupId`/`groupName`
          (Anatomia, Ciência Básica, Ortopedia Adulto, Ortopedia Infantil,
          Trauma Adulto, Trauma Infantil, Oncologia Ortopédica) em temas já
          cadastrados, a partir de uma árvore Área → Grupo → Temas. Não cria
          áreas/temas/questões/grupos novos; só atualiza temas cujo ID já
          existe no Firestore. Usado só para estatísticas de desempenho — a
          Área continua sendo o filtro de questões no banco e nas provas. */}
      <div className="pt-4 border-t border-slate-800 space-y-4">
        <h2 className="text-lg font-bold text-[#05413b] flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-cyan-400" />
          Atualizar Grupos (TEOT) dos Temas
        </h2>
        <p className="text-xs text-slate-400 -mt-2">
          Grava o agrupamento oficial do TEOT (Anatomia, Ciência Básica, Ortopedia Adulto, Ortopedia Infantil, Trauma Adulto, Trauma Infantil, Oncologia Ortopédica) nos temas já cadastrados, para uso exclusivo nas estatísticas de desempenho. Não afeta os filtros de Área no banco de questões nem na elaboração de provas.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#05413b] flex items-center gap-2 mb-2">
                <FileJson className="w-4 h-4 text-cyan-400" />
                Upload de Árvore de Grupos (JSON)
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                Selecione um arquivo `.json` no formato Área → Grupo → Temas.
              </p>
              <input
                type="file"
                accept=".json"
                onChange={handleGroupFileChange}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300"
              />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#05413b] flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-teal-400" />
                Usar Árvore Padrão de Grupos
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                Carregar a estrutura oficial de grupos TEOT inclusa.
              </p>
              <button
                onClick={handleLoadBundledGroupTree}
                className="px-4 py-2 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/40 text-xs font-semibold"
              >
                Carregar Árvore Integrada
              </button>
            </div>
          </div>
        </div>

        {groupPreview && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-[#05413b]">Pré-visualização</h3>
              <span className="text-[11px] font-bold uppercase px-2.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {Array.isArray(groupPreview) ? `${groupPreview.length} entradas carregadas` : 'JSON carregado'}
              </span>
            </div>

            {groupProgress && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-slate-300">
                  <span>{groupProgress.phase === 'temas' ? 'Atualizando temas...' : 'Atualizando questões do banco...'}</span>
                  <span className="font-bold text-cyan-400">{groupProgress.processedCount} / {groupProgress.totalCount}</span>
                </div>
                <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="bg-cyan-500 h-full transition-all duration-200"
                    style={{ width: `${Math.round((groupProgress.processedCount / (groupProgress.totalCount || 1)) * 100)}%` }}
                  />
                </div>
              </div>
            )}

            {groupError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{groupError}</span>
              </div>
            )}

            {groupResult && (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{groupResult.matched} tema(s) e {groupResult.matchedQuestions} questão(ões) atualizados com sucesso.</span>
                </div>

                {groupResult.unknownGroups.length > 0 && (
                  <p className="text-[11px] text-amber-400">
                    Nome(s) de grupo sem correspondência na coleção `groups`: {groupResult.unknownGroups.join(', ')}.
                  </p>
                )}

                {groupResult.unmatched.length > 0 && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs">
                    <p className="font-bold text-amber-400 mb-1.5 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {groupResult.unmatched.length} tema(s) sem correspondência no banco:
                    </p>
                    <ul className="text-amber-300/90 space-y-0.5 max-h-40 overflow-y-auto">
                      {groupResult.unmatched.map((name, i) => <li key={i}>• {name}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={handleApplyGroups}
                disabled={applyingGroups}
                className="flex items-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-2.5 px-5 rounded-xl text-xs shadow-lg shadow-cyan-500/20 disabled:opacity-50"
              >
                {applyingGroups ? <RefreshCw className="w-4 h-4 animate-spin" /> : <GitBranch className="w-4 h-4" />}
                <span>{applyingGroups ? 'Atualizando...' : 'Aplicar Grupos no Firestore'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-slate-800">
        <BulkImagesSection />
      </div>

      <div className="pt-4 border-t border-slate-800 space-y-4">
        <h2 className="text-lg font-bold text-[#05413b]">Envio em Lote para a Videoteca</h2>
        <CsvBulkImportSection
          materialType="video"
          title="Upload de Arquivo CSV — Videoteca"
          description="Cadastra vários vídeos do YouTube de uma vez."
        />
      </div>

      <div className="pt-4 border-t border-slate-800 space-y-4">
        <h2 className="text-lg font-bold text-[#05413b]">Envio de Aulas em Lote</h2>
        <CsvBulkImportSection
          materialType="aula"
          title="Upload de Arquivo CSV — Aulas"
          description="Cadastra várias apresentações (Canva ou Google Slides) de uma vez."
        />
      </div>

    </div>
  );
};
