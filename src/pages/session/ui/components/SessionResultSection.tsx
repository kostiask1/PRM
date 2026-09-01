import { EditableField } from "../../../../features/editor/ui/index.js";
import { lang } from "../../../../shared/lib/index.js";
import "../../../../assets/components/SessionResultSection.css";
import TodoSection from "./TodoSection.tsx";

interface SessionResultSectionProps {
	value: string;
	onChange: (value: string) => void;
}

export default function SessionResultSection({
	value,
	onChange,
}: SessionResultSectionProps) {
	return (
		<TodoSection title={lang.t("Session result")}>
			<EditableField
				data-history-field="result_text"
				type="textarea"
				className="SessionResultSection__field"
				enableHistory={false}
				placeholder={lang.t("Summary of what actually happened...")}
				value={value}
				onChange={(event) => onChange(event.target.value)}
			/>
		</TodoSection>
	);
}
