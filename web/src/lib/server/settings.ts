import { getLogger } from "@logtape/logtape";
import yaml from "js-yaml";
import { existsSync, readFileSync, watch, writeFileSync, type FSWatcher } from "node:fs"; // Import watch and FSWatcher
import path from "node:path";
import { z } from "zod";
import { DefaultGitLabScopes } from "./db/base-schema";

const logger = getLogger("settings");

const getLocalSettingsFilePath = () => {
  return getSettingsFileInConfigOrHere(process.cwd());
};

const getSettingsFileInConfigOrHere = (basePath: string) => {
  let candidate = path.resolve(basePath, "config", "settings.yaml");
  if (existsSync(candidate)) {
    return candidate;
  } else {
    candidate = path.resolve(basePath, "settings.yaml");
    return existsSync(candidate) ? candidate : undefined;
  }
};

const getHomeSettingsFilePath = () => {
  const base = path.resolve(path.join(process.env.HOME ?? "~", "data"));
  const candidate = getSettingsFileInConfigOrHere(base);
  if (candidate && existsSync(candidate)) {
    return candidate;
  } else {
    return path.join(base, "config", "settings.yaml");
  }
};

const getHomeDataPath = () => {
  const candidate = path.resolve(path.join(process.env.HOME ?? "~", "data"));
  if (existsSync(candidate)) {
    return candidate;
  }
  const altCandidate = path.resolve(process.cwd(), "data");
  if (existsSync(altCandidate)) {
    return altCandidate;
  } else {
    return candidate;
  }
};

const getSettingsFilePath = () => {
  const settingsFilePath = Bun.env.SETTINGS_FILE ?? process.env.SETTINGS_FILE;
  if (!!settingsFilePath && settingsFilePath.length > 0 && existsSync(settingsFilePath)) {
    return settingsFilePath;
  }
  const homeSettingsFilePath = getHomeSettingsFilePath();
  if (existsSync(homeSettingsFilePath)) {
    return homeSettingsFilePath;
  }
  return getLocalSettingsFilePath() ?? homeSettingsFilePath;
};

const getDataRoot = () => {
  const dataPath = Bun.env.DATA_ROOT ?? process.env.DATA_ROOT;
  if (!!dataPath && dataPath.length > 0 && existsSync(dataPath)) {
    return dataPath;
  }
  return getHomeDataPath();
};

const dataRoot = getDataRoot();

