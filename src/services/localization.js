export const LANG_STORAGE_KEY = "prm.language";
export const DEFAULT_LANGUAGE = "uk";

function loadLanguagePacks() {
	const modules = import.meta.glob("../langs/*.json", { eager: true });
	const packs = {};

	Object.entries(modules).forEach(([filePath, moduleValue]) => {
		const match = filePath.match(/\/([a-z]{2})\.json$/i);
		if (!match) return;
		const code = match[1].toLowerCase();
		const dictionary = moduleValue?.default || moduleValue || {};
		packs[code] = dictionary;
	});

	return packs;
}

function formatTemplate(template, variables = {}) {
	return String(template || "").replace(/\{([a-zA-Z0-9_]+)\}/g, (fullMatch, key) => {
		if (Object.prototype.hasOwnProperty.call(variables, key)) {
			return String(variables[key]);
		}
		return fullMatch;
	});
}

class Localization {
	constructor(options = {}) {
		this.defaultLanguage = String(options.defaultLanguage || DEFAULT_LANGUAGE).toLowerCase();
		this.storageKey = options.storageKey || LANG_STORAGE_KEY;
		this.packs = loadLanguagePacks();

		const initialLanguage =
			options.initialLanguage ||
			(typeof localStorage !== "undefined"
				? localStorage.getItem(this.storageKey)
				: null) ||
			this.defaultLanguage;

		this.currentLanguage = this.normalizeLanguage(initialLanguage);
	}

	normalizeLanguage(code) {
		const normalized = String(code || "").toLowerCase();
		if (this.packs[normalized]) return normalized;
		if (this.packs[this.defaultLanguage]) return this.defaultLanguage;
		const firstAvailable = Object.keys(this.packs)[0];
		return firstAvailable || "en";
	}

	getAvailableLanguages() {
		return Object.keys(this.packs);
	}

	getLanguage() {
		return this.currentLanguage;
	}

	setLanguage(code) {
		this.currentLanguage = this.normalizeLanguage(code);
		if (typeof localStorage !== "undefined") {
			localStorage.setItem(this.storageKey, this.currentLanguage);
		}
		return this.currentLanguage;
	}

	t(phrase, variables = {}) {
		const source = String(phrase || "");
		const dictionary = this.packs[this.currentLanguage] || {};
		const translated = dictionary[source] || source;
		return formatTemplate(translated, variables);
	}
}

export { Localization };

export const lang = new Localization();
