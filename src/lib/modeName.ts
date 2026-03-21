const DEFAULT_MODE_NAME = 'CUSTOM MODE';
const CUSTOM_MODE_BASE_LIMIT = 12;

function collapseWhitespace(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

export function normalizeModeName(value: string, options?: { defaultName?: string; baseLimit?: number }) {
  const defaultName = options?.defaultName || DEFAULT_MODE_NAME;
  const baseLimit = options?.baseLimit || CUSTOM_MODE_BASE_LIMIT;
  const normalized = collapseWhitespace(value);

  if (!normalized) return defaultName;

  const words = normalized.split(' ').filter(Boolean);
  const hasStandaloneMode = words.some((word) => /^mode$/i.test(word));

  if (hasStandaloneMode) {
    const withoutMode = collapseWhitespace(words.filter((word) => !/^mode$/i.test(word)).join(' '));
    if (!withoutMode) return defaultName;
    const limitedBase = withoutMode.slice(0, baseLimit).trim();
    return `${limitedBase.toUpperCase()} MODE`;
  }

  if (/mode/i.test(normalized)) {
    return normalized.toUpperCase();
  }

  const limitedBase = normalized.slice(0, baseLimit).trim();
  if (!limitedBase) return defaultName;
  return `${limitedBase.toUpperCase()} MODE`;
}