// Define the Zod schema for your settings, including nested or array structures if needed.
export const settingsSchema = z.object({
  dev: z.boolean().default(false),
  baseUrl: z.string().optional(),
  email: z
    .object({
      encryptionPassword: z.string().nonempty().default("1234567890!?"),
      defaultReceiver: z.array(z.string().email()).optional().or(z.string().email()).optional(),
      sender: z.string().email().optional(),
      subject: z.string().optional().default("AUTOMATED BACKUP ({date})"),
      api: z.object({
        url: z.string().optional().default("http://134.102.23.170:3000/api/send-email"),
        timeout: z.number().optional().default(30000)
      }).optional(),
      smtp: z
        .object({
          host: z.string(),
          port: z.number().gt(0),
          user: z.string(),
          pass: z.string(),
          secure: z.boolean().optional().default(true),
          authMethod: z.string().optional()
        })
        .optional()
        .default({
          host: "",
          port: 465,
          user: "",
          pass: "",
          secure: true
        })
    })
    .optional()
    .default({}),
  paths: z
    .object({
      dataRoot: z.string().nonempty().default(dataRoot),
      config: z.string().nonempty().default(path.join(dataRoot, "config")),
      database: z
        .string()
        .nonempty()
        .default(`file://${path.join(dataRoot, "config", "main.db")}`),
      archive: z.string().nonempty().default(path.join(dataRoot, "archive")),
      logs: z.string().nonempty().default(path.join(dataRoot, "logs"))
    })
    .default({}),
  hashing: z
    .object({
      algorithm: z
        .enum([
          "sha256",
          "sha512",
          "blake2b512",
          "md5",
          "sha1",
          "sha224",
          "sha384",
          "sha512-224",
          "sha512-256"
        ])
        .default("sha256"),
      hmacKey: z.string().nonempty().optional()
    })
    .default({}),
  auth: z
    .object({
      initCode: z
        .string()
        .nonempty()
        .default(process.env.INIT_CODE ?? "aVNEpnVwsutCH5sq4HGuQCyoFRFh7ifneoiZogrpV2EoLRsc"),
      secret: z.string().optional(),
      trustedOrigins: z
        .array(z.string().nonempty())
        .default(["http://localhost:3000", "http://localhost:4173", "http://localhost:5173"]),
      trustedProviders: z
        .array(z.string().nonempty())
        .default(["gitlab", "jira", "jiraCloud", "gitlabCloud", "gitlab-cloud", "gitlab-onprem"]),
      allowDifferentEmails: z.boolean().default(true),
      admins: z
        .array(
          z.object({
            email: z.string().email(),
            name: z.string().optional()
          })
        )
        .default([]),
      providers: z
        .object({
          gitlab: z
            .object({
              baseUrl: z.string().optional(),
              clientId: z.string().optional(),
              clientSecret: z.string().optional(),
              userInfoUrl: z.string().optional(),
              authorizationUrl: z.string().optional(),
              authorizationUrlParams: z.record(z.string()).optional(),
              tokenUrl: z.string().optional(),
              type: z.enum(["oauth2", "oidc"]).default("oidc"),
              discoveryUrl: z.string().optional(),
              scopes: z.array(z.string()).default(DefaultGitLabScopes.map((x) => `${x}`)),
              redirectURI: z.string().default("/api/auth/oauth2/callback/gitlab")
            })
            .default({}),
          gitlabCloud: z
            .object({
              baseUrl: z.string().nonempty().default("https://gitlab.com"),
              clientId: z.string().optional(),
              clientSecret: z.string().optional(),
              discoveryUrl: z.string().optional(),
              scopes: z
                .array(z.string())
                .default(["read:jira-work", "read:jira-user", "read:me", "read:account"]),
              redirectURI: z.string().default("/api/auth/oauth2/callback/gitlab")
            })
            .default({}),
          jiracloud: z
            .object({
              baseUrl: z.string().optional().default("https://api.atlassian.com"),
              clientId: z.string().optional(),
              clientSecret: z.string().optional(),
              authorizationUrl: z.string().default("https://auth.atlassian.com/authorize"),
              authorizationUrlParams: z
                .record(z.string())
                .default({ audience: "api.atlassian.com" }),
              tokenUrl: z.string().default("https://auth.atlassian.com/oauth/token"),
              scopes: z
                .array(z.string())
                .default(["read:jira-work", "read:jira-user", "read:me", "read:account"]),
              redirectURI: z.string().default("/api/auth/oauth2/callback/jiracloud"),
              accessibleResourcesUrl: z
                .string()
                .default("https://api.atlassian.com/oauth/token/accessible-resources")
            })
            .default({}),
          jira: z
            .object({
              baseUrl: z.string().optional(),
              clientId: z.string().optional(),
              clientSecret: z.string().optional(),
              authorizationUrl: z.string().default("/authorize"),
              authorizationUrlParams: z
                .record(z.string())
                .default({ audience: "api.atlassian.com" }),
              tokenUrl: z.string().default("/oauth/token"),
              scopes: z
                .array(z.string())
                .default(["read:jira-work", "read:jira-user", "read:me", "read:account"]),
              redirectURI: z.string().default("/api/auth/oauth2/callback/jira"),
              accessibleResourcesUrl: z
                .string()
                .default("https://api.atlassian.com/oauth/token/accessible-resources")
            })
            .default({})
        })
        .default({})
    })
    .default({}),
  app: z.object({
      CRAWLER_API_TOKEN: z
        .string()
        .default(
          process.env.CRAWLER_API_TOKEN ||
            "nLR6HdQXYwpehaQxGRsoZUZmFTje3m4BVwPZRNSkEqYurTmNzxsphvMWQfX3SXNA"
        ),
      sendFailedJobsToCrawler: z.boolean().default(false)
    }).default({})
  // For nested settings, you might add something like:
  // nestedConfig: z.object({
  //   enabled: z.boolean(),
  //   values: z.array(z.string()),
  // }),
});

export type Settings = z.infer<typeof settingsSchema>;

