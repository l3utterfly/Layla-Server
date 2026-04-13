function generatePassword(length: number = 16): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export enum UserSettingKey {
  LOCAL_SERVER_URL = 'local-server-url',
  MODEL_PATH = 'model-path',
  LOCAL_SERVER_PATH = 'local-server-path',
  ADDITIONAL_SERVER_CMD_ARGS = 'additional-server-cmd-args',
  SERVER_SECRET_KEY = 'server-secret-key',
}

type UserSettingDefaults = {
  [UserSettingKey.LOCAL_SERVER_URL]: string;
  [UserSettingKey.MODEL_PATH]: string | null;
  [UserSettingKey.LOCAL_SERVER_PATH]: string;
  [UserSettingKey.ADDITIONAL_SERVER_CMD_ARGS]: string | null;
  [UserSettingKey.SERVER_SECRET_KEY]: string;
};

export const USER_SETTING_DEFAULTS: {
  [K in UserSettingKey]: UserSettingDefaults[K];
} = {
  [UserSettingKey.LOCAL_SERVER_URL]: 'http://127.0.0.1:8080/v1/chat/completions',
  [UserSettingKey.MODEL_PATH]: null,
  [UserSettingKey.LOCAL_SERVER_PATH]: './resources/server/llama-server.exe',
  [UserSettingKey.ADDITIONAL_SERVER_CMD_ARGS]: null,
  [UserSettingKey.SERVER_SECRET_KEY]: generatePassword(),
};

const STORAGE_PREFIX = 'user-setting:';

class UserSettingsService {
  private static initialized = false;

  private static ensureDefaults() {
    if (UserSettingsService.initialized) return;

    // On first run, persist any defaults that aren't already stored
    // (this saves the randomly generated secret key)
    for (const key of Object.values(UserSettingKey)) {
      if (localStorage.getItem(`${STORAGE_PREFIX}${key}`) === null) {
        const defaultValue = USER_SETTING_DEFAULTS[key as UserSettingKey];
        if (defaultValue !== null) {
          localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(defaultValue));
        }
      }
    }

    UserSettingsService.initialized = true;
  }

  static async removeSetting(key: UserSettingKey): Promise<void> {
    localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
  }

  static async saveSetting<K extends UserSettingKey>(
    key: K,
    value: UserSettingDefaults[K],
  ): Promise<void> {
    if (value === null) {
      await UserSettingsService.removeSetting(key);
    } else {
      localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value));
    }
  }

  static async getSetting<K extends UserSettingKey>(
    key: K,
  ): Promise<UserSettingDefaults[K]> {
    UserSettingsService.ensureDefaults();

    const raw = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
    if (raw === null) {
      return USER_SETTING_DEFAULTS[key];
    }

    try {
      return JSON.parse(raw);
    } catch {
      return USER_SETTING_DEFAULTS[key];
    }
  }

  static async getMultipleSettings<K extends UserSettingKey>(
    keys: K[],
  ): Promise<{ [key in K]: UserSettingDefaults[key] }> {
    UserSettingsService.ensureDefaults();

    const result: Partial<{ [key in K]: UserSettingDefaults[key] }> = {};

    for (const key of keys) {
      const raw = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
      if (raw === null) {
        result[key] = USER_SETTING_DEFAULTS[key];
      } else {
        try {
          result[key] = JSON.parse(raw);
        } catch {
          result[key] = USER_SETTING_DEFAULTS[key];
        }
      }
    }

    return result as { [key in K]: UserSettingDefaults[key] };
  }
}

export default UserSettingsService;