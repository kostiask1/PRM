import type { ChangeEvent, KeyboardEvent } from "react";

import type { MonsterData } from "../../../entities/bestiary/index.js";
import { lang } from "../../../shared/lib/index.js";
import { Button, TextInput } from "../../../shared/ui/index.js";
import {
	actionEntriesToText,
	CREATURE_ACTION_SECTIONS,
	getMonsterActionList,
	type CreatureActionSection,
} from "../model.ts";

interface MonsterActionSectionsProps {
	draft: MonsterData;
	onAddAction: (section: CreatureActionSection) => void;
	onActionNameChange: (
		event: ChangeEvent<HTMLInputElement>,
		section: CreatureActionSection,
		index: number,
	) => void;
	onActionTextChange: (
		event: ChangeEvent<HTMLTextAreaElement>,
		section: CreatureActionSection,
		index: number,
	) => void;
	onActionTextKeyDown: (
		event: KeyboardEvent<HTMLTextAreaElement>,
		section: CreatureActionSection,
		index: number,
	) => void;
	onRemoveAction: (section: CreatureActionSection, index: number) => void;
}

export default function MonsterActionSections({
	draft,
	onAddAction,
	onActionNameChange,
	onActionTextChange,
	onActionTextKeyDown,
	onRemoveAction,
}: MonsterActionSectionsProps) {
	return (
		<>
			{CREATURE_ACTION_SECTIONS.map((section) => {
				const list = getMonsterActionList(draft, section.key);
				return (
					<section
						key={section.key}
						className="MonsterFieldEditModal__action_section"
					>
						<div className="MonsterFieldEditModal__action_header">
							<h4>{lang.t(section.label)}</h4>
							<Button
								variant="ghost"
								size={Button.SIZES.SMALL}
								icon="plus"
								onClick={() => onAddAction(section.key)}
							>
								{lang.t("Add action")}
							</Button>
						</div>
						{list.length === 0 ? (
							<div className="MonsterFieldEditModal__empty">
								{lang.t("No entries.")}
							</div>
						) : (
							<div className="MonsterFieldEditModal__action_list">
								{list.map((action, index) => (
									<div
										key={`${section.key}-${index}`}
										className="MonsterFieldEditModal__action_item"
									>
										<div className="MonsterFieldEditModal__action_title">
											<label className="MonsterFieldEditModal__field">
												<span>{lang.t("Name")}</span>
												<TextInput
													value={String(action?.name || "")}
													onChange={(event) =>
														onActionNameChange(event, section.key, index)
													}
												/>
											</label>
											<Button
												variant="ghost"
												size={Button.SIZES.SMALL}
												icon="trash"
												onClick={() => onRemoveAction(section.key, index)}
												title={lang.t("Remove action")}
											/>
										</div>
										<label className="MonsterFieldEditModal__field">
											<span>{lang.t("Text")}</span>
											<textarea
												className="Input Input__textarea MonsterFieldEditModal__textarea"
												rows={4}
												value={actionEntriesToText(action)}
												onChange={(event) =>
													onActionTextChange(event, section.key, index)
												}
												onKeyDown={(event) =>
													onActionTextKeyDown(event, section.key, index)
												}
												title={lang.t("Ctrl+K — Insert rule reference")}
											/>
										</label>
									</div>
								))}
							</div>
						)}
					</section>
				);
			})}
		</>
	);
}
