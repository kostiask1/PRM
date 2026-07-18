import { lang } from "../../../shared/lib/index.js";
import {
	getImagePromptItemKey,
	type ImagePromptEntity,
} from "../model/imagePromptPicker.ts";

export interface ImagePromptColumnProps<Item extends ImagePromptEntity> {
	title: string;
	items: readonly Item[];
	emptyLabel: string;
	getName: (item: Item, index: number) => string;
	getDescription: (item: Item, index: number) => unknown;
	getKey?: (item: Item, index: number) => unknown;
	onSelect: (item: Item, index: number) => void;
	loading: boolean;
	getPreview: (description: unknown) => string;
}

export default function ImagePromptColumn<Item extends ImagePromptEntity>({
	title,
	items,
	emptyLabel,
	getName,
	getDescription,
	getKey,
	onSelect,
	loading,
	getPreview,
}: ImagePromptColumnProps<Item>) {
	return (
		<section className="AiAssistant__image_prompt_column">
			<h4>{lang.t(title)}</h4>
			<div className="AiAssistant__image_prompt_list">
				{items.length > 0 ? (
					items.map((item, index) => {
						const key = getImagePromptItemKey(
							item,
							index,
							title,
							getKey?.(item, index),
						);
						const description = getPreview(getDescription(item, index));
						return (
							<button
								key={key}
								type="button"
								className="AiAssistant__image_prompt_item"
								onClick={() => onSelect(item, index)}
								disabled={loading}
								title={lang.t("Generate visual prompt for this item")}
							>
								<strong>{getName(item, index)}</strong>
								{description && <span>{description}</span>}
							</button>
						);
					})
				) : (
					<div className="muted AiAssistant__empty_context">
						{lang.t(emptyLabel)}
					</div>
				)}
			</div>
		</section>
	);
}
