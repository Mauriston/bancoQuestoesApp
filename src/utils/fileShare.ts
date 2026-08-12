// Nome de arquivo seguro a partir de um título livre — remove caracteres
// problemáticos em qualquer SO (Windows inclusive, já que o app roda em
// navegadores desktop também) e colapsa espaços repetidos.
export function toSafeFileName(title: string, extension: string): string {
  const cleaned = (title || 'arquivo').trim().replace(/[/\\:*?"<>|]/g, '-').replace(/\s+/g, ' ');
  return `${cleaned}.${extension}`;
}

// Baixa um arquivo remoto e abre a folha nativa de compartilhamento do
// dispositivo (Web Share API) com o nome de arquivo desejado — em vez do
// nome gerado pelo servidor de origem (ex.: o ID de exportação do Google
// Slides). Em navegadores/dispositivos sem suporte a compartilhar arquivos
// (a maioria dos desktops), cai para um download comum com o mesmo nome.
// Se o fetch falhar (ex.: bloqueio de CORS do servidor de origem), cai para
// simplesmente abrir a URL original em nova aba — o usuário ainda consegue
// baixar o arquivo, só que com o nome padrão do servidor.
export async function shareOrDownloadFile(url: string, filename: string, mimeType = 'application/pdf'): Promise<void> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Falha ao baixar arquivo (HTTP ${response.status}).`);
    const blob = await response.blob();
    const file = new File([blob], filename, { type: mimeType });

    const nav = navigator as Navigator & { canShare?: (data?: any) => boolean; share?: (data: any) => Promise<void> };
    if (nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
      await nav.share({ files: [file], title: filename });
      return;
    }

    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  } catch (err) {
    // AbortError acontece quando o usuário simplesmente cancela a folha de
    // compartilhamento — não é uma falha real, não precisa de fallback.
    if (err instanceof DOMException && err.name === 'AbortError') return;
    console.warn('Não foi possível gerar o compartilhamento com nome customizado, abrindo o link direto:', err);
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
