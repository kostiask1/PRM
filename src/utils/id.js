export function idsEqual(left, right) {
	if (
		left === null ||
		left === undefined ||
		right === null ||
		right === undefined
	) {
		return false;
	}
	return String(left) === String(right);
}
