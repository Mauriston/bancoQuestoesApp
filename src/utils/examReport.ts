// Gera o "Relatório de Prova" em PDF a partir do template A4 (SBOT — Poppins
// + Nunito Sans, paleta teal/navy). Reaproveita a mesma estratégia de
// impressão do template original: monta um documento HTML autocontido numa
// nova aba e aciona window.print(), permitindo que o usuário salve como PDF
// pelo próprio navegador (sem depender de nenhuma lib de geração de PDF).

import { Attempt, Exam, ExamQuestion, AttemptAnswer, QuestionAnswer, Reference } from '../types';

export const APP_NAME = 'TEOT HMA 2027';
export const APP_TAGLINE = 'Treinamento e banco de questões TEOT/TARO do HMA.';

export interface ReportBreakdownArea {
  name: string;
  accuracy: number;
  correct: number;
  total: number;
}

export interface ReportBreakdownGroup {
  groupName: string;
  accuracy: number;
  correct: number;
  total: number;
}

export interface ReportBreakdownTheme {
  name: string;
  groupName?: string;
  accuracy: number;
  correct: number;
  total: number;
}

export interface ReportQuestion {
  source?: string;
  statement: string;
  imageUrl?: string;
  alternatives: { A: string; B: string; C: string; D: string };
  correctAlternative?: 'A' | 'B' | 'C' | 'D';
  selectedAlternative: 'A' | 'B' | 'C' | 'D' | null;
  comments?: string;
  commentMediaUrl?: string;
  referenceName?: string;
  referenceUrl?: string;
}

export interface ExamReportData {
  appName: string;
  appTagline: string;
  examName: string;
  userName: string;
  score: number;
  correctCount: number;
  totalQuestions: number;
  areaBreakdown: ReportBreakdownArea[];
  groupBreakdown: ReportBreakdownGroup[];
  themeBreakdown: ReportBreakdownTheme[];
  questions: ReportQuestion[];
}

