import type { Note } from '../domain/note.js';

export function render_note_markdown(note: Note): string {
  return [
    `# ${note.title}`,
    '',
    `- 状态：${note.status}`,
    `- 版本：${note.version}`,
    `- 更新时间：${note.updated_at}`,
    '',
    '## 来源概览',
    ...note.source_refs.map(
      (ref) => `- ${ref.source_title} (${ref.source_id})`,
    ),
    '',
    '## 为什么值得关注',
    ...list_items(note.why_it_matters),
    '',
    '## 讨论后的结论',
    ...list_items(note.conclusions),
    '',
    '## 当前理解',
    note.current_understanding,
    '',
    '## 未解决问题',
    ...list_items(note.open_questions),
    '',
    '## 相关笔记',
    ...list_items(note.related_note_ids),
    '',
    '## 来源链接',
    ...note.source_refs.flatMap((ref) => [
      `- ${ref.source_title}: ${ref.source_url ?? ref.source_id}`,
      ...ref.evidence_refs.map((evidence) => `  - ${evidence}`),
    ]),
    '',
  ].join('\n');
}

function list_items(items: string[]): string[] {
  return items.length === 0 ? ['- 无'] : items.map((item) => `- ${item}`);
}
