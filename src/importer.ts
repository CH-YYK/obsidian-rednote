import { App, Notice, requestUrl, TFile } from "obsidian";
import { RedNoteSettings } from "./types";
import {
	extractTitle,
	extractContent,
	extractImages,
	extractVideoUrl,
	isVideoNote,
	extractTags,
	sanitizeFilename
} from "./parser";
import { TemplateEngine, TemplateData } from "./template";

export class RedNoteImporter {
	private app: App;
	private settings: RedNoteSettings;
	private onSettingsSaved: () => Promise<void>;

	constructor(app: App, settings: RedNoteSettings, onSettingsSaved: () => Promise<void>) {
		this.app = app;
		this.settings = settings;
		this.onSettingsSaved = onSettingsSaved;
	}

	async downloadMediaFile(url: string, folderPath: string, filename: string): Promise<string> {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 seconds timeout
		try {
			const response = await fetch(url, { signal: controller.signal });
			clearTimeout(timeoutId);
			if (!response.ok) throw new Error(`HTTP error ${response.status}`);
			const blob = await response.blob();
			const arrayBuffer = await blob.arrayBuffer();
			const filePath = `${folderPath}/${filename}`;
			await this.app.vault.adapter.writeBinary(filePath, arrayBuffer);
			return filename;
		} catch (error) {
			clearTimeout(timeoutId);
			const isTimeout = error.name === "AbortError";
			const msg = isTimeout ? "Request timeout (10s)" : error.message;
			console.log(`Failed to download media from ${url}: ${msg}`);
			new Notice(`Failed to download media: ${msg}`);
			return url;
		}
	}

	async createFolderRecursive(folderPath: string): Promise<void> {
		const parts = folderPath.split("/").filter(p => p);
		let currentPath = "";
		for (const part of parts) {
			currentPath = currentPath ? `${currentPath}/${part}` : part;
			if (!await this.app.vault.adapter.exists(currentPath)) {
				try {
					await this.app.vault.createFolder(currentPath);
				} catch (err) {
					if (!err.message.includes("Folder already exists")) {
						throw err;
					}
				}
			}
		}
	}

	// Double-phase import (backward compatible)
	async importNote(url: string, category: string, downloadMedia: boolean, targetFile?: TFile): Promise<void> {
		const data = await this.fetchNoteData(url);
		await this.saveNote(url, data, category, downloadMedia, targetFile);
	}

