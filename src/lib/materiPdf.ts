import { jsPDF } from 'jspdf';
import { MateriAjarInfografis, UserProfile } from '../store/useStore';
import { getTemplateOption } from './materiTemplates';

export const PDF_PAGE_W = 1654; // A4 @ 200 DPI
export const PDF_PAGE_H = 2339; // A4 @ 200 DPI

interface ThemePalette {
  name: string;
  canvasBg: string;
  headerStart: string;
  headerEnd: string;
  primary: string;
  primaryDark: string;
  primarySoft: string;
  primaryBorder: string;
  accent: string;
  accentSoft: string;
  accentBorder: string;
  accentText: string;
  secondarySoft: string;
  secondaryBorder: string;
  secondaryText: string;
  textMain: string;
  textMuted: string;
}

export const INFOGRAFIS_THEMES: Record<MateriAjarInfografis['temaWarna'], ThemePalette> = {
  emerald: {
    name: 'Zamrud Islami',
    canvasBg: '#F4F9F7',
    headerStart: '#065F46',
    headerEnd: '#0D9488',
    primary: '#059669',
    primaryDark: '#064E3B',
    primarySoft: '#ECFDF5',
    primaryBorder: '#A7F3D0',
    accent: '#D97706',
    accentSoft: '#FFFBEB',
    accentBorder: '#FDE68A',
    accentText: '#92400E',
    secondarySoft: '#F0F9FF',
    secondaryBorder: '#BAE6FD',
    secondaryText: '#075985',
    textMain: '#0F172A',
    textMuted: '#475569',
  },
  sky: {
    name: 'Langit Cerah',
    canvasBg: '#F2F8FD',
    headerStart: '#075985',
    headerEnd: '#0284C7',
    primary: '#0284C7',
    primaryDark: '#0C4A6E',
    primarySoft: '#F0F9FF',
    primaryBorder: '#BAE6FD',
    accent: '#EA580C',
    accentSoft: '#FFF7ED',
    accentBorder: '#FED7AA',
    accentText: '#9A3412',
    secondarySoft: '#ECFDF5',
    secondaryBorder: '#A7F3D0',
    secondaryText: '#065F46',
    textMain: '#0F172A',
    textMuted: '#475569',
  },
  amber: {
    name: 'Surya Hangat',
    canvasBg: '#FCF8F0',
    headerStart: '#92400E',
    headerEnd: '#D97706',
    primary: '#D97706',
    primaryDark: '#78350F',
    primarySoft: '#FFFBEB',
    primaryBorder: '#FDE68A',
    accent: '#059669',
    accentSoft: '#ECFDF5',
    accentBorder: '#A7F3D0',
    accentText: '#065F46',
    secondarySoft: '#EEF2FF',
    secondaryBorder: '#C7D2FE',
    secondaryText: '#3730A3',
    textMain: '#0F172A',
    textMuted: '#475569',
  },
  indigo: {
    name: 'Cakrawala Ilmu',
    canvasBg: '#F4F5FB',
    headerStart: '#312E81',
    headerEnd: '#4F46E5',
    primary: '#4F46E5',
    primaryDark: '#312E81',
    primarySoft: '#EEF2FF',
    primaryBorder: '#C7D2FE',
    accent: '#0D9488',
    accentSoft: '#F0FDFA',
    accentBorder: '#99F6E4',
    accentText: '#115E59',
    secondarySoft: '#FFFBEB',
    secondaryBorder: '#FDE68A',
    secondaryText: '#92400E',
    textMain: '#0F172A',
    textMuted: '#475569',
  },
};

