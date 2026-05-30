import { describe, expect, it } from 'vitest';
import { render_note_markdown } from '../../src/notes/render-markdown.js';
import { create_test_note } from '../note-test-helpers.js';

describe('note markdown renderer', () => {
  it('renders required sections and processed evidence locators', () => {
    const markdown = render_note_markdown(create_test_note());

    expect(markdown).toContain('# Test Note');
    expect(markdown).toContain('## 来源概览');
    expect(markdown).toContain('## 为什么值得关注');
    expect(markdown).toContain('## 讨论后的结论');
    expect(markdown).toContain('## 当前理解');
    expect(markdown).toContain('## 未解决问题');
    expect(markdown).toContain('## 相关笔记');
    expect(markdown).toContain('## 来源链接');
    expect(markdown).toContain('processed/segments.json#seg_0001');
  });

  it('renders related note ids from note JSON', () => {
    const markdown = render_note_markdown(
      create_test_note({ related_note_ids: ['note_20260514_related'] }),
    );

    expect(markdown).toContain('- note_20260514_related');
  });

  it('renders stably for the same note', () => {
    const note = create_test_note();

    expect(render_note_markdown(note)).toBe(render_note_markdown(note));
  });

  it('does not mutate the note', () => {
    const note = create_test_note();
    const before = JSON.stringify(note);

    render_note_markdown(note);

    expect(JSON.stringify(note)).toBe(before);
  });
});