	// Phase 1: Fetch and parse Note Data
	async fetchNoteData(url: string) {
		const response = await requestUrl({ url });
		const html = response.text;

		const title = extractTitle(html);
		const rawContent = extractContent(html);
		const tags = extractTags(rawContent);
		const isVideo = isVideoNote(html);

		// Pre-clean tags from description for a cleaner edit experience
		let content = rawContent;
		if (isVideo) {
			content = rawContent.replace(/#\S+/g, "").trim();
		} else {
			content = rawContent.replace(/#[^#\s]*(?:\s+#[^#\s]*)*\s*/g, "").trim();
		}

		const images = extractImages(html);
		const videoUrl = extractVideoUrl(html);

		return { title, content, tags, images, videoUrl, isVideo };
	}

	// Phase 2: Save processed/edited data to Vault
	async saveNote(
		url: string,
		data: { title: string; content: string; tags: string[]; images: string[]; videoUrl: string | null; isVideo: boolean; noteTemplate?: string; subfolder?: string },
		category: string,
		downloadMedia: boolean,
		targetFile?: TFile
	): Promise<void> {
		try {
			const { title, content, tags, images, videoUrl, isVideo, noteTemplate } = data;

			const baseFolder = this.settings.defaultFolder || "";
			const mediaFolder = baseFolder ? `${baseFolder}/media` : "media";
			
			let folderPath = baseFolder;
			if (this.settings.enableSubfolder) {
				const subfolder = data.subfolder !== undefined ? data.subfolder.trim() : (category || "Uncategorized");
				if (subfolder) {
					folderPath = baseFolder ? `${baseFolder}/${subfolder}` : subfolder;
				}
			}

			let safeTitle = title.replace(/[/\\?%*:|"<>]/g, "-").trim();
			safeTitle = safeTitle.length > 0 ? safeTitle : "Untitled";
			safeTitle = safeTitle.substring(0, 50);
			const filename = isVideo ? `[V]${safeTitle}` : safeTitle;

			let filePath = `${folderPath}/${filename}.md`;
			let collisionIndex = 1;
			while (this.app.vault.getAbstractFileByPath(filePath) || await this.app.vault.adapter.exists(filePath)) {
				filePath = `${folderPath}/${filename}-${collisionIndex}.md`;
				collisionIndex++;
			}

			const mediaSafeTitle = sanitizeFilename(title);

			if (folderPath && !await this.app.vault.adapter.exists(folderPath)) {
				await this.createFolderRecursive(folderPath);
			}

			const mediaMapping: { [remoteUrl: string]: string } = {};

			if (downloadMedia) {
				if (mediaFolder && !await this.app.vault.adapter.exists(mediaFolder)) {
					await this.createFolderRecursive(mediaFolder);
				}

				if (isVideo) {
					if (videoUrl) {
						const videoFilename = `${mediaSafeTitle}-${Date.now()}.mp4`;
						const downloadedFilename = await this.downloadMediaFile(videoUrl, mediaFolder, videoFilename);
						const localPath = downloadedFilename.startsWith("http") ? downloadedFilename : `../media/${downloadedFilename}`;
						mediaMapping[videoUrl] = localPath;
					} else if (images.length > 0) {
						const imageFilename = `${mediaSafeTitle}-0-${Date.now()}.jpg`;
						const downloadedFilename = await this.downloadMediaFile(images[0], mediaFolder, imageFilename);
						const localPath = downloadedFilename.startsWith("http") ? downloadedFilename : `../media/${downloadedFilename}`;
						mediaMapping[images[0]] = localPath;
						new Notice("Video URL not found; using cover image as fallback.");
					}
				} else {
					if (images.length > 0) {
						const downloadPromises = images.map(async (imageUrl, i) => {
							const imageFilename = `${mediaSafeTitle}-${i}-${Date.now()}.jpg`;
							const downloadedFilename = await this.downloadMediaFile(imageUrl, mediaFolder, imageFilename);
							const localPath = downloadedFilename.startsWith("http") ? downloadedFilename : `../media/${downloadedFilename}`;
							mediaMapping[imageUrl] = localPath;
						});
						await Promise.all(downloadPromises);
					}
				}
			}

			// Map image/video URLs to local relative paths if downloaded
			const mappedImages = images.map((img) => mediaMapping[img] || img);
			const mappedVideoUrl = videoUrl ? (mediaMapping[videoUrl] || videoUrl) : null;

			const { rawMedia, mediaBlock } = TemplateEngine.generateMediaBlock(
				{ isVideo, videoUrl: mappedVideoUrl, images: mappedImages },
				url
			);

			const noteDate = new Date().toISOString().split("T")[0];
			const templateData: TemplateData = {
				title,
				content,
				url,
				category,
				date: noteDate,
				mediaBlock,
				rawMedia
			};

			let yamlBlock = "";
			const parsedProperties = TemplateEngine.render(this.settings.propertiesTemplate || "", templateData, true).trim();
			
			let yamlTags = "";
			if (tags.length > 0) {
				if (this.settings.writeObsidianPropertyTags) {
					yamlTags += "\ntags:\n" + tags.map((t) => `  - ${t}`).join("\n");
				}
				if (this.settings.writeRedNoteTags) {
					yamlTags += "\nrednote_tags:\n" + tags.map((t) => `  - ${t}`).join("\n");
				}
			}

			if (parsedProperties || yamlTags) {
				yamlBlock = `---\n${parsedProperties}${yamlTags}\n---\n`;
			}

			const activeNoteTemplate = noteTemplate || this.settings.noteTemplate;
			const bodyBlock = TemplateEngine.render(activeNoteTemplate, templateData, false);

			const markdown = `${yamlBlock}${bodyBlock}`;

			if (targetFile) {
				await this.app.vault.modify(targetFile, markdown);
				if (targetFile.path !== filePath) {
					await this.app.fileManager.renameFile(targetFile, filePath);
				}
			} else {
				const file = await this.app.vault.create(filePath, markdown);
				await this.app.workspace.getLeaf(true).openFile(file);
			}

			this.settings.lastCategory = category;
			if (this.settings.enableSubfolder && data.subfolder) {
				this.settings.lastSubfolder = data.subfolder;
			}
			await this.onSettingsSaved();

			new Notice(`Imported RedNote note as ${filePath}`);
		} catch (error) {
			console.log(`Failed to save note: ${error.message}`);
			new Notice(`Failed to save note: ${error.message}`);
		}
	}
}
