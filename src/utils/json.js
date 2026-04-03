export function isJsonObject(str) {
	try {
		const o = JSON.parse(str);

		if (o && typeof o === "object") {
			return true;
		}
	} catch (e) {}

	return false;
}

export function isJsonString(str) {
	try {
		const result = JSON.parse(str);

		if (typeof result === "string") {
			return true;
		}
	} catch (e) {}
	return false;
}
