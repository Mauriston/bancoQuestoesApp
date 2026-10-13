// Atualização automática do app instalado (PWA "adicionar à tela de início").
//
// No iPhone o app pode ficar dias em segundo plano com o JavaScript antigo
// ainda carregado, então um deploy novo não aparece até o app ser fechado à
// força. Aqui comparamos o __BUILD_ID__ embutido neste bundle com o
// /version.json publicado no servidor (sempre sem cache) quando o app abre,
// volta ao primeiro plano ou a cada 15 minutos; se diferirem, recarrega.
//
// Não recarrega durante a execução de uma prova (/app/exams/:id) para não
// interromper o candidato — tenta de novo no próximo gatilho.
const CHECK_INTERVAL_MS = 15 * 60 * 1000;

function isTakingExam(): boolean {
  return /^\/app\/exams\/[^/]+$/.test(window.location.pathname);
}

async function checkForNewVersion(): Promise<void> {
  if (isTakingExam()) return;
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    if (data?.buildId && data.buildId !== __BUILD_ID__) {
      window.location.reload();
    }
  } catch {
    // Sem rede ou arquivo ausente: ignora e tenta no próximo gatilho.
  }
}

export function startVersionCheck(): void {
  if (import.meta.env.DEV) return;
  window.setTimeout(checkForNewVersion, 3000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForNewVersion();
  });
  window.addEventListener('pageshow', (e) => {
    if ((e as PageTransitionEvent).persisted) checkForNewVersion();
  });
  window.setInterval(checkForNewVersion, CHECK_INTERVAL_MS);
}
