import { App, Plugin, PluginSettingTab, Setting } from "obsidian";
import { RedNoteSettings } from "./types";

export interface RedNotePluginInterface extends Plugin {
	settings: RedNoteSettings;
	saveSettings(): Promise<void>;
}

export class RedNoteSettingTab extends PluginSettingTab {
	plugin: RedNotePluginInterface;

	constructor(app: App, plugin: RedNotePluginInterface) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// Default folder setting
		new Setting(containerEl)
			.setName("Default folder")
			.setDesc("Base folder where notes will be saved (e.g., 'RedNote'). Leave empty for vault root.")
			.addText((text) =>
				text
					.setPlaceholder("RedNote")
					.setValue(this.plugin.settings.defaultFolder)
					.onChange(async (value) => {
						this.plugin.settings.defaultFolder = value.trim();
						await this.plugin.saveSettings();
					})
			);

		// Enable subfolder setting
		new Setting(containerEl)
			.setName("Enable subfolder")
			.setDesc("If enabled, notes will be saved in a subfolder (e.g., category or custom path) under the default folder.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableSubfolder)
					.onChange(async (value) => {
						this.plugin.settings.enableSubfolder = value;
						await this.plugin.saveSettings();
					})
			);

		// Download media toggle
		new Setting(containerEl)
			.setName("Download media")
			.setDesc("Default setting: if enabled, images will be downloaded locally. Can be overridden per import. (Note: Video download is currently not supported; video posts will fallback to cover image or keep the remote link.)")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.downloadMedia)
					.onChange(async (value) => {
						this.plugin.settings.downloadMedia = value;
						await this.plugin.saveSettings();
					})
			);

		// Advanced Options (collapsible details container)
		const advancedDetails = containerEl.createEl("details");
		advancedDetails.style.cursor = "pointer";
		advancedDetails.style.marginTop = "20px";
		advancedDetails.style.marginBottom = "20px";

		const advancedSummary = advancedDetails.createEl("summary", { text: "Advanced Options" });
		advancedSummary.style.fontWeight = "bold";

		const advancedContainer = advancedDetails.createEl("div");
		advancedContainer.style.padding = "10px 0 0 15px";
		advancedContainer.style.borderLeft = "2px solid var(--interactive-accent)";
		advancedContainer.style.marginTop = "10px";

		// Write YAML tags toggle (renamed to "Write tags to Obsidian tags")
		new Setting(advancedContainer)
			.setName("Write tags to Obsidian tags")
			.setDesc("If enabled, parsed hashtags will be written to the standard 'tags' YAML frontmatter list.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.writeObsidianPropertyTags)
					.onChange(async (value) => {
						this.plugin.settings.writeObsidianPropertyTags = value;
						await this.plugin.saveSettings();
					})
			);

		// Write RedNote tags toggle (renamed to "Write tags to properties")
		new Setting(advancedContainer)
			.setName("Write tags to properties")
			.setDesc("If enabled, parsed hashtags will be written to a custom 'rednote_tags' YAML frontmatter list.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.writeRedNoteTags)
					.onChange(async (value) => {
						this.plugin.settings.writeRedNoteTags = value;
						await this.plugin.saveSettings();
					})
			);

		// Properties Template
		new Setting(containerEl)
			.setName("Note properties template")
			.setDesc("Customize the YAML frontmatter properties template. Available placeholders: {{title}}, {{content}}, {{media}}, {{source}}, {{date}}, {{category}}.")
			.addTextArea((text) => {
				text.inputEl.rows = 4;
				text.inputEl.cols = 50;
				text.inputEl.style.fontFamily = "monospace";
				text
					.setValue(this.plugin.settings.propertiesTemplate)
					.onChange(async (value) => {
						this.plugin.settings.propertiesTemplate = value;
						await this.plugin.saveSettings();
					});
			});

		// Note Template
		new Setting(containerEl)
			.setName("Note body template")
			.setDesc("Customize the Markdown note body template. Available placeholders: {{title}}, {{content}}, {{media}}.")
			.addTextArea((text) => {
				text.inputEl.rows = 4;
				text.inputEl.cols = 50;
				text.inputEl.style.fontFamily = "monospace";
				text
					.setValue(this.plugin.settings.noteTemplate)
					.onChange(async (value) => {
						this.plugin.settings.noteTemplate = value;
						await this.plugin.saveSettings();
					});
			});

		// Category management
		new Setting(containerEl)
			.setName("Categories")
			.setHeading();

		containerEl.createEl("p", { text: "Add, edit, or remove categories for organizing notes. Use Up/Down arrows to reorder." });

		this.plugin.settings.categories.forEach((category, index) => {
			const setting = new Setting(containerEl)
				.setName(`Category ${index + 1}`)
				.addText((text) =>
					text
						.setValue(category)
						.onChange(async (value) => {
							this.plugin.settings.categories[index] = value.trim();
							await this.plugin.saveSettings();
						})
				);

			setting.addButton((button) =>
				button
					.setIcon("arrow-up")
					.setTooltip("Move up")
					.setDisabled(index === 0)
					.onClick(async () => {
						if (index > 0) {
							[this.plugin.settings.categories[index], this.plugin.settings.categories[index - 1]] =
								[this.plugin.settings.categories[index - 1], this.plugin.settings.categories[index]];
							await this.plugin.saveSettings();
							this.display();
						}
					})
			);

			setting.addButton((button) =>
				button
					.setIcon("arrow-down")
					.setTooltip("Move down")
					.setDisabled(index === this.plugin.settings.categories.length - 1)
					.onClick(async () => {
						if (index < this.plugin.settings.categories.length - 1) {
							[this.plugin.settings.categories[index], this.plugin.settings.categories[index + 1]] =
								[this.plugin.settings.categories[index + 1], this.plugin.settings.categories[index]];
							await this.plugin.saveSettings();
							this.display();
						}
					})
			);

			setting.addButton((button) =>
				button
					.setButtonText("Remove")
					.onClick(async () => {
						this.plugin.settings.categories.splice(index, 1);
						await this.plugin.saveSettings();
						this.display();
					})
			);
		});

		new Setting(containerEl)
			.addButton((button) =>
				button
					.setButtonText("Add category")
					.onClick(async () => {
						this.plugin.settings.categories.push("New Category");
						await this.plugin.saveSettings();
						this.display();
					})
			);
	}
}
