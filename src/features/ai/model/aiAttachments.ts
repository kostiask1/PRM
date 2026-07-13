export const MAX_AI_ATTACHMENTS = 4;
export const MAX_AI_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_AI_IMAGE_BYTES = 10 * 1024 * 1024;

const AI_IMAGE_MIME_BY_EXTENSION: Readonly<Record<string, string>> = Object.freeze({
	".gif": "image/gif",
	".jpeg": "image/jpeg",
	".jpg": "image/jpeg",
	".png": "image/png",
	".webp": "image/webp",
});

const AI_FILE_MIME_BY_EXTENSION: Readonly<Record<string, string>> = Object.freeze({
	".csv": "text/csv",
	".css": "text/css",
	".htm": "text/html",
	".html": "text/html",
	".js": "text/javascript",
	".json": "application/json",
	".md": "text/markdown",
	".markdown": "text/markdown",
	".pdf": "application/pdf",
	".scss": "text/css",
	".txt": "text/plain",
	".xml": "application/xml",
	".yaml": "application/x-yaml",
	".yml": "application/x-yaml",
});

const AI_FILE_MIME_TYPES = new Set([
	...Object.values(AI_FILE_MIME_BY_EXTENSION),
	"text/xml",
]);

export const AI_IMAGE_ACCEPT = Object.keys(AI_IMAGE_MIME_BY_EXTENSION).join(",");
export const AI_FILE_ACCEPT = Object.keys(AI_FILE_MIME_BY_EXTENSION).join(",");

export interface AiAttachmentDescriptor {
	name?: string;
	type?: string;
	sizeBytes?: number;
	url?: string;
}

type NamedFile = Pick<File, "name" | "type">;

function getFileExtension(fileName: string): string {
	const match = String(fileName || "")
		.toLowerCase()
		.match(/\.[^.]+$/);
	return match ? match[0] : "";
}

export function getSupportedAiFileMimeType(file: NamedFile | null | undefined): string {
	if (!file) return "";
	const byExtension = AI_FILE_MIME_BY_EXTENSION[getFileExtension(file.name)];
	if (byExtension) return byExtension;
	const mimeType = String(file.type || "").toLowerCase();
	return AI_FILE_MIME_TYPES.has(mimeType) ? mimeType : "";
}

export function getSupportedAiImageMimeType(file: NamedFile | null | undefined): string {
	if (!file) return "";
	const byExtension = AI_IMAGE_MIME_BY_EXTENSION[getFileExtension(file.name)];
	if (byExtension) return byExtension;
	const mimeType = String(file.type || "").toLowerCase();
	return Object.values(AI_IMAGE_MIME_BY_EXTENSION).includes(mimeType)
		? mimeType
		: "";
}

export function readFileAsBase64(file: Blob): Promise<string> {
	return new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			const result = String(reader.result || "");
			resolve(result.includes(",") ? result.split(",").pop() || "" : result);
		};
		reader.onerror = () => reject(reader.error || new Error("File read failed."));
		reader.readAsDataURL(file);
	});
}

export function getAttachedImageKey(image: AiAttachmentDescriptor | null | undefined): string {
	return image?.url || `${image?.name || ""}:${image?.sizeBytes || ""}`;
}

export function getAttachedFileKey(file: AiAttachmentDescriptor | null | undefined): string {
	return `${file?.name || ""}:${file?.sizeBytes || ""}`;
}
