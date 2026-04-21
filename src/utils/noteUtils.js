export function createEmptyNote() {
	return {
		id: Date.now(),
		title: "",
		text: "",
		collapsed: false,
	};
}

export function appendTrailingEmptyNote(notes = []) {
	const next = [...notes];
	const last = next[next.length - 1];
	if (
		next.length === 0 ||
		(last && (last.text?.trim() !== "" || last.title?.trim() !== ""))
	) {
		next.push(createEmptyNote());
	}
	return next;
}

export function ensureAtLeastOneNote(notes = []) {
	return notes.length > 0 ? notes : [createEmptyNote()];
}
