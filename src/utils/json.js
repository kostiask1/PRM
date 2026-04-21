export function isJsonObject(str) {
	try {
		const o = JSON.parse(str);

		if (o && typeof o === "object") {
			return true;
		}
	} catch {
		return false;
	}

	return false;
}

export function isJsonString(str) {
	try {
		const result = JSON.parse(str);

		if (typeof result === "string") {
			return true;
		}
	} catch {
		return false;
	}
	return false;
}
