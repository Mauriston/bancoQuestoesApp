import React, { useState } from 'react';
import Papa from 'papaparse';
import { UploadCloud, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getAreas, getThemes, createVideotecaItem, createAulaItem } from '../services/firebaseService';

interface CsvRow {
  titulo: string;
  area: string;
  tema: string;
  url: string;
}

interface CsvBulkImportSectionProps {
  materialType: 'video' | 'aula';
  title: string;
  description: string;
}

// Envio em lote de materiais da Videoteca/Aulas via CSV (colunas: titulo,
// area, tema, url) — não existia parser CSV no projeto (só import JSON),
// então usa papaparse. Segue o mesmo padrão visual de preview + confirmação
// das outras seções desta página (ver ImportPage.tsx).
export const CsvBulkImportSection: React.FC<CsvBulkImportSectionProps> = ({ materialType, title, description }) => {
  const { currentUser } = useAuth();
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: string[] } | null>(null);
  const [error, setError] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    setError('');

    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: (res) => {
        const parsed = (res.data || []).filter(r => r.titulo && r.area && r.tema && r.url);
        setRows(parsed);
      },
      error: (err) => setError(`Erro ao ler o CSV: ${err.message}`)
    });
  };

  const handleImport = async () => {
    if (!rows.length || !currentUser) return;
    setImporting(true);
    setError('');
    const skipped: string[] = [];
    let created = 0;
    try {
      const [areas, themes] = await Promise.all([getAreas(), getThemes()]);
      for (const row of rows) {
        const area = areas.find(a => a.name.trim().toLowerCase() === row.area.trim().toLowerCase());
        const theme = themes.find(t => t.name.trim().toLowerCase() === row.tema.trim().toLowerCase() && (!area || t.areaId === area.id));
        if (!area || !theme) {
          skipped.push(`${row.titulo} (área/tema não encontrado: ${row.area} / ${row.tema})`);
          continue;
        }
        const payload = {
          title: row.titulo, areaId: area.id, areaName: area.name, themeId: theme.id, themeName: theme.name,
          url: row.url, createdBy: currentUser.id
        };
        if (materialType === 'video') await createVideotecaItem(payload);
        else await createAulaItem(payload);
        created += 1;
      }
      setResult({ created, skipped });
      setRows([]);
      setFileName('');
    } catch (err: any) {
      setError(err.message || 'Erro desconhecido ao importar.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
      <h3 className="text-sm font-bold text-[#050f41] flex items-center gap-2">
        <UploadCloud className="w-4 h-4 text-cyan-400" />
        {title}
      </h3>
      <p className="text-xs text-slate-400">{description} Colunas esperadas: <code className="text-teal-400">titulo, area, tema, url</code>.</p>

      <input
        type="file"
        accept=".csv"
        onChange={handleFileChange}
        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300"
      />

      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {rows.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-slate-400">{fileName}: <strong className="text-cyan-400">{rows.length}</strong> linha(s) válida(s) prontas para importar.</p>
          <div className="flex justify-end">
            <button
              onClick={handleImport}
              disabled={importing}
              className="flex items-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-2 px-4 rounded-xl text-xs shadow-lg shadow-cyan-500/20 disabled:opacity-50"
            >
              {importing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
              {importing ? 'Importando...' : 'Importar CSV'}
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p>{result.created} material(is) importado(s) com sucesso.</p>
            {result.skipped.length > 0 && (
              <ul className="mt-1.5 text-amber-300/90 space-y-0.5">
                {result.skipped.map((s, i) => <li key={i}>• {s}</li>)}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
