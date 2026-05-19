const GENERATED_ARRAY_KEYS = [
	"characters",
	"npcs",
	"locations",
	"scenes",
	"encounters",
	"notes",
	"monsters",
];

function isObject(value) {
	return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function hasText(value) {
	return String(value || "").trim().length > 0;
}

function addError(errors, path, message) {
	errors.push({ path, message });
}

function validateNamedObjectList(payload, key, errors, nameKeys = ["name", "title"]) {
	if (payload[key] === undefined) return;
	if (!Array.isArray(payload[key])) {
		addError(errors, key, "must be an array");
		return;
	}

	payload[key].forEach((item, index) => {
		if (!isObject(item)) {
			addError(errors, `${key}[${index}]`, "must be an object");
			return;
		}
		if (item.delete || item.deleted || item._delete) return;
		if (!nameKeys.some((nameKey) => hasText(item[nameKey]))) {
			addError(errors, `${key}[${index}]`, "must have a name");
		}
	});
}

function validateNotes(payload, errors) {
	if (payload.notes === undefined) return;
	if (!Array.isArray(payload.notes)) {
		addError(errors, "notes", "must be an array");
		return;
	}

	payload.notes.forEach((note, index) => {
		if (typeof note === "string") return;
		if (!isObject(note)) {
			addError(errors, `notes[${index}]`, "must be a string or object");
			return;
		}
		if (!hasText(note.title || note.name) && !hasText(note.text || note.content || note.description)) {
			addError(errors, `notes[${index}]`, "must have text");
		}
	});
}

function validateScenes(payload, errors) {
	if (payload.scenes === undefined) return;
	if (!Array.isArray(payload.scenes)) {
		addError(errors, "scenes", "must be an array");
		return;
	}

	payload.scenes.forEach((scene, index) => {
		if (!isObject(scene)) {
			addError(errors, `scenes[${index}]`, "must be an object");
			return;
		}
		if (!isObject(scene.texts) && !hasText(scene.summary || scene.name || scene.title)) {
			addError(errors, `scenes[${index}]`, "must have texts or summary");
		}
		if (scene.npcs !== undefined && !Array.isArray(scene.npcs)) {
			addError(errors, `scenes[${index}].npcs`, "must be an array");
		}
		if (scene.notes !== undefined && !Array.isArray(scene.notes)) {
			addError(errors, `scenes[${index}].notes`, "must be an array");
		}
	});
}

function validateEncounters(payload, errors) {
	if (payload.encounters === undefined) return;
	if (!Array.isArray(payload.encounters)) {
		addError(errors, "encounters", "must be an array");
		return;
	}

	payload.encounters.forEach((encounter, index) => {
		if (!isObject(encounter)) {
			addError(errors, `encounters[${index}]`, "must be an object");
			return;
		}
		if (encounter.monsters !== undefined && !Array.isArray(encounter.monsters)) {
			addError(errors, `encounters[${index}].monsters`, "must be an array");
		}
	});
}

function validateCustomMonsters(payload, errors, { requireMonsters = false } = {}) {
	if (payload.monsters === undefined) {
		if (requireMonsters) addError(errors, "monsters", "must be an array");
		return;
	}
	if (!Array.isArray(payload.monsters)) {
		addError(errors, "monsters", "must be an array");
		return;
	}
	if (requireMonsters && payload.monsters.length === 0) {
		addError(errors, "monsters", "must not be empty");
	}

	payload.monsters.forEach((monster, index) => {
		if (!isObject(monster)) {
			addError(errors, `monsters[${index}]`, "must be an object");
			return;
		}
		if (!hasText(monster.name || monster.title)) {
			addError(errors, `monsters[${index}]`, "must have a name");
		}
		if (monster.spellcasting !== undefined && !Array.isArray(monster.spellcasting)) {
			addError(errors, `monsters[${index}].spellcasting`, "must be an array");
		}
	});
}

function validateAiGeneratedContent(payload, options = {}) {
	const errors = [];
	if (!isObject(payload)) {
		return {
			valid: false,
			errors: [{ path: "$", message: "must be an object" }],
		};
	}

	for (const key of GENERATED_ARRAY_KEYS) {
		if (payload[key] !== undefined && !Array.isArray(payload[key])) {
			addError(errors, key, "must be an array");
		}
	}

	validateNamedObjectList(payload, "characters", errors, [
		"name",
		"fullName",
		"firstName",
		"first_name",
		"title",
	]);
	validateNamedObjectList(payload, "npcs", errors, [
		"name",
		"fullName",
		"firstName",
		"first_name",
		"title",
	]);
	validateNamedObjectList(payload, "locations", errors);
	validateNotes(payload, errors);
	validateScenes(payload, errors);
	validateEncounters(payload, errors);
	validateCustomMonsters(payload, errors, {
		requireMonsters: options.type === "custom-monster",
	});

	return {
		valid: errors.length === 0,
		errors,
	};
}

function assertAiGeneratedContentContract(payload, options = {}) {
	const result = validateAiGeneratedContent(payload, options);
	if (result.valid) return result;

	const error = new Error(
		`AI response does not match expected schema: ${result.errors
			.map((entry) => `${entry.path} ${entry.message}`)
			.join("; ")}`,
	);
	error.status = 400;
	error.details = result.errors;
	throw error;
}

module.exports = {
	assertAiGeneratedContentContract,
	validateAiGeneratedContent,
};
