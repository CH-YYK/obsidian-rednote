const fs = require("fs");
const path = require("path");

function loadEnv() {
	const envPath = path.join(__dirname, ".env");
	if (!fs.existsSync(envPath)) {
		console.warn("⚠️  No .env file found. Create a .env file containing: \nOBSIDIAN_VAULT_PATH=\"/path/to/your/obsidian/vault\"");
		process.exit(1);
	}

	const content = fs.readFileSync(envPath, "utf-8");
	const env = {};
	
	content.split(/\r?\n/).forEach((line) => {
		const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
		if (match) {
			const key = match[1];
			let val = match[2] || "";
			
			// Remove surrounding quotes if present
			if (val.length > 0 && val.charAt(0) === '"' && val.charAt(val.length - 1) === '"') {
				val = val.substring(1, val.length - 1);
			} else if (val.length > 0 && val.charAt(0) === "'" && val.charAt(val.length - 1) === "'") {
				val = val.substring(1, val.length - 1);
			}
			
			env[key] = val.trim();
		}
	});
	
	return env;
}

function installLocal() {
	const env = loadEnv();
	let vaultPath = env.OBSIDIAN_VAULT_PATH;

	if (!vaultPath) {
		console.error("❌ OBSIDIAN_VAULT_PATH is not defined in your .env file.");
		process.exit(1);
	}

	// Expand $HOME if present
	if (vaultPath.startsWith("$HOME")) {
		const homeDir = process.env.HOME || process.env.USERPROFILE || "";
		vaultPath = vaultPath.replace("$HOME", homeDir);
	} else if (vaultPath.startsWith("~")) {
		const homeDir = process.env.HOME || process.env.USERPROFILE || "";
		vaultPath = vaultPath.replace("~", homeDir);
	}

	// Auto-template the Obsidian plugin installation path
	const targetPath = path.join(vaultPath, ".obsidian", "plugins", "rednote");

	console.log(`📦 Deploying plugin files to: ${targetPath}`);

	try {
		// Ensure target directory exists
		fs.mkdirSync(targetPath, { recursive: true });

		// Files to copy
		const files = ["main.js", "manifest.json", "styles.css"];
		files.forEach((file) => {
			const srcFile = path.join(__dirname, file);
			const destFile = path.join(targetPath, file);
			
			if (fs.existsSync(srcFile)) {
				fs.copyFileSync(srcFile, destFile);
				console.log(`  ✓ Copied ${file}`);
			} else {
				console.warn(`  ⚠️  Warning: ${file} not found in root, skipped.`);
			}
		});

		console.log("✨ Local deployment completed successfully!");
	} catch (err) {
		console.error(`❌ Failed to copy plugin files: ${err.message}`);
		process.exit(1);
	}
}

installLocal();
