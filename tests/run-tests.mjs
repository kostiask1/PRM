import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs/promises";
import path from "node:path";

import { idsEqual } from "../src/utils/id.js";
import { isJsonObject, isJsonString } from "../src/utils/json.js";
import { matchesMonsterSearch, getMonsterTypeString } from "../src/utils/bestiary.js";
import classNames from "../src/utils/classNames.js";
import { rollDiceFormula } from "../src/utils/dice.js";
import { normalizeConditionName, loadConditionsMap } from "../src/utils/conditions.js";
import {
	createEmptyNote,
	appendTrailingEmptyNote,
	ensureAtLeastOneNote,
} from "../src/utils/noteUtils.js";
import {
	buildNavigationUrl,
	parseUrl,
	shouldOpenInNewTabFromEvent,
} from "../src/utils/navigation.js";
import { downloadBlob, downloadJsonFile } from "../src/utils/download.js";
import { getSpellByName, getConditionByName } from "../src/utils/referencePreview.js";
import { resolveSpellInput, resolveConditionInput } from "../src/utils/referenceResolvers.js";
import CampaignViewModel from "../src/models/CampaignViewModel.js";
import SessionViewModel from "../src/models/SessionViewModel.js";
import CharacterCardModel from "../src/models/CharacterCardModel.js";
import MonsterStatBlockModel from "../src/models/MonsterStatBlockModel.js";
import SpellCardModel from "../src/models/SpellCardModel.js";
import { api } from "../src/api.js";

const require = createRequire(import.meta.url);
const storage = require("../server/storage.js");
const spellsRouter = require("../server/routes/spells.js");

const results = [];
const TEST_PREFIX = `autotest-${Date.now()}`;

function makeTestSlug(name) {
	return `${TEST_PREFIX}-${name}-${Math.random().toString(36).slice(2, 10)}`;
}

async function cleanupTestData(slug) {
	await fs.rm(path.join(storage.IMAGES_DIR, slug), { recursive: true, force: true });
	await fs.rm(storage.campaignDir(slug), { recursive: true, force: true });
}

async function withTestSlug(name, callback) {
	const slug = makeTestSlug(name);
	try {
		return await callback(slug);
	} finally {
		await cleanupTestData(slug);
	}
}

async function run(name, fn) {
	try {
		await fn();
		results.push({ name, ok: true });
		console.log(`PASS ${name}`);
	} catch (error) {
		results.push({ name, ok: false, error });
		console.error(`FAIL ${name}`);
		console.error(error);
	}
}

await run("idsEqual compares values by string representation", () => {
	assert.equal(idsEqual(1, "1"), true);
	assert.equal(idsEqual("abc", "abc"), true);
	assert.equal(idsEqual(null, "1"), false);
	assert.equal(idsEqual(undefined, undefined), false);
});

await run("JSON helpers validate object and string payloads", () => {
	assert.equal(isJsonObject('{"a":1}'), true);
	assert.equal(isJsonObject('"hello"'), false);
	assert.equal(isJsonObject("not-json"), false);
	assert.equal(isJsonString('"hello"'), true);
	assert.equal(isJsonString('{"a":1}'), false);
	assert.equal(isJsonString("not-json"), false);
});

await run("note helpers maintain trailing empty note slot", () => {
	const note = createEmptyNote();
	assert.equal(note.title, "");
	assert.equal(note.text, "");
	assert.equal(note.collapsed, false);
	assert.ok(note.id);

	const withContent = [{ ...note, title: "A" }];
	const appended = appendTrailingEmptyNote(withContent);
	assert.equal(appended.length, 2);
	assert.equal(appended[1].title, "");
	assert.equal(appendTrailingEmptyNote([createEmptyNote()]).length, 1);
	assert.equal(ensureAtLeastOneNote([]).length, 1);
});

await run("parseUrl supports campaign/session/encounter and static sections", () => {
	const originalWindow = global.window;
	try {
		global.window = { location: { pathname: "/campaign/test-c/session/s1" } };
		assert.deepEqual(parseUrl(), { campaign: "test-c", session: "s1", encounter: null });
		global.window = { location: { pathname: "/campaign/test-c/session/s1/encounter/e1" } };
		assert.deepEqual(parseUrl(), { campaign: "test-c", session: "s1", encounter: "e1" });
		global.window = { location: { pathname: "/bestiary" } };
		assert.deepEqual(parseUrl(), { campaign: "bestiary", session: null, encounter: null });
		global.window = { location: { pathname: "/spells" } };
		assert.deepEqual(parseUrl(), { campaign: "spells", session: null, encounter: null });
	} finally {
		global.window = originalWindow;
	}
});

