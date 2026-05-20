import { describe, expect, it } from 'vitest';
import {
  create_note,
  get_note,
  get_note_markdown,
  list_notes,
  save_note_markdown,
} from '../../src/storage/note-repo.js';
import { create_temp_dir } from '../source-test-helpers.js';
import { create_test_note } from '../note-test-helpers.js';

describe('note repo', () => {
  it('creates and reads note JSON and Markdown', async () => {
    const cwd = await create_temp_dir();
    const note = create_test_note();

    await create_note({ note, markdown: '# Test Note\n' }, { cwd });

    await expect(get_note(note.id, { cwd })).resolves.toEqual(note);
    await expect(get_note_markdown(note.id, { cwd })).resolves.toBe(
      '# Test Note\n',
    );
  });

  it('writes Markdown without changing note JSON', async () => {
    const cwd = await create_temp_dir();
    const note = create_test_note();
    await create_note({ note, markdown: '# Old\n' }, { cwd });

    await save_note_markdown(note.id, '# New\n', { cwd });

    await expect(get_note_markdown(note.id, { cwd })).resolves.toBe('# New\n');
    await expect(get_note(note.id, { cwd })).resolves.toEqual(note);
  });

  it('lists notes by updated_at descending and filters by status', async () => {
    const cwd = await create_temp_dir();
    const older = create_test_note({
      id: 'note_20260514_older',
      title: 'Older',
      slug: 'older',
      root_note_id: 'note_20260514_older',
      updated_at: '2026-05-14T00:00:00.000Z',
    });
    const newer = create_test_note({
      id: 'note_20260515_newer',
      title: 'Newer',
      slug: 'newer',
      root_note_id: 'note_20260515_newer',
      updated_at: '2026-05-15T00:00:00.000Z',
      status: 'archived',
    });

    await create_note({ note: older, markdown: '# Older\n' }, { cwd });
    await create_note({ note: newer, markdown: '# Newer\n' }, { cwd });

    await expect(list_notes({}, { cwd })).resolves.toEqual([newer, older]);
    await expect(list_notes({ status: 'draft' }, { cwd })).resolves.toEqual([
      older,
    ]);
  });

  it('returns not found for missing notes', async () => {
    const cwd = await create_temp_dir();

    await expect(get_note('note_20260514_missing', { cwd })).rejects.toThrow(
      'Note not found',
    );
  });
});
