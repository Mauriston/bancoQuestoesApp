// Redimensiona uma imagem para um quadrado (recorte central) de `size` px, com
// boa qualidade: reduz em etapas de no máximo 2x (o redimensionamento direto
// de uma foto grande para poucos pixels, feito pelo navegador, costuma sair
// serrilhado/pixelado) e exporta em JPEG. Em qualquer falha devolve o arquivo
// original, para nunca bloquear o upload.
export async function resizeImageToSquare(file: File, size = 512, quality = 0.9): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const side = Math.min(bitmap.width, bitmap.height);
    // Já é pequena o bastante: não amplia nem recomprime.
    if (side <= size) {
      bitmap.close();
      return file;
    }
    const sx = (bitmap.width - side) / 2;
    const sy = (bitmap.height - side) / 2;

    let current: CanvasImageSource = bitmap;
    let curW = side;
    let curSx = sx;
    let curSy = sy;
    while (curW / 2 > size) {
      const next = Math.round(curW / 2);
      const step = document.createElement('canvas');
      step.width = next;
      step.height = next;
      const sctx = step.getContext('2d');
      if (!sctx) return file;
      sctx.imageSmoothingEnabled = true;
      sctx.imageSmoothingQuality = 'high';
      sctx.drawImage(current, curSx, curSy, curW, curW, 0, 0, next, next);
      current = step;
      curW = next;
      curSx = 0;
      curSy = 0;
    }

    const out = document.createElement('canvas');
    out.width = size;
    out.height = size;
    const ctx = out.getContext('2d');
    if (!ctx) return file;
    ctx.fillStyle = '#ffffff'; // PNG com transparência não vira preto no JPEG
    ctx.fillRect(0, 0, size, size);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(current, curSx, curSy, curW, curW, 0, 0, size, size);
    bitmap.close();

    const blob: Blob | null = await new Promise(resolve => out.toBlob(resolve, 'image/jpeg', quality));
    if (!blob) return file;
    return new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
