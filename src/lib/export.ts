import { Note } from '@/types';

export function exportMarkdown(note: Note): void {
  const content = note.content_markdown || generateMarkdown(note);
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitizeFilename(note.title || 'note')}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportPDF(noteId: string): Promise<void> {
  const element = document.getElementById(`note-content-${noteId}`);
  if (!element) return;

  // Dynamically import html2pdf to avoid SSR issues
  const { default: html2pdf } = await import('html2pdf.js');
  html2pdf().set({
    margin: [10, 10, 10, 10],
    filename: 'note.pdf',
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
  }).from(element).save();
}

export async function exportWord(note: Note): Promise<void> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = await import('docx');

  const children = [];

  // Title
  children.push(new Paragraph({
    text: note.title || '未命名笔记',
    heading: HeadingLevel.HEADING_1,
  }));

  // Summary
  if (note.summary) {
    children.push(new Paragraph({ text: '摘要', heading: HeadingLevel.HEADING_2 }));
    children.push(new Paragraph({ text: note.summary }));
  }

  // Key Points
  if (note.key_points?.length) {
    children.push(new Paragraph({ text: '关键要点', heading: HeadingLevel.HEADING_2 }));
    note.key_points.forEach(point => {
      children.push(new Paragraph({ text: `• ${point}` }));
    });
  }

  // Analysis
  const ac = note.analysis_content;
  if (ac?.main_viewpoints?.length) {
    children.push(new Paragraph({ text: '主要观点', heading: HeadingLevel.HEADING_2 }));
    ac.main_viewpoints.forEach(v => {
      children.push(new Paragraph({ text: `• ${v}` }));
    });
  }

  if (ac?.critical_analysis) {
    children.push(new Paragraph({ text: '批判性分析', heading: HeadingLevel.HEADING_2 }));
    children.push(new Paragraph({ text: ac.critical_analysis }));
  }

  if (ac?.innovative_insights?.length) {
    children.push(new Paragraph({ text: '创新洞见', heading: HeadingLevel.HEADING_2 }));
    ac.innovative_insights.forEach(i => {
      children.push(new Paragraph({ text: `• ${i}` }));
    });
  }

  if (ac?.knowledge_connections?.length) {
    children.push(new Paragraph({ text: '知识关联', heading: HeadingLevel.HEADING_2 }));
    ac.knowledge_connections.forEach(c => {
      children.push(new Paragraph({ text: `• ${c}` }));
    });
  }

  // Tags
  if (note.tags?.length) {
    children.push(new Paragraph({
      text: `标签: ${note.tags.map(t => `#${t}`).join(' ')}`,
    }));
  }

  const doc = new Document({
    sections: [{ properties: {}, children }],
  });

  const buffer = await Packer.toBlob(doc);
  const url = URL.createObjectURL(buffer);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitizeFilename(note.title || 'note')}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function generateMarkdown(note: Note): string {
  const lines: string[] = [];
  lines.push(`# ${note.title || '未命名笔记'}`);
  lines.push('');

  if (note.summary) {
    lines.push('## 摘要');
    lines.push(note.summary);
    lines.push('');
  }

  if (note.key_points?.length) {
    lines.push('## 关键要点');
    note.key_points.forEach(p => lines.push(`- ${p}`));
    lines.push('');
  }

  const ac = note.analysis_content;
  if (ac?.main_viewpoints?.length) {
    lines.push('## 主要观点');
    ac.main_viewpoints.forEach(v => lines.push(`- ${v}`));
    lines.push('');
  }

  if (ac?.critical_analysis) {
    lines.push('## 批判性分析');
    lines.push(ac.critical_analysis);
    lines.push('');
  }

  if (ac?.innovative_insights?.length) {
    lines.push('## 创新洞见');
    ac.innovative_insights.forEach(i => lines.push(`- ${i}`));
    lines.push('');
  }

  if (ac?.knowledge_connections?.length) {
    lines.push('## 知识关联');
    ac.knowledge_connections.forEach(c => lines.push(`- ${c}`));
    lines.push('');
  }

  if (note.tags?.length) {
    lines.push(`**标签**: ${note.tags.map(t => `\`#${t}\``).join(' ')}`);
  }

  return lines.join('\n');
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-z0-9\u4e00-\u9fa5\s-]/gi, '').trim().slice(0, 50) || 'note';
}