export class AppSettings {
  // The singleton instance.
  private static instance: AppSettings;
  private settings: Settings;
  private readonly filePath: string;
  private isWriting: boolean = false; // Flag to prevent reload loop
  private watcher: FSWatcher | null = null; // To hold the watcher instance

  // Private constructor to enforce singleton pattern.
  private constructor(filePath: string) {
    logger.info("Loading Settings from: {filePath} ({exists})", {
      filePath,
      exists: existsSync(filePath)
    });
    this.filePath = filePath;
    // Read and parse the YAML file synchronously.
    const fileContents = readFileSync(this.filePath, "utf8");
    const data = yaml.load(fileContents);
    // Validate the parsed data with Zod.
    this.settings = settingsSchema.parse(data);

    // Start watching the file
    this.watchFile();
  }

  // Method to reload settings from file
  private reloadSettings() {
    if (this.isWriting) {
      // logger.info("Skipping reload during write operation.");
      return; // Don't reload if we are currently writing
    }
    logger.info(`Settings file changed, reloading...`, { filePath: this.filePath });
    try {
      const fileContents = readFileSync(this.filePath, "utf8");
      const data = yaml.load(fileContents);
      this.settings = settingsSchema.parse(data);
      logger.info("Settings reloaded successfully.");
      // TODO: Optionally notify other parts of the application about the change
    } catch (error) {
      logger.error("Error reloading settings file:", { error });
      // Keep old settings in case of error? Or throw?
    }
  }

  // Method to setup file watcher
  private watchFile() {
    try {
      // Close existing watcher if any
      this.watcher?.close();

      this.watcher = watch(this.filePath, (eventType) => {
        if (eventType === "change") {
          this.reloadSettings();
        }
      });

      this.watcher.on("error", (error) => {
        logger.error(`Error watching settings file:`, { filePath: this.filePath, error });
        // Attempt to restart watcher?
        this.watcher = null; // Clear watcher reference
        // Maybe add a delay before retrying watchFile()
      });

      logger.info(`Watching settings file:`, { filePath: this.filePath });
    } catch (error) {
      logger.error(`Failed to start watching settings file:`, { filePath: this.filePath, error });
      this.watcher = null;
    }
  }

  /**
   * Gets the singleton instance of AppSettings.
   * On first call, the file path must be provided.
   *
   * @param filePath - The path to the YAML settings file.
   * @returns The AppSettings instance.
   */
  public static getInstance(filePath?: string): AppSettings {
    if (!AppSettings.instance) {
      if (!filePath || filePath.length <= 0) filePath = getSettingsFilePath();
      if (!filePath || filePath.length <= 0) {
        throw new Error("First-time initialization requires a file path.");
      }
      if (!existsSync(filePath)) {
        const temp = settingsSchema.parse({});
        logger.debug("Generated default settings", { temp, yaml: yaml.dump(temp) });
        writeFileSync(filePath, yaml.dump(temp), "utf8");
      }
      AppSettings.instance = new AppSettings(filePath);
    }
    return AppSettings.instance;
  }

  /**
   * Returns the current settings.
   *
   * @returns The current settings.
   */
  public getSettings(): Settings {
    return this.settings;
  }

  /**
   * Updates the settings with the provided partial values, validates the updated settings,
   * and writes them back to the YAML file.
   *
   * @param newSettings - Partial settings to update.
   */
  public updateSettings(newSettings: Partial<Settings>): void {
    this.isWriting = true; // Set flag before writing
    try {
      // Merge the current settings with the new values.
      const updated = { ...this.settings, ...newSettings };
      // Validate the updated settings.
      this.settings = settingsSchema.parse(updated);
      // Convert the updated settings back to YAML format.
      const yamlStr = yaml.dump(this.settings);
      writeFileSync(this.filePath, yamlStr, "utf8");
      logger.info("Settings updated and saved.");
    } catch (error) {
      logger.error("Error updating settings:", { error });
      // Optionally re-throw or handle error
    } finally {
      // Ensure flag is reset even if write fails, after a short delay
      // to allow file system events to settle potentially.
      setTimeout(() => {
        this.isWriting = false;
      }, 100);
    }
  }
}

export default () => AppSettings.getInstance().getSettings();
