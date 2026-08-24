import type { MouseEvent as ReactMouseEvent } from "react";
import type {
	BestiaryFavorite,
	BestiaryMonster,
} from "../../../entities/bestiary/index.js";
import {
	getMonsterTypeString,
	MonsterStatBlockModel,
} from "../../../entities/bestiary/index.js";
import { lang } from "../../../shared/lib/index.js";
import {
	Button,
	highlightText,
	ListCard,
	Tooltip,
} from "../../../shared/ui/index.js";
import { classNames } from "../../../shared/lib/index.js";
import { getSourceFullName } from "../../../entities/reference/index.js";
import {
	getBestiaryMonsterRowPresentation,
	getMonsterSizeText,
	getMonsterTagText,
	type BestiaryMonsterRowPresentation,
	type BestiaryMonsterRowPrimaryAction,
} from "../model.js";

function executeMonsterRowPrimaryAction(
	action: BestiaryMonsterRowPrimaryAction,
	monster: BestiaryMonster,
	onSelectMonster: MonsterListItemProps["onSelectMonster"],
	onAddMonster: MonsterListItemProps["onAddMonster"],
) {
	if (action === "select") {
		onSelectMonster?.(monster);
		return;
	}
	if (action === "add") onAddMonster?.(monster);
}

function executeStoppedMonsterRowAction(
	event: ReactMouseEvent<HTMLElement>,
	action: () => void,
) {
	event.stopPropagation();
	action();
}

interface MonsterListItemActionsProps {
	monster: BestiaryMonster;
	onAddMonster: MonsterListItemProps["onAddMonster"];
	onAiEdit: MonsterListItemProps["onAiEdit"];
	onDelete: MonsterListItemProps["onDelete"];
	onEdit: MonsterListItemProps["onEdit"];
	onSelectMonster: MonsterListItemProps["onSelectMonster"];
	onToggleFavorite: MonsterListItemProps["onToggleFavorite"];
	presentation: BestiaryMonsterRowPresentation;
}

function MonsterListItemActions({
	monster,
	onAddMonster,
	onAiEdit,
	onDelete,
	onEdit,
	onSelectMonster,
	onToggleFavorite,
	presentation,
}: MonsterListItemActionsProps) {
	return (
		<>
			<Button
				variant="ghost"
				size={Button.SIZES.SMALL}
				icon="star"
				className={classNames("Bestiary__item_fav_btn", {
					is_active: presentation.isFavorite,
				})}
				onClick={(event) =>
					executeStoppedMonsterRowAction(event, () =>
						onToggleFavorite(monster),
					)
				}
				title={lang.t(presentation.favoriteTitleKey)}
			/>
			{presentation.primaryTitleKey && (
				<Button
					variant="ghost"
					size={Button.SIZES.SMALL}
					icon="plus"
					onClick={(event) =>
						executeStoppedMonsterRowAction(event, () =>
							executeMonsterRowPrimaryAction(
								presentation.primaryAction,
								monster,
								onSelectMonster,
								onAddMonster,
							),
						)
					}
					title={lang.t(presentation.primaryTitleKey)}
				/>
			)}
			<Button
				variant="ghost"
				className="Bestiary__item_edit_btn"
				size={Button.SIZES.SMALL}
				icon="edit"
				onClick={(event) =>
					executeStoppedMonsterRowAction(event, () => onEdit(monster))
				}
				title={lang.t("Edit creature")}
			/>
			{presentation.isCustom && (
				<>
					<Button
						variant="ghost"
						className="Bestiary__item_ai_edit_btn"
						size={Button.SIZES.SMALL}
						icon="wand"
						onClick={(event) =>
							executeStoppedMonsterRowAction(event, () => onAiEdit(monster))
						}
						title={lang.t("AI edit custom creature")}
					/>
					<Button
						variant="danger"
						className="Bestiary__item_delete_btn"
						size={Button.SIZES.SMALL}
						icon="trash"
						onClick={(event) =>
							executeStoppedMonsterRowAction(event, () => onDelete(monster))
						}
						title={lang.t("Delete custom creature")}
					/>
				</>
			)}
		</>
	);
}

interface MonsterListItemContentProps {
	monster: BestiaryMonster;
	presentation: BestiaryMonsterRowPresentation;
	search: string;
	sourceFullName: string;
}

function MonsterListItemContent({
	monster,
	presentation,
	search,
	sourceFullName,
}: MonsterListItemContentProps) {
	return (
		<div className="Bestiary__item_content">
			<img
				className="Bestiary__item_token"
				src={presentation.tokenSrc}
				alt=""
				loading="lazy"
				draggable={false}
				onError={(event) => {
					event.currentTarget.hidden = true;
				}}
			/>
			<div className="Bestiary__item_info">
				<div className="ListCard__title">
					{highlightText(monster.name, search)}
				</div>
				<div className="ListCard__meta">
					{highlightText(getMonsterSizeText(monster), search)}{" "}
					{highlightText(getMonsterTypeString(monster.type), search)}{" "}
					{highlightText(getMonsterTagText(monster), search)}
					{monster.source && (
						<Tooltip content={sourceFullName} disabled={!sourceFullName}>
							<span className="Bestiary__item_source">
								{" "}
								• {highlightText(monster.source, search)}
							</span>
						</Tooltip>
					)}
				</div>
			</div>
			<Tooltip content={lang.t("Challenge Rating")}>
				<div className="Bestiary__item_cr">
					<div className="Bestiary__cr_label">CR</div>
					<div className="Bestiary__cr_value">{presentation.crDisplay}</div>
				</div>
			</Tooltip>
		</div>
	);
}

export interface MonsterListItemProps {
	favorites: BestiaryFavorite[];
	monster: BestiaryMonster;
	onAddMonster?: ((monster: BestiaryMonster) => void) | null;
	onAiEdit: (monster: BestiaryMonster) => void;
	onDelete: (monster: BestiaryMonster) => void;
	onEdit: (monster: BestiaryMonster) => void;
	onSelectMonster?: ((monster: BestiaryMonster) => void) | null;
	onSelect: (monster: BestiaryMonster | null) => void;
	onToggleFavorite: (monster: BestiaryMonster) => void;
	search: string;
	selectedMonster: BestiaryMonster | null;
}

export function BestiaryMonsterListItem(props: MonsterListItemProps) {
	const { favorites, monster, search, selectedMonster } = props;
	const fallbackTokenSrc = new MonsterStatBlockModel(monster).localTokenSrc;
	const presentation = getBestiaryMonsterRowPresentation(
		monster,
		selectedMonster,
		favorites,
		Boolean(props.onSelectMonster),
		Boolean(props.onAddMonster),
		fallbackTokenSrc,
	);
	return (
		<div>
			<ListCard
				active={presentation.isSelected}
				onClick={() => props.onSelect(presentation.nextSelection)}
				onDoubleClick={() =>
					executeMonsterRowPrimaryAction(
						presentation.primaryAction,
						monster,
						props.onSelectMonster,
						props.onAddMonster,
					)
				}
				actions={
					<MonsterListItemActions
						monster={monster}
						onAddMonster={props.onAddMonster}
						onAiEdit={props.onAiEdit}
						onDelete={props.onDelete}
						onEdit={props.onEdit}
						onSelectMonster={props.onSelectMonster}
						onToggleFavorite={props.onToggleFavorite}
						presentation={presentation}
					/>
				}
			>
				<MonsterListItemContent
					monster={monster}
					presentation={presentation}
					search={search}
					sourceFullName={getSourceFullName(monster.source)}
				/>
			</ListCard>
		</div>
	);
}
