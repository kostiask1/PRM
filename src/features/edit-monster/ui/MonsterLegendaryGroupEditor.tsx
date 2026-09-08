import type { MonsterData } from "../../../entities/bestiary/index.js";
import { lang } from "../../../shared/lib/index.js";
import { Button, TextInput } from "../../../shared/ui/index.js";

interface MonsterLegendaryGroupEditorProps {
	draft: MonsterData;
	onChange: (monster: MonsterData) => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export default function MonsterLegendaryGroupEditor({
	draft,
	onChange,
}: MonsterLegendaryGroupEditorProps) {
	const group = isRecord(draft.legendaryGroup) ? draft.legendaryGroup : null;
	if (!group) {
		return (
		<section className="MonsterFieldEditModal__legendary_group">
			<div className="MonsterFieldEditModal__compact_header">
				<strong>{lang.t("Legendary group")}</strong>
				<Button
					variant="ghost"
					size={Button.SIZES.SMALL}
					icon="plus"
					onClick={() =>
						onChange({
							...draft,
							legendaryGroup: { name: "", source: draft.source || "" },
						})
					}
				>
					{lang.t("Add legendary group")}
				</Button>
			</div>
		</section>
		);
	}

	const updateField = (field: "name" | "source", value: string) => {
		onChange({
			...draft,
			legendaryGroup: { ...group, [field]: value },
		});
	};

	return (
		<section className="MonsterFieldEditModal__legendary_group">
			<div className="MonsterFieldEditModal__compact_header">
				<strong>{lang.t("Legendary group")}</strong>
				<Button
					variant="ghost"
					size={Button.SIZES.SMALL}
					icon="trash"
					title={lang.t("Remove legendary group")}
					aria-label={lang.t("Remove legendary group")}
					onClick={() => {
						const next = { ...draft };
						delete next.legendaryGroup;
						onChange(next);
					}}
				/>
			</div>
			<div className="MonsterFieldEditModal__legendary_group_fields">
				<label className="MonsterFieldEditModal__field">
					<span className="MonsterFieldEditModal__field_label">
						{lang.t("Group name")}
					</span>
					<TextInput
						value={String(group.name ?? "")}
						onChange={(event) => updateField("name", event.target.value)}
					/>
				</label>
				<label className="MonsterFieldEditModal__field">
					<span className="MonsterFieldEditModal__field_label">
						{lang.t("Group source")}
					</span>
					<TextInput
						value={String(group.source ?? "")}
						onChange={(event) => updateField("source", event.target.value)}
					/>
				</label>
			</div>
		</section>
	);
}
