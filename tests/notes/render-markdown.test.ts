import { describe, expect, it } from 'vitest';
import { render_note_markdown } from '../../src/notes/render-markdown.js';
import { create_test_note } from '../note-test-helpers.js';

describe('note markdown renderer', () => {
  it('renders required sections', () => {
    const markdown = render_note_markdown(create_test_note());

    expect(markdown).toContain('# Test Note');
    expect(markdown).toContain('## 来源概览');
    expect(markdown).toContain('## 为什么值得关注');
    expect(markdown).toContain('## 讨论后的结论');
    expect(markdown).toContain('## 当前理解');
    expect(markdown).toContain('## 未解决问题');
    expect(markdown).toContain('## 相关笔记');
    expect(markdown).toContain('## 来源链接');
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
