import "server-only";

/**
 * The public demo is read-only for settings: visitors can build and run workflows, but cannot change the
 * budget, models or provider keys. Set SETTINGS_EDITABLE=true (for example in .env.local) to edit them.
 */
export const settingsLocked = () => process.env.SETTINGS_EDITABLE !== "true";

export const SETTINGS_LOCKED_MESSAGE = "Settings are read-only in the live demo.";
