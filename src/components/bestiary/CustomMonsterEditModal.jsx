import Modal from "../common/Modal";
import Button from "../form/Button";
import Input from "../form/Input";
import { lang } from "../../services/localization";

export default function CustomMonsterEditModal({
	editingMonster,
	editingMonsterError,
	editingMonsterJson,
	isSavingMonsterEdit,
	onCancel,
	onJsonChange,
	onSave,
	title = lang.t("Edit custom creature"),
}) {
	if (!editingMonster) return null;

	return (
		<Modal
			title={title}
			onCancel={onCancel}
			showFooter={false}
			className="Bestiary__edit_modal"
		>
			<div className="Bestiary__edit_form">
				<Input
					type="textarea"
					value={editingMonsterJson}
					onChange={(event) => onJsonChange(event.target.value)}
					disabled={isSavingMonsterEdit}
					className="Bestiary__edit_json"
				/>
				{editingMonsterError && (
					<div className="Bestiary__edit_error">{editingMonsterError}</div>
				)}
				<div className="Bestiary__edit_actions">
					<Button
						variant="ghost"
						onClick={onCancel}
						disabled={isSavingMonsterEdit}
					>
						{lang.t("Cancel")}
					</Button>
					<Button
						variant="primary"
						icon="check"
						onClick={onSave}
						disabled={isSavingMonsterEdit}
					>
						{isSavingMonsterEdit ? lang.t("Saving...") : lang.t("Save")}
					</Button>
				</div>
			</div>
		</Modal>
	);
}
