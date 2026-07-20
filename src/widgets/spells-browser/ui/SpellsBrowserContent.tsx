import type { MutableRefObject } from "react";
import ReactList from "react-list";
import type { SpellRecord } from "../../../entities/spell/index.js";
import { capitalizeWords, getSourceFullName } from "../../../entities/reference/index.js";
import type { RichContentRenderOptions } from "../../../features/rich-content/index.js";
import { lang } from "../../../shared/lib/index.js";
import { Button, highlightText, ListCard, Tooltip } from "../../../shared/ui/index.js";
import { SpellCard } from "../../spell-card/index.js";
import {
	executeSpellInsertAction,
	getSpellListItemPresentation,
	type SpellListItemPresentation,
} from "../model/spellsBrowser.ts";

interface SpellListItemProps {
	spell: SpellRecord;
	selected: boolean;
	search: string;
	onSelect: (spell: SpellRecord | null) => void;
	onInsert?: ((spell: SpellRecord) => void) | null;
}

function SpellListItem({ spell, selected, search, onSelect, onInsert }: SpellListItemProps) {
	const presentation = getSpellListItemPresentation(spell, {
		selected,
		capitalizeName: capitalizeWords,
		resolveSourceName: getSourceFullName,
		translate: lang.t,
	});
	return (
		<div
			key={presentation.itemKey}
			onDoubleClick={() => executeSpellInsertAction(onInsert, spell)}
		>
			<ListCard
				active={presentation.active}
				onClick={() => onSelect(presentation.nextSelection)}
			>
				<div className="ListCard__title">
					{highlightText(presentation.displayName, search)}
				</div>
				<div className="ListCard__meta">
					{highlightText(presentation.levelLabel, search)}
					<SpellSchoolMeta presentation={presentation} search={search} />
					<SpellClassesMeta presentation={presentation} search={search} />
					<SpellSourceMeta presentation={presentation} search={search} />
				</div>
			</ListCard>
		</div>
	);
}

function SpellSchoolMeta({
	presentation,
	search,
}: {
	presentation: SpellListItemPresentation;
	search: string;
}) {
	if (!presentation.showSchool) return null;
	return <> • {highlightText(presentation.schoolName, search)}</>;
}

function SpellClassesMeta({
	presentation,
	search,
}: {
	presentation: SpellListItemPresentation;
	search: string;
}) {
	if (!presentation.showClasses) return null;
	return <> • {highlightText(presentation.classesLabel, search)}</>;
}

function SpellSourceMeta({
	presentation,
	search,
}: {
	presentation: SpellListItemPresentation;
	search: string;
}) {
	if (!presentation.showSource) return null;
	return (
		<Tooltip
			content={presentation.sourceFullName}
			disabled={presentation.disableSourceTooltip}
		>
			<span className="Spells__item_source">
				{" • "}
				{highlightText(presentation.source, search)}
			</span>
		</Tooltip>
	);
}

interface SpellsBrowserContentProps {
	spells: SpellRecord[];
	selectedSpell: SpellRecord | null;
	search: string;
	loading: boolean;
	renderOptions: RichContentRenderOptions;
	listRef: MutableRefObject<ReactList | null>;
	listContainerRef: MutableRefObject<HTMLDivElement | null>;
	detailRef: MutableRefObject<HTMLDivElement | null>;
	onSelect: (spell: SpellRecord | null) => void;
	onInsert?: ((spell: SpellRecord) => void) | null;
	onBack: () => void;
}

export default function SpellsBrowserContent(props: SpellsBrowserContentProps) {
	const insertSelectedSpell = () => {
		if (props.selectedSpell) props.onInsert?.(props.selectedSpell);
	};
	const renderSpellItem = (index: number) => {
		const spell = props.spells[index];
		if (!spell) return null;
		const selected = props.selectedSpell?.name === spell.name && props.selectedSpell?.source === spell.source;
		return <SpellListItem spell={spell} selected={selected} search={props.search} onSelect={props.onSelect} onInsert={props.onInsert} />;
	};
	return (
		<div className="Spells__content">
			<div className="Spells__list" ref={props.listContainerRef}>
				<ReactList
					ref={props.listRef}
					itemRenderer={renderSpellItem}
					length={props.spells.length}
					scrollParentGetter={() => props.listContainerRef.current ?? (typeof window === "undefined" ? null : window)}
					scrollParentViewportSizeGetter={() => props.listContainerRef.current?.clientHeight ?? (typeof window === "undefined" ? 0 : window.innerHeight)}
					type="uniform"
				/>
			</div>
			{props.loading && <div className="muted Spells__loading">{lang.t("Updating spells...")}</div>}
			<div className="Spells__detail" ref={props.detailRef}>
				{props.selectedSpell ? (
					<>
						<div className="Spells__mobileDetailHeader"><div className="Spells__mobileDetailTitle"><span>{lang.t("Selected element")}</span><strong>{capitalizeWords(props.selectedSpell.name.split("|")[0])}</strong></div><Button variant="ghost" icon="back" onClick={props.onBack}>{lang.t("Back")}</Button></div>
						{props.onInsert && <div className="Spells__select_actions"><Button variant="primary" icon="plus" onClick={insertSelectedSpell}>{lang.t("Insert")}</Button></div>}
						<SpellCard spell={props.selectedSpell} searchHighlight={props.search} renderOptions={props.renderOptions} />
					</>
				) : <p className="muted">{lang.t("Select a spell from the list to view details.")}</p>}
			</div>
		</div>
	);
}
