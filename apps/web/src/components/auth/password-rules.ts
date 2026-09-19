export const PASSWORD_RULES = [
  { id: 'length', label: 'At least 10 characters', test: (p: string) => p.length >= 10 },
  { id: 'letter', label: 'A letter', test: (p: string) => /[a-z]/i.test(p) },
  { id: 'number', label: 'A number or symbol', test: (p: string) => /[\d\W_]/.test(p) },
] as const;

export const passwordOk = (p: string) => PASSWORD_RULES.every((r) => r.test(p));