await run("navigation helpers support modifier tab-open and URL building", () => {
	assert.equal(shouldOpenInNewTabFromEvent({ ctrlKey: true }), true);
	assert.equal(shouldOpenInNewTabFromEvent({ metaKey: true }), true);
	assert.equal(shouldOpenInNewTabFromEvent({ ctrlKey: false, metaKey: false }), false);
	assert.equal(shouldOpenInNewTabFromEvent(null), false);

	assert.equal(buildNavigationUrl(null), "/");
	assert.equal(buildNavigationUrl("bestiary"), "/bestiary");
	assert.equal(buildNavigationUrl("spells"), "/spells");
	assert.equal(
		buildNavigationUrl("camp", "sess 1", "enc-1"),
		"/campaign/camp/session/sess%201/encounter/enc-1",
	);
});

await run("CampaignViewModel formats links and dates", () => {
	const model = new CampaignViewModel({
		slug: "my-campaign",
		name: "My Campaign",
		createdAt: "2026-01-01T00:00:00.000Z",
	});
	assert.equal(model.name, "My Campaign");
	assert.equal(model.buildSessionHref("session 1.json"), "/campaign/my-campaign/session/session%201.json");
	assert.notEqual(model.createdAtLabel, "-");
	assert.equal(model.formatSessionUpdatedAt(""), "-");
});

await run("SessionViewModel encounter lookup and labels", () => {
	const model = new SessionViewModel({
		completed: false,
		isSaving: true,
		data: {
			notes: [{ id: 1 }],
			scenes: [{ id: 2, encounterId: "enc-1" }],
			encounters: [{ id: "enc-1", name: "Fight" }],
		},
	});
	assert.equal(model.completeButtonLabel, "Complete");
	assert.equal(model.saveStatusLabel, "Saving...");
	assert.equal(model.findEncounterName(model.scenes[0]), "Fight");
	assert.equal(model.findEncounterName({ encounterId: "missing" }), "Untitled");
});

await run("CharacterCardModel derives fields and maintains notes", () => {
	const model = new CharacterCardModel({
		firstName: "Ім'я",
		lastName: "Прізвище",
		level: "3",
		race: "Ельф",
		class: "Маг",
		notes: [],
	});
	assert.equal(model.displayName, "Ім'я");
	assert.equal(model.fullName, "Ім'я Прізвище");
	assert.equal(model.level, 3);
	assert.equal(model.notes.length, 1);
	const noteId = model.notes[0].id;
	assert.ok(model.withUpdatedNote(noteId, { title: "T" }).some((n) => n.title === "T"));
	assert.equal(model.withDeletedNote(noteId).length, 1);
});

await run("MonsterStatBlockModel formats combat data", () => {
	const model = new MonsterStatBlockModel({
		name: "Orc",
		source: "MM",
		size: ["M"],
		alignment: ["C", "E"],
		ac: [{ ac: 13, from: ["armor"] }],
		hp: { average: 15, formula: "2d8+6" },
		speed: { walk: 30, fly: { number: 60, condition: "(hover)" }, canHover: true },
		str: 16, dex: 12, con: 14, int: 8, wis: 11, cha: 10,
	});
	assert.equal(model.size, "Medium");
	assert.equal(model.alignment, "Chaotic Evil");
	assert.equal(model.ac.val, 13);
	assert.equal(model.hp.val, 15);
	assert.match(model.localTokenSrc, /\/database\/bestiary\/tokens\/MM\/Orc\.webp$/);
});

await run("SpellCardModel formats spell labels", () => {
	const model = new SpellCardModel({
		name: "Magic Missile|PHB",
		source: "PHB",
		page: 257,
		level: 1,
		school: "V",
		time: [{ number: 1, unit: "action" }],
		range: { type: "point", distance: { type: "feet", amount: 120 } },
		components: { v: true, s: true, m: "a bit of phosphorus" },
		duration: [{ type: "instant" }],
	});
	assert.equal(model.displayName, "Magic Missile");
	assert.equal(model.levelLabel, "1-й рівень");
	assert.match(model.rangeLabel, /120 фт/);
	assert.equal(model.durationLabel, "Миттєво");
	assert.equal(model.sourceLabel, "PHB (стор. 257)");
});

