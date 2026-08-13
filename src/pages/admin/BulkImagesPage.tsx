import React, { useState, useMemo } from 'react';
import {
  Images, FolderOpen, CheckCircle2, XCircle, AlertTriangle, RefreshCw, ImageOff
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { uploadBatchQuestionImage, addAdminLog } from '../../services/firebaseService';

const IMAGE_EXT_RE = /\.(jpe?g|png)$/i;

const FONTE_SUGESTOES = ['TEOT 2024', 'TARO 2022', 'BANCO PRÓPRIO'];

interface FileEntry {
  file: File;
  questionId: string;
}

interface ResultEntry {
  fileName: string;
  questionId: string;
  status: 'success' | 'not_found' | 'error';
  message?: string;
}

export const BulkImagesSection: React.FC = () => {
  const { currentUser } = useAuth();

  const [prova, setProva] = useState('');
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [skippedNonImage, setSkippedNonImage] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [results, setResults] = useState<ResultEntry[]>([]);

  const isReadyForFolder = prova.trim().length > 0;

  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    setResults([]);
    setProcessedCount(0);
    if (!fileList || fileList.length === 0) {
      setEntries([]);
      setSkippedNonImage(0);
      return;
    }

    const imageEntries: FileEntry[] = [];
    let skipped = 0;

    Array.from(fileList).forEach((file) => {
      if (!IMAGE_EXT_RE.test(file.name)) {
        skipped++;
        return;
      }
      const questionId = file.name.replace(IMAGE_EXT_RE, '').trim();
      imageEntries.push({ file, questionId });
    });

    setEntries(imageEntries);
    setSkippedNonImage(skipped);
  };

  const summary = useMemo(() => {
    const success = results.filter(r => r.status === 'success').length;
    const notFound = results.filter(r => r.status === 'not_found').length;
    const error = results.filter(r => r.status === 'error').length;
    return { success, notFound, error };
  }, [results]);

  const handleStartImport = async () => {
    if (!isReadyForFolder || entries.length === 0 || processing) return;

    setProcessing(true);
    setResults([]);
    setProcessedCount(0);

    const collected: ResultEntry[] = [];

    for (const entry of entries) {
      try {
        await uploadBatchQuestionImage(prova.trim(), entry.questionId, entry.file);
        collected.push({ fileName: entry.file.name, questionId: entry.questionId, status: 'success' });
      } catch (err: any) {
        const message: string = err?.message || 'Erro desconhecido';
        collected.push({
          fileName: entry.file.name,
          questionId: entry.questionId,
          status: message.includes('não encontrada no Firestore') ? 'not_found' : 'error',
          message
        });
      }
      setProcessedCount(prev => prev + 1);
      setResults([...collected]);
    }

    const successCount = collected.filter(r => r.status === 'success').length;
    const notFoundCount = collected.filter(r => r.status === 'not_found').length;
    const errorCount = collected.filter(r => r.status === 'error').length;

    if (currentUser) {
      try {
        await addAdminLog(
          currentUser.id,
          currentUser.name || currentUser.id,
          'bulk_image_import',
          `Prova "${prova.trim()}": ${successCount} vinculada(s), ${notFoundCount} sem questão correspondente, ${errorCount} com erro (de ${collected.length} arquivo(s)).`
        );
      } catch {
        // Log de auditoria é best-effort — não deve impedir o admin de ver o resultado da importação.
      }
    }

    setProcessing(false);
  };

  const handleReset = () => {
    setProva('');
    setEntries([]);
    setSkippedNonImage(0);
    setResults([]);
    setProcessedCount(0);
  };

  const progressPercent = entries.length > 0 ? Math.round((processedCount / entries.length) * 100) : 0;

  return (
    <div className="space-y-6">

      <div>
        <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
          <Images className="w-5 h-5 text-cyan-400" />
          Atualizar Imagens de Questões em Lote
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Envie uma pasta com várias imagens de uma vez — cada arquivo deve se chamar exatamente
          <code className="mx-1 px-1.5 py-0.5 rounded bg-slate-800 text-[11px] text-slate-300">&lt;idDaQuestão&gt;.jpeg</code>
          ou <code className="mx-1 px-1.5 py-0.5 rounded bg-slate-800 text-[11px] text-slate-300">.png</code>.
        </p>
      </div>

      {/* Passo 1: Fonte */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <h3 className="text-sm font-bold text-slate-100 mb-2">1. Qual a fonte dessas imagens?</h3>
        <p className="text-xs text-slate-400 mb-4">
          Usado para organizar o armazenamento por prova (ex.: <code className="text-slate-300">imagens_questoes/TEOT 2024/...</code>). Pode digitar um nome novo.
        </p>
        <input
          type="text"
          list="fonte-sugestoes"
          placeholder="Ex.: TEOT 2024, TARO 2022, BANCO PRÓPRIO..."
          value={prova}
          onChange={(e) => { setProva(e.target.value); setResults([]); }}
          disabled={processing}
          className="w-full max-w-md bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 disabled:opacity-60"
        />
        <datalist id="fonte-sugestoes">
          {FONTE_SUGESTOES.map((f) => <option key={f} value={f} />)}
        </datalist>
      </div>

      {/* Passo 2: Pasta */}
      <div className={`bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl transition-opacity ${!isReadyForFolder ? 'opacity-50 pointer-events-none' : ''}`}>
        <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 mb-2">
          <FolderOpen className="w-4 h-4 text-cyan-400" />
          2. Selecione a pasta com as imagens
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          Escolha a pasta inteira — o navegador vai listar todos os arquivos de imagem dentro dela automaticamente.
        </p>
        <input
          type="file"
          // @ts-expect-error: webkitdirectory não faz parte da tipagem padrão do React, mas é suportado pelos principais navegadores.
          webkitdirectory="true"
          directory=""
          multiple
          onChange={handleFolderChange}
          disabled={!isReadyForFolder || processing}
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-cyan-500/20 file:text-cyan-300 file:text-xs file:font-semibold disabled:opacity-60"
        />

        {entries.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-semibold">
              {entries.length} imagem(ns) encontrada(s)
            </span>
            {skippedNonImage > 0 && (
              <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-500 font-medium flex items-center gap-1.5">
                <ImageOff className="w-3.5 h-3.5" />
                {skippedNonImage} arquivo(s) ignorado(s) (não são .jpeg/.jpg/.png)
              </span>
            )}
          </div>
        )}
      </div>

      {/* Passo 3: Confirmação e execução */}
      {entries.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-100">3. Conferir e importar</h3>
            <span className="text-[11px] font-bold uppercase px-2.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
              Prova: {prova.trim()}
            </span>
          </div>

          {processing && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-300">
                <span>Processando imagens...</span>
                <span className="font-bold text-cyan-400">{processedCount} / {entries.length}</span>
              </div>
              <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="bg-cyan-500 h-full transition-all duration-200"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {results.length > 0 && (
            <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-800 divide-y divide-slate-800/80">
              {results.map((r, i) => (
                <div key={`${r.fileName}-${i}`} className="flex items-start gap-2.5 px-3 py-2 text-xs">
                  {r.status === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />}
                  {r.status === 'not_found' && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />}
                  {r.status === 'error' && <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />}
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-100 truncate">{r.fileName}</p>
                    <p className="text-[11px] text-slate-400">
                      {r.status === 'success' && `Vinculada à questão ${r.questionId}.`}
                      {r.status === 'not_found' && `Nenhuma questão com id "${r.questionId}" foi encontrada — arquivo não enviado.`}
                      {r.status === 'error' && (r.message || 'Falha ao enviar.')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!processing && results.length > 0 && (
            <div className="flex flex-wrap gap-3 text-xs">
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-semibold">
                {summary.success} vinculada(s)
              </span>
              {summary.notFound > 0 && (
                <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 font-semibold">
                  {summary.notFound} sem questão correspondente
                </span>
              )}
              {summary.error > 0 && (
                <span className="px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 font-semibold">
                  {summary.error} com erro
                </span>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            {results.length > 0 && !processing && (
              <button
                onClick={handleReset}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-800"
              >
                Começar de novo
              </button>
            )}
            <button
              onClick={handleStartImport}
              disabled={processing || results.length > 0}
              className="flex items-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-2.5 px-5 rounded-xl text-xs shadow-lg shadow-cyan-500/20 disabled:opacity-50"
            >
              {processing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Images className="w-4 h-4" />}
              <span>
                {processing
                  ? 'Importando...'
                  : results.length > 0
                    ? 'Importação concluída'
                    : `Importar ${entries.length} imagem(ns)`}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
