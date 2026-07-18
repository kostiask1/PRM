import { MonsterStatBlockModel, getMonsterTypeString, type BestiaryMonster } from "../../../entities/bestiary/index.js";
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

function CreatureListContent({ item, query }: { item: ReferenceItem; query: string }) {
	const monster = item as BestiaryMonster;
	const tokenSrc = String(monster.imageUrl || new MonsterStatBlockModel(monster).localTokenSrc);
	const source = String(monster.source || "");
	const sourceFullName = getSourceFullName(source);
	const size = Array.isArray(monster.size) ? monster.size[0] : monster.size;
	return (
		<div className="Bestiary__item_content">
			<img className="Bestiary__item_token" src={tokenSrc} alt="" loading="lazy" draggable={false} onError={(event) => { event.currentTarget.hidden = true; }} />
			<div className="Bestiary__item_info">
				<div className="ListCard__title">{highlightText(monster.name, query)}</div>
				<div className="ListCard__meta">
					{highlightText(size, query)} {highlightText(getMonsterTypeString(monster.type), query)}
					{source && (
						<Tooltip content={sourceFullName} disabled={!sourceFullName}>
							<span className="Bestiary__item_source"> • {highlightText(source, query)}</span>
						</Tooltip>
					)}
				</div>
			</div>
			<Tooltip content={lang.t("Challenge Rating")}>
				<div className="Bestiary__item_cr"><div className="Bestiary__cr_label">CR</div><div className="Bestiary__cr_value">{String(getMonsterCr(monster) || "--")}</div></div>
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
