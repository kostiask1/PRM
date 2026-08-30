import { MonsterStatBlockModel, getMonsterTypeString, type BestiaryMonster } from "../../../entities/bestiary/index.js";
import "../../../assets/components/RulesReferenceListItem.css";
import { getSourceFullName } from "../../../entities/reference/index.js";
import { lang } from "../../../shared/lib/index.js";
import { ListCard, Tooltip, highlightText } from "../../../shared/ui/index.js";
import { getReferenceItemKey, type ReferenceItem, type ReferenceTabId } from "../model.js";

export interface RulesReferenceListItemProps {
	tabId: ReferenceTabId;
	item: ReferenceItem;
	query: string;
	meta?: string;
	active: boolean;
	onSelect: () => void;
	onInsert: () => void;
}

function getMonsterCr(monster: BestiaryMonster): unknown {
	return monster.cr && typeof monster.cr === "object" ? monster.cr.cr : monster.cr;
}

function getCreatureTokenSrc(monster: BestiaryMonster): string {
	return String(monster.imageUrl || new MonsterStatBlockModel(monster).localTokenSrc);
}

function getCreatureSize(monster: BestiaryMonster): unknown {
	return Array.isArray(monster.size) ? monster.size[0] : monster.size;
}

function getCreatureCrLabel(monster: BestiaryMonster): string {
	return String(getMonsterCr(monster) || "--");
}

function getCreatureListPresentation(monster: BestiaryMonster) {
	const source = String(monster.source || "");
	return {
		tokenSrc: getCreatureTokenSrc(monster),
		source,
		sourceFullName: getSourceFullName(source),
		size: getCreatureSize(monster),
		type: getMonsterTypeString(monster.type),
		cr: getCreatureCrLabel(monster),
	};
}

function CreatureListContent({ item, query }: { item: ReferenceItem; query: string }) {
	const monster = item as BestiaryMonster;
	const presentation = getCreatureListPresentation(monster);
	return (
		<div className="RulesReferenceListItem__content">
			<img className="RulesReferenceListItem__token" src={presentation.tokenSrc} alt="" loading="lazy" draggable={false} onError={(event) => { event.currentTarget.hidden = true; }} />
			<div className="RulesReferenceListItem__info">
				<div className="ListCard__title">{highlightText(monster.name, query)}</div>
				<div className="ListCard__meta">
					{highlightText(presentation.size, query)} {highlightText(presentation.type, query)}
					{presentation.source && (
						<Tooltip content={presentation.sourceFullName} disabled={!presentation.sourceFullName}>
							<span className="RulesReferenceListItem__source"> • {highlightText(presentation.source, query)}</span>
						</Tooltip>
					)}
				</div>
			</div>
			<Tooltip content={lang.t("Challenge Rating")}>
				<div className="RulesReferenceListItem__cr"><div className="RulesReferenceListItem__crLabel">CR</div><div className="RulesReferenceListItem__crValue">{presentation.cr}</div></div>
			</Tooltip>
		</div>
	);
}

function GenericListContent({ item, query, meta }: Pick<RulesReferenceListItemProps, "item" | "query" | "meta">) {
	return (
		<>
			<div className="ListCard__title">{highlightText(String(item.name || ""), query)}</div>
			{meta && <div className="ListCard__meta">{highlightText(meta, query)}</div>}
		</>
	);
}

export default function RulesReferenceListItem({ tabId, item, query, meta, active, onSelect, onInsert }: RulesReferenceListItemProps) {
	return (
		<div key={getReferenceItemKey(tabId, item)} onDoubleClick={onInsert}>
			<ListCard onClick={onSelect} active={active}>
				{tabId === "bestiary" ? <CreatureListContent item={item} query={query} /> : <GenericListContent item={item} query={query} meta={meta} />}
			</ListCard>
		</div>
	);
}