const REPORT_CSS = `
:root{
  --teal-900:#17332E;--teal-700:#146B5E;--teal-600:#1E8C7C;--teal-500:#2F9C8C;--teal-100:#D8ECE8;
  --navy-900:#2C3A47;--grey-600:#6B7680;--grey-500:#8A9199;--grey-300:#D8DBDD;--grey-200:#E4E6E7;--grey-100:#F2F2F2;--white:#FFFFFF;
  --blue-700:#1F6E96;--orange-600:#F05400;
  --ok:#079551;--warn:#FFCB70;--bad:#E20018;--pending:#F05400;
  --ok-tint:rgba(7,149,81,.12);--bad-tint:rgba(226,0,24,.10);
  --ok-chip:rgba(7,149,81,.15);--bad-chip:rgba(226,0,24,.12);--pending-chip:rgba(240,84,0,.12);
  --border-subtle:var(--grey-300);--border-hairline:var(--grey-100);
  --surface-muted:var(--grey-100);--surface-alt:#FAFAFA;
  --cover-bg:#05413B;
  --font-display:'Poppins',system-ui,sans-serif;
  --font-body:'Nunito Sans',system-ui,sans-serif;
  --weight-regular:400;--weight-medium:500;--weight-semibold:600;--weight-bold:700;
  --size-h1:30px;--size-h2:26px;--size-h3:22px;--size-h4:18px;--size-h5:17px;
  --size-body:17px;--size-body-sm:15px;--size-ui:14px;--size-caption:13px;--size-meta:12px;--size-tab-sm:10px;
  --leading-tight:1.35;--leading-snug:1.4;--leading-normal:1.5;--leading-relaxed:1.6;
  --type-section:var(--weight-bold) var(--size-h4)/var(--leading-snug) var(--font-display);
  --radius-xs:8px;--radius-sm:12px;--radius-lg:18px;--radius-full:999px;
  --sheet-w:210mm;--sheet-h:297mm;--sheet-pad:16mm;
  --desk:#E7EBEA;--desk-ink:#2C3A47;--desk-ink-muted:#6B7680;--desk-line:#CFD6D4;--desk-chrome:rgba(255,255,255,.72);
}
@media (prefers-color-scheme:dark){
  :root:not([data-theme="light"]){
    --desk:#131C1A;--desk-ink:#E6EDEB;--desk-ink-muted:#93A19D;--desk-line:#2A3835;--desk-chrome:rgba(20,32,30,.72);
  }
}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{
  margin:0;background:var(--desk);color:var(--desk-ink);
  font:var(--weight-regular) var(--size-ui)/var(--leading-normal,1.5) var(--font-body);
  -webkit-font-smoothing:antialiased;
}
.toolbar{
  position:sticky;top:0;z-index:20;
  display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;
  padding:10px 20px;border-bottom:1px solid var(--desk-line);
  background:var(--desk-chrome);backdrop-filter:blur(10px);
}
.toolbar__id{display:flex;align-items:baseline;gap:10px;min-width:0}
.toolbar__title{font:var(--weight-semibold) var(--size-caption)/1.2 var(--font-display);letter-spacing:.4px;text-transform:uppercase;color:var(--desk-ink);margin:0}
.toolbar__meta{font:var(--weight-regular) var(--size-meta)/1.2 var(--font-body);color:var(--desk-ink-muted);margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.toolbar__actions{display:flex;align-items:center;gap:12px}
.hint{font:var(--weight-regular) var(--size-meta)/1.3 var(--font-body);color:var(--desk-ink-muted);margin:0}
.btn{
  font:var(--weight-semibold) var(--size-caption)/1 var(--font-display);
  color:var(--white);background:var(--teal-600);border:0;border-radius:var(--radius-full);
  padding:10px 18px;cursor:pointer;transition:background-color .12s cubic-bezier(.4,0,.2,1);
}
.btn:hover{background:var(--teal-700)}
.btn:focus-visible{outline:2px solid var(--teal-500);outline-offset:3px}
.desk{padding:28px 16px 56px;display:flex;justify-content:center}
.stage{transform-origin:top center}
.sheets{display:flex;flex-direction:column;align-items:center;gap:22px;width:var(--sheet-w)}
.sheet{
  width:var(--sheet-w);height:var(--sheet-h);
  display:flex;flex-direction:column;
  background:var(--white);color:var(--navy-900);
  overflow:hidden;position:relative;
  box-shadow:0 8px 28px rgba(23,51,46,.16);
  -webkit-print-color-adjust:exact;print-color-adjust:exact;
}
.sheet__body{flex:1 1 auto;min-height:0;overflow:hidden}
.fit{transform-origin:top left}
.runhead{
  flex:0 0 auto;display:flex;align-items:baseline;justify-content:space-between;gap:12px;
  margin:0 var(--sheet-pad);padding:10mm 0 12px;
  border-bottom:2px solid var(--border-subtle);
}
.runhead__exam{font:var(--weight-bold) var(--size-h5)/var(--leading-tight) var(--font-display);color:var(--navy-900);margin:0}
.runhead__user{font:var(--weight-regular) var(--size-caption)/var(--leading-snug) var(--font-body);color:var(--grey-600);margin:2px 0 0}
.runhead__tag{font:var(--weight-medium) var(--size-meta)/1.2 var(--font-display);color:var(--grey-500);margin:0;white-space:nowrap}
.runfoot{flex:0 0 auto;padding:0 var(--sheet-pad) 9mm;text-align:right}
.pageno{font:var(--weight-semibold) var(--size-caption)/1 var(--font-display);color:var(--grey-500);font-variant-numeric:tabular-nums}
.cover{
  flex:1 1 auto;display:flex;flex-direction:column;align-items:center;justify-content:center;
  padding:24mm 20mm;background:var(--cover-bg);position:relative;overflow:hidden;text-align:center;
}
.cover__glow{position:absolute;width:280px;height:280px;border-radius:var(--radius-full);filter:blur(60px);pointer-events:none}
.cover__glow--warm{top:-60px;left:-80px;background:rgba(255,203,112,.08)}
.cover__glow--cool{bottom:-60px;right:-80px;background:rgba(7,149,81,.12)}
.cover__inner{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;width:100%}
.cover__icon{width:96px;height:96px;border-radius:22px;object-fit:contain;box-shadow:0 12px 32px rgba(0,0,0,.35)}
.cover__app{font:var(--weight-bold) var(--size-h1)/1.2 var(--font-display);color:var(--white);letter-spacing:.2px;margin:20px 0 4px;text-wrap:balance}
.cover__tagline{font:var(--weight-regular) var(--size-body-sm)/var(--leading-snug) var(--font-body);color:rgba(255,255,255,.6);margin:0 0 56px}
.cover__id{width:100%;max-width:340px;display:flex;flex-direction:column;gap:20px}
.cover__exam{font:var(--weight-bold) var(--size-h3)/var(--leading-tight) var(--font-display);color:var(--white);margin:0;padding-bottom:18px;border-bottom:1px solid rgba(255,255,255,.15);text-wrap:balance}
.cover__user{font:var(--weight-semibold) var(--size-h4)/var(--leading-tight) var(--font-body);color:var(--white);margin:0}
.perf{padding:18px var(--sheet-pad) 0}
.scorecard{
  background:var(--surface-muted);border-radius:var(--radius-lg);
  padding:28px 32px;margin-bottom:28px;
  display:flex;align-items:center;justify-content:space-between;gap:16px;
}
.scorecard__exam{font:var(--weight-bold) var(--size-h2)/var(--leading-tight) var(--font-display);color:var(--navy-900);margin:0;text-wrap:balance}
.scorecard__count{font:var(--weight-regular) var(--size-body-sm)/var(--leading-snug) var(--font-body);color:var(--grey-600);margin:6px 0 0}
.scorecard__value{font:var(--weight-bold) 56px/1 var(--font-display);margin:0;flex-shrink:0;font-variant-numeric:tabular-nums}
.section-title{font:var(--type-section);color:var(--teal-600);text-transform:uppercase;letter-spacing:.5px;margin:0 0 14px}
.bars{display:flex;flex-direction:column;gap:10px;margin-bottom:26px}
.bar{display:grid;grid-template-columns:var(--label-w,130px) 1fr 44px;align-items:center;gap:10px}
.bar--wide{--label-w:170px}
.bar__name{font:var(--weight-semibold) var(--size-caption)/var(--leading-snug) var(--font-body);color:var(--navy-900)}
.bar__track{height:14px;background:var(--grey-100);border-radius:var(--radius-full);overflow:hidden}
.bar__fill{height:100%;border-radius:var(--radius-full)}
.bar__value{font:var(--weight-bold) var(--size-caption)/1 var(--font-display);text-align:right;font-variant-numeric:tabular-nums}
.themes{width:100%;border-collapse:collapse}
.themes th{
  font:var(--weight-bold) var(--size-meta)/1.2 var(--font-display);color:var(--grey-600);
  text-transform:uppercase;letter-spacing:.5px;text-align:left;
  padding:0 0 8px;border-bottom:1px solid var(--border-hairline);
}
.themes th:last-child,.themes td:last-child{text-align:right}
.themes td{
  font:var(--weight-regular) var(--size-caption)/var(--leading-snug) var(--font-body);color:var(--navy-900);
  padding:9px 0;border-bottom:1px solid var(--border-hairline);
}
.themes td.is-muted{color:var(--grey-600)}
.themes__pct{font:var(--weight-bold) var(--size-caption)/1 var(--font-display);font-variant-numeric:tabular-nums}
.themes__frac{font:var(--weight-regular) var(--size-meta)/1 var(--font-body);color:var(--grey-500);font-variant-numeric:tabular-nums}
.qpage{padding:16px var(--sheet-pad) var(--sheet-pad)}
.qpage .section-title{margin-bottom:20px}
.qhead{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}
.qhead__title{font:var(--weight-bold) var(--size-body)/var(--leading-tight) var(--font-display);color:var(--navy-900);margin:0}
.chips{display:flex;align-items:center;gap:8px}
.chip{
  font:var(--weight-bold) var(--size-meta)/1.3 var(--font-display);letter-spacing:.5px;text-transform:uppercase;
  padding:3px 10px;border-radius:var(--radius-full);white-space:nowrap;
}
.chip--source{color:var(--grey-600);background:var(--grey-100);border:1px solid var(--border-subtle)}
.statement{font:var(--weight-regular) var(--size-body)/var(--leading-relaxed) var(--font-body);color:var(--navy-900);white-space:pre-line;margin:0 0 14px}
.figure{margin:0 0 16px;text-align:center}
.figure img{max-width:100%;max-height:76mm;object-fit:contain;border-radius:var(--radius-sm);border:1px solid var(--border-subtle)}
.alts{display:flex;flex-direction:column;gap:8px;margin-bottom:18px}
.alt{display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border-radius:var(--radius-xs);border:1px solid var(--border-subtle);background:var(--surface-alt)}
.alt__key{
  width:22px;height:22px;flex-shrink:0;border-radius:6px;background:var(--grey-500);
  display:flex;align-items:center;justify-content:center;
  font:var(--weight-bold) var(--size-meta)/1 var(--font-display);color:var(--white);
}
.alt__text{flex:1;font:var(--weight-regular) var(--size-caption)/1.5 var(--font-body);color:var(--navy-900)}
.alt__tag{flex-shrink:0;font:var(--weight-bold) var(--size-tab-sm)/1.3 var(--font-display);letter-spacing:.5px;text-transform:uppercase;color:var(--grey-500)}
.alt.is-correct{background:var(--ok-tint);border-color:var(--ok)}
.alt.is-correct .alt__key{background:var(--ok)}
.alt.is-correct .alt__tag{color:var(--ok)}
.alt.is-correct .alt__text{font-weight:var(--weight-bold)}
.alt.is-wrong{background:var(--bad-tint);border-color:var(--bad)}
.alt.is-wrong .alt__key{background:var(--bad)}
.alt.is-wrong .alt__tag{color:var(--bad)}
.alt.is-wrong .alt__text{font-weight:var(--weight-bold)}
.notes{background:var(--surface-muted);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:16px 18px}
.notes__label{font:var(--weight-bold) var(--size-caption)/1.3 var(--font-display);letter-spacing:.5px;text-transform:uppercase;color:var(--teal-700);margin:0 0 8px}
.notes__answer{font:var(--weight-bold) var(--size-caption)/var(--leading-snug) var(--font-body);color:var(--teal-700);margin:0 0 8px}
.notes__text{font:var(--weight-regular) var(--size-caption)/var(--leading-relaxed) var(--font-body);color:var(--navy-900);white-space:pre-line;margin:0}
.notes__figure{margin:12px 0 0;text-align:center}
.notes__figure img{max-width:100%;max-height:58mm;object-fit:contain;border-radius:var(--radius-sm);border:1px solid var(--border-subtle)}
.notes__ref{font:var(--weight-regular) var(--size-caption)/var(--leading-snug) var(--font-body);color:var(--navy-900);margin:12px 0 0}
.notes__ref a{color:var(--teal-600)}
.video{margin:12px 0 0;max-width:360px}
.video__link{display:block;position:relative;border-radius:var(--radius-sm);overflow:hidden;border:1px solid var(--border-subtle);background:#1B1B1B;aspect-ratio:16/9}
.video__link:focus-visible{outline:2px solid var(--teal-500);outline-offset:2px}
.video__thumb{width:100%;height:100%;object-fit:cover;display:block}
.video__play{
  position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
  width:56px;height:40px;border-radius:12px;background:#FF0000;
  display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.35);
}
.video__play::after{content:"";width:0;height:0;margin-left:4px;border-top:10px solid transparent;border-bottom:10px solid transparent;border-left:16px solid var(--white)}
.video__caption{font:var(--weight-regular) var(--size-meta)/1.4 var(--font-body);color:var(--grey-600);text-align:center;margin:6px 0 0}
@page{size:A4 portrait;margin:0}
@media print{
  html,body{background:var(--white);margin:0;padding:0}
  .toolbar{display:none}
  .desk{padding:0;display:block}
  .stage{transform:none!important;width:auto!important;height:auto!important}
  .sheets{gap:0;width:auto}
  .sheet{height:296.5mm;box-shadow:none;break-after:page;page-break-after:always}
  .sheet:last-child{break-after:auto;page-break-after:auto}
}
@media (prefers-reduced-motion:reduce){
  *{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}
}
`;

// Corpo do script de renderização, executado dentro da nova aba. Escrito
// como string (em vez de import) porque roda num `document` isolado, criado
// via window.open + document.write — não compartilha o bundle/módulos da
// SPA. `__ICON__` e `__DADOS__` são substituídos abaixo antes de injetar.
const REPORT_SCRIPT = `
(function () {
  "use strict";
  var ICON = "__ICON__";
  var DADOS = __DADOS__;

  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function scoreColor(score) {
    if (score < 50) return "var(--bad)";
    if (score < 60) return "var(--warn)";
    return "var(--ok)";
  }

  function youtubeId(url) {
    if (!url) return null;
    try {
      var u = new URL(url, "https://example.invalid");
      var host = u.hostname.replace(/^www\\.|^m\\./, "");
      if (host === "youtu.be") return u.pathname.slice(1) || null;
      if (host === "youtube.com") {
        if (u.pathname === "/watch") return u.searchParams.get("v");
        var m = u.pathname.match(/^\\/(embed|shorts|live)\\/([^/?#]+)/);
        if (m) return m[2];
      }
    } catch (e) { /* url inválida — trata como não-vídeo */ }
    return null;
  }

  function coverSheet(d) {
    return '' +
      '<section class="sheet">' +
        '<div class="cover">' +
          '<span class="cover__glow cover__glow--warm"></span>' +
          '<span class="cover__glow cover__glow--cool"></span>' +
          '<div class="cover__inner">' +
            '<img class="cover__icon" src="' + esc(ICON) + '" alt="">' +
            '<h1 class="cover__app">' + esc(d.appName) + '</h1>' +
            '<p class="cover__tagline">' + esc(d.appTagline) + '</p>' +
            '<div class="cover__id">' +
              '<p class="cover__exam">' + esc(d.examName) + '</p>' +
              '<p class="cover__user">' + esc(d.userName) + '</p>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</section>';
  }

  function runhead(d, tag) {
    return '' +
      '<header class="runhead">' +
        '<div>' +
          '<p class="runhead__exam">' + esc(d.examName) + '</p>' +
          '<p class="runhead__user">' + esc(d.userName) + '</p>' +
        '</div>' +
        (tag ? '<p class="runhead__tag">' + esc(tag) + '</p>' : '') +
      '</header>';
  }

  function runfoot(n) {
    return '<footer class="runfoot"><span class="pageno">' + n + '</span></footer>';
  }

  function barRow(name, accuracy, wide) {
    var color = scoreColor(accuracy);
    return '' +
      '<div class="bar' + (wide ? ' bar--wide' : '') + '">' +
        '<span class="bar__name">' + esc(name) + '</span>' +
        '<div class="bar__track"><div class="bar__fill" style="width:' + Math.max(0, Math.min(100, accuracy)) + '%;background:' + color + '"></div></div>' +
        '<span class="bar__value" style="color:' + color + '">' + accuracy + '%</span>' +
      '</div>';
  }

  function performanceSheet(d, pageNo) {
    var areas = d.areaBreakdown || [];
    var groups = d.groupBreakdown || [];
    var themes = d.themeBreakdown || [];

    var themeRows = themes.map(function (t) {
      return '' +
        '<tr>' +
          '<td>' + esc(t.name) + '</td>' +
          '<td class="is-muted">' + esc(t.groupName) + '</td>' +
          '<td>' +
            '<span class="themes__pct" style="color:' + scoreColor(t.accuracy) + '">' + t.accuracy + '%</span>' +
            '<span class="themes__frac"> (' + t.correct + '/' + t.total + ')</span>' +
          '</td>' +
        '</tr>';
    }).join('');

    return '' +
      '<section class="sheet">' +
        runhead(d, 'Relatório de desempenho') +
        '<div class="sheet__body"><div class="fit"><div class="perf">' +
          '<div class="scorecard">' +
            '<div>' +
              '<p class="scorecard__exam">' + esc(d.examName) + '</p>' +
              '<p class="scorecard__count">' + d.correctCount + ' de ' + d.totalQuestions + ' questões corretas</p>' +
            '</div>' +
            '<p class="scorecard__value" style="color:' + scoreColor(d.score) + '">' + d.score + '%</p>' +
          '</div>' +

          (areas.length ? '<h2 class="section-title">Desempenho por área</h2><div class="bars">' +
            areas.map(function (a) { return barRow(a.name, a.accuracy, false); }).join('') +
          '</div>' : '') +

          (groups.length ? '<h2 class="section-title">Desempenho por grupo</h2><div class="bars">' +
            groups.map(function (g) { return barRow(g.groupName, g.accuracy, true); }).join('') +
          '</div>' : '') +

          (themes.length ? '<h2 class="section-title">Desempenho por temas</h2>' +
          '<table class="themes">' +
            '<thead><tr><th scope="col">Tema</th><th scope="col">Grupo</th><th scope="col">Aproveitamento</th></tr></thead>' +
            '<tbody>' + themeRows + '</tbody>' +
          '</table>' : '') +
        '</div></div></div>' +
        runfoot(pageNo) +
      '</section>';
  }

  function altRow(key, text, correctKey, selectedKey) {
    var isCorrect = key === correctKey;
    var isWrong = key === selectedKey && !isCorrect;
    var cls = isCorrect ? " is-correct" : isWrong ? " is-wrong" : "";
    var tag = isCorrect ? "Gabarito" : isWrong ? "Sua escolha" : "";
    return '' +
      '<div class="alt' + cls + '">' +
        '<span class="alt__key">' + key + '</span>' +
        '<span class="alt__text">' + esc(text) + '</span>' +
        (tag ? '<span class="alt__tag">' + tag + '</span>' : '') +
      '</div>';
  }

  function questionSheet(d, q, number, pageNo, first) {
    var acertou = q.selectedAlternative && q.selectedAlternative === q.correctAlternative;
    var statusLabel = acertou ? "Correta" : q.selectedAlternative ? "Incorreta" : "Não respondida";
    var statusStyle = acertou
      ? "color:var(--ok);background:var(--ok-chip)"
      : q.selectedAlternative
        ? "color:var(--bad);background:var(--bad-chip)"
        : "color:var(--pending);background:var(--pending-chip)";

    var alts = ["A", "B", "C", "D"]
      .filter(function (k) { return q.alternatives && q.alternatives[k]; })
      .map(function (k) { return altRow(k, q.alternatives[k], q.correctAlternative, q.selectedAlternative); })
      .join('');

    var ytId = youtubeId(q.commentMediaUrl);
    var hasImageMedia = !!q.commentMediaUrl && !ytId;
    var hasNotes = !!(q.comments || q.commentMediaUrl || q.correctAlternative);

    var notes = '';
    if (hasNotes) {
      notes = '<div class="notes">' +
        '<p class="notes__label">Comentários</p>' +
        (q.correctAlternative ? '<p class="notes__answer">Gabarito: ' + esc(q.correctAlternative) + '</p>' : '') +
        (q.comments ? '<p class="notes__text">' + esc(q.comments) + '</p>' : '') +
        (ytId
          ? '<div class="video">' +
              '<a class="video__link" href="' + esc(q.commentMediaUrl) + '" target="_blank" rel="noopener noreferrer">' +
                '<img class="video__thumb" src="https://img.youtube.com/vi/' + esc(ytId) + '/hqdefault.jpg" alt="" data-hide-on-error>' +
                '<span class="video__play"></span>' +
              '</a>' +
              '<p class="video__caption">Clique na imagem para ver no YouTube</p>' +
            '</div>'
          : '') +
        (hasImageMedia
          ? '<div class="notes__figure"><img src="' + esc(q.commentMediaUrl) + '" alt="Mídia do comentário" data-drop-on-error></div>'
          : '') +
        (q.referenceName
          ? '<p class="notes__ref">Fonte: ' + (q.referenceUrl
              ? '<a href="' + esc(q.referenceUrl) + '" target="_blank" rel="noopener noreferrer">' + esc(q.referenceName) + '</a>'
              : esc(q.referenceName)) + '</p>'
          : '') +
      '</div>';
    }

    return '' +
      '<section class="sheet">' +
        runhead(d, '') +
        '<div class="sheet__body"><div class="fit"><div class="qpage">' +
          (first ? '<h2 class="section-title">Questões, gabaritos e comentários</h2>' : '') +
          '<div class="qhead">' +
            '<p class="qhead__title">Questão ' + number + '</p>' +
            '<div class="chips">' +
              (q.source ? '<span class="chip chip--source">' + esc(q.source) + '</span>' : '') +
              '<span class="chip" style="' + statusStyle + '">' + statusLabel + '</span>' +
            '</div>' +
          '</div>' +
          '<p class="statement">' + esc(q.statement) + '</p>' +
          (q.imageUrl ? '<div class="figure"><img src="' + esc(q.imageUrl) + '" alt="Imagem da questão" data-drop-on-error></div>' : '') +
          '<div class="alts">' + alts + '</div>' +
          notes +
        '</div></div></div>' +
        runfoot(pageNo) +
      '</section>';
  }

  var MIN_FIT = 0.62;

  function fitOne(fit) {
    var available = fit.parentElement.clientHeight;
    if (!available) return;

    function heightAt(scale) {
      if (scale === 1) {
        fit.style.transform = "";
        fit.style.width = "";
      } else {
        fit.style.transform = "scale(" + scale + ")";
        fit.style.width = (100 / scale) + "%";
      }
      return fit.scrollHeight * scale;
    }

    if (heightAt(1) <= available) return;

    var lo = MIN_FIT, hi = 1;
    for (var pass = 0; pass < 6; pass++) {
      var mid = (lo + hi) / 2;
      if (heightAt(mid) <= available) lo = mid; else hi = mid;
    }
    heightAt(lo);
  }

  function fitSheets(root) {
    root.querySelectorAll(".fit").forEach(fitOne);
  }

  function renderRelatorio(d) {
    var questions = d.questions || [];
    var page = 1;

    var html = coverSheet(d) + performanceSheet(d, ++page);
    questions.forEach(function (q, i) {
      html += questionSheet(d, q, i + 1, ++page, i === 0);
    });

    var sheets = document.getElementById("sheets");
    sheets.innerHTML = html;

    document.getElementById("toolbar-meta").textContent =
      d.examName + " · " + d.userName + " · " + page + " páginas";

    sheets.querySelectorAll("[data-hide-on-error]").forEach(function (img) {
      img.addEventListener("error", function () { img.style.visibility = "hidden"; });
    });
    sheets.querySelectorAll("[data-drop-on-error]").forEach(function (img) {
      img.addEventListener("error", function () {
        var fig = img.closest(".figure, .notes__figure");
        if (fig) fig.remove();
        fitSheets(sheets);
      });
    });

    fitSheets(sheets);
    scaleStage();
  }

  var SHEET_PX = 794;

  function scaleStage() {
    var stage = document.getElementById("stage");
    var desk = stage.parentElement;
    var scale = Math.min(1, (desk.clientWidth - 32) / SHEET_PX);
    if (scale >= 1) {
      stage.style.transform = "";
      stage.style.height = "";
      return;
    }
    stage.style.transform = "scale(" + scale + ")";
    stage.style.height = (stage.firstElementChild.offsetHeight * scale) + "px";
  }

  window.addEventListener("resize", scaleStage);
  document.fonts && document.fonts.ready.then(function () {
    fitSheets(document.getElementById("sheets"));
    scaleStage();
  });

  document.getElementById("print-btn").addEventListener("click", function () {
    window.print();
  });

  renderRelatorio(DADOS);
})();
`;

