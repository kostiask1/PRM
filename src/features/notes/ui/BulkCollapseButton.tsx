import { Button } from "../../../shared/ui/index.js";
import { lang } from "../../../shared/lib/index.js";
import {
	getBulkCollapseAction,
	type CollapsibleNoteItem,
} from "../model.ts";

export interface BulkCollapseButtonProps {
	items?: readonly CollapsibleNoteItem[];
	onChange: (collapsed: boolean) => void;
}

export default function BulkCollapseButton({
	items = [],
	onChange,
}: BulkCollapseButtonProps) {
	const shouldCollapse = getBulkCollapseAction(items);
	if (shouldCollapse === null) return null;

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
