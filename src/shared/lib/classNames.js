function appendFromValue(bucket, value) {
	if (!value) return;

	if (typeof value === "string" || typeof value === "number") {
		bucket.push(String(value));
		return;
	}

	if (Array.isArray(value)) {
		value.forEach((item) => appendFromValue(bucket, item));
		return;
	}

	if (typeof value === "object") {
		Object.keys(value).forEach((key) => {
			if (value[key]) {
				bucket.push(key);
			}
		});
	}
}

export default function classNames(...args) {
	const result = [];
	args.forEach((arg) => appendFromValue(result, arg));
	return result.join(" ");
}
