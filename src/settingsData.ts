// settingsData.ts
import * as fs from "fs";
import * as path from "path";

function loadSettings(): Record<string, any> {
  const prodDir = path.dirname(process.execPath);
  const devDir = __dirname;
  const prodSettingsDir = path.join(prodDir, "settings");
  const devSettingsDir = path.join(devDir, "../settings");
  let baseDir: string;

  //console.log("VIRTUAL FILES:", fs.readdirSync(__dirname));
  if (fs.existsSync(prodSettingsDir)) {
    baseDir = prodSettingsDir;
    console.log("SETTINGS LOADED FROM:", prodSettingsDir);
  } else if (fs.existsSync(devSettingsDir)) {
    baseDir = devSettingsDir;
    console.log("SETTINGS LOADED FROM:", devSettingsDir);
  } else {
    throw new Error(`YOU NEED SETTINGS FILES.`);
  }
  const settingsDir = path.join(baseDir);
  const settings: Record<string, any> = {};
  const files = fs.readdirSync(settingsDir);

  files.forEach((file) => {
    if (file.endsWith(".json")) {
      const filePath = path.join(settingsDir, file);
      try {
        const content = fs.readFileSync(filePath, "utf-8");
        const key = file.toUpperCase().replace(".JSON", "");
        settings[key] = JSON.parse(content);
      } catch (err) {
        console.error(`ERROR READING FILE ${filePath}:`, err);
      }
    }
  });
  return settings;
}

export const userSettings = loadSettings();
