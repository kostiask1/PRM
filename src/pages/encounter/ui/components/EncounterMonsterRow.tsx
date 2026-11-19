import { classNames, lang, makeDomId } from "../../../../shared/lib/index.js";
import "../../../../assets/components/EncounterMonsterRow.css";
import { Button, Icon, Tooltip } from "../../../../shared/ui/index.js";
import { renderMentionText } from "../../../../features/entity-link/index.js";
import {
	getEncounterCharacterDisplayName,
	hasMonsterHpFormula,
	isEncounterCharacterParticipant,
} from "../../../../entities/encounter/index.js";
import { getEncounterMonsterRowStats } from "../../model/encounterPagePresentation.ts";
import type {
	EncounterViewModel,
	EncounterViewParticipant,
} from "../../model/contracts.ts";
import { makeHistoryTargetId } from "../../../../entities/history/index.js";
import { MonsterStatBlockModel } from "../../../../entities/bestiary/index.js";
import EncounterConditions from "./EncounterConditions.tsx";

type EncounterMonsterRowView = Pick<
	EncounterViewModel,
	| "getHpColor"
	| "updateMonsterMaxHp"
	| "rollMonsterHp"
	| "duplicateMonster"
	| "removeMonster"
	| "getMonsterImageOverride"
	| "updateMonsterConditions"
	| "updateMonsterInitiative"
	| "rollMonsterInitiative"
>;


interface EncounterMonsterRowProps {
	monster: EncounterViewParticipant;
	isDragging: boolean;
	hpDrafts: Record<string, string>;
	selectedInstanceId?: string;
	isCurrentTurn?: boolean;
	view: EncounterMonsterRowView;
	onSelect: (monster: EncounterViewParticipant) => void;
	onHpChange: (instanceId: string, value: string) => void;
	onHpBlur: (monster: EncounterViewParticipant) => void;
	onOpenConditionPicker: (instanceId: string) => void;
	getParticipantInstanceId: (participant: EncounterViewParticipant) => string;
}

type EncounterMonsterCombatStatsProps = Pick<
	EncounterMonsterRowProps,
	"monster" | "hpDrafts" | "view" | "onHpChange" | "onHpBlur"
> & {
	instanceId: string;
};

function EncounterInitiativeInput({
	monster,
	instanceId,
	view,
}: {
	monster: EncounterViewParticipant;
	instanceId: string;
	view: Pick<EncounterViewModel, "updateMonsterInitiative" | "rollMonsterInitiative">;
}) {
	return (
		<div className="EncounterMonsterRow__initiative">
			<Tooltip content={lang.t("Roll initiative (d20 + DEX)")}>
				<button
					type="button"
					className="EncounterMonsterRow__initRollBtn"
					onClick={(event) => {
						event.stopPropagation();
						view.rollMonsterInitiative(instanceId);
					}}
					aria-label={lang.t("Roll initiative")}
				>
					<Icon name="dice" size={13} />
				</button>
			</Tooltip>
			<input
				type="number"
				aria-label={lang.t("Initiative")}
				placeholder={lang.t("Init")}
				title={lang.t("Initiative")}
				className="EncounterMonsterRow__initInput"
				value={monster.initiative ?? ""}
				onChange={(event) => {
					const val = event.target.value.trim();
					view.updateMonsterInitiative(instanceId, val === "" ? null : Number(val));
				}}
				onClick={(event) => {
					event.stopPropagation();
					event.currentTarget.select();
				}}
				onFocus={(event) => event.currentTarget.select()}
				onKeyDown={(event) => {
					if (event.key === "Enter") event.currentTarget.blur();
				}}
			/>
		</div>
	);
}

