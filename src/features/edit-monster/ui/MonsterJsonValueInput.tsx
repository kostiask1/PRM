import { useEffect, useMemo, useState } from "react";

import { lang } from "../../../shared/lib/index.js";

interface MonsterJsonValueInputProps {
	ariaLabel: string;
	rows?: number;
	value: unknown;
	onChange: (value: unknown) => void;
}

function serialize(value: unknown): string {
	try {
		return JSON.stringify(value, null, 2) ?? "null";
	} catch {
		return "null";
	}
}

export default function MonsterJsonValueInput({
	ariaLabel,
	rows = 4,
	value,
	onChange,
}: MonsterJsonValueInputProps) {
	const serializedValue = useMemo(() => serialize(value), [value]);
	const [text, setText] = useState(serializedValue);
	const [error, setError] = useState("");

	useEffect(() => {
		setText(serializedValue);
		setError("");
	}, [serializedValue]);

	return (
		<div className="MonsterFieldEditModal__json_value">
			<textarea
				className="Input Input__textarea MonsterFieldEditModal__json_value_input"
				aria-label={ariaLabel}
				rows={rows}
				value={text}
				onChange={(event) => {
					const nextText = event.target.value;
					setText(nextText);
					try {
						onChange(JSON.parse(nextText) as unknown);
						setError("");
					} catch {
						setError(lang.t("Invalid JSON."));
					}
				}}
			/>
			{error && (
				<span className="MonsterFieldEditModal__inline_error" role="alert">
					{error}
				</span>
			)}
		</div>
	);
}
