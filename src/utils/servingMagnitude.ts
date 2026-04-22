export const getServingMagnitude = (qps: number): string => {
  if (qps >= 1000000) return '\u{1F680} Netflix API Scale';
  if (qps >= 150000) return '\u{1F525} Google Search Scale';
  if (qps >= 75000) return '\u{1F4DA} Wikipedia Total Scale';
  if (qps >= 10000) return '\u{1F426} X (Twitter) Writes Scale';
  if (qps >= 2500) return '\u{1F4BB} Stack Overflow Scale';
  if (qps >= 500) return '\u{1F3E2} Large Enterprise Scale';
  return '\u{1F3E0} Boutique Shop Scale';
};
