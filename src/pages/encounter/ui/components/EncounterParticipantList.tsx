import type { ReactNode } from "react";
import { lang } from "../../../../shared/lib/index.js";
import { Button, DraggableList } from "../../../../shared/ui/index.js";
import type { EncounterViewParticipant } from "../../model/contracts.ts";

interface EncounterParticipantListProps {
	monsters: EncounterViewParticipant[];
	onOpenBestiary(): void;
	onOpenCharacterPicker(): void;
	onReorder(monsters: EncounterViewParticipant[]): void;
	onDrop(monsters?: EncounterViewParticipant[] | null): void;
	renderRow(monster: EncounterViewParticipant, isDragging: boolean): ReactNode;
}

export default function EncounterParticipantList({
	monsters,
	onOpenBestiary,
	onOpenCharacterPicker,
	onReorder,
	onDrop,
	renderRow,
}: EncounterParticipantListProps) {
	return (
		<div className="EncounterView__list">
			<div className="EncounterView__addActions">
				<Button variant="create" onClick={onOpenBestiary} icon="plus" className="EncounterView__addBtn">{lang.t("Add monster")}</Button>
				<Button variant="ghost" onClick={onOpenCharacterPicker} icon="user" className="EncounterView__addBtn">{lang.t("Add player")}</Button>
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
