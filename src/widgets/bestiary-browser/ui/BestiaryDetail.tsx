import type { Dispatch, RefObject, SetStateAction } from "react";
import type {
	BestiaryFavorite,
	BestiaryMonster,
} from "../../../entities/bestiary/index.js";
import { lang } from "../../../shared/lib/index.js";
import { Button } from "../../../shared/ui/index.js";
import { getBestiaryDetailPresentation } from "../model.js";
import type { BestiaryMonsterStatBlockSlot } from "./bestiaryComposition.ts";

export interface BestiaryDetailProps {
	MonsterStatBlock: BestiaryMonsterStatBlockSlot;
	detailRef: RefObject<HTMLDivElement>;
	favorites: BestiaryFavorite[];
	onAddMonster?: ((monster: BestiaryMonster) => void) | null;
	onDeleteCustomMonster: (monster: BestiaryMonster) => void;
	onEditMonster: (monster: BestiaryMonster) => void;
	onFavoriteListChange: Dispatch<SetStateAction<BestiaryFavorite[]>>;
	onMonsterAiAction: (monster: BestiaryMonster) => void;
	onSelectMonster?: ((monster: BestiaryMonster) => void) | null;
	searchHighlight: string;
	selectedMonster: BestiaryMonster | null;
}

export function BestiaryDetail({
	MonsterStatBlock,
	detailRef,
	favorites,
	onAddMonster,
	onDeleteCustomMonster,
	onEditMonster,
	onFavoriteListChange,
	onMonsterAiAction,
	onSelectMonster,
	searchHighlight,
	selectedMonster,
}: BestiaryDetailProps) {
	const presentation = getBestiaryDetailPresentation(
		selectedMonster,
		favorites,
		onSelectMonster,
		onAddMonster,
		onDeleteCustomMonster,
		() => lang.t("Add to encounter"),
	);
	if (!presentation) return null;
	return (
		<div className="Bestiary__detail_container" ref={detailRef}>
			{presentation.insertAction && (
				<div className="Bestiary__select_actions">
					<Button
						variant="primary"
						icon="plus"
						onClick={() =>
							presentation.insertAction?.(presentation.monster)
						}
					>
						{lang.t("Insert")}
					</Button>
				</div>
			)}
			<MonsterStatBlock
				monster={presentation.monster}
				favoriteActive={presentation.favoriteActive}
				onNameClick={presentation.addAction}
				nameTitle={presentation.addTitle}
				onFavoriteChange={onFavoriteListChange}
				showAddToEncounterPicker={presentation.showAddToEncounterPicker}
				onAddToEncounter={presentation.addAction}
				onAiAction={onMonsterAiAction}
				onDelete={presentation.deleteAction}
				onFieldEdit={onEditMonster}
				searchHighlight={searchHighlight}
			/>
		</div>
	);
}
