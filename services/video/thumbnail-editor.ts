export type ThumbnailLayout = "split" | "banner" | "center";

type FrameSource =
  | HTMLVideoElement
  | HTMLImageElement
  | HTMLCanvasElement
  | null;

const WIDTH = 1280;
const HEIGHT = 720;

function sourceSize(source: FrameSource) {
  if (!source) return null;

  if (source instanceof HTMLVideoElement) {
    if (!source.videoWidth || !source.videoHeight) return null;
    return { width: source.videoWidth, height: source.videoHeight };
  }

  if (source instanceof HTMLImageElement) {
    if (!source.naturalWidth || !source.naturalHeight) return null;
    return { width: source.naturalWidth, height: source.naturalHeight };
  }

  return { width: source.width, height: source.height };
}

function drawCover(
  context: CanvasRenderingContext2D,
  source: FrameSource,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const size = sourceSize(source);
  if (!source || !size) return;

  const scale = Math.max(width / size.width, height / size.height);
  const drawWidth = size.width * scale;
  const drawHeight = size.height * scale;

  context.save();
  context.beginPath();
  context.rect(x, y, width, height);
  context.clip();
  context.drawImage(
    source,
    x + (width - drawWidth) / 2,
    y + (height - drawHeight) / 2,
    drawWidth,
    drawHeight
  );
  context.restore();
}

function wrapLines(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;
    if (context.measureText(candidate).width <= maxWidth || !current) {
      current = candidate;
      return;
    }

    lines.push(current);
    current = word;
  });

  if (current) lines.push(current);
  return lines;
}

function fitText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxHeight: number,
  maxSize: number,
  minSize: number
) {
  for (let size = maxSize; size >= minSize; size -= 4) {
    context.font = `900 ${size}px "Arial Black", Impact, sans-serif`;
    const lines = wrapLines(context, text, maxWidth);
    const lineHeight = size * 1.06;

    if (lines.length * lineHeight <= maxHeight) {
      return { size, lines, lineHeight };
    }
  }

  context.font = `900 ${minSize}px "Arial Black", Impact, sans-serif`;
  const lines = wrapLines(context, text, maxWidth).slice(0, 4);
  return { size: minSize, lines, lineHeight: minSize * 1.06 };
}

function drawLines(
  context: CanvasRenderingContext2D,
  lines: string[],
  lineHeight: number,
  x: number,
  top: number,
  align: CanvasTextAlign
) {
  context.textAlign = align;
  context.textBaseline = "top";
  lines.forEach((line, index) => {
    context.fillText(line, x, top + index * lineHeight);
  });
}

export function renderThumbnailPreview(
  canvas: HTMLCanvasElement,
  image: FrameSource,
  text: string,
  layout: ThumbnailLayout,
  bgColor: string,
  textColor: string
) {
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) return;

  context.clearRect(0, 0, WIDTH, HEIGHT);
  context.fillStyle = bgColor;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  const headline = text.trim();
  context.fillStyle = textColor;

  if (layout === "split") {
    drawCover(context, image, WIDTH * 0.46, 0, WIDTH * 0.54, HEIGHT);

    const maxWidth = WIDTH * 0.37;
    const maxHeight = HEIGHT * 0.72;
    if (headline) {
      const { lines, lineHeight } = fitText(
        context,
        headline,
        maxWidth,
        maxHeight,
        112,
        48
      );
      const blockHeight = lines.length * lineHeight;
      drawLines(
        context,
        lines,
        lineHeight,
        WIDTH * 0.055,
        (HEIGHT - blockHeight) / 2,
        "left"
      );
    }
    return;
  }

  if (layout === "banner") {
    drawCover(context, image, 0, 0, WIDTH, HEIGHT);

    const bannerTop = HEIGHT * 0.7;
    context.fillStyle = bgColor;
    context.fillRect(0, bannerTop, WIDTH, HEIGHT - bannerTop);

    if (headline) {
      context.fillStyle = textColor;
      const maxWidth = WIDTH * 0.9;
      const maxHeight = HEIGHT * 0.26;
      const { size, lines, lineHeight } = fitText(
        context,
        headline,
        maxWidth,
        maxHeight,
        92,
        36
      );
      const blockHeight = lines.length * lineHeight;
      drawLines(
        context,
        lines,
        lineHeight,
        WIDTH / 2,
        bannerTop + (HEIGHT - bannerTop - blockHeight) / 2,
        "center"
      );
      context.font = `900 ${size}px "Arial Black", Impact, sans-serif`;
    }
    return;
  }

  drawCover(context, image, 0, 0, WIDTH, HEIGHT);
  context.fillStyle = bgColor;
  context.globalAlpha = 0.45;
  context.fillRect(0, 0, WIDTH, HEIGHT);
  context.globalAlpha = 1;

  if (headline) {
    context.fillStyle = textColor;
    context.shadowColor = "rgba(0,0,0,0.55)";
    context.shadowBlur = 24;
    context.shadowOffsetY = 6;

    const maxWidth = WIDTH * 0.82;
    const maxHeight = HEIGHT * 0.68;
    const { lines, lineHeight } = fitText(
      context,
      headline,
      maxWidth,
      maxHeight,
      124,
      52
    );
    const blockHeight = lines.length * lineHeight;
    drawLines(
      context,
      lines,
      lineHeight,
      WIDTH / 2,
      (HEIGHT - blockHeight) / 2,
      "center"
    );

    context.shadowColor = "transparent";
    context.shadowBlur = 0;
    context.shadowOffsetY = 0;
  }
}
