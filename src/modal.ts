import { App, Modal, Setting } from "obsidian";
import { RedNoteSettings } from "./types";

export class RedNoteInputModal extends Modal {
	result: string | null = null;
	onSubmit: (result: string | null) => void;

	constructor(app: App, onSubmit: (result: string | null) => void) {
		super(app);
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.addClass("xhs-modal-content");

		contentEl.createEl("h2", { text: "Import RedNote Note" });

		const textRow = contentEl.createEl("div", { cls: "xhs-modal-row" });
		textRow.createEl("p", { text: "Paste the share text or URL below:" });
		const input = textRow.createEl("textarea", {
			cls: "xhs-modal-textarea",
			attr: { placeholder: "e.g., Paste the RedNote shared link here..." },
		});

		const buttonRow = contentEl.createEl("div", { cls: ["xhs-modal-row", "xhs-button-row"] });
		const submitButton = buttonRow.createEl("button", {
			text: "Fetch Content",
			cls: "xhs-submit-button mod-cta",
		});

		submitButton.addEventListener("click", () => {
			this.result = input.value.trim();
			this.close();
		});

		input.addEventListener("keypress", (e) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				this.result = input.value.trim();
				this.close();
			}
		});
	}

	onClose() {
		this.onSubmit(this.result);
	}
}

export class RedNoteConfirmModal extends Modal {
	private data: { title: string; content: string; tags: string[]; images: string[]; videoUrl: string | null; isVideo: boolean };
	private settings: RedNoteSettings;
	private onSubmit: (result: { title: string; content: string; tags: string[]; images: string[]; videoUrl: string | null; isVideo: boolean; category: string; downloadMedia: boolean; noteTemplate: string; subfolder?: string } | null) => void;
	
	private editedTitle: string;
	private editedContent: string;
	private noteTemplate: string;
	private editedTags: string[];
	private selectedCategory: string;
	private subfolder: string;
	private enableSubfolderLocal: boolean;
	private downloadMedia: boolean;
	private isConfirmed = false;

