import type { ReactNode } from "react";
import "../../../../assets/components/EncounterParticipantList.css";
import { lang } from "../../../../shared/lib/index.js";
import { Button, DraggableList } from "../../../../shared/ui/index.js";
import type { EncounterViewParticipant } from "../../model/contracts.ts";

interface EncounterParticipantListProps {
	monsters: EncounterViewParticipant[];
	onOpenBestiary(): void;
	onOpenCharacterPicker(): void;
	onReorder(monsters: EncounterViewParticipant[]): void;
	onDrop(monsters?: EncounterViewParticipant[] | null): void;
	onRollAllInitiatives?(): void;
	onSortByInitiative?(): void;
	renderRow(monster: EncounterViewParticipant, isDragging: boolean): ReactNode;
}

export default function EncounterParticipantList({
	monsters,
	onOpenBestiary,
	onOpenCharacterPicker,
	onReorder,
	onDrop,
	onRollAllInitiatives,
	onSortByInitiative,
	renderRow,
}: EncounterParticipantListProps) {
	return (
		<div className="EncounterParticipantList">
			<h2 className="EncounterParticipantList__title">{lang.t("Participants")}</h2>
			<div className="EncounterParticipantList__actions">
				<Button variant="create" onClick={onOpenBestiary} icon="plus" className="EncounterParticipantList__addButton">{lang.t("Add monster")}</Button>
				<Button variant="ghost" onClick={onOpenCharacterPicker} icon="user" className="EncounterParticipantList__addButton">{lang.t("Add player")}</Button>
				{monsters.length > 0 && onRollAllInitiatives && (
					<Button
						variant="ghost"
						onClick={onRollAllInitiatives}
						icon="dice"
						className="EncounterParticipantList__addButton"
						title={lang.t("Roll initiative")}
						aria-label={lang.t("Roll initiative")}
					>
						{lang.t("Initiative")}
					</Button>
				)}
				{monsters.length > 1 && onSortByInitiative && (
					<Button
						variant="ghost"
						onClick={onSortByInitiative}
						icon="sort-desc"
						className="EncounterParticipantList__addButton"
						title={lang.t("Sort by initiative")}
						aria-label={lang.t("Sort by initiative")}
					/>
				)}
			</div>
			<DraggableList
				items={monsters}
				onReorder={onReorder}
				onDrop={onDrop}
				keyExtractor={(monster) => monster.instanceId || String(monster.id || monster.name || "")}
				renderItem={renderRow}
			/>
		</div>
	);
}
