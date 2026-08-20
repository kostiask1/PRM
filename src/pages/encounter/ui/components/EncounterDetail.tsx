import type { CSSProperties } from "react";
import { classNames, lang } from "../../../../shared/lib/index.js";
import type { BestiaryMonster } from "../../../../entities/bestiary/index.js";
import { isEncounterCharacterParticipant } from "../../../../entities/encounter/index.js";
import {
	CharacterCard,
	type CharacterCardProps,
} from "../../../../widgets/campaign-entity-card/index.js";
import { MonsterStatBlock } from "../../../../widgets/monster-stat-block/index.js";
import type {
	EncounterViewModel,
	EncounterViewParticipant,
} from "../../model/contracts.ts";

interface EncounterDetailProps {
	displayMode: "grid" | "single";
	gridMonsters: EncounterViewParticipant[];
	gridColumns: number;
	selectedInstance: EncounterViewParticipant | null;
	selectedGridInstanceId: string | null;
	focusedMonsterId: string | null;
	campaignSlug: string;
	getParticipantInstanceId: (participant: EncounterViewParticipant) => string;
	setGridItemRef: (instanceId: string, node: HTMLDivElement | null) => void;
	onAiAction: (monster: EncounterViewParticipant) => void;
	onFieldEdit: (monster: EncounterViewParticipant) => void;
	onTokenImageChange: (
		monster: EncounterViewParticipant,
		imageUrl: string | null,
	) => void;
	onCharacterChange: (
		instanceId: string,
	) => CharacterCardProps["onChange"];
	getMonsterImageOverride: EncounterViewModel["getMonsterImageOverride"];
}

export default function EncounterDetail(props: EncounterDetailProps) {
	return props.displayMode === "grid"
		? <EncounterGridDetail {...props} />
		: <EncounterSingleDetail {...props} />;
}

function EncounterGridDetail(props: EncounterDetailProps) {
	return (
		<div className="EncounterView__detailView EncounterView__detailView__grid">
			{props.gridMonsters.length > 0 ? (
				<div className="EncounterView__grid" style={{ "--encounter-grid-columns": props.gridColumns } as CSSProperties}>
					{props.gridMonsters.map((monster) => <EncounterGridMonster key={props.getParticipantInstanceId(monster)} monster={monster} props={props} />)}
				</div>
			) : <EncounterDetailEmptyState />}
		</div>
	);
}

function EncounterGridMonster({ monster, props }: { monster: EncounterViewParticipant; props: EncounterDetailProps }) {
	const instanceId = props.getParticipantInstanceId(monster);
	return (
		<div ref={(node) => props.setGridItemRef(instanceId, node)} className={classNames("EncounterView__gridItem", { is_selected: props.selectedGridInstanceId === instanceId, is_focused: props.focusedMonsterId === instanceId })}>
			<EncounterMonsterStatBlock monster={monster} props={props} layoutMode="grid" />
		</div>
	);
}

function EncounterSingleDetail(props: EncounterDetailProps) {
	return (
		<div className="EncounterView__detailView EncounterView__detailView__single">
			<EncounterSelectedDetail {...props} />
		</div>
	);
}

function EncounterSelectedDetail(props: EncounterDetailProps) {
	const selected = props.selectedInstance;
	if (!selected) return <EncounterDetailEmptyState />;
	if (isEncounterCharacterParticipant(selected)) {
		return <CharacterCard character={selected} campaignSlug={props.campaignSlug} type="characters" viewMode="modal" showDeleteButton={false} onChange={props.onCharacterChange(props.getParticipantInstanceId(selected))} />;
	}
	return <EncounterMonsterStatBlock monster={selected} props={props} />;
}

function EncounterMonsterStatBlock({ monster, props, layoutMode }: { monster: EncounterViewParticipant; props: EncounterDetailProps; layoutMode?: "grid" }) {
	return (
		<MonsterStatBlock
			monster={monster as BestiaryMonster}
			onAiAction={(value) => props.onAiAction(value as EncounterViewParticipant)}
			onFieldEdit={(value) => props.onFieldEdit(value as EncounterViewParticipant)}
			onTokenImageChange={(value, imageUrl) => props.onTokenImageChange(value as EncounterViewParticipant, imageUrl)}
			tokenUploadCampaignSlug={props.campaignSlug}
			tokenImageOverrideUrl={props.getMonsterImageOverride(monster)}
			layoutMode={layoutMode}
		/>
	);
}

function EncounterDetailEmptyState() {
	return <p className="muted">{lang.t("Select a monster from the list to see its stats.")}</p>;
}