	constructor(
		app: App,
		data: { title: string; content: string; tags: string[]; images: string[]; videoUrl: string | null; isVideo: boolean },
		settings: RedNoteSettings,
		onSubmit: (result: { title: string; content: string; tags: string[]; images: string[]; videoUrl: string | null; isVideo: boolean; category: string; downloadMedia: boolean; noteTemplate: string; subfolder?: string } | null) => void
	) {
		super(app);
		this.data = data;
		this.settings = settings;
		this.onSubmit = onSubmit;

		// Initialize edited fields with raw/rendered values
		this.editedTitle = data.title;
		this.editedContent = data.content;
		this.noteTemplate = settings.noteTemplate;
		this.editedTags = [...data.tags];
		this.selectedCategory = this.settings.lastCategory && this.settings.categories.includes(this.settings.lastCategory)
			? this.settings.lastCategory
			: this.settings.categories[0] || "Others";
		this.subfolder = this.settings.lastSubfolder || this.selectedCategory;
		this.enableSubfolderLocal = this.settings.enableSubfolder;
		this.downloadMedia = this.settings.downloadMedia;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("xhs-modal-content");

		contentEl.createEl("h2", { text: "Review RedNote Note Details" });

		// Title edit field
		new Setting(contentEl)
			.setName("Title")
			.setDesc("Customize the name of the note file")
			.addText((text) =>
				text
					.setValue(this.editedTitle)
					.onChange((value) => {
						this.editedTitle = value.trim();
					})
			);

		// Content/Description textarea field
		new Setting(contentEl)
			.setName("Content")
			.setDesc("Customize the content of the note")
			.addTextArea((textarea) => {
				textarea
					.setValue(this.editedContent)
					.onChange((value) => {
						this.editedContent = value;
					});
				textarea.inputEl.rows = 6;
				textarea.inputEl.cols = 40;
				textarea.inputEl.style.width = "100%";
			});

		// Note Template textarea field
		new Setting(contentEl)
			.setName("Note Template")
			.setDesc("Customize the Markdown template layout for this import")
			.addTextArea((textarea) => {
				textarea
					.setValue(this.noteTemplate)
					.onChange((value) => {
						this.noteTemplate = value;
					});
				textarea.inputEl.rows = 6;
				textarea.inputEl.cols = 40;
				textarea.inputEl.style.width = "100%";
				textarea.inputEl.style.fontFamily = "monospace";
			});

		// Tags edit field
		new Setting(contentEl)
			.setName("RedNote Tags")
			.setDesc("Comma-separated list of RedNote tags")
			.addText((text) =>
				text
					.setValue(this.editedTags.join(", "))
					.onChange((value) => {
						this.editedTags = value
							.split(",")
							.map((t) => t.trim())
							.filter((t) => t.length > 0);
					})
			);

		// Category selection dropdown
		let subfolderTextComponent: any = null;
		let subfolderSetting: Setting | null = null;

		new Setting(contentEl)
			.setName("Category")
			.setDesc("Select the subfolder category")
			.addDropdown((dropdown) => {
				this.settings.categories.forEach((cat) => {
					dropdown.addOption(cat, cat);
				});
				dropdown.addOption("Others", "Others");
				
				dropdown.setValue(this.selectedCategory);
				dropdown.onChange((value) => {
					const oldCategory = this.selectedCategory;
					this.selectedCategory = value;
					if (this.enableSubfolderLocal && subfolderTextComponent) {
						if (!this.subfolder || this.subfolder === oldCategory || this.subfolder === "Others") {
							this.subfolder = value;
							subfolderTextComponent.setValue(value);
						}
					}
				});
			});

		// Enable subfolder toggle
		new Setting(contentEl)
			.setName("Enable subfolder")
			.setDesc("Toggle saving notes in a subfolder for this import")
			.addToggle((toggle) =>
				toggle
					.setValue(this.enableSubfolderLocal)
					.onChange((value) => {
						this.enableSubfolderLocal = value;
						if (subfolderSetting) {
							if (value) {
								subfolderSetting.settingEl.style.display = "";
								if (!this.subfolder && subfolderTextComponent) {
									this.subfolder = this.selectedCategory;
									subfolderTextComponent.setValue(this.selectedCategory);
								}
							} else {
								subfolderSetting.settingEl.style.display = "none";
							}
						}
					})
			);

		// Subfolder input textbox
		subfolderSetting = new Setting(contentEl)
			.setName("Subfolder")
			.setDesc("Customize the subfolder name under the default folder")
			.addText((text) => {
				subfolderTextComponent = text;
				text
					.setValue(this.subfolder)
					.onChange((value) => {
						this.subfolder = value.trim();
					});
			});

		if (!this.enableSubfolderLocal) {
			subfolderSetting.settingEl.style.display = "none";
		}

		// Download media toggle
		new Setting(contentEl)
			.setName("Download media")
			.setDesc("Check to save attachments to local media folder. (Note: Video download is currently not supported; video posts will fallback to cover image.)")
			.addToggle((toggle) =>
				toggle
					.setValue(this.downloadMedia)
					.onChange((value) => {
						this.downloadMedia = value;
					})
			);

		// Media attachment summary
		let mediaInfo = "None";
		if (this.data.isVideo) {
			mediaInfo = "Video file detected (will download .mp4)";
		} else if (this.data.images.length > 0) {
			mediaInfo = `${this.data.images.length} images detected`;
		}
		new Setting(contentEl)
			.setName("Attachments")
			.setDesc(mediaInfo);

		// Action buttons
		const buttonRow = contentEl.createEl("div", { 
			cls: ["xhs-modal-row", "xhs-button-row"]
		});
		buttonRow.style.display = "flex";
		buttonRow.style.gap = "10px";
		buttonRow.style.justifyContent = "flex-end";
		buttonRow.style.marginTop = "20px";

		const cancelButton = buttonRow.createEl("button", {
			text: "Cancel",
		});
		cancelButton.addEventListener("click", () => {
			this.close();
		});

		const confirmButton = buttonRow.createEl("button", {
			text: "Confirm & Save",
			cls: "mod-cta",
		});
		confirmButton.addEventListener("click", () => {
			this.isConfirmed = true;
			this.close();
		});
	}

	onClose() {
		if (this.isConfirmed) {
			this.onSubmit({
				title: this.editedTitle,
				content: this.editedContent,
				tags: this.editedTags,
				images: this.data.images,
				videoUrl: this.data.videoUrl,
				isVideo: this.data.isVideo,
				category: this.selectedCategory,
				downloadMedia: this.downloadMedia,
				noteTemplate: this.noteTemplate,
				subfolder: this.enableSubfolderLocal ? this.subfolder : undefined,
			});
		} else {
			this.onSubmit(null);
		}
	}
}