function EncounterMonsterCombatStats({
	monster,
	instanceId,
	hpDrafts,
	view,
	onHpChange,
	onHpBlur,
}: EncounterMonsterCombatStatsProps) {
	const rowStats = getEncounterMonsterRowStats(monster);
	return (
		<>
			<div className="EncounterMonsterRow__hp">
				<EncounterCurrentHpInput {...{ monster, instanceId, hpDrafts, view, onHpChange, onHpBlur }} maxHp={rowStats.maxHp} />
				<span className="muted">/</span>
				<EncounterMaxHpInput {...{ instanceId, view }} name={String(monster.name || "")} maxHp={rowStats.maxHp} />
			</div>
			<div className="EncounterMonsterRow__ac">{lang.t("AC")} {rowStats.ac}</div>
		</>
	);
}

function EncounterCurrentHpInput({ monster, instanceId, hpDrafts, view, onHpChange, onHpBlur, maxHp }: EncounterMonsterCombatStatsProps & { maxHp: string | number }) {
	return (
		<input
			data-history-field="currentHp"
			aria-label={lang.t("Current HP: {name}", { name: String(monster.name || "") })}
			type="text"
			value={getEncounterHpInputDisplay(hpDrafts[instanceId], monster.currentHp)}
			onChange={(event) => onHpChange(instanceId, event.target.value)}
			onBlur={() => onHpBlur(monster)}
			onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
			onFocus={(event) => event.currentTarget.select()}
			onClick={(event) => { event.stopPropagation(); event.currentTarget.select(); }}
			className="EncounterMonsterRow__hpInput"
			style={{ color: view.getHpColor(toEncounterStatNumber(monster.currentHp), toEncounterStatNumber(maxHp)) }}
		/>
	);
}

function EncounterMaxHpInput({ instanceId, view, maxHp, name }: { instanceId: string; view: EncounterMonsterRowView; maxHp: string | number; name: string }) {
	return (
		<Tooltip content={lang.t("Max HP")}>
			<input aria-label={lang.t("Max HP: {name}", { name })} data-history-field="hit_points" type="number" value={maxHp} onChange={(event) => view.updateMonsterMaxHp(instanceId, event.target.value)} onClick={(event) => event.stopPropagation()} className="EncounterMonsterRow__maxHpInput" />
		</Tooltip>
	);
}

function getEncounterHpInputDisplay(draft: string | undefined, currentHp: unknown): string {
	return draft === undefined ? String(currentHp ?? "") : draft;
}

function toEncounterStatNumber(value: unknown): number {
	return Number(value) || 0;
}

function EncounterMonsterRowActions({
	monster,
	instanceId,
	isCharacter,
	view,
}: {
	monster: EncounterViewParticipant;
	instanceId: string;
	isCharacter: boolean;
	view: EncounterMonsterRowView;
}) {
	return (
		<details
			className="EncounterMonsterRow__actions"
			onClick={(event) => event.stopPropagation()}
			onBlur={(event) => {
				const nextTarget = event.relatedTarget;
				if (
					nextTarget instanceof Node &&
					event.currentTarget.contains(nextTarget)
				) {
					return;
				}
				event.currentTarget.removeAttribute("open");
			}}
		>
			<summary
				className="EncounterMonsterRow__action EncounterMonsterRow__actionsToggle"
				aria-label={lang.t("Actions")}
				title={lang.t("Actions")}
			>
				<Icon name="dots-vertical" size={14} />
			</summary>
			<div className="EncounterMonsterRow__menu">
				{!isCharacter && hasMonsterHpFormula(monster) && (
					<Button
						variant="ghost"
						size={Button.SIZES.SMALL}
						icon="dice"
						iconSize={16}
						className="EncounterMonsterRow__menuItem"
						onClick={(event) => {
							event.stopPropagation();
							event.currentTarget.closest("details")?.removeAttribute("open");
							view.rollMonsterHp(instanceId);
						}}
					>
						{lang.t("Roll HP by formula")}
					</Button>
				)}
				{!isCharacter && (
					<Button
						variant="ghost"
						size={Button.SIZES.SMALL}
						icon="plus"
						iconSize={16}
						className="EncounterMonsterRow__menuItem"
						onClick={(event) => {
							event.stopPropagation();
							event.currentTarget.closest("details")?.removeAttribute("open");
							view.duplicateMonster(monster);
						}}
					>
						{lang.t("Duplicate")}
					</Button>
				)}
				<Button
					variant="danger"
					size={Button.SIZES.SMALL}
					icon="trash"
					iconSize={16}
					className="EncounterMonsterRow__menuItem EncounterMonsterRow__menuItem--danger"
					onClick={(event) => {
						event.stopPropagation();
						event.currentTarget.closest("details")?.removeAttribute("open");
						view.removeMonster(instanceId);
					}}
				>
					{lang.t("Delete")}
				</Button>
			</div>
		</details>
	);
}

