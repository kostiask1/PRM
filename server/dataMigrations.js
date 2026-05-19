const fs = require("fs/promises");
const path = require("path");

const CURRENT_SCHEMA_VERSION = 1;
const SCHEMA_FILE_NAME = "_schema.json";
const BACKUP_DIR_NAME = "_migration-backups";

async function exists(filePath) {
	try {
		await fs.access(filePath);
		return true;
	} catch {
		return false;
	}
}

function createBackupLabel(version) {
	return `v${version}-${new Date().toISOString().replace(/[:.]/g, "-")}`;
}

async function backupFile(storage, filePath, backupLabel) {
	if (!(await exists(filePath))) return null;
	const relative = path.relative(storage.DATA_DIR, filePath);
	if (relative.startsWith("..") || path.isAbsolute(relative)) return null;

	const backupPath = path.join(
		storage.DATA_DIR,
		BACKUP_DIR_NAME,
		backupLabel,
		relative,
	);
	await storage.ensureDir(path.dirname(backupPath));
	await fs.copyFile(filePath, backupPath);
	return backupPath;
}

async function readSchemaState(storage) {
	const schemaPath = path.join(storage.DATA_DIR, SCHEMA_FILE_NAME);
	if (!(await exists(schemaPath))) {
		return { version: 0, appliedAt: null, migrations: [] };
	}
	const state = await storage.readJson(schemaPath);
	return {
		version: Number.parseInt(String(state.version || 0), 10) || 0,
		appliedAt: state.appliedAt || null,
		migrations: Array.isArray(state.migrations) ? state.migrations : [],
	};
}

async function writeSchemaState(storage, state) {
	await storage.writeJson(path.join(storage.DATA_DIR, SCHEMA_FILE_NAME), {
		version: state.version,
		appliedAt: new Date().toISOString(),
		migrations: state.migrations,
	});
}

async function migrateToVersion1(storage) {
	const backupLabel = createBackupLabel(1);
	const backedUp = [];

	await storage.ensureDir(storage.DATA_DIR);

	if (await exists(storage.SETTINGS_PATH)) {
		const backupPath = await backupFile(storage, storage.SETTINGS_PATH, backupLabel);
		if (backupPath) backedUp.push(backupPath);
		const settings = await storage.readSettings();
		await storage.writeJson(storage.SETTINGS_PATH, {
			...storage.DEFAULT_APP_SETTINGS,
			...settings,
		});
	}

	if (await exists(storage.CUSTOM_BESTIARY_PATH)) {
		const backupPath = await backupFile(
			storage,
			storage.CUSTOM_BESTIARY_PATH,
			backupLabel,
		);
		if (backupPath) backedUp.push(backupPath);
		const monsters = await storage.readCustomBestiaryMonsters();
		await storage.writeCustomBestiaryMonsters(monsters);
	}

	return {
		version: 1,
		name: "normalize-settings-and-custom-bestiary",
		backedUp,
		appliedAt: new Date().toISOString(),
	};
}

const MIGRATIONS = [
	{
		version: 1,
		run: migrateToVersion1,
	},
];

async function runDataMigrations(storage) {
	await storage.ensureDir(storage.DATA_DIR);
	const state = await readSchemaState(storage);
	const applied = [];

	for (const migration of MIGRATIONS) {
		if (state.version >= migration.version) continue;
		const result = await migration.run(storage);
		state.version = migration.version;
		state.migrations = [...state.migrations, result];
		await writeSchemaState(storage, state);
		applied.push(result);
	}

	if (state.version < CURRENT_SCHEMA_VERSION) {
		state.version = CURRENT_SCHEMA_VERSION;
		await writeSchemaState(storage, state);
	}

	return {
		version: Math.max(state.version, CURRENT_SCHEMA_VERSION),
		applied,
	};
}

module.exports = {
	CURRENT_SCHEMA_VERSION,
	runDataMigrations,
};
