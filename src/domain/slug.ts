export function create_slug(input: string): string {
  const slug = input
    .trim()
    .toLowerCase()
    .replace(/\s+/gu, '-')
    .replace(/[\\/:*?"<>|#%{}^~[\]`]+/gu, '')
    .replace(/-+/gu, '-')
    .replace(/^-|-$/gu, '')
    .slice(0, 60)
    .replace(/-$/gu, '');

  return slug.length > 0 ? slug : 'untitled';
}