function sanitizeSvgForCanvas(rawSvg?: string): string {
  if (!rawSvg || typeof rawSvg !== 'string') return '';
  let svg = rawSvg.trim();
  const startIdx = svg.indexOf('<svg');
  const endIdx = svg.lastIndexOf('</svg>');
  if (startIdx === -1 || endIdx === -1) return '';
  svg = svg.slice(startIdx, endIdx + 6);
  svg = svg
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/\son\w+\s*=\s*(['"])[\s\S]*?\1/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/<image[^>]*>/gi, '');
  if (!svg.includes('xmlns=')) {
    svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  return svg;
}

async function loadSvgAsImage(rawSvg?: string): Promise<HTMLImageElement | null> {
  const clean = sanitizeSvgForCanvas(rawSvg);
  if (!clean) return null;
  return new Promise((resolve) => {
    try {
      const blob = new Blob([clean], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    } catch {
      resolve(null);
    }
  });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  font: string
): string[] {
  const cleaned = (text || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  ctx.font = font;
  const words = cleaned.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      if (ctx.measureText(word).width > maxWidth) {
        let chunk = '';
        for (const ch of word) {
          if (ctx.measureText(chunk + ch).width <= maxWidth) {
            chunk += ch;
          } else {
            if (chunk) lines.push(chunk);
            chunk = ch;
          }
        }
        current = chunk;
      } else {
        current = word;
      }
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  y: number,
  lineHeight: number,
  font: string,
  color: string,
  align: CanvasTextAlign = 'left',
  rtl = false
) {
  ctx.save();
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  if (rtl) ctx.direction = 'rtl';
  lines.forEach((line, idx) => {
    ctx.fillText(line, x, y + idx * lineHeight);
  });
  ctx.restore();
}

function drawSectionChip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  bgColor: string,
  textColor: string,
  fontSize = 18
): number {
  ctx.save();
  ctx.font = `800 ${fontSize}px "Plus Jakarta Sans", system-ui, sans-serif`;
  const padX = Math.round(fontSize * 0.9);
  const h = Math.round(fontSize * 1.9);
  const w = Math.ceil(ctx.measureText(label).width) + padX * 2;
  drawRoundedRect(ctx, x, y, w, h, Math.round(h / 2));
  ctx.fillStyle = bgColor;
  ctx.fill();
  ctx.fillStyle = textColor;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + padX, y + h / 2 + 1);
  ctx.restore();
  return h;
}

function drawFallbackIslamicMotif(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  palette: ThemePalette
) {
  ctx.save();
  drawRoundedRect(ctx, x, y, w, h, 16);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  const cx = x + w / 2;
  const cy = y + h / 2;
  const radius = Math.min(w, h) * 0.28;

  ctx.fillStyle = palette.primarySoft;
  ctx.beginPath();
  ctx.arc(cx, cy - 8, radius * 1.15, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = palette.primary;
  ctx.beginPath();
  ctx.arc(cx - 8, cy - 12, radius * 0.65, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = palette.primarySoft;
  ctx.beginPath();
  ctx.arc(cx + 14, cy - 20, radius * 0.56, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = palette.accent;
  drawRoundedRect(ctx, cx - radius * 0.9, cy + radius * 0.42, radius * 0.86, radius * 0.48, 6);
  ctx.fill();
  drawRoundedRect(ctx, cx + radius * 0.04, cy + radius * 0.42, radius * 0.86, radius * 0.48, 6);
  ctx.fill();
  ctx.restore();
}

function drawIslamicCornerPattern(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 2; i++) {
    ctx.save();
    ctx.rotate((i * Math.PI) / 4);
    ctx.strokeRect(-size / 2, -size / 2, size, size);
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.34, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

class PaginatedA4Composer {
  pages: HTMLCanvasElement[] = [];
  ctx!: CanvasRenderingContext2D;
  curY = 56;
  readonly marginX = 56;
  readonly contentW = PDF_PAGE_W - 112; // 1542
  readonly footerTop = PDF_PAGE_H - 86;
  readonly bottomLimit = PDF_PAGE_H - 108;

  constructor(
    private readonly item: MateriAjarInfografis,
    private readonly profile: UserProfile | null,
    private readonly palette: ThemePalette
  ) {
    this.startNewPage(true);
  }

  startNewPage(isFirst = false) {
    const canvas = document.createElement('canvas');
    canvas.width = PDF_PAGE_W;
    canvas.height = PDF_PAGE_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Browser tidak mendukung rendering Canvas 2D.');
    this.pages.push(canvas);
    this.ctx = ctx;

    // Background + outer border
    ctx.fillStyle = this.palette.canvasBg;
    ctx.fillRect(0, 0, PDF_PAGE_W, PDF_PAGE_H);

    ctx.save();
    ctx.strokeStyle = this.palette.primaryBorder;
    ctx.lineWidth = 3;
    drawRoundedRect(ctx, 22, 22, PDF_PAGE_W - 44, PDF_PAGE_H - 44, 30);
    ctx.stroke();
    ctx.restore();

    if (isFirst) {
      this.curY = 52;
    } else {
      const tpl = getTemplateOption(this.item.gayaTemplate);
      ctx.save();
      drawRoundedRect(ctx, this.marginX, 46, this.contentW, 64, 18);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.strokeStyle = this.palette.primaryBorder;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.font = '800 20px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillStyle = this.palette.primaryDark;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        `${this.item.judulMateri}  ·  ${tpl.name}`,
        this.marginX + 24,
        78
      );
      ctx.font = '700 18px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillStyle = this.palette.textMuted;
      ctx.textAlign = 'right';
      ctx.fillText(
        `PAIBP Kelas ${this.item.grade} · Fase ${this.item.fase}`,
        this.marginX + this.contentW - 24,
        78
      );
      ctx.restore();
      this.curY = 132;
    }
  }

  ensureSpace(neededHeight: number) {
    if (this.curY > 150 && this.curY + neededHeight > this.bottomLimit) {
      this.startNewPage(false);
    }
  }

  finalize() {
    const total = this.pages.length;
    const namaSekolah = this.profile?.namaSekolah || 'SD Negeri';
    const guru = this.profile?.namaGuru ? `Guru PAIBP: ${this.profile.namaGuru}` : 'Guru PAIBP SD';
    const tpl = getTemplateOption(this.item.gayaTemplate);

    this.pages.forEach((canvas, idx) => {
      const ctx = canvas.getContext('2d')!;
      const fy = this.footerTop;
      ctx.save();
      ctx.strokeStyle = this.palette.primaryBorder;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(this.marginX, fy);
      ctx.lineTo(this.marginX + this.contentW, fy);
      ctx.stroke();

      ctx.font = '600 18px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillStyle = this.palette.textMuted;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`${guru}  ·  ${namaSekolah}  ·  Elemen: ${this.item.elemen}`, this.marginX, fy + 16);

      ctx.textAlign = 'right';
      ctx.fillText(`${tpl.name}  ·  Halaman ${idx + 1} dari ${total}`, this.marginX + this.contentW, fy + 16);
      ctx.restore();
    });
  }
}

const FONT_TITLE = '800 44px "Plus Jakarta Sans", system-ui, sans-serif';
const FONT_SUB = '700 21px "Plus Jakarta Sans", system-ui, sans-serif';
const FONT_BODY = '500 20px "Plus Jakarta Sans", system-ui, sans-serif';
const FONT_BODY_BOLD = '700 21px "Plus Jakarta Sans", system-ui, sans-serif';
const FONT_SMALL = '600 18px "Plus Jakarta Sans", system-ui, sans-serif';
const FONT_LABEL = '800 17px "Plus Jakarta Sans", system-ui, sans-serif';
const FONT_ARAB = '700 32px "Amiri", "Traditional Arabic", serif';
const LH_BODY = 29;
const LH_SMALL = 25;

function drawHeaderAndPengantar(
  doc: PaginatedA4Composer,
  item: MateriAjarInfografis,
  profile: UserProfile | null,
  palette: ThemePalette
) {
  const { ctx, marginX, contentW } = doc;
  const pad = 28;
  const tpl = getTemplateOption(item.gayaTemplate);
  const fokusLabel = item.fokusPilihan === 'atp' ? 'FOKUS ATP' : 'FOKUS TP';

  const titleLines = wrapLines(ctx, item.judulMateri, contentW - pad * 2 - 20, FONT_TITLE);
  const tpLines = wrapLines(
    ctx,
    `${item.fokusPilihan === 'atp' ? 'Alur Tujuan Pembelajaran (ATP)' : 'Tujuan Pembelajaran (TP)'}: ${item.tp}`,
    contentW - pad * 2 - 36,
    FONT_SUB
  );
  const headerH = 26 + 38 + 16 + titleLines.length * 54 + 16 + (tpLines.length * 29 + 24) + 26;

  doc.ensureSpace(headerH);
  const y0 = doc.curY;

  ctx.save();
  drawRoundedRect(ctx, marginX, y0, contentW, headerH, 26);
  const grad = ctx.createLinearGradient(marginX, y0, marginX + contentW, y0 + headerH);
  grad.addColorStop(0, palette.headerStart);
  grad.addColorStop(1, palette.headerEnd);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.clip();
  drawIslamicCornerPattern(ctx, marginX + contentW - 80, y0 + 68, 130, 'rgba(255,255,255,0.12)');
  ctx.restore();

  const metaY = y0 + 26;
  const chipH = drawSectionChip(
    ctx,
    marginX + pad,
    metaY,
    `PAIBP  ·  KELAS ${item.grade} SD  ·  FASE ${item.fase}  ·  ${fokusLabel}  ·  ${tpl.name.toUpperCase()}`,
    'rgba(255,255,255,0.2)',
    '#FFFFFF',
    16
  );

  ctx.save();
  ctx.font = FONT_SMALL;
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    `${profile?.namaSekolah || 'SD Negeri'}  ·  TP ${profile?.tahunPelajaran || '2026/2027'}`,
    marginX + contentW - pad,
    metaY + chipH / 2
  );
  ctx.restore();

  const titleY = metaY + chipH + 16;
  drawLines(ctx, titleLines, marginX + pad, titleY, 54, FONT_TITLE, '#FFFFFF');

  const tpY = titleY + titleLines.length * 54 + 16;
  const tpH = tpLines.length * 29 + 24;
  ctx.save();
  drawRoundedRect(ctx, marginX + pad, tpY, contentW - pad * 2, tpH, 14);
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
  drawLines(ctx, tpLines, marginX + pad + 18, tpY + 12, 29, FONT_SUB, '#FFFFFF');

  doc.curY += headerH + 20;

  // PENGANTAR MATERI
  const colGap = 20;
  const leftW = Math.floor((contentW - pad * 2 - colGap) * 0.56);
  const rightW = contentW - pad * 2 - colGap - leftW;
  const pengantarLines = wrapLines(ctx, item.pengantarMateri?.pengantarSingkat || '', leftW, FONT_BODY);
  const pemantikLines = wrapLines(ctx, item.pengantarMateri?.pertanyaanPemantik || '', rightW - 36, FONT_BODY_BOLD);
  const pLeftH = 38 + 14 + pengantarLines.length * LH_BODY;
  const pRightH = 36 + 12 + pemantikLines.length * LH_BODY + 32;
  const pHeight = pad * 2 + Math.max(pLeftH, pRightH);

  doc.ensureSpace(pHeight);
  const pY = doc.curY;
  const pCtx = doc.ctx;

  pCtx.save();
  drawRoundedRect(pCtx, marginX, pY, contentW, pHeight, 24);
  pCtx.fillStyle = '#FFFFFF';
  pCtx.fill();
  pCtx.strokeStyle = palette.primaryBorder;
  pCtx.lineWidth = 2;
  pCtx.stroke();
  pCtx.restore();

  const pChipH = drawSectionChip(pCtx, marginX + pad, pY + pad, '01 · PENGANTAR MATERI', palette.primarySoft, palette.primaryDark, 16);
  drawLines(pCtx, pengantarLines, marginX + pad, pY + pad + pChipH + 12, LH_BODY, FONT_BODY, palette.textMain);

  const rx = marginX + pad + leftW + colGap;
  pCtx.save();
  drawRoundedRect(pCtx, rx, pY + pad, rightW, pHeight - pad * 2, 18);
  pCtx.fillStyle = palette.accentSoft;
  pCtx.fill();
  pCtx.strokeStyle = palette.accentBorder;
  pCtx.lineWidth = 2;
  pCtx.stroke();
  pCtx.restore();

  const qChipH = drawSectionChip(pCtx, rx + 18, pY + pad + 16, 'PERTANYAAN PEMANTIK', palette.accent, '#FFFFFF', 15);
  drawLines(pCtx, pemantikLines, rx + 18, pY + pad + 16 + qChipH + 10, LH_BODY, FONT_BODY_BOLD, palette.accentText);

  doc.curY += pHeight + 20;
}

function drawIntiMateriSection(
  doc: PaginatedA4Composer,
  item: MateriAjarInfografis,
  palette: ThemePalette,
  intiImg: HTMLImageElement | null
) {
  const pad = 28;
  const colGap = 22;
  const innerW = doc.contentW - pad * 2;
  const leftW = Math.floor((innerW - colGap) * 0.56);
  const rightW = innerW - colGap - leftW;
  const probe = doc.ctx;

  const konsepLines = wrapLines(probe, item.intiMateri?.pengertianKonsep || '', leftW - 32, FONT_BODY_BOLD);
  const penjelasanLines = wrapLines(probe, item.intiMateri?.penjelasanUtama || '', leftW, FONT_BODY);
  const hasArab = Boolean(item.intiMateri?.teksArab && item.intiMateri.teksArab.trim());
  const arabLines = hasArab ? wrapLines(probe, item.intiMateri.teksArab || '', leftW - 36, FONT_ARAB) : [];
  const arabArtiLines = hasArab && item.intiMateri?.artinyaArab
    ? wrapLines(probe, `Artinya: "${item.intiMateri.artinyaArab}"`, leftW - 36, FONT_SMALL)
    : [];
  const poinLines = (item.intiMateri?.poinPenting || []).map((p) => wrapLines(probe, p, leftW - 44, FONT_BODY));

  let leftH = 38 + 14 + (28 + konsepLines.length * LH_BODY + 24) + 14 + 26 + penjelasanLines.length * LH_BODY + 14;
  if (hasArab) {
    leftH += 18 + arabLines.length * 46 + (arabArtiLines.length > 0 ? 8 + arabArtiLines.length * LH_SMALL : 0) + 18 + 14;
  }
  leftH += 28 + poinLines.reduce((acc, ls) => acc + Math.max(1, ls.length) * LH_BODY + 10, 0);

  const svgH = 270;
  const captionLines = wrapLines(probe, item.intiMateri?.captionIlustrasi || '', rightW - 24, FONT_SMALL);
  const contohLines = (item.intiMateri?.contohKonkret || []).map((c) => wrapLines(probe, c, rightW - 56, FONT_BODY));
  const contohBoxH = 34 + 10 + contohLines.reduce((acc, ls) => acc + Math.max(1, ls.length) * LH_BODY + 10, 0) + 18;
  const rightH = 38 + 14 + svgH + (captionLines.length > 0 ? 8 + captionLines.length * LH_SMALL : 0) + 16 + contohBoxH;

  const totalH = pad * 2 + Math.max(leftH, rightH);
  doc.ensureSpace(totalH);

  const ctx = doc.ctx;
  const y0 = doc.curY;
  const x0 = doc.marginX;

  ctx.save();
  drawRoundedRect(ctx, x0, y0, doc.contentW, totalH, 24);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.strokeStyle = palette.primaryBorder;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  const chipH = drawSectionChip(ctx, x0 + pad, y0 + pad, '02 · INTI MATERI', palette.primarySoft, palette.primaryDark, 16);
  let ly = y0 + pad + chipH + 14;
  const lx = x0 + pad;
  const rx = lx + leftW + colGap;

  const kBoxH = 28 + konsepLines.length * LH_BODY + 24;
  ctx.save();
  drawRoundedRect(ctx, lx, ly, leftW, kBoxH, 16);
  ctx.fillStyle = palette.primarySoft;
  ctx.fill();
  ctx.strokeStyle = palette.primaryBorder;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
  drawLines(ctx, ['PENGERTIAN KONSEP'], lx + 16, ly + 10, 22, FONT_LABEL, palette.primaryDark);
  drawLines(ctx, konsepLines, lx + 16, ly + 34, LH_BODY, FONT_BODY_BOLD, palette.textMain);
  ly += kBoxH + 14;

  drawLines(ctx, ['PENJELASAN UTAMA'], lx, ly, 22, FONT_LABEL, palette.primaryDark);
  ly += 26;
  drawLines(ctx, penjelasanLines, lx, ly, LH_BODY, FONT_BODY, palette.textMain);
  ly += penjelasanLines.length * LH_BODY + 14;

  if (hasArab) {
    const aBoxH = 18 + arabLines.length * 46 + (arabArtiLines.length > 0 ? 8 + arabArtiLines.length * LH_SMALL : 0) + 16;
    ctx.save();
    drawRoundedRect(ctx, lx, ly, leftW, aBoxH, 16);
    ctx.fillStyle = palette.secondarySoft;
    ctx.fill();
    ctx.strokeStyle = palette.secondaryBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    drawLines(ctx, arabLines, lx + leftW / 2, ly + 14, 46, FONT_ARAB, palette.secondaryText, 'center', true);
    if (arabArtiLines.length > 0) {
      drawLines(ctx, arabArtiLines, lx + leftW / 2, ly + 14 + arabLines.length * 46 + 6, LH_SMALL, FONT_SMALL, palette.textMuted, 'center');
    }
    ly += aBoxH + 14;
  }

  drawLines(ctx, ['POIN-POIN PENTING'], lx, ly, 22, FONT_LABEL, palette.primaryDark);
  ly += 28;
  poinLines.forEach((lines, idx) => {
    ctx.save();
    ctx.fillStyle = palette.primary;
    ctx.beginPath();
    ctx.arc(lx + 12, ly + 13, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 14px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(idx + 1), lx + 12, ly + 14);
    ctx.restore();
    drawLines(ctx, lines, lx + 34, ly, LH_BODY, FONT_BODY, palette.textMain);
    ly += Math.max(1, lines.length) * LH_BODY + 10;
  });

  // Right Illustration & Contoh Konkret
  let ry = y0 + pad + chipH + 14;
  ctx.save();
  drawRoundedRect(ctx, rx, ry, rightW, svgH, 18);
  ctx.fillStyle = '#F8FAFC';
  ctx.fill();
  ctx.strokeStyle = palette.primaryBorder;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.clip();
  if (intiImg) {
    const s = Math.min((rightW - 18) / (intiImg.width || 360), (svgH - 18) / (intiImg.height || 190));
    const dw = (intiImg.width || 360) * s;
    const dh = (intiImg.height || 190) * s;
    ctx.drawImage(intiImg, rx + (rightW - dw) / 2, ry + (svgH - dh) / 2, dw, dh);
  } else {
    drawFallbackIslamicMotif(ctx, rx + 6, ry + 6, rightW - 12, svgH - 12, palette);
  }
  ctx.restore();

  ry += svgH;
  if (captionLines.length > 0) {
    ry += 8;
    drawLines(ctx, captionLines, rx + rightW / 2, ry, LH_SMALL, FONT_SMALL, palette.textMuted, 'center');
    ry += captionLines.length * LH_SMALL;
  }

  ry += 16;
  ctx.save();
  drawRoundedRect(ctx, rx, ry, rightW, contohBoxH, 18);
  ctx.fillStyle = palette.accentSoft;
  ctx.fill();
  ctx.strokeStyle = palette.accentBorder;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
  drawLines(ctx, ['CONTOH KONKRET'], rx + 18, ry + 14, 22, FONT_LABEL, palette.accentText);
  let cy = ry + 42;
  contohLines.forEach((lines) => {
    ctx.save();
    ctx.fillStyle = palette.accent;
    drawRoundedRect(ctx, rx + 18, cy + 5, 18, 18, 5);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 13px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✓', rx + 27, cy + 14);
    ctx.restore();
    drawLines(ctx, lines, rx + 46, cy, LH_BODY, FONT_BODY, palette.textMain);
    cy += Math.max(1, lines.length) * LH_BODY + 10;
  });

  doc.curY += totalH + 20;
}

async function drawStyleSpecificShowcase(
  doc: PaginatedA4Composer,
  item: MateriAjarInfografis,
  palette: ThemePalette
) {
  const gaya = item.gayaTemplate || 'educational_infographic';
  const ss = item.styleSpecific;
  const pad = 26;
  const x0 = doc.marginX;
  const w = doc.contentW;

  if (gaya === 'cheat_sheet' && ss?.cheatSheetFacts?.length) {
    const facts = ss.cheatSheetFacts;
    const colW = Math.floor((w - pad * 2 - 18) / 2);
    const rows: { left: any; right?: any; h: number }[] = [];
    for (let i = 0; i < facts.length; i += 2) {
      const f1 = facts[i];
      const f2 = facts[i + 1];
      const l1 = wrapLines(doc.ctx, f1.nilai, colW - 28, FONT_BODY);
      const l2 = f2 ? wrapLines(doc.ctx, f2.nilai, colW - 28, FONT_BODY) : [];
      const h = 44 + Math.max(l1.length, l2.length, 1) * LH_BODY + 18;
      rows.push({ left: { ...f1, lines: l1 }, right: f2 ? { ...f2, lines: l2 } : undefined, h });
    }
    const blockH = pad * 2 + 44 + rows.reduce((a, r) => a + r.h + 14, 0);
    doc.ensureSpace(blockH);
    const ctx = doc.ctx;
    const y0 = doc.curY;
    ctx.save();
    drawRoundedRect(ctx, x0, y0, w, blockH, 24);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.strokeStyle = palette.primaryBorder;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    drawSectionChip(ctx, x0 + pad, y0 + pad, 'CHEAT SHEET · RINGKASAN CEPAT MATERI', palette.primary, '#FFFFFF', 16);
    let ry = y0 + pad + 48;
    rows.forEach((r) => {
      [r.left, r.right].forEach((cell, idx) => {
        if (!cell) return;
        const cx = x0 + pad + idx * (colW + 18);
        ctx.save();
        drawRoundedRect(ctx, cx, ry, colW, r.h, 14);
        ctx.fillStyle = idx === 0 ? palette.primarySoft : palette.secondarySoft;
        ctx.fill();
        ctx.strokeStyle = idx === 0 ? palette.primaryBorder : palette.secondaryBorder;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
        drawLines(ctx, [cell.label.toUpperCase()], cx + 14, ry + 12, 20, FONT_LABEL, palette.primaryDark);
        drawLines(ctx, cell.lines, cx + 14, ry + 36, LH_BODY, FONT_BODY, palette.textMain);
      });
      ry += r.h + 14;
    });
    doc.curY += blockH + 20;
  } else if (gaya === 'sticky_notes' && ss?.stickyNotes?.length) {
    const notes = ss.stickyNotes;
    const colW = Math.floor((w - pad * 2 - 20) / 2);
    const noteColors: Record<string, { bg: string; border: string; tape: string }> = {
      yellow: { bg: '#FEF9C3', border: '#FDE047', tape: '#F59E0B' },
      mint: { bg: '#DCFCE7', border: '#86EFAC', tape: '#10B981' },
      sky: { bg: '#E0F2FE', border: '#7DD3FC', tape: '#0284C7' },
      rose: { bg: '#FFE4E6', border: '#FDA4AF', tape: '#E11D48' },
    };
    doc.ensureSpace(120);
    drawSectionChip(doc.ctx, x0, doc.curY, 'STICKY NOTES · CATATAN PENTING', palette.accent, '#FFFFFF', 16);
    doc.curY += 46;
    for (let i = 0; i < notes.length; i += 2) {
      const n1 = notes[i];
      const n2 = notes[i + 1];
      const l1 = wrapLines(doc.ctx, n1.isi, colW - 36, FONT_BODY);
      const l2 = n2 ? wrapLines(doc.ctx, n2.isi, colW - 36, FONT_BODY) : [];
      const rowH = 56 + Math.max(l1.length, l2.length, 1) * LH_BODY + 22;
      doc.ensureSpace(rowH + 16);
      const ctx = doc.ctx;
      const ry = doc.curY;
      [n1, n2].forEach((note, idx) => {
        if (!note) return;
        const lines = idx === 0 ? l1 : l2;
        const c = noteColors[note.warna] || noteColors.yellow;
        const nx = x0 + idx * (colW + 20);
        ctx.save();
        drawRoundedRect(ctx, nx, ry + 8, colW + 28, rowH - 8, 16);
        ctx.fillStyle = c.bg;
        ctx.fill();
        ctx.strokeStyle = c.border;
        ctx.lineWidth = 2;
        ctx.stroke();
        // Tape at top center
        drawRoundedRect(ctx, nx + (colW + 28) / 2 - 42, ry, 84, 18, 4);
        ctx.fillStyle = c.tape;
        ctx.fill();
        ctx.restore();
        drawLines(ctx, [note.judul], nx + 20, ry + 26, 26, FONT_BODY_BOLD, palette.textMain);
        drawLines(ctx, lines, nx + 20, ry + 58, LH_BODY, FONT_BODY, palette.textMain);
      });
      doc.curY += rowH + 16;
    }
    doc.curY += 8;
  } else if (gaya === 'mind_map' && ss?.mindMapCabang?.length) {
    const branches = ss.mindMapCabang;
    const branchH = 148;
    const mapH = Math.max(520, Math.ceil(branches.length / 2) * (branchH + 22) + 160);
    doc.ensureSpace(mapH);
    const ctx = doc.ctx;
    const y0 = doc.curY;

    ctx.save();
    drawRoundedRect(ctx, x0, y0, w, mapH, 24);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.strokeStyle = palette.primaryBorder;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    drawSectionChip(ctx, x0 + pad, y0 + pad, 'MIND MAP · PEMETAAN KONSEP', palette.primary, '#FFFFFF', 16);
    const centerX = x0 + w / 2;
    const centerY = y0 + mapH / 2 + 16;
    const nodeW = 330;
    const nodeH = 116;

    // Branch positions around central node
    const boxW = 470;
    const positions = [
      { x: x0 + 36, y: y0 + 88 },
      { x: x0 + w - boxW - 36, y: y0 + 88 },
      { x: x0 + 36, y: y0 + mapH - branchH - 36 },
      { x: x0 + w - boxW - 36, y: y0 + mapH - branchH - 36 },
      { x: centerX - boxW / 2, y: y0 + mapH - branchH - 28 },
    ];

    const branchColors = ['#059669', '#0284C7', '#D97706', '#7C3AED', '#E11D48'];
    branches.forEach((b, idx) => {
      const pos = positions[idx % positions.length];
      const bx = pos.x + boxW / 2;
      const by = pos.y + branchH / 2;
      const col = branchColors[idx % branchColors.length];

      // Curved connector
      ctx.save();
      ctx.strokeStyle = col;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.quadraticCurveTo((centerX + bx) / 2, centerY, bx, by);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      drawRoundedRect(ctx, pos.x, pos.y, boxW, branchH, 18);
      ctx.fillStyle = '#F8FAFC';
      ctx.fill();
      ctx.strokeStyle = col;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();

      drawLines(ctx, [b.cabang], pos.x + 16, pos.y + 14, 26, FONT_BODY_BOLD, col);
      let sy = pos.y + 48;
      (b.subPoin || []).slice(0, 3).forEach((sp) => {
        const sLines = wrapLines(ctx, `• ${sp}`, boxW - 32, FONT_SMALL).slice(0, 2);
        drawLines(ctx, sLines, pos.x + 16, sy, 22, FONT_SMALL, palette.textMain);
        sy += sLines.length * 22 + 4;
      });
    });

    // Central node drawn on top
    ctx.save();
    drawRoundedRect(ctx, centerX - nodeW / 2, centerY - nodeH / 2, nodeW, nodeH, 28);
    ctx.fillStyle = palette.primary;
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.restore();
    const cLines = wrapLines(ctx, item.judulMateri, nodeW - 32, FONT_BODY_BOLD).slice(0, 3);
    drawLines(ctx, cLines, centerX, centerY - (cLines.length * 26) / 2, 26, FONT_BODY_BOLD, '#FFFFFF', 'center');

    doc.curY += mapH + 20;
  } else if (gaya === 'comic_strip' && ss?.comicPanels?.length) {
    const panels = ss.comicPanels;
    const imgs = await Promise.all(panels.map((p) => loadSvgAsImage(p.svgScene)));
    doc.ensureSpace(120);
    drawSectionChip(doc.ctx, x0, doc.curY, 'COMIC STRIP · CERITA PEMBELAJARAN', palette.accent, '#FFFFFF', 16);
    doc.curY += 46;
    const colW = Math.floor((w - 22) / 2);
    for (let i = 0; i < panels.length; i += 2) {
      const p1 = panels[i];
      const p2 = panels[i + 1];
      const d1 = wrapLines(doc.ctx, `${p1.tokoh}: "${p1.dialog}"`, colW - 36, FONT_BODY_BOLD);
      const n1 = wrapLines(doc.ctx, p1.narasi, colW - 36, FONT_SMALL);
      const d2 = p2 ? wrapLines(doc.ctx, `${p2.tokoh}: "${p2.dialog}"`, colW - 36, FONT_BODY_BOLD) : [];
      const n2 = p2 ? wrapLines(doc.ctx, p2.narasi, colW - 36, FONT_SMALL) : [];
      const svgH = 190;
      const textH = Math.max(d1.length * 27 + n1.length * 24, d2.length * 27 + n2.length * 24) + 76;
      const panelH = svgH + textH + 26;
      doc.ensureSpace(panelH + 18);
      const ctx = doc.ctx;
      const py = doc.curY;
      [p1, p2].forEach((panel, idx) => {
        if (!panel) return;
        const px = x0 + idx * (colW + 22);
        const img = imgs[i + idx];
        const dlg = idx === 0 ? d1 : d2;
        const nar = idx === 0 ? n1 : n2;

        ctx.save();
        drawRoundedRect(ctx, px, py, colW, panelH, 18);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        ctx.strokeStyle = palette.textMain;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();

        // Panel number & setting banner
        drawSectionChip(ctx, px + 14, py + 12, `PANEL ${panel.panelNo} · ${panel.latar}`, palette.primaryDark, '#FFFFFF', 14);
        // Scene box
        const sy = py + 48;
        ctx.save();
        drawRoundedRect(ctx, px + 14, sy, colW - 28, svgH, 12);
        ctx.fillStyle = '#F8FAFC';
        ctx.fill();
        ctx.clip();
        if (img) {
          const s = Math.min((colW - 36) / (img.width || 300), (svgH - 12) / (img.height || 160));
          ctx.drawImage(img, px + 14 + (colW - 28 - (img.width || 300) * s) / 2, sy + (svgH - (img.height || 160) * s) / 2, (img.width || 300) * s, (img.height || 160) * s);
        } else {
          drawFallbackIslamicMotif(ctx, px + 18, sy + 4, colW - 36, svgH - 8, palette);
        }
        ctx.restore();

        // Speech bubble
        const by = sy + svgH + 10;
        const bH = dlg.length * 27 + 20;
        ctx.save();
        drawRoundedRect(ctx, px + 14, by, colW - 28, bH, 14);
        ctx.fillStyle = palette.accentSoft;
        ctx.fill();
        ctx.strokeStyle = palette.accentBorder;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
        drawLines(ctx, dlg, px + 24, by + 10, 27, FONT_BODY_BOLD, palette.accentText);
        drawLines(ctx, nar, px + 16, by + bH + 8, 24, FONT_SMALL, palette.textMuted);
      });
      doc.curY += panelH + 18;
    }
    doc.curY += 8;
  } else if (gaya === 'flashcard' && ss?.flashcards?.length) {
    const cards = ss.flashcards;
    doc.ensureSpace(120);
    drawSectionChip(doc.ctx, x0, doc.curY, 'FLASHCARD · KARTU HAFALAN & LATIHAN (GUNTING & LIPAT)', palette.primary, '#FFFFFF', 16);
    doc.curY += 46;
    const halfW = Math.floor((w - 16) / 2);
    cards.forEach((fc) => {
      const fLines = wrapLines(doc.ctx, fc.depan, halfW - 36, FONT_BODY_BOLD);
      const aLines = fc.arab ? wrapLines(doc.ctx, fc.arab, halfW - 36, FONT_ARAB) : [];
      const bLines = wrapLines(doc.ctx, fc.belakang, halfW - 36, FONT_BODY);
      const tLines = wrapLines(doc.ctx, `Tips: ${fc.tips}`, halfW - 36, FONT_SMALL);
      const leftH = 44 + fLines.length * 28 + (aLines.length > 0 ? aLines.length * 42 + 8 : 0) + 18;
      const rightH = 44 + bLines.length * LH_BODY + tLines.length * 24 + 22;
      const cardH = Math.max(leftH, rightH, 150);

      doc.ensureSpace(cardH + 16);
      const ctx = doc.ctx;
      const cy = doc.curY;

      // Dashed cut border
      ctx.save();
      ctx.setLineDash([8, 6]);
      ctx.strokeStyle = palette.primary;
      ctx.lineWidth = 2;
      drawRoundedRect(ctx, x0, cy, w, cardH, 16);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.stroke();
      // Center fold line
      ctx.beginPath();
      ctx.moveTo(x0 + w / 2, cy);
      ctx.lineTo(x0 + w / 2, cy + cardH);
      ctx.stroke();
      ctx.restore();

      drawSectionChip(ctx, x0 + 18, cy + 14, `KARTU ${fc.nomor} · DEPAN`, palette.primarySoft, palette.primaryDark, 14);
      let fy = cy + 50;
      if (aLines.length > 0) {
        drawLines(ctx, aLines, x0 + halfW / 2, fy, 42, FONT_ARAB, palette.secondaryText, 'center', true);
        fy += aLines.length * 42 + 6;
      }
      drawLines(ctx, fLines, x0 + 18, fy, 28, FONT_BODY_BOLD, palette.textMain);

      const rx = x0 + w / 2 + 18;
      drawSectionChip(ctx, rx, cy + 14, `BELAKANG · JAWABAN`, palette.accentSoft, palette.accentText, 14);
      drawLines(ctx, bLines, rx, cy + 50, LH_BODY, FONT_BODY, palette.textMain);
      drawLines(ctx, tLines, rx, cy + 56 + bLines.length * LH_BODY, 24, FONT_SMALL, palette.textMuted);

      doc.curY += cardH + 16;
    });
    doc.curY += 8;
  } else if (gaya === 'step_by_step' && ss?.stepByStep?.length) {
    const steps = ss.stepByStep;
    doc.ensureSpace(120);
    drawSectionChip(doc.ctx, x0, doc.curY, 'STEP-BY-STEP · TAHAPAN PROSES BERURUTAN', palette.primary, '#FFFFFF', 16);
    doc.curY += 46;
    steps.forEach((st, idx) => {
      const descLines = wrapLines(doc.ctx, st.deskripsi, w - 130, FONT_BODY);
      const catLines = st.catatan ? wrapLines(doc.ctx, `Catatan Adab: ${st.catatan}`, w - 130, FONT_SMALL) : [];
      const rowH = Math.max(96, 46 + descLines.length * LH_BODY + (catLines.length > 0 ? catLines.length * 24 + 8 : 0) + 18);
      doc.ensureSpace(rowH + 18);
      const ctx = doc.ctx;
      const sy = doc.curY;

      ctx.save();
      drawRoundedRect(ctx, x0, sy, w, rowH, 18);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.strokeStyle = palette.primaryBorder;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.fillStyle = palette.primary;
      ctx.beginPath();
      ctx.arc(x0 + 46, sy + rowH / 2, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 22px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(st.langkahNo), x0 + 46, sy + rowH / 2 + 1);
      ctx.restore();

      drawLines(ctx, [st.judulLangkah], x0 + 92, sy + 16, 26, FONT_BODY_BOLD, palette.primaryDark);
      drawLines(ctx, descLines, x0 + 92, sy + 46, LH_BODY, FONT_BODY, palette.textMain);
      if (catLines.length > 0) {
        drawLines(ctx, catLines, x0 + 92, sy + 50 + descLines.length * LH_BODY, 24, FONT_SMALL, palette.accentText);
      }

      if (idx < steps.length - 1) {
        ctx.save();
        ctx.fillStyle = palette.primary;
        ctx.font = '800 20px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('▼', x0 + 46, sy + rowH + 14);
        ctx.restore();
      }
      doc.curY += rowH + 20;
    });
  } else if (gaya === 'timeline' && ss?.timelineEvents?.length) {
    const events = ss.timelineEvents;
    doc.ensureSpace(120);
    drawSectionChip(doc.ctx, x0, doc.curY, 'TIMELINE · KRONOLOGI SEJARAH & KETELADANAN', palette.primary, '#FFFFFF', 16);
    doc.curY += 46;
    events.forEach((ev, idx) => {
      const kLines = wrapLines(doc.ctx, ev.keterangan, w - 120, FONT_BODY);
      const hLines = wrapLines(doc.ctx, `Hikmah: ${ev.hikmah}`, w - 120, FONT_SMALL);
      const rowH = 52 + kLines.length * LH_BODY + hLines.length * 24 + 24;
      doc.ensureSpace(rowH + 16);
      const ctx = doc.ctx;
      const ey = doc.curY;

      // Vertical spine line
      ctx.save();
      ctx.strokeStyle = palette.primaryBorder;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x0 + 36, ey);
      ctx.lineTo(x0 + 36, ey + rowH + (idx < events.length - 1 ? 16 : 0));
      ctx.stroke();

      ctx.fillStyle = palette.accent;
      ctx.beginPath();
      ctx.arc(x0 + 36, ey + 34, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      drawRoundedRect(ctx, x0 + 72, ey, w - 72, rowH, 18);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.strokeStyle = palette.primaryBorder;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      drawSectionChip(ctx, x0 + 92, ey + 14, ev.urutan, palette.primarySoft, palette.primaryDark, 14);
      drawLines(ctx, [ev.judulPeristiwa], x0 + 92, ey + 48, 26, FONT_BODY_BOLD, palette.textMain);
      drawLines(ctx, kLines, x0 + 92, ey + 78, LH_BODY, FONT_BODY, palette.textMain);
      drawLines(ctx, hLines, x0 + 92, ey + 82 + kLines.length * LH_BODY, 24, FONT_SMALL, palette.accentText);

      doc.curY += rowH + 16;
    });
  } else if (gaya === 'comparison_chart' && ss?.comparisonData?.baris?.length) {
    const cmp = ss.comparisonData;
    const colAspekW = Math.floor(w * 0.24);
    const colValW = Math.floor((w - colAspekW) / 2);
    doc.ensureSpace(140);
    drawSectionChip(doc.ctx, x0, doc.curY, `COMPARISON CHART · ${cmp.judulPerbandingan.toUpperCase()}`, palette.primary, '#FFFFFF', 16);
    doc.curY += 46;

    // Table Header
    const headH = 54;
    const hCtx = doc.ctx;
    hCtx.save();
    drawRoundedRect(hCtx, x0, doc.curY, w, headH, 14);
    hCtx.fillStyle = palette.primaryDark;
    hCtx.fill();
    hCtx.restore();
    drawLines(hCtx, ['ASPEK PEMBEDA'], x0 + 16, doc.curY + 16, 22, FONT_LABEL, '#FFFFFF');
    drawLines(hCtx, [cmp.kolomA], x0 + colAspekW + 16, doc.curY + 15, 24, FONT_BODY_BOLD, '#FFFFFF');
    drawLines(hCtx, [cmp.kolomB], x0 + colAspekW + colValW + 16, doc.curY + 15, 24, FONT_BODY_BOLD, '#FFFFFF');
    doc.curY += headH + 8;

    cmp.baris.forEach((row, idx) => {
      const aLines = wrapLines(doc.ctx, row.aspek, colAspekW - 28, FONT_BODY_BOLD);
      const v1Lines = wrapLines(doc.ctx, row.nilaiA, colValW - 28, FONT_BODY);
      const v2Lines = wrapLines(doc.ctx, row.nilaiB, colValW - 28, FONT_BODY);
      const rowH = Math.max(aLines.length, v1Lines.length, v2Lines.length, 1) * LH_BODY + 28;
      doc.ensureSpace(rowH + 6);
      const ctx = doc.ctx;
      const ry = doc.curY;
      ctx.save();
      drawRoundedRect(ctx, x0, ry, w, rowH, 12);
      ctx.fillStyle = idx % 2 === 0 ? '#FFFFFF' : palette.primarySoft;
      ctx.fill();
      ctx.strokeStyle = palette.primaryBorder;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
      drawLines(ctx, aLines, x0 + 14, ry + 14, LH_BODY, FONT_BODY_BOLD, palette.primaryDark);
      drawLines(ctx, v1Lines, x0 + colAspekW + 14, ry + 14, LH_BODY, FONT_BODY, palette.textMain);
      drawLines(ctx, v2Lines, x0 + colAspekW + colValW + 14, ry + 14, LH_BODY, FONT_BODY, palette.textMain);
      doc.curY += rowH + 8;
    });
    doc.curY += 12;
  } else if (gaya === 'isometric_3d' && ss?.isometricObjects?.length) {
    const objs = ss.isometricObjects;
    const imgs = await Promise.all(objs.map((o) => loadSvgAsImage(o.svgIsometric)));
    doc.ensureSpace(120);
    drawSectionChip(doc.ctx, x0, doc.curY, 'ISOMETRIC 3D · VISUALISASI OBJEK & MAKNA', palette.primary, '#FFFFFF', 16);
    doc.curY += 46;
    objs.forEach((obj, idx) => {
      const img = imgs[idx];
      const fLines = wrapLines(doc.ctx, `Fungsi / Ciri: ${obj.fungsi}`, w - 340, FONT_BODY);
      const mLines = wrapLines(doc.ctx, `Makna Spiritual: ${obj.makna}`, w - 340, FONT_BODY);
      const cardH = Math.max(210, 56 + fLines.length * LH_BODY + mLines.length * LH_BODY + 28);
      doc.ensureSpace(cardH + 16);
      const ctx = doc.ctx;
      const cy = doc.curY;

      ctx.save();
      drawRoundedRect(ctx, x0, cy, w, cardH, 20);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.strokeStyle = palette.primaryBorder;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      // Isometric style pedestal frame on left
      ctx.save();
      drawRoundedRect(ctx, x0 + 18, cy + 18, 280, cardH - 36, 16);
      ctx.fillStyle = palette.secondarySoft;
      ctx.fill();
      ctx.strokeStyle = palette.secondaryBorder;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.clip();
      if (img) {
        const s = Math.min(256 / (img.width || 280), (cardH - 52) / (img.height || 180));
        ctx.drawImage(img, x0 + 18 + (280 - (img.width || 280) * s) / 2, cy + 18 + (cardH - 36 - (img.height || 180) * s) / 2, (img.width || 280) * s, (img.height || 180) * s);
      } else {
        drawFallbackIslamicMotif(ctx, x0 + 24, cy + 24, 268, cardH - 48, palette);
      }
      ctx.restore();

      drawLines(ctx, [obj.namaObjek], x0 + 320, cy + 20, 26, FONT_BODY_BOLD, palette.primaryDark);
      drawLines(ctx, fLines, x0 + 320, cy + 54, LH_BODY, FONT_BODY, palette.textMain);
      drawLines(ctx, mLines, x0 + 320, cy + 62 + fLines.length * LH_BODY, LH_BODY, FONT_BODY, palette.accentText);

      doc.curY += cardH + 16;
    });
  }
}

function drawBottomPedagogicalSections(
  doc: PaginatedA4Composer,
  item: MateriAjarInfografis,
  palette: ThemePalette,
  dailyImg: HTMLImageElement | null
) {
  const pad = 26;
  const colGap = 22;
  const colW = Math.floor((doc.contentW - colGap) / 2);
  const colInnerW = colW - pad * 2;
  const probe = doc.ctx;

  // ROW: Contoh Sehari-hari + Aktivitas Siswa
  const svgH = 165;
  const dCapLines = wrapLines(probe, item.contohSehariHari?.captionIlustrasi || '', colInnerW - 20, FONT_SMALL);
  const situasiLines = wrapLines(probe, item.contohSehariHari?.situasi || '', colInnerW, FONT_BODY_BOLD);
  const penLines = (item.contohSehariHari?.penerapan || []).map((p) => wrapLines(probe, p, colInnerW - 36, FONT_BODY));
  const dailyH = pad * 2 + 38 + 12 + svgH + (dCapLines.length > 0 ? 8 + dCapLines.length * LH_SMALL : 0) + 14 + situasiLines.length * LH_BODY + 10 + penLines.reduce((a, ls) => a + ls.length * LH_BODY + 8, 0);

  const actTitleLines = wrapLines(probe, item.aktivitasSiswa?.judulAktivitas || '', colInnerW - 32, FONT_BODY_BOLD);
  const actStepLines = (item.aktivitasSiswa?.langkah || []).map((l) => wrapLines(probe, l, colInnerW - 64, FONT_BODY));
  const actH = pad * 2 + 38 + 12 + (18 + actTitleLines.length * LH_BODY + 16) + 14 + actStepLines.reduce((a, ls) => a + Math.max(42, ls.length * LH_BODY + 16) + 10, 0);

  const row3H = Math.max(dailyH, actH);
  doc.ensureSpace(row3H);

  let ctx = doc.ctx;
  let y0 = doc.curY;
  const xL = doc.marginX;
  const xR = xL + colW + colGap;

  // Left card: Contoh Sehari-hari
  ctx.save();
  drawRoundedRect(ctx, xL, y0, colW, row3H, 24);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.strokeStyle = palette.primaryBorder;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  const dChipH = drawSectionChip(ctx, xL + pad, y0 + pad, '03 · CONTOH SEHARI-HARI', palette.secondarySoft, palette.secondaryText, 15);
  let dy = y0 + pad + dChipH + 12;
  ctx.save();
  drawRoundedRect(ctx, xL + pad, dy, colInnerW, svgH, 16);
  ctx.fillStyle = '#F8FAFC';
  ctx.fill();
  ctx.strokeStyle = palette.secondaryBorder;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.clip();
  if (dailyImg) {
    const s = Math.min((colInnerW - 14) / (dailyImg.width || 360), (svgH - 14) / (dailyImg.height || 170));
    const dw = (dailyImg.width || 360) * s;
    const dh = (dailyImg.height || 170) * s;
    ctx.drawImage(dailyImg, xL + pad + (colInnerW - dw) / 2, dy + (svgH - dh) / 2, dw, dh);
  } else {
    drawFallbackIslamicMotif(ctx, xL + pad + 4, dy + 4, colInnerW - 8, svgH - 8, palette);
  }
  ctx.restore();

  dy += svgH;
  if (dCapLines.length > 0) {
    dy += 8;
    drawLines(ctx, dCapLines, xL + pad + colInnerW / 2, dy, LH_SMALL, FONT_SMALL, palette.textMuted, 'center');
    dy += dCapLines.length * LH_SMALL;
  }
  dy += 12;
  drawLines(ctx, situasiLines, xL + pad, dy, LH_BODY, FONT_BODY_BOLD, palette.textMain);
  dy += situasiLines.length * LH_BODY + 10;
  penLines.forEach((lines) => {
    ctx.save();
    ctx.fillStyle = palette.primary;
    ctx.beginPath();
    ctx.arc(xL + pad + 10, dy + 13, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    drawLines(ctx, lines, xL + pad + 26, dy, LH_BODY, FONT_BODY, palette.textMain);
    dy += Math.max(1, lines.length) * LH_BODY + 8;
  });

  // Right card: Aktivitas Siswa
  ctx.save();
  drawRoundedRect(ctx, xR, y0, colW, row3H, 24);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.strokeStyle = palette.accentBorder;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  const aChipH = drawSectionChip(ctx, xR + pad, y0 + pad, '04 · AKTIVITAS SISWA', palette.accentSoft, palette.accentText, 15);
  let ay = y0 + pad + aChipH + 12;
  const actBannerH = 16 + actTitleLines.length * LH_BODY + 16;
  ctx.save();
  drawRoundedRect(ctx, xR + pad, ay, colInnerW, actBannerH, 14);
  ctx.fillStyle = palette.accent;
  ctx.fill();
  ctx.restore();
  drawLines(ctx, actTitleLines, xR + pad + 16, ay + 15, LH_BODY, FONT_BODY_BOLD, '#FFFFFF');
  ay += actBannerH + 14;

  actStepLines.forEach((lines, idx) => {
    const sh = Math.max(42, lines.length * LH_BODY + 16);
    ctx.save();
    drawRoundedRect(ctx, xR + pad, ay, colInnerW, sh, 12);
    ctx.fillStyle = palette.accentSoft;
    ctx.fill();
    ctx.fillStyle = palette.accent;
    drawRoundedRect(ctx, xR + pad + 10, ay + 9, 28, 28, 8);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 15px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(idx + 1), xR + pad + 24, ay + 24);
    ctx.restore();
    drawLines(ctx, lines, xR + pad + 50, ay + 8, LH_BODY, FONT_BODY, palette.textMain);
    ay += sh + 10;
  });

  doc.curY += row3H + 20;

  // ROW: Rangkuman & Latihan Pemahaman
  const rangkumanLines = (item.rangkuman || []).map((r) => wrapLines(doc.ctx, r, colInnerW - 36, FONT_BODY));
  const rangkumanH = pad * 2 + 38 + 14 + rangkumanLines.reduce((a, ls) => a + ls.length * LH_BODY + 10, 0);
  const latihanLines = (item.latihanPemahaman || []).map((q, idx) => wrapLines(doc.ctx, `${idx + 1}. ${q.pertanyaan}`, colInnerW - 26, FONT_BODY));
  const latihanH = pad * 2 + 38 + 14 + latihanLines.reduce((a, ls) => a + ls.length * LH_BODY + 24, 0);
  const row4H = Math.max(rangkumanH, latihanH);

  doc.ensureSpace(row4H);
  ctx = doc.ctx;
  y0 = doc.curY;

  ctx.save();
  drawRoundedRect(ctx, xL, y0, colW, row4H, 24);
  ctx.fillStyle = palette.primarySoft;
  ctx.fill();
  ctx.strokeStyle = palette.primaryBorder;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  const rChipH = drawSectionChip(ctx, xL + pad, y0 + pad, '05 · RANGKUMAN PENTING', palette.primary, '#FFFFFF', 15);
  let ry = y0 + pad + rChipH + 14;
  rangkumanLines.forEach((lines, idx) => {
    ctx.save();
    ctx.fillStyle = palette.primaryDark;
    ctx.font = '800 19px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`${idx + 1}.`, xL + pad, ry);
    ctx.restore();
    drawLines(ctx, lines, xL + pad + 30, ry, LH_BODY, FONT_BODY_BOLD, palette.textMain);
    ry += Math.max(1, lines.length) * LH_BODY + 10;
  });

  ctx.save();
  drawRoundedRect(ctx, xR, y0, colW, row4H, 24);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.strokeStyle = palette.primaryBorder;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  const lChipH = drawSectionChip(ctx, xR + pad, y0 + pad, '06 · LATIHAN PEMAHAMAN', palette.primaryDark, '#FFFFFF', 15);
  let ly = y0 + pad + lChipH + 14;
  latihanLines.forEach((lines) => {
    const qh = lines.length * LH_BODY + 16;
    ctx.save();
    drawRoundedRect(ctx, xR + pad, ly, colInnerW, qh, 12);
    ctx.fillStyle = '#F8FAFC';
    ctx.fill();
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
    drawLines(ctx, lines, xR + pad + 14, ly + 8, LH_BODY, FONT_BODY, palette.textMain);
    ly += qh + 8;
  });

  doc.curY += row4H + 18;
}

export async function composeMateriA4Pages(
  item: MateriAjarInfografis,
  profile: UserProfile | null
): Promise<HTMLCanvasElement[]> {
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // ignore
    }
  }

  const palette = INFOGRAFIS_THEMES[item.temaWarna || 'emerald'] || INFOGRAFIS_THEMES.emerald;
  const [intiImg, dailyImg] = await Promise.all([
    loadSvgAsImage(item.intiMateri?.ilustrasiSvg),
    loadSvgAsImage(item.contohSehariHari?.ilustrasiSvg),
  ]);

  const doc = new PaginatedA4Composer(item, profile, palette);
  drawHeaderAndPengantar(doc, item, profile, palette);
  await drawStyleSpecificShowcase(doc, item, palette);
  drawIntiMateriSection(doc, item, palette, intiImg);
  drawBottomPedagogicalSections(doc, item, palette, dailyImg);
  doc.finalize();
  return doc.pages;
}

export async function renderMateriPdfPagesPreview(
  item: MateriAjarInfografis,
  profile: UserProfile | null
): Promise<string[]> {
  const canvases = await composeMateriA4Pages(item, profile);
  return canvases.map((c) => c.toDataURL('image/jpeg', 0.9));
}

export async function downloadMateriPdf(
  item: MateriAjarInfografis,
  profile: UserProfile | null
): Promise<void> {
  const canvases = await composeMateriA4Pages(item, profile);
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  canvases.forEach((canvas, idx) => {
    if (idx > 0) pdf.addPage('a4', 'portrait');
    const imgData = canvas.toDataURL('image/jpeg', 0.94);
    pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
  });

  const tpl = getTemplateOption(item.gayaTemplate);
  const safeStyle = tpl.id.replace(/_/g, '-');
  const safeTitle = (item.judulMateri || 'materi-ajar')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40);
  pdf.save(`Materi-PAIBP-Kls${item.grade}-${safeStyle}-${safeTitle}.pdf`);
}
