export const type = {
  hero: 'heading-mode',
  heroCritical: 'heading-mode heading-mode-critical',
  heading: 'heading-sm text-[20px]',
  body: 'body',
  label: 'label-system',
  identityLabel: 'label-identity',
  identityLabelCritical: 'label-identity-critical',
  value: 'metric-number text-[18px]',
  button: 'font-primary-bold text-[12px] tracking-[0.15em] uppercase',
} as const;

export function formatHeadingText(value: string) {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
