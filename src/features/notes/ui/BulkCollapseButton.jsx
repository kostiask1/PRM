import { Button } from "../../../shared/ui/index.js";
import { lang } from "../../../shared/lib/index.js";

export default function BulkCollapseButton({ items = [], onChange }) {
	const realItems = items.filter((item) => !item._isVirtual);
	if (realItems.length === 0) return null;

	const shouldCollapse = realItems.some((item) => !item.collapsed);

	return (
		<Button
			variant="ghost"
			size={Button.SIZES.SMALL}
			icon="chevron"
			iconSize={16}
			onClick={() => onChange(shouldCollapse)}
			title={lang.t(shouldCollapse ? "Collapse all items" : "Expand all items")}
		>
			{lang.t(shouldCollapse ? "Collapse all" : "Expand all")}
		</Button>
	);
}
