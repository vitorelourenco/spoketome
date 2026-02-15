const NOTION_URL_REGEX =
  /^https?:\/\/(?:www\.)?notion\.(?:so|site)\/(?:[^/]+\/)*[^?#]*?([0-9a-f]{32})(?:[?#].*)?$/i;

export function extractPageId(url: string): string | null {
  const match = url.match(NOTION_URL_REGEX);
  if (!match) return null;

  const hex = match[1];
  // Format as UUID: 8-4-4-4-12
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

export function isValidNotionUrl(url: string): boolean {
  return NOTION_URL_REGEX.test(url);
}
