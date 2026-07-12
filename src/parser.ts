export function extractURL(shareText: string): string | null {
	// Match mobile short links (both http and https), stopping before whitespaces or common sentence terminators
	const mobileUrlMatch = shareText.match(/https?:\/\/xhslink\.com\/[^\s,，。!！]+/);
	if (mobileUrlMatch) {
		return mobileUrlMatch[0];
	}
	
	// Match web/explore links for both Xiaohongshu and RedNote
	const webUrlMatch = shareText.match(/https?:\/\/(?:www\.)?(?:xiaohongshu|rednote)\.com\/(?:discovery\/item|explore)\/[a-zA-Z0-9]+(?:\?[^\s,，。!！]*)?/);
	if (webUrlMatch) {
		// Normalize explore URLs to discovery/item format
		return webUrlMatch[0].replace('/explore/', '/discovery/item/');
	}
	
	return null;
}

export function extractTitle(html: string): string {
	const match = html.match(/<title>(.*?)<\/title>/);
	if (!match) return "Untitled RedNote Note";
	const rawTitle = match[1].replace(" - 小红书", "").replace(" - RedNote", "").trim();
	// Remove hashtags to keep note title and file name clean
	return rawTitle.replace(/#[^#\s\n\r]+/g, "").replace(/#/g, "").trim() || "Untitled RedNote Note";
}

export function extractImages(html: string): string[] {
	const stateMatch = html.match(/window\.__INITIAL_STATE__=(.*?)<\/script>/s);
	if (!stateMatch) return [];

	try {
		const jsonStr = stateMatch[1].trim();
		const cleanedJson = jsonStr.replace(/undefined/g, "null");
		const state = JSON.parse(cleanedJson);
		const noteId = Object.keys(state.note.noteDetailMap)[0];
		const imageList = state.note.noteDetailMap[noteId].note.imageList || [];
		return imageList
			.map((img: any) => img.urlDefault || "")
			.filter((url: string) => url && url.startsWith("http"));
	} catch (e) {
		console.log(`Failed to parse images: ${e.message}`);
		return [];
	}
}

export function extractVideoUrl(html: string): string | null {
	const stateMatch = html.match(/window\.__INITIAL_STATE__=(.*?)<\/script>/s);
	if (!stateMatch) return null;

	try {
		const jsonStr = stateMatch[1].trim();
		const cleanedJson = jsonStr.replace(/undefined/g, "null");
		const state = JSON.parse(cleanedJson);
		const noteId = Object.keys(state.note.noteDetailMap)[0];
		const noteData = state.note.noteDetailMap[noteId].note;
		const videoInfo = noteData.video;

		if (!videoInfo || !videoInfo.media || !videoInfo.media.stream) return null;

		if (videoInfo.media.stream.h264 && videoInfo.media.stream.h264.length > 0) {
			return videoInfo.media.stream.h264[0].masterUrl || null;
		}
		if (videoInfo.media.stream.h265 && videoInfo.media.stream.h265.length > 0) {
			return videoInfo.media.stream.h265[0].masterUrl || null;
		}
		return null;
	} catch (e) {
		console.log(`Failed to parse video URL: ${e.message}`);
		return null;
	}
}

export function extractContent(html: string): string {
	const divMatch = html.match(/<div id="detail-desc" class="desc">([\s\S]*?)<\/div>/);
	if (divMatch) {
		return divMatch[1]
			.replace(/<[^>]+>/g, "")
			.replace(/\[话题\]/g, "")
			.replace(/\[[^\]]+\]/g, "")
			.trim() || "Content not found";
	}

	const stateMatch = html.match(/window\.__INITIAL_STATE__=(.*?)<\/script>/s);
	if (stateMatch) {
		try {
			const jsonStr = stateMatch[1].trim();
			const cleanedJson = jsonStr.replace(/undefined/g, "null");
			const state = JSON.parse(cleanedJson);
			const noteId = Object.keys(state.note.noteDetailMap)[0];
			const desc = state.note.noteDetailMap[noteId].note.desc || "";
			return desc
				.replace(/\[话题\]/g, "")
				.replace(/\[[^\]]+\]/g, "")
				.trim() || "Content not found";
		} catch (e) {
			console.log(`Failed to parse content from JSON: ${e.message}`);
		}
	}
	return "Content not found";
}

export function isVideoNote(html: string): boolean {
	const stateMatch = html.match(/window\.__INITIAL_STATE__=(.*?)<\/script>/s);
	if (!stateMatch) return false;

	try {
		const jsonStr = stateMatch[1].trim();
		const cleanedJson = jsonStr.replace(/undefined/g, "null");
		const state = JSON.parse(cleanedJson);
		const noteId = Object.keys(state.note.noteDetailMap)[0];
		const noteType = state.note.noteDetailMap[noteId].note.type;
		return noteType === "video";
	} catch (e) {
		console.log(`Failed to determine note type: ${e.message}`);
		return false;
	}
}

export function extractTags(content: string): string[] {
	const tagMatches = content.match(/#[^#\s\n\r]+/g) || [];
	return tagMatches.map((tag) => tag.replace(/#/g, "").trim()).filter((tag) => tag.length > 0);
}

export function sanitizeFilename(title: string): string {
	// Keep alphanumeric, Chinese/Japanese/Korean characters, spaces, and safe symbols (-, _)
	let sanitized = title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af\s-_]/g, "").trim();
	sanitized = sanitized.replace(/\s+/g, "-");
	sanitized = sanitized.length > 0 ? sanitized : "Untitled";
	return sanitized.substring(0, 50);
}
