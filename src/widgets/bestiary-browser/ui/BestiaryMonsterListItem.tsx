import type { MouseEvent as ReactMouseEvent } from "react";
import {
	useCallback,
	useRef,
	useState,
	type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import type {
	BestiaryFavorite,
	BestiaryMonster,
} from "../../../entities/bestiary/index.js";
import {
	getMonsterTypeString,
	MonsterStatBlockModel,
} from "../../../entities/bestiary/index.js";
import { classNames, lang } from "../../../shared/lib/index.js";
import {
	Button,
	highlightText,
	Icon,
	ListCard,
	Tooltip,
	useDropdownPortalLifecycle,
} from "../../../shared/ui/index.js";
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

interface CustomMonsterMoreMenuProps {
	monster: BestiaryMonster;
	onAiEdit: MonsterListItemProps["onAiEdit"];
	onDelete: MonsterListItemProps["onDelete"];
}

function CustomMonsterMoreMenu({
	monster,
	onAiEdit,
	onDelete,
}: CustomMonsterMoreMenuProps) {
	const [isOpen, setIsOpen] = useState(false);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const dropdownRef = useRef<HTMLDivElement>(null);
	const [dropdownStyle, setDropdownStyle] = useState<CSSProperties>({});

	const updatePosition = useCallback(() => {
		if (!triggerRef.current) return;
		const rect = triggerRef.current.getBoundingClientRect();
		const width = 300;
		const offset = 4;
		const spaceBelow = window.innerHeight - rect.bottom;
		const openUp = spaceBelow < 100 && rect.top > spaceBelow;
		const left = Math.min(
			Math.max(8, rect.right - width),
			window.innerWidth - width - 8,
		);

		setDropdownStyle({
			position: "fixed",
			left,
			...(openUp
				? { bottom: window.innerHeight - rect.top + offset }
				: { top: rect.bottom + offset }),
			width,
			zIndex: 10000,
		});
	}, []);

	useDropdownPortalLifecycle({
		isOpen,
		triggerRef,
		dropdownRef,
		setIsOpen,
		updatePosition,
	});

	const toggleOpen = (event: ReactMouseEvent<HTMLElement>) => {
		event.stopPropagation();
		if (!isOpen) updatePosition();
		setIsOpen((prev) => !prev);
	};

	const handleAiEdit = (event: ReactMouseEvent<HTMLElement>) => {
		event.stopPropagation();
		setIsOpen(false);
		onAiEdit(monster);
	};

	const handleDelete = (event: ReactMouseEvent<HTMLElement>) => {
		event.stopPropagation();
		setIsOpen(false);
		onDelete(monster);
	};

	return (
		<>
			<Button
				ref={triggerRef}
				variant="ghost"
				size={Button.SIZES.SMALL}
				icon="dots-vertical"
				className={classNames("Bestiary__item_more_btn", {
					is_active: isOpen,
				})}
				aria-label={`${lang.t("More actions")}: ${monster.name}`}
				aria-expanded={isOpen}
				onClick={toggleOpen}
				title={isOpen ? undefined : lang.t("More actions")}
			/>
			{isOpen &&
				typeof document !== "undefined" &&
				createPortal(
					<div
						ref={dropdownRef}
						className="Bestiary__item_more_menu"
						style={dropdownStyle}
						onClick={(event) => event.stopPropagation()}
					>
						<Button
							variant="ghost"
							size={Button.SIZES.SMALL}
							icon="wand"
							className="Bestiary__item_ai_edit_btn"
							onClick={handleAiEdit}
						>
							{lang.t("AI edit custom creature")}
						</Button>
						<Button
							variant="danger"
							size={Button.SIZES.SMALL}
							icon="trash"
							className="Bestiary__item_delete_btn"
							onClick={handleDelete}
						>
							{lang.t("Delete custom creature")}
						</Button>
					</div>,
					document.body,
				)}
		</>
	);
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
				aria-label={`${lang.t(presentation.favoriteTitleKey)}: ${monster.name}`}
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
					aria-label={`${lang.t(presentation.primaryTitleKey)}: ${monster.name}`}
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
				aria-label={`${lang.t("Edit creature")}: ${monster.name}`}
				onClick={(event) =>
					executeStoppedMonsterRowAction(event, () => onEdit(monster))
				}
				title={lang.t("Edit creature")}
			/>
			{presentation.isCustom && (
				<CustomMonsterMoreMenu
					monster={monster}
					onAiEdit={onAiEdit}
					onDelete={onDelete}
				/>
			)}
		</>
	);
}

interface MonsterListItemContentProps {
	monster: BestiaryMonster;
	presentation: BestiaryMonsterRowPresentation;
	search: string;
	sourceFullName: string;
	localTokenSrc: string;
	externalTokenSrc: string;
}

function MonsterListItemContent({
	monster,
	presentation,
	search,
	sourceFullName,
	localTokenSrc,
	externalTokenSrc,
}: MonsterListItemContentProps) {
	return (
		<div className="Bestiary__item_content">
			<img
				className="Bestiary__item_token"
				src={presentation.tokenSrc}
				alt=""
				loading="lazy"
				draggable={false}
				onLoad={(event) => {
					event.currentTarget.hidden = false;
				}}
				onError={(event) => {
					if (presentation.tokenSrc === localTokenSrc && event.currentTarget.src !== externalTokenSrc) {
						event.currentTarget.src = externalTokenSrc;
					} else {
						event.currentTarget.hidden = true;
					}
				}}
			/>
			<span className="Bestiary__item_tokenFallback" aria-hidden="true"><Icon name="skull" size={20} /></span>
			<div className="Bestiary__item_info">
				<div className="ListCard__title" title={monster.name}>
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
	const tokenModel = new MonsterStatBlockModel(monster);
	const fallbackTokenSrc = tokenModel.localTokenSrc;
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
				selectionState={presentation.isSelected}
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
					localTokenSrc={fallbackTokenSrc}
					externalTokenSrc={tokenModel.externalTokenSrc}
				/>
			</ListCard>
		</div>
	);
}
