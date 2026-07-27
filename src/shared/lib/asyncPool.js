export async function mapWithConcurrency(
	items,
	concurrency,
	mapper,
) {
	const source = Array.from(items || []);
	if (source.length === 0) return [];
	const workerCount = Math.max(
		1,
		Math.min(
			source.length,
			Math.floor(Number(concurrency)) || 1,
		),
	);
	const results = new Array(source.length);
	let cursor = 0;

	async function worker() {
		while (cursor < source.length) {
			const index = cursor;
			cursor += 1;
			results[index] = await mapper(source[index], index);
		}
	}

	await Promise.all(
		Array.from({ length: workerCount }, () => worker()),
	);
	return results;
}
