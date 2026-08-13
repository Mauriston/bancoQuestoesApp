import React, { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { TRAINING_SCHEDULE, TRAINING_SCHEDULE_NOTE, TrainingScheduleItem } from '../../constants';

const CATEGORY_STYLES: Record<TrainingScheduleItem['category'], { dot: string; badge: string; label: string }> = {
  traumatologia: { dot: 'bg-slate-100', badge: 'bg-slate-100/10 text-slate-100 border-slate-100/30', label: 'Traumatologia' },
  ortopedia: { dot: 'bg-[#079551]', badge: 'bg-[#079551]/10 text-[#079551] border-[#079551]/30', label: 'Ortopedia' },
  oncologia: { dot: 'bg-cyan-500', badge: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/30', label: 'Oncologia Ortopédica' },
};

const WEEKDAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MONTH_LABELS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

function parseBrDate(d: string): Date {
  const [day, month, year] = d.split('/').map(Number);
  return new Date(year, month - 1, day);
}

// Página estilo "Google Calendar" para o cronograma fixo do treinamento —
// sem CRUD administrativo (ver TRAINING_SCHEDULE em constants.ts, extraído
// da imagem de referência fornecida pelo usuário).
export const CronogramaPage: React.FC = () => {
  const eventsByDateKey = useMemo(() => {
    const map: Record<string, TrainingScheduleItem[]> = {};
    TRAINING_SCHEDULE.forEach(item => {
      const date = parseBrDate(item.date);
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      if (!map[key]) map[key] = [];
      map[key].push(item);
    });
    return map;
  }, []);

  const firstEventDate = parseBrDate(TRAINING_SCHEDULE[0].date);
  const [viewMonth, setViewMonth] = useState(firstEventDate.getMonth());
  const [viewYear, setViewYear] = useState(firstEventDate.getFullYear());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const goToMonth = (delta: number) => {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setViewMonth(m);
    setViewYear(y);
  };

  const calendarCells = useMemo(() => {
    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    const startOffset = firstOfMonth.getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: Array<{ day: number | null; key: string | null }> = [];
    for (let i = 0; i < startOffset; i++) cells.push({ day: null, key: null });
    for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, key: `${viewYear}-${viewMonth}-${d}` });
    while (cells.length % 7 !== 0) cells.push({ day: null, key: null });
    return cells;
  }, [viewMonth, viewYear]);

  const selectedEvents = selectedKey ? eventsByDateKey[selectedKey] || [] : [];

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-teal-400" />
          Cronograma
        </h1>
        <p className="text-xs text-slate-400 mt-1">Próximos eventos do Treinamento HMA TEOT 2027.</p>
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
        {(Object.keys(CATEGORY_STYLES) as TrainingScheduleItem['category'][]).map(cat => (
          <span key={cat} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${CATEGORY_STYLES[cat].dot}`} />
            {CATEGORY_STYLES[cat].label}
          </span>
        ))}
      </div>

      {/* Calendário mensal */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => goToMonth(-1)} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-100">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h2 className="text-sm font-bold text-slate-100">{MONTH_LABELS[viewMonth]} {viewYear}</h2>
          <button onClick={() => goToMonth(1)} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-100">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAY_LABELS.map((w, i) => (
            <div key={i} className="text-[10px] font-bold text-slate-500 uppercase pb-1">{w}</div>
          ))}
          {calendarCells.map((cell, idx) => {
            const events = cell.key ? eventsByDateKey[cell.key] : undefined;
            const hasEvents = !!events && events.length > 0;
            const isSelected = cell.key !== null && cell.key === selectedKey;
            return (
              <button
                key={idx}
                disabled={!cell.day}
                onClick={() => cell.key && setSelectedKey(cell.key === selectedKey ? null : cell.key)}
                className={`aspect-square rounded-lg text-xs flex flex-col items-center justify-center gap-0.5 transition-colors ${
                  !cell.day ? 'invisible' :
                  isSelected ? 'bg-cyan-500 text-slate-950 font-bold' :
                  hasEvents ? 'bg-slate-800 text-slate-100 font-semibold hover:bg-slate-700' :
                  'text-slate-500 hover:bg-slate-800/60'
                }`}
              >
                <span>{cell.day}</span>
                {hasEvents && (
                  <span className="flex gap-0.5">
                    {events!.slice(0, 3).map((ev, i) => (
                      <span key={i} className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-slate-950' : CATEGORY_STYLES[ev.category].dot}`} />
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Detalhe do dia selecionado */}
      {selectedEvents.length > 0 && (
        <div className="bg-slate-900 border border-cyan-500/30 rounded-2xl p-4 sm:p-6 shadow-xl space-y-3">
          <h3 className="text-sm font-bold text-slate-100">Eventos selecionados</h3>
          {selectedEvents.map(ev => (
            <div key={ev.n} className="flex items-start gap-3">
              <span className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${CATEGORY_STYLES[ev.category].dot}`} />
              <div>
                <p className="text-sm font-semibold text-slate-100">{ev.title} <span className="text-slate-400 font-normal">— {ev.subtitle}</span></p>
                <span className={`inline-flex items-center text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border mt-1 ${CATEGORY_STYLES[ev.category].badge}`}>
                  {CATEGORY_STYLES[ev.category].label}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lista completa (agenda) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <h3 className="text-sm font-bold text-slate-100 px-4 sm:px-6 pt-4 sm:pt-6">Programação Completa</h3>
        <div className="divide-y divide-slate-800/80 mt-2">
          {TRAINING_SCHEDULE.map(ev => (
            <div key={ev.n} className="p-4 sm:px-6 flex items-center gap-4">
              <div className="w-16 shrink-0 text-center">
                <p className="text-xs font-bold text-slate-100">{ev.date}</p>
              </div>
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${CATEGORY_STYLES[ev.category].dot}`} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-200 truncate">{ev.title} <span className="text-slate-400 font-normal">— {ev.subtitle}</span></p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-[11px] text-slate-500 italic text-center">{TRAINING_SCHEDULE_NOTE}</p>
    </div>
  );
};