function buildReportDocument(data: ExamReportData): string {
  const iconUrl = `${window.location.origin}/icons/icon-512.png`;
  const script = REPORT_SCRIPT
    .replace('__ICON__', iconUrl)
    .replace('__DADOS__', JSON.stringify(data));

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Relatório de Prova — ${escapeHtml(data.examName)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=Nunito+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>${REPORT_CSS}</style>
</head>
<body>
<div class="toolbar">
  <div class="toolbar__id">
    <p class="toolbar__title">Relatório de Prova</p>
    <p class="toolbar__meta" id="toolbar-meta"></p>
  </div>
  <div class="toolbar__actions">
    <p class="hint">A4 retrato &middot; margens “Nenhuma” &middot; gráficos de fundo ativados</p>
    <button class="btn" type="button" id="print-btn">Salvar em PDF</button>
  </div>
</div>
<main class="desk">
  <div class="stage" id="stage">
    <div class="sheets" id="sheets"></div>
  </div>
</main>
<script>${script}</script>
</body>
</html>`;
}

function escapeHtml(v: string): string {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export interface BuildExamReportArgs {
  attempt: Attempt;
  exam: Exam | null;
  questions: ExamQuestion[];
  answers: Record<string, AttemptAnswer>;
  answerKeys: Record<string, QuestionAnswer>;
  sourceExamById: Record<string, string>;
  references: Reference[];
  areaBreakdown: { name: string; accuracy: number; correct: number; total: number }[];
  groupBreakdown: { groupName: string; accuracy: number; correct: number; total: number }[];
  themeBreakdown: { name: string; groupName?: string; accuracy: number; correct: number; total: number }[];
}

// Monta o payload do relatório com os dados já carregados em ExamResultPage
// — nenhuma nova leitura ao Firestore é necessária. Segue exatamente o
// mesmo mapeamento usado na revisão de questões em tela (ver
// ExamResultPage.tsx), então o PDF reflete fielmente o que o candidato vê.
export function buildExamReportData(args: BuildExamReportArgs): ExamReportData {
  const { attempt, exam, questions, answers, answerKeys, sourceExamById, references, areaBreakdown, groupBreakdown, themeBreakdown } = args;

  const reportQuestions: ReportQuestion[] = exam?.allowReviewAfterFinish !== false
    ? questions.map((q): ReportQuestion => {
        const userAns = answers[q.id];
        const key = answerKeys[q.originalQuestionId];
        const reference = key?.referenceId ? references.find(r => r.id === key.referenceId) : undefined;
        return {
          source: sourceExamById[q.originalQuestionId],
          statement: q.statement,
          imageUrl: q.imageUrl,
          alternatives: q.alternatives,
          correctAlternative: key?.correctAlternative,
          selectedAlternative: userAns?.selectedAlternative ?? null,
          comments: key?.comments,
          commentMediaUrl: key?.commentMediaUrl,
          referenceName: reference?.referenceName,
          referenceUrl: reference?.referenceUrlDownload,
        };
      })
    : [];

  return {
    appName: APP_NAME,
    appTagline: APP_TAGLINE,
    examName: attempt.examName || exam?.name || 'Simulado',
    userName: attempt.userName || 'Candidato',
    score: attempt.scorePercentage || 0,
    correctCount: attempt.correctAnswers || 0,
    totalQuestions: attempt.totalQuestions,
    areaBreakdown,
    groupBreakdown,
    themeBreakdown: themeBreakdown.map(t => ({ ...t, groupName: t.groupName || '' })),
    questions: reportQuestions,
  };
}

// Abre o relatório numa nova aba e injeta o HTML pronto para impressão. Deve
// ser chamado diretamente a partir de um handler de clique do usuário —
// alguns navegadores bloqueiam window.open() fora desse contexto.
export function openExamReport(data: ExamReportData): void {
  const win = window.open('', '_blank');
  if (!win) {
    alert('Não foi possível abrir o relatório. Verifique se o navegador está bloqueando pop-ups para este site.');
    return;
  }
  win.document.open();
  win.document.write(buildReportDocument(data));
  win.document.close();
}
