import { jsPDF } from 'jspdf';
import type { NeuralProfile, SynapticVaultState } from '@/core/model/types';

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
}

export function exportCodexPdf(profile: NeuralProfile): void {
  const pdf = new jsPDF();
  pdf.setFillColor(10, 14, 20); pdf.rect(0, 0, 210, 297, 'F'); pdf.setTextColor(202, 169, 110); pdf.setFontSize(20); pdf.text('CITADEL // GRAND CODEX', 20, 26);
  pdf.setFontSize(11); pdf.setTextColor(230, 230, 230); pdf.text(`Answered: ${profile.totalAnswered}   Resonance: ${profile.resonantFrequency.toFixed(2)} / 5`, 20, 42);
  let y = 62; for (const [name, score] of Object.entries(profile.archetypeScores)) { pdf.text(`${name}: ${score.toFixed(1)}`, 20, y); y += 11; }
  pdf.save('citadel-grand-codex.pdf');
}

export function exportCodexPoster(profile: NeuralProfile, vault: SynapticVaultState): void {
  const canvas = document.createElement('canvas'); canvas.width = 1600; canvas.height = 2200; const context = canvas.getContext('2d'); if (!context) return;
  context.fillStyle = '#0a0d12'; context.fillRect(0, 0, canvas.width, canvas.height); context.strokeStyle = '#c8a96e'; context.lineWidth = 4; context.strokeRect(60, 60, 1480, 2080);
  context.fillStyle = '#c8a96e'; context.font = '52px monospace'; context.fillText('CITADEL // GRAND CODEX', 130, 190); context.fillStyle = '#e8e8e8'; context.font = '30px monospace'; context.fillText(`${profile.totalAnswered} DIALECTICS ANSWERED`, 130, 270);
  let y = 420; for (const [name, score] of Object.entries(profile.archetypeScores)) { context.fillStyle = '#e8e8e8'; context.fillText(name.toUpperCase(), 130, y); context.fillStyle = '#60c0f0'; context.fillRect(500, y - 28, Math.min(780, score * 130), 24); context.fillStyle = '#e8e8e8'; context.fillText(score.toFixed(1), 1320, y); y += 110; }
  context.fillStyle = '#888'; context.font = '24px monospace'; context.fillText(`ACTIVE DECK: ${vault.activeDeckId}`, 130, 1950); canvas.toBlob((blob) => { if (blob) download(blob, 'citadel-grand-codex.png'); }, 'image/png');
}