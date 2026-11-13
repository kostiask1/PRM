import type { ChangeEvent } from "react";
import BestiaryContent, {
	type BestiaryContentProps,
} from "./BestiaryContent.tsx";
import BestiaryHeaderActions from "./BestiaryHeaderActions.tsx";

export interface BestiaryBrowserContentProps
	extends Omit<BestiaryContentProps, "headerActions"> {
	canExport: boolean;
	canRedo: boolean;
	canUndo: boolean;
	onCreate: () => void;
	onExport: () => void;
	onImport: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
	onRedo: () => Promise<void>;
	onUndo: () => Promise<void>;
}

export function BestiaryBrowserContent({
	canExport,
	canRedo,
	canUndo,
	onCreate,
	onExport,
	onImport,
	onRedo,
	onUndo,
	...contentProps
}: BestiaryBrowserContentProps) {
	return (
		<BestiaryContent
			{...contentProps}
			headerActions={
				<BestiaryHeaderActions
					canExport={canExport}
					canRedo={canRedo}
					canUndo={canUndo}
					onCreate={onCreate}
					onExport={onExport}
					onImport={onImport}
					onRedo={onRedo}
					onUndo={onUndo}
				/>
			}
		/>
	);
}
