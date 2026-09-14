export function extractURL(shareText: string): string | null {
	if (!shareText || typeof shareText !== "string") return null;

	// 1. Mobile short links (xhslink.com, xhslink.cn, xhs.cn)
	// Matches: http://xhslink.com/o/xxx, https://xhslink.cn/o/xxx, http://xhs.cn/xxx, etc.
	const shortLinkRegex = /(?:https?:\/\/)?(?:www\.)?(?:xhslink\.(?:com|cn)|xhs\.cn)\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+/i;
	const shortMatch = shareText.match(shortLinkRegex);
	if (shortMatch) {
		let url = shortMatch[0].trim();
		if (!url.startsWith("http://") && !url.startsWith("https://")) {
			url = `https://${url}`;
		}
		return url;
	}

	// 2. Web URLs (xiaohongshu.com, rednote.com)
	// Supports /explore/{id}, /discovery/item/{id}, /user/profile/{uid}/{id}, /search_result/{id}
	const webUrlRegex = /(?:https?:\/\/)?(?:www\.)?(?:xiaohongshu|rednote)\.com\/(?:explore|discovery\/item|user\/profile\/[a-zA-Z0-9_-]+|search_result)\/([a-zA-Z0-9_-]+)(?:\?[^\s,，。!！"'\)\]】]*)?/i;
	const webMatch = shareText.match(webUrlRegex);
	if (webMatch) {
		let fullUrl = webMatch[0].trim();
		if (!fullUrl.startsWith("http://") && !fullUrl.startsWith("https://")) {
			fullUrl = `https://${fullUrl}`;
		}
		// Strip trailing punctuation if matched
		fullUrl = fullUrl.replace(/[)\]}>,.;!?，。！？）】"']+$/, "");

		try {
			const parsed = new URL(fullUrl);
			const noteId = webMatch[1];
			// Normalize path to /explore/{noteId} while keeping query parameters (e.g. xsec_token) intact
			parsed.pathname = `/explore/${noteId}`;
			return parsed.toString();
		} catch {
			// Fallback: simple string replacement if URL parsing fails
			return fullUrl.replace(/\/discovery\/item\//, "/explore/");
		}
	}

	return null;
}

export function extractInitialState(html: string): any | null {
	const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*(.*?)<\/script>/s);
	if (!stateMatch) return null;

	try {
		const jsonStr = stateMatch[1].trim().replace(/;+\s*$/, "");
		const cleanedJson = jsonStr.replace(/\bundefined\b/g, "null");
		return JSON.parse(cleanedJson);
	} catch (e) {
		const errorMsg = e instanceof Error ? e.message : String(e);
		console.log(`Failed to parse __INITIAL_STATE__: ${errorMsg}`);
		return null;
	}
}

export function getNoteFromState(state: any, noteId?: string | null): any | null {
	if (!state) return null;

	if (state.noteData?.data?.noteData) {
		return state.noteData.data.noteData;
	}

	const detailMap = state.note?.noteDetailMap || state.note?.detailMap;
	if (detailMap && typeof detailMap === "object") {
		if (noteId && detailMap[noteId]) {
			const entry = detailMap[noteId];
			return entry.note || entry;
		}
		for (const key of Object.keys(detailMap)) {
			const entry = detailMap[key];
			const note = entry?.note || entry;
			if (note && (note.title || note.desc || note.imageList || note.video)) {
				return note;
			}
		}
		const firstKey = Object.keys(detailMap)[0];
		if (firstKey) {
			const entry = detailMap[firstKey];
			return entry?.note || entry || null;
		}
	}

	return null;
}

function decodeHtmlEntities(str: string): string {
	return str
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&nbsp;/g, " ");
}

