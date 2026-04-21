import assert from "node:assert/strict";
import { createRequire } from "node:module";

import { idsEqual } from "../src/utils/id.js";
import { isJsonObject, isJsonString } from "../src/utils/json.js";
import {
	createEmptyNote,
	appendTrailingEmptyNote,
	ensureAtLeastOneNote,
} from "../src/utils/noteUtils.js";
import { parseUrl } from "../src/utils/navigation.js";
import { downloadBlob, downloadJsonFile } from "../src/utils/download.js";
import CampaignViewModel from "../src/models/CampaignViewModel.js";
import SessionViewModel from "../src/models/SessionViewModel.js";
import CharacterCardModel from "../src/models/CharacterCardModel.js";
import MonsterStatBlockModel from "../src/models/MonsterStatBlockModel.js";
import SpellCardModel from "../src/models/SpellCardModel.js";

const require = createRequire(import.meta.url);
const storage = require("../server/storage.js");

const results = [];

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
	assert.equal(model.completeButtonLabel, "Завершити");
	assert.equal(model.saveStatusLabel, "Зберігання...");
	assert.equal(model.findEncounterName(model.scenes[0]), "Fight");
	assert.equal(model.findEncounterName({ encounterId: "missing" }), "Без назви");
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

const failed = results.filter((r) => !r.ok);
console.log(`\nTotal: ${results.length}, Passed: ${results.length - failed.length}, Failed: ${failed.length}`);

if (failed.length > 0) {
	process.exitCode = 1;
}