await run("download helpers create and revoke blob URL", () => {
	const originalURL = global.URL;
	const originalDocument = global.document;
	const originalBlob = global.Blob;

	let clicked = false;
	let revokedUrl = "";
	const anchor = {
		href: "",
		download: "",
		click() {
			clicked = true;
		},
	};

	global.URL = {
		createObjectURL(blob) {
			assert.ok(blob);
			return "blob:test";
		},
		revokeObjectURL(url) {
			revokedUrl = url;
		},
	};
	global.document = {
		createElement(tag) {
			assert.equal(tag, "a");
			return anchor;
		},
	};
	global.Blob = class BlobMock {
		constructor(parts, options) {
			this.parts = parts;
			this.type = options?.type;
		}
	};

	try {
		downloadBlob(new global.Blob(["x"], { type: "text/plain" }), "x.txt");
		assert.equal(anchor.href, "blob:test");
		assert.equal(anchor.download, "x.txt");
		assert.equal(clicked, true);
		assert.equal(revokedUrl, "blob:test");
		clicked = false;
		downloadJsonFile({ a: 1 }, "a.json");
		assert.equal(anchor.download, "a.json");
		assert.equal(clicked, true);
	} finally {
		global.URL = originalURL;
		global.document = originalDocument;
		global.Blob = originalBlob;
	}
});

await run("storage core helpers sanitize and build identifiers", () => {
	const dirty = '  test<>:"/\\|?*\u0001  name...  ';
	assert.equal(storage.sanitizeName(dirty), "test name");
	assert.match(storage.campaignSlug(" Моя Кампанія !!! "), /^[\p{L}\p{N}-]+$/u);
	assert.equal(storage.sessionFileName("Session <> Name").endsWith(".json"), true);
	const id1 = storage.createId();
	const id2 = storage.createId();
	assert.notEqual(id1, id2);
	const session = storage.makeDefaultSessionData("My Session");
	assert.equal(session.name, "My Session");
	assert.equal(session.completed, false);
	assert.equal(storage.campaignDir("../unsafe").includes(".."), false);
});

await run("classNames merges strings arrays objects and falsy values", () => {
	assert.equal(classNames("a", "b"), "a b");
	assert.equal(classNames("a", ["b", null, ["c", 1]], { d: true, e: false }), "a b c 1 d");
	assert.equal(classNames(null, false, 0, "", { test: 1, hidden: 0 }), "test");
});

await run("bestiary search helpers match by name, type and tags", () => {
	const dragon = {
		name: "Young Red Dragon",
		type: {
			type: "dragon",
			tags: ["fire", "chromatic"],
		},
	};
	const chooser = {
		name: "Shifter Beast",
		type: {
			type: { choose: ["fiend", "undead"] },
			tags: ["shapechanger"],
		},
	};

	assert.equal(getMonsterTypeString("beast"), "beast");
	assert.equal(getMonsterTypeString({ type: "dragon" }), "dragon");
	assert.equal(getMonsterTypeString({ type: { choose: ["fiend", "undead"] } }), "fiend/undead");
	assert.equal(matchesMonsterSearch(dragon, ""), true);
	assert.equal(matchesMonsterSearch(dragon, "red"), true);
	assert.equal(matchesMonsterSearch(dragon, "dragon"), true);
	assert.equal(matchesMonsterSearch(dragon, "chromatic"), true);
	assert.equal(matchesMonsterSearch(dragon, "construct"), false);
	assert.equal(matchesMonsterSearch(chooser, "undead"), true);
	assert.equal(matchesMonsterSearch(chooser, "shapechanger"), true);
});

