import { lang } from "../../../shared/lib/index.js";

const FIELD_LABELS: Record<string, string> = {
	firstName: "First name",
	lastName: "Last name",
	hit_points: "HP",
	armor_class: "AC",
	hp: "HP",
	ac: "AC",
	currentHp: "Current HP",
	imageUrl: "Image",
};

export function getAiResponseFieldLabel(field: string): string {
	const readable = FIELD_LABELS[field] || field.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ");
	return lang.t(readable.charAt(0).toUpperCase() + readable.slice(1));
}
