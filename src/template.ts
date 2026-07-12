export interface TemplateData {
	title: string;
	content: string;
	url: string;
	category: string;
	date: string;
	mediaBlock: string;
	rawMedia: string;
}

export class TemplateEngine {
	static DEFAULT_PROPERTIES = 'title: "{{title}}"\nsource: "{{source}}"\ndate: "{{date}}"\ncategory: "{{category}}"';
	static DEFAULT_NOTE = '{{media}}\n{{title}}\n{{content}}';

	static generateMediaBlock(data: { isVideo: boolean; videoUrl: string | null; images: string[] }, url: string): { rawMedia: string; mediaBlock: string } {
		let rawMedia = "";
		let mediaBlock = "";

		if (data.isVideo) {
			if (data.videoUrl) {
				mediaBlock = `<video controls src="${data.videoUrl}" width="100%"></video>\n\n`;
				rawMedia = data.videoUrl;
			} else if (data.images.length > 0) {
				mediaBlock = `[![Cover Image](${data.images[0]})](${url})\n\n`;
				rawMedia = data.images[0];
			}
		} else {
			if (data.images.length > 0) {
				rawMedia = data.images[0] || "";
				mediaBlock = `![Cover Image](${data.images[0]})\n\n`;
				if (data.images.length > 1) {
					const otherImages = data.images.slice(1);
					mediaBlock += otherImages.map((u) => `![Image](${u})`).join("\n") + "\n\n";
				}
			}
		}

		return { rawMedia, mediaBlock };
	}

	static render(template: string, data: TemplateData, forProperties: boolean): string {
		let result = template || "";
		const mediaValue = forProperties ? data.rawMedia : data.mediaBlock;

		result = result.replace(/\{\{title\}\}/g, data.title);
		result = result.replace(/\{\{content\}\}/g, data.content);
		result = result.replace(/\{\{media\}\}/g, mediaValue);
		result = result.replace(/\{\{source\}\}/g, data.url);
		result = result.replace(/\{\{url\}\}/g, data.url);
		result = result.replace(/\{\{date\}\}/g, data.date);
		result = result.replace(/\{\{category\}\}/g, data.category);

		return result;
	}

	static replaceMediaUrls(content: string, mediaMapping: { [remoteUrl: string]: string }): string {
		let result = content;
		for (const [remoteUrl, localPath] of Object.entries(mediaMapping)) {
			// Escape special regex characters in the remote URL (removed unnecessary escape of /)
			const escapedUrl = remoteUrl.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
			result = result.replace(new RegExp(escapedUrl, "g"), localPath);
		}
		return result;
	}
}