await run("rollDiceFormula computes deterministic totals keep suffix and critical", () => {
	const originalRandom = Math.random;
	const originalNow = Date.now;
	let idx = 0;
	const randomValues = [0, 0.5, 0, 0, 0.5, 0.99];

	Math.random = () => randomValues[idx++];
	Date.now = () => 12345;

	try {
		const basic = rollDiceFormula("2d6 + 3 - 1");
		assert.equal(basic.id, 12345);
		assert.equal(basic.formula, "2d6 + 2");
		assert.equal(basic.total, 7);
		assert.equal(basic.average, 9);
		assert.equal(basic.isCritical, false);
		assert.equal(basic.breakdown.length, 4);

		const critical = rollDiceFormula("1d20+5");
		assert.equal(critical.isCritical, true);
		assert.equal(critical.total, 1);
		assert.equal(critical.formula, "1d20 + 5");

		const keepHighest = rollDiceFormula("3d6h2");
		assert.equal(keepHighest.total, 10);
		assert.equal(keepHighest.average, 7);
		assert.equal(keepHighest.breakdown.filter((entry) => entry.dropped).length, 1);

		assert.equal(rollDiceFormula(""), null);
		const unknown = rollDiceFormula("abc");
		assert.equal(unknown.total, 0);
		assert.equal(unknown.formula, "");
	} finally {
		Math.random = originalRandom;
		Date.now = originalNow;
	}
});

await run("conditions and reference resolvers use normalized keys and cache", async () => {
	const originalSearchSpells = api.searchSpells;
	const originalGetConditions = api.getConditions;
	let spellCalls = 0;
	let conditionCalls = 0;

	api.searchSpells = async (params = {}) => {
		spellCalls += 1;
		if (String(params.name || "").includes("magic missile")) {
			return [
				{ name: "Magic Missile|PHB", source: "PHB" },
				{ name: "Magic Missile|XPHB", source: "XPHB" },
			];
		}
		return [{ name: "Shield|PHB", source: "PHB" }];
	};

	api.getConditions = async () => {
		conditionCalls += 1;
		if (conditionCalls === 1) {
			throw new Error("temporary");
		}
		return [
			{ name: "Prone", entries: ["..."] },
			{ name: "Blinded", entries: ["..."] },
		];
	};

	try {
		assert.equal(normalizeConditionName("  BLINDED "), "blinded");
		await assert.rejects(() => loadConditionsMap(), /temporary/);

		const conditionMap = await loadConditionsMap();
		assert.equal(conditionCalls, 2);
		assert.equal(conditionMap.get("prone")?.name, "Prone");
		const sameMap = await loadConditionsMap();
		assert.equal(sameMap, conditionMap);
		assert.equal(conditionCalls, 2);

		const spell = await getSpellByName(" Magic Missile ");
		assert.equal(spell?.name, "Magic Missile|PHB");
		const sameSpell = await getSpellByName("magic missile|xphb");
		assert.equal(sameSpell?.name, "Magic Missile|PHB");
		assert.equal(spellCalls, 1);

		assert.equal((await resolveSpellInput({ name: "Manual Spell" })).name, "Manual Spell");
		assert.equal((await resolveSpellInput("Shield")).name, "Shield|PHB");
		assert.equal(await resolveSpellInput(""), null);
		assert.equal(await resolveSpellInput(123), null);

		assert.equal((await getConditionByName(" prone ")).name, "Prone");
		assert.equal((await resolveConditionInput({ name: "Stunned", entries: ["text"] })).name, "Stunned");
		assert.equal((await resolveConditionInput("Prone")).name, "Prone");
		assert.equal(await resolveConditionInput({ foo: "bar" }), null);
	} finally {
		api.searchSpells = originalSearchSpells;
		api.getConditions = originalGetConditions;
	}
});

await run("spells conditions route merges kinds and prefers newer sources", async () => {
	const originalExists = storage.exists;
	const originalReadJson = storage.readJson;
	const layer = spellsRouter.stack.find((item) => item.route?.path === "/conditions");
	assert.ok(layer);
	const handler = layer.route.stack[0].handle;

	storage.exists = async () => true;
	storage.readJson = async () => ({
		condition: [
			{ name: "Blinded", source: "PHB", page: 1, entries: ["old"] },
			{ name: "Blinded", source: "XPHB", page: 2, entries: ["new"] },
		],
		status: [{ name: "Concentration", source: "PHB", page: 3, entries: ["status"] }],
	});

	try {
		let jsonPayload = null;
		await handler(
			{},
			{
				json(value) {
					jsonPayload = value;
					return value;
				},
			},
			(error) => {
				throw error;
			},
		);

		assert.ok(Array.isArray(jsonPayload));
		assert.equal(jsonPayload.length, 2);
		assert.deepEqual(jsonPayload.map((item) => item.name), ["Blinded", "Concentration"]);

		const blinded = jsonPayload.find((item) => item.name === "Blinded");
		const concentration = jsonPayload.find((item) => item.name === "Concentration");
		assert.equal(blinded.kind, "condition");
		assert.equal(blinded.source, "XPHB");
		assert.deepEqual(blinded.entries, ["new"]);
		assert.equal(concentration.kind, "status");
		assert.equal(concentration.source, "PHB");
	} finally {
		storage.exists = originalExists;
		storage.readJson = originalReadJson;
	}
});

