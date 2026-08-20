import { classNames, lang } from "../../../../shared/lib/index.js";
import { Button, Tooltip } from "../../../../shared/ui/index.js";
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

type EncounterMonsterRowView = Pick<
	EncounterViewModel,
	| "getHpColor"
	| "updateMonsterMaxHp"
	| "rollMonsterHp"
	| "duplicateMonster"
	| "removeMonster"
>;

interface EncounterMonsterRowProps {
	monster: EncounterViewParticipant;
	isDragging: boolean;
	hpDrafts: Record<string, string>;
	selectedInstanceId?: string;
	view: EncounterMonsterRowView;
	onSelect: (monster: EncounterViewParticipant) => void;
	onHpChange: (instanceId: string, value: string) => void;
	onHpBlur: (monster: EncounterViewParticipant) => void;
	getParticipantInstanceId: (participant: EncounterViewParticipant) => string;
}

type EncounterMonsterCombatStatsProps = Pick<
	EncounterMonsterRowProps,
	"monster" | "hpDrafts" | "view" | "onHpChange" | "onHpBlur"
> & {
	instanceId: string;
};

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
				<EncounterMaxHpInput {...{ instanceId, view }} maxHp={rowStats.maxHp} />
			</div>
			<div className="EncounterMonsterRow__ac">{lang.t("AC")} {rowStats.ac}</div>
		</>
	);
}

function EncounterCurrentHpInput({ monster, instanceId, hpDrafts, view, onHpChange, onHpBlur, maxHp }: EncounterMonsterCombatStatsProps & { maxHp: string | number }) {
	return (
		<input
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

function EncounterMaxHpInput({ instanceId, view, maxHp }: { instanceId: string; view: EncounterMonsterRowView; maxHp: string | number }) {
	return (
		<Tooltip content={lang.t("Max HP")}>
			<input type="number" value={maxHp} onChange={(event) => view.updateMonsterMaxHp(instanceId, event.target.value)} onClick={(event) => event.stopPropagation()} className="EncounterMonsterRow__maxHpInput" />
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
		<div className="EncounterMonsterRow__actions">
			{!isCharacter && hasMonsterHpFormula(monster) && (
				<Button
					variant="ghost"
					size={Button.SIZES.SMALL}
					icon="dice"
					className="EncounterMonsterRow__action"
					onClick={(event) => {
						event.stopPropagation();
						view.rollMonsterHp(instanceId);
					}}
					title={lang.t("Roll HP by formula")}
				/>
			)}
			{!isCharacter && (
				<Button
					variant="ghost"
					size={Button.SIZES.SMALL}
					icon="plus"
					className="EncounterMonsterRow__action"
					onClick={(event) => {
						event.stopPropagation();
						view.duplicateMonster(monster);
					}}
					title={lang.t("Duplicate")}
				/>
			)}
			<Button
				variant="danger"
				size={Button.SIZES.SMALL}
				icon="x"
				className="EncounterMonsterRow__action"
				onClick={(event) => {
					event.stopPropagation();
					view.removeMonster(instanceId);
				}}
				title={lang.t("Delete")}
			/>
		</div>
	);
}

export default function EncounterMonsterRow({
	monster,
	isDragging,
	hpDrafts,
	selectedInstanceId,
	view,
	onSelect,
	onHpChange,
	onHpBlur,
	getParticipantInstanceId,
}: EncounterMonsterRowProps) {
	const instanceId = getParticipantInstanceId(monster);
	const isCharacter = isEncounterCharacterParticipant(monster);
	const displayName = isCharacter
		? getEncounterCharacterDisplayName(monster)
		: String(monster.name);

	return (
		<div
			className={classNames("EncounterMonsterRow", {
				EncounterMonsterRow__character: isCharacter,
				is_active: selectedInstanceId === instanceId,
				is_dragging: isDragging,
			})}
			onClick={() => onSelect(monster)}
		>
			<div className="EncounterMonsterRow__content">
				<div className="EncounterMonsterRow__name">
					{renderMentionText(displayName)}
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
					<EncounterMonsterRowActions
						monster={monster}
						instanceId={instanceId}
						isCharacter={isCharacter}
						view={view}
					/>
				</div>
			</div>
		</div>
	);
}