function cleanTitle(raw: string): string {
	if (!raw) return "";
	let cleaned = decodeHtmlEntities(raw)
		.replace(/\s*-\s*小红书\s*$/i, "")
		.replace(/\s*-\s*RedNote\s*$/i, "")
		.replace(/\s*-\s*你的生活指南\s*$/i, "")
		.trim();
	return cleaned.replace(/#[^#\s\n\r]+/g, "").replace(/#/g, "").trim();
}

function isGenericTitle(title: string): boolean {
	const lower = title.toLowerCase();
	return lower === "小红书" || lower === "rednote" || lower === "你访问的页面不见了" || lower === "untitled rednote note";
}

export function extractTitle(html: string): string {
	const state = extractInitialState(html);
	const note = getNoteFromState(state);

	if (note && typeof note.title === "string" && note.title.trim().length > 0) {
		const cleaned = cleanTitle(note.title);
		if (cleaned) return cleaned;
	}

	// Try <meta property="og:title">
	const ogMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["'](.*?)["']/i);
	if (ogMatch && ogMatch[1]) {
		const cleaned = cleanTitle(ogMatch[1]);
		if (cleaned && !isGenericTitle(cleaned)) return cleaned;
	}

	// Try <title>
	const match = html.match(/<title>(.*?)<\/title>/is);
	if (match && match[1]) {
		const cleaned = cleanTitle(match[1]);
		if (cleaned && !isGenericTitle(cleaned)) return cleaned;
	}

	// Fallback to note description first line
	if (note && typeof note.desc === "string" && note.desc.trim().length > 0) {
		const firstLine = note.desc.trim().split(/\r?\n/)[0];
		const cleaned = cleanTitle(firstLine);
		if (cleaned) return cleaned;
	}

	return "Untitled RedNote Note";
}

export function extractImages(html: string): string[] {
	const state = extractInitialState(html);
	const note = getNoteFromState(state);
	const imageList = note?.imageList || [];

	if (!Array.isArray(imageList)) return [];

	return imageList
		.map((img: any) => {
			let url = img.urlDefault || img.url || (img.infoList && img.infoList[0]?.url) || img.urlPre || "";
			if (typeof url === "string" && url.startsWith("//")) {
				url = `https:${url}`;
			}
			return url;
		})
		.filter((url: string) => typeof url === "string" && url.startsWith("http"));
}

export function extractVideoUrl(html: string): string | null {
	const state = extractInitialState(html);
	const note = getNoteFromState(state);
	const videoInfo = note?.video;

	if (!videoInfo) return null;

	// Check consumer originVideoKey
	const originKey = videoInfo.consumer?.originVideoKey;
	if (originKey && typeof originKey === "string") {
		return `https://sns-video-bd.xhscdn.com/${originKey}`;
	}

	// Check stream h264 / h265
	const stream = videoInfo.media?.stream;
	if (stream) {
		if (Array.isArray(stream.h264) && stream.h264.length > 0) {
			const item = stream.h264[0];
			const url = item.masterUrl || item.master_url || item.url || (item.backupUrls && item.backupUrls[0]) || (item.backup_urls && item.backup_urls[0]);
			if (url) return url;
		}
		if (Array.isArray(stream.h265) && stream.h265.length > 0) {
			const item = stream.h265[0];
			const url = item.masterUrl || item.master_url || item.url || (item.backupUrls && item.backupUrls[0]) || (item.backup_urls && item.backup_urls[0]);
			if (url) return url;
		}
	}

	// Check mediaV2
	if (videoInfo.mediaV2) {
		try {
			const mediaV2 = typeof videoInfo.mediaV2 === "string" ? JSON.parse(videoInfo.mediaV2) : videoInfo.mediaV2;
			const v2Stream = mediaV2?.video?.stream || mediaV2?.stream;
			if (v2Stream) {
				const h264List = v2Stream.h264 || [];
				if (h264List.length > 0) {
					const url = h264List[0].master_url || h264List[0].masterUrl || h264List[0].url;
					if (url) return url;
				}
			}
		} catch {
			// ignore mediaV2 parse error
		}
	}

	return null;
}

function cleanContent(raw: string): string {
	return raw
		.replace(/\[话题\]/g, "")
		.replace(/\[[^\]]+\]/g, "")
		.trim();
}

export function extractContent(html: string): string {
	const state = extractInitialState(html);
	const note = getNoteFromState(state);

	if (note && typeof note.desc === "string" && note.desc.trim().length > 0) {
		return cleanContent(note.desc);
	}

	const divMatch = html.match(/<div id="detail-desc" class="desc">([\s\S]*?)<\/div>/);
	if (divMatch) {
		const text = divMatch[1].replace(/<[^>]+>/g, "");
		const cleaned = cleanContent(text);
		if (cleaned) return cleaned;
	}

	const metaMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["'](.*?)["']/i);
	if (metaMatch && metaMatch[1]) {
		const cleaned = cleanContent(metaMatch[1]);
		if (cleaned) return cleaned;
	}

	return "Content not found";
}

export function isVideoNote(html: string): boolean {
	const state = extractInitialState(html);
	const note = getNoteFromState(state);
	if (note) {
		if (note.type === "video" || !!note.video) {
			return true;
		}
	}
	return false;
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
