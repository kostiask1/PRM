import { renderMentionPreview } from "./renderMentionText.tsx";

export function EntityLinkedListItem({ text, label, maxLength, selected, changed = false, onSelect }: {
	text: string;
	label: string;
	maxLength?: number;
	selected: boolean;
	changed?: boolean;
	onSelect: () => void;
}) {
	return (
		<div className="CampaignEntitySection__item CampaignEntitySection__linkedItem" data-selected={selected} data-changed={changed || undefined}>
			<button type="button" className="CampaignEntitySection__linkedItemSelect" aria-label={label} aria-pressed={selected} onClick={onSelect} />
			<span className="CampaignEntitySection__linkedItemText">{renderMentionPreview(text, maxLength)}</span>
		</div>
	);
}