await run("storage image listing and subcategory discovery", async () => {
	await withTestSlug("images-list", async (slug) => {
		const category = "characters";
		const rootDir = storage.campaignImagesDir(slug, category);
		const nestedDir = storage.campaignImagesDir(slug, category, "nested");
		await storage.ensureDir(rootDir);
		await storage.ensureDir(nestedDir);
		await fs.writeFile(path.join(rootDir, "a.png"), "a", "utf8");
		await fs.writeFile(path.join(rootDir, "b.txt"), "b", "utf8");
		await fs.writeFile(path.join(nestedDir, "c.webp"), "c", "utf8");

		const rootImages = await storage.listImages(slug, category);
		assert.deepEqual(rootImages.map((item) => item.name), ["a.png"]);
		assert.match(rootImages[0].url, /\/api\/images\//);
		assert.equal(rootImages[0].path, path.join(category, "", "a.png"));

		const subcategories = await storage.listSubcategories(slug, category);
		assert.deepEqual(subcategories, ["nested"]);
		const nestedImages = await storage.listImages(slug, category, "nested");
		assert.deepEqual(nestedImages.map((item) => item.name), ["c.webp"]);
	});
});

await run("storage renameImage handles success and collisions", async () => {
	await withTestSlug("rename-image", async (slug) => {
		const category = "attachments";
		const subcategory = "folder";
		const dir = storage.campaignImagesDir(slug, category, subcategory);
		await storage.ensureDir(dir);
		await fs.writeFile(path.join(dir, "old.png"), "x", "utf8");
		await fs.writeFile(path.join(dir, "existing.png"), "y", "utf8");

		const result = await storage.renameImage(slug, category, subcategory, "old.png", "new.png");
		assert.match(result.oldUrl, /old\.png$/);
		assert.match(result.newUrl, /new\.png$/);
		assert.equal(await storage.exists(path.join(dir, "new.png")), true);
		assert.equal(await storage.exists(path.join(dir, "old.png")), false);

		await assert.rejects(
			() => storage.renameImage(slug, category, subcategory, "missing.png", "x.png"),
		);
		await assert.rejects(
			() => storage.renameImage(slug, category, subcategory, "new.png", "existing.png"),
		);
	});
});

await run("storage moveImages moves files and directories", async () => {
	await withTestSlug("move-images", async (slug) => {
		const category = "characters";
		const srcSubcategory = "src";
		const destSubcategory = "dest";
		const srcDir = storage.campaignImagesDir(slug, category, srcSubcategory);
		await storage.ensureDir(path.join(srcDir, "pack", "nested"));
		await fs.writeFile(path.join(srcDir, "a.png"), "a", "utf8");
		await fs.writeFile(path.join(srcDir, "pack", "nested", "b.png"), "b", "utf8");

		const results = await storage.moveImages(
			["a.png", "pack"],
			{ slug, category, subcategory: srcSubcategory },
			{ slug, category, subcategory: destSubcategory },
		);

		assert.equal(results.length, 2);
		assert.equal(await storage.exists(path.join(srcDir, "a.png")), false);
		assert.equal(await storage.exists(path.join(srcDir, "pack")), false);
		assert.equal(await storage.exists(path.join(storage.campaignImagesDir(slug, category, destSubcategory), "a.png")), true);
		assert.equal(await storage.exists(path.join(storage.campaignImagesDir(slug, category, destSubcategory), "pack", "nested", "b.png")), true);
	});
});

await run("storage deleteImages removes folders or extracts contents", async () => {
	await withTestSlug("delete-images", async (slug) => {
		const category = "tokens";
		const baseSubcategory = "root";
		const baseDir = storage.campaignImagesDir(slug, category, baseSubcategory);
		await storage.ensureDir(path.join(baseDir, "dropme", "nested"));
		await storage.ensureDir(path.join(baseDir, "extractme", "inner"));
		await fs.writeFile(path.join(baseDir, "dropme", "nested", "a.png"), "a", "utf8");
		await fs.writeFile(path.join(baseDir, "extractme", "b.png"), "b", "utf8");
		await fs.writeFile(path.join(baseDir, "extractme", "inner", "c.png"), "c", "utf8");

		await storage.deleteImages(
			["dropme"],
			{ slug, category, subcategory: baseSubcategory },
			{ extractFolderContents: false },
		);
		assert.equal(await storage.exists(path.join(baseDir, "dropme")), false);

		await storage.deleteImages(
			["extractme"],
			{ slug, category, subcategory: baseSubcategory },
			{ extractFolderContents: true },
		);
		assert.equal(await storage.exists(path.join(baseDir, "extractme")), false);
		assert.equal(await storage.exists(path.join(baseDir, "b.png")), true);
		assert.equal(await storage.exists(path.join(baseDir, "inner", "c.png")), true);
	});
});

await run("storage renameSubcategory validates source and destination", async () => {
	await withTestSlug("rename-subcategory", async (slug) => {
		const category = "attachments";
		const root = storage.campaignImagesDir(slug, category);
		await storage.ensureDir(path.join(root, "old"));
		await storage.ensureDir(path.join(root, "taken"));

		await assert.rejects(
			() => storage.renameSubcategory(slug, category, "missing", "target"),
		);
		await assert.rejects(
			() => storage.renameSubcategory(slug, category, "old", "taken"),
		);

		await storage.renameSubcategory(slug, category, "old", "renamed");
		assert.equal(await storage.exists(path.join(root, "renamed")), true);
		assert.equal(await storage.exists(path.join(root, "old")), false);
	});
});

await run("storage updates campaign entities and session references after rename", async () => {
	await withTestSlug("ref-update", async (slug) => {
		const category = "characters";
		const subcategory = "players";
		const imagesDir = storage.campaignImagesDir(slug, category, subcategory);
		await storage.ensureDir(imagesDir);
		await fs.writeFile(path.join(imagesDir, "old.png"), "x", "utf8");

		const oldUrl = `/api/images/${encodeURIComponent(slug)}/${encodeURIComponent(category)}/${subcategory}/old.png`;
		const expectedNewUrl = `/api/images/${encodeURIComponent(slug)}/${encodeURIComponent(category)}/${subcategory}/new.png`;

		await storage.ensureDir(path.join(storage.campaignDir(slug), "sessions"));
		await storage.writeJson(storage.campaignMetaPath(slug), {
			id: `${slug}-id`,
			name: "Test Campaign",
			slug,
			imageUrl: oldUrl,
		});
		await storage.writeEntity(slug, "characters", "hero", {
			id: "hero-1",
			firstName: "Hero",
			lastName: "One",
			level: 1,
			race: "Human",
			class: "Fighter",
			imageUrl: oldUrl,
		});

		const sessionFile = "session.json";
		await storage.writeJson(storage.sessionPath(slug, sessionFile), {
			id: "s1",
			name: "Session 1",
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			completed: false,
			order: 0,
			data: {
				notes: [{ id: 1, title: "", text: `image ${oldUrl}`, collapsed: false }],
			},
		});

		await storage.renameImage(slug, category, subcategory, "old.png", "new.png");

		const meta = await storage.readCampaign(slug);
		assert.equal(meta.imageUrl, expectedNewUrl);
		const entities = await storage.listEntities(slug, "characters");
		assert.equal(entities[0].imageUrl, expectedNewUrl);
		const session = await storage.readSession(slug, sessionFile);
		assert.equal(JSON.stringify(session).includes(expectedNewUrl), true);
		assert.equal(JSON.stringify(session).includes(oldUrl), false);
	});
});

const failed = results.filter((r) => !r.ok);
console.log(`\nTotal: ${results.length}, Passed: ${results.length - failed.length}, Failed: ${failed.length}`);

if (failed.length > 0) {
	process.exitCode = 1;
}
