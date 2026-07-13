function updateEnvValue(envText, key, value) {
	const line = `${key}=${value}`;
	const eol = envText.includes("\r\n") ? "\r\n" : "\n";
	const matcher = new RegExp(`^${key}=.*$`, "m");
	if (matcher.test(envText)) return envText.replace(matcher, line);
	const suffix = envText && !envText.endsWith("\n") ? eol : "";
	return `${envText}${suffix}${line}${eol}`;
}

function createEnvApiKeyStore({ filePath, fileSystem, environment }) {
	return {
		async save(apiKey) {
			let envText = "";
			try {
				envText = await fileSystem.readFile(filePath, "utf8");
			} catch (error) {
				if (error.code !== "ENOENT") throw error;
			}
			await fileSystem.writeFile(
				filePath,
				updateEnvValue(envText, "GEMINI_API_KEY", apiKey),
				"utf8",
			);
			environment.GEMINI_API_KEY = apiKey;
		},
	};
}

module.exports = { createEnvApiKeyStore, updateEnvValue };
