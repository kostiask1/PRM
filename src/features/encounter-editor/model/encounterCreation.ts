import type { SessionRecord } from "../../../entities/session/index.js";
import type { EncounterEditorId, EncounterScene } from "./contracts.ts";

interface EncounterCreationSessionData extends Record<string, unknown> {
	scenes?: EncounterScene[];
}

export interface EncounterCreationSession extends Record<string, unknown> {
	fileName?: string;
	data?: EncounterCreationSessionData;
}

export interface EncounterNavigationOptions {
	fileName: string;
	openInNewTab: boolean;
}

interface NoEncounterOpenPlan {
	kind: "none";
}

interface NavigateEncounterOpenPlan {
	kind: "navigate";
	encounterId: EncounterEditorId;
	navigation: EncounterNavigationOptions;
}

interface CreateEncounterOpenPlan {
	kind: "create";
	scene: EncounterScene;
	sceneIndex: number;
	openInNewTab: boolean;
}

export type EncounterOpenPlan =
	| NoEncounterOpenPlan
	| NavigateEncounterOpenPlan
	| CreateEncounterOpenPlan;

export interface EncounterCreationResult {
	session: SessionRecord;
	encounterId: EncounterEditorId;
}

export interface EncounterCreationCommandOptions {
	campaignSlug: string;
	session: EncounterCreationSession | null;
	sessionId: string;
	scene: EncounterScene | null | undefined;
	openInNewTab?: boolean;
	flushPendingSave: (options: {
		throwOnError: boolean;
	}) => Promise<SessionRecord | null>;
	requestEncounterName: (
		scene: EncounterScene,
		sceneIndex: number,
	) => string | null | Promise<string | null>;
	createSceneEncounter: (
		campaignSlug: string,
		fileName: string,
		sceneId: EncounterEditorId,
		name: string,
	) => Promise<unknown>;
	setSession: (session: SessionRecord) => void;
	navigateToEncounter: (
		encounterId: EncounterEditorId,
		options: EncounterNavigationOptions,
	) => void;
	onError?: (error: unknown) => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isEncounterEditorId(value: unknown): value is EncounterEditorId {
	return typeof value === "string" || typeof value === "number";
}

function findSceneIndex(
	session: EncounterCreationSession,
	sceneId: EncounterEditorId,
): number {
	return (session.data?.scenes || []).findIndex(
		(scene) => String(scene.id) === String(sceneId),
	);
}

export function getEncounterCreationFileName(
	flushedSession: SessionRecord | null,
	session: EncounterCreationSession,
	sessionId: string,
): string {
	return flushedSession?.fileName || session.fileName || sessionId;
}

export function getEncounterOpenPlan(options: {
	session: EncounterCreationSession | null;
	sessionId: string;
	scene: EncounterScene | null | undefined;
	openInNewTab?: boolean;
}): EncounterOpenPlan {
	const { session, sessionId, scene, openInNewTab = false } = options;
	if (!session || !scene) return { kind: "none" };
	if (scene.encounterId !== null && scene.encounterId !== undefined) {
		return {
			kind: "navigate",
			encounterId: scene.encounterId,
			navigation: {
				fileName: session.fileName || sessionId,
				openInNewTab,
			},
		};
	}
	const sceneIndex = findSceneIndex(session, scene.id);
	if (sceneIndex < 0) return { kind: "none" };
	return { kind: "create", scene, sceneIndex, openInNewTab };
}

export function requireEncounterCreationResult(
	value: unknown,
): EncounterCreationResult {
	if (!isRecord(value) || !isRecord(value.session)) {
		throw new Error("Encounter creation returned an incomplete result");
	}
	const encounter = value.encounter;
	if (!isRecord(encounter) || !isEncounterEditorId(encounter.id)) {
		throw new Error("Encounter creation returned an incomplete result");
	}
	return {
		session: value.session as SessionRecord,
		encounterId: encounter.id,
	};
}

async function createEncounterFromPlan(
	options: EncounterCreationCommandOptions,
	plan: CreateEncounterOpenPlan,
): Promise<void> {
	const name = await options.requestEncounterName(plan.scene, plan.sceneIndex);
	if (name === null || !options.session) return;
	try {
		const flushedSession = await options.flushPendingSave({
			throwOnError: true,
		});
		const fileName = getEncounterCreationFileName(
			flushedSession,
			options.session,
			options.sessionId,
		);
		const response = await options.createSceneEncounter(
			options.campaignSlug,
			fileName,
			plan.scene.id,
			name,
		);
		const result = requireEncounterCreationResult(response);
		options.setSession(result.session);
		options.navigateToEncounter(result.encounterId, {
			fileName,
			openInNewTab: plan.openInNewTab,
		});
	} catch (error) {
		options.onError?.(error);
	}
}

export async function executeEncounterOpen(
	options: EncounterCreationCommandOptions,
): Promise<void> {
	const plan = getEncounterOpenPlan(options);
	if (plan.kind === "none") return;
	if (plan.kind === "navigate") {
		options.navigateToEncounter(plan.encounterId, plan.navigation);
		return;
	}
	await createEncounterFromPlan(options, plan);
}
