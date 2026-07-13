export function formatBytes(bytes) {
	const value = Number(bytes) || 0;
	if (value <= 0) return "0 B";
	const units = ["B", "KB", "MB", "GB", "TB"];
	const unitIndex = Math.min(
		Math.floor(Math.log(value) / Math.log(1024)),
		units.length - 1,
	);
	const scaled = value / 1024 ** unitIndex;
	const precision = scaled >= 100 || unitIndex === 0 ? 0 : scaled >= 10 ? 1 : 2;
	return `${scaled.toFixed(precision)} ${units[unitIndex]}`;
}
