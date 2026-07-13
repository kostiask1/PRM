export interface LocalizationService {
	getAvailableLanguages(): string[];
	getLanguage(): string;
	setLanguage(code: unknown): string;
	t(phrase: unknown, variables?: Record<string, unknown>): string;
}

export const lang: LocalizationService;
