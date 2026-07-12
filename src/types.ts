import { TemplateEngine } from "./template";

export interface ParsedNoteData {
	title: string;
	content: string;
	tags: string[];
	images: string[];
	videoUrl: string | null;
	isVideo: boolean;
	subfolder?: string;
	enableSubfolder?: boolean;
}

export interface RedNoteSettings {
	defaultFolder: string;
	enableSubfolder: boolean;
	lastSubfolder: string;
	categories: string[];
	lastCategory: string;
	downloadMedia: boolean;
	writeObsidianPropertyTags: boolean;
	writeRedNoteTags: boolean;
	propertiesTemplate: string;
	noteTemplate: string;
}

export const DEFAULT_SETTINGS: RedNoteSettings = {
	defaultFolder: "RedNote",
	enableSubfolder: false,
	lastSubfolder: "",
	categories: [
		"Food",
		"Travel",
		"Entertainment",
		"Knowledge",
		"Work",
		"Relationship",
		"Personal Growth",
		"Discounts",
		"Comedy",
		"Parenting"
	],
	lastCategory: "",
	downloadMedia: false,
	writeObsidianPropertyTags: false,
	writeRedNoteTags: true,
	propertiesTemplate: TemplateEngine.DEFAULT_PROPERTIES,
	noteTemplate: TemplateEngine.DEFAULT_NOTE,
};
