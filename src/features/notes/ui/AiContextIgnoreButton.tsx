import { Button } from "../../../shared/ui/index.js";
import { lang } from "../../../shared/lib/index.js";

export interface AiContextIgnoreButtonProps {
	ignored: boolean;
	onToggle?: (ignored: boolean) => void;
}

export default function AiContextIgnoreButton({
	ignored,
	onToggle,
}: AiContextIgnoreButtonProps) {
	return (
		<Button
			variant={ignored ? "primary" : "ghost"}
			size={Button.SIZES.SMALL}
			icon={ignored ? "x" : "database"}
			iconSize={13}
			onClick={(event) => {
				event.preventDefault();
				event.stopPropagation();
				onToggle?.(!ignored);
			}}
			title={
				ignored
					? lang.t("Include in AI context")
					: lang.t("Ignore in AI context")
			}
			data-no-list-drag="true"
		/>
	);
}
