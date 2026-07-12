export interface RedNoteSettings {
	defaultFolder: string;
	categories: string[];
	lastCategory: string;
	downloadMedia: boolean;
	writeObsidianBodyTags: boolean;
	writeObsidianPropertyTags: boolean;
	writeRedNoteTags: boolean;
	propertiesTemplate: string;
	noteTemplate: string;
}

export const DEFAULT_SETTINGS: RedNoteSettings = {
	defaultFolder: "RedNote Notes",
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
	writeObsidianBodyTags: false,
	writeObsidianPropertyTags: false,
	writeRedNoteTags: true,
	propertiesTemplate: 'title: "{{title}}"\nsource: "{{source}}"\ndate: "{{date}}"\ncategory: "{{category}}"',
	noteTemplate: '{{media}}\n{{title}}\n{{content}}',
};