export default function EncounterMonsterRow({
	monster,
	isDragging,
	hpDrafts,
	selectedInstanceId,
	isCurrentTurn,
	view,
	onSelect,
	onHpChange,
	onHpBlur,
	onOpenConditionPicker,
	getParticipantInstanceId,
}: EncounterMonsterRowProps) {
	const instanceId = getParticipantInstanceId(monster);
	const isCharacter = isEncounterCharacterParticipant(monster);
	const displayName = isCharacter
		? getEncounterCharacterDisplayName(monster)
		: String(monster.name);
	const tokenModel = new MonsterStatBlockModel({
		name: monster.name,
		originalBestiaryName: monster.originalBestiaryName || undefined,
		source: monster.source || undefined,
	});
	const imageUrl = typeof monster.imageUrl === "string" ? monster.imageUrl : "";
	const tokenSrc = imageUrl || view.getMonsterImageOverride(monster) ||
		(isCharacter ? "" : tokenModel.localTokenSrc);

	return (
		<div
			id={makeDomId("encounter", "participant", instanceId)}
			data-history-focus-id={makeHistoryTargetId(
				"encounter",
				"participant",
				instanceId,
			)}
			className={classNames("EncounterMonsterRow", {
				EncounterMonsterRow__character: isCharacter,
				is_active: selectedInstanceId === instanceId,
				is_current_turn: isCurrentTurn,
				is_dragging: isDragging,
			})}
			onClick={() => onSelect(monster)}
		>
			<div className="EncounterMonsterRow__content">
				<div className="EncounterMonsterRow__identity">
					{tokenSrc && <img key={tokenSrc} className="EncounterMonsterRow__token" src={tokenSrc} alt="" loading="lazy" draggable={false} onLoad={(event) => { event.currentTarget.hidden = false; }} onError={(event) => {
						if (tokenSrc === tokenModel.localTokenSrc && event.currentTarget.src !== tokenModel.externalTokenSrc) event.currentTarget.src = tokenModel.externalTokenSrc;
						else event.currentTarget.hidden = true;
					}} />}
					<span className={classNames("EncounterMonsterRow__tokenFallback", { is_empty: !tokenSrc })} aria-hidden="true"><Icon name={isCharacter ? "user" : "skull"} size={16} /></span>
					<div className="EncounterMonsterRow__name">{renderMentionText(displayName)}</div>
				</div>
				<div className="EncounterMonsterRow__stats">
					{isCharacter ? (
						<div className="EncounterMonsterRow__playerBadge">{lang.t("Player")}</div>
					) : (
						<EncounterMonsterCombatStats
							monster={monster}
							instanceId={instanceId}
							hpDrafts={hpDrafts}
							view={view}
							onHpChange={onHpChange}
							onHpBlur={onHpBlur}
						/>
					)}
					<EncounterInitiativeInput
						monster={monster}
						instanceId={instanceId}
						view={view}
					/>
					<EncounterMonsterRowActions
						monster={monster}
						instanceId={instanceId}
						isCharacter={isCharacter}
						view={view}
					/>
				</div>
				<EncounterConditions monster={monster} instanceId={instanceId} view={view} onAdd={onOpenConditionPicker} />
			</div>
		</div>
	);
}
