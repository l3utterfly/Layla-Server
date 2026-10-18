// Run with: node --test test/secret-generation.test.cjs
const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");
const { buildSync } = require("esbuild");

const bundle = buildSync({
  entryPoints: [path.join(__dirname, "../src/services/user-settings-service.ts")],
  bundle: true,
  platform: "browser",
  format: "cjs",
  write: false,
}).outputFiles[0].text;

function loadSettings(values = new Map(), bridge = {
  generateCryptoSecret: async () => randomBytes(32).toString("hex"),
}) {
  const context = {
    module: { exports: {} },
    window: { electronBridge: bridge },
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    },
  };
  vm.runInNewContext(bundle, context);
  return context.module.exports;
}

test("fresh installs default to a persistent 16-character Math.random secret", async () => {
  const values = new Map();
  const { default: settings, UserSettingKey: key } = loadSettings(values);
  const secret = await settings.getSetting(key.SERVER_SECRET_KEY);
  assert.match(secret, /^[A-Za-z0-9]{16}$/);
  assert.equal(await settings.getSetting(key.SECRET_GENERATION_METHOD), "math-random");
  const reloaded = loadSettings(values);
  assert.equal(await reloaded.default.getSetting(key.SERVER_SECRET_KEY), secret);
});

test("selecting and persisting a generator never replaces an existing secret", async () => {
  const values = new Map([
    ["user-setting:server-secret-key", JSON.stringify("legacySecret1234")],
  ]);
  const { default: settings, UserSettingKey: key } = loadSettings(values);
  assert.equal(await settings.getSetting(key.SERVER_SECRET_KEY), "legacySecret1234");
  await settings.saveSetting(key.SECRET_GENERATION_METHOD, "math-random");
  const reloaded = loadSettings(values);
  assert.equal(await reloaded.default.getSetting(key.SECRET_GENERATION_METHOD), "math-random");
  assert.equal(await reloaded.default.getSetting(key.SERVER_SECRET_KEY), "legacySecret1234");
});

test("legacy generation uses Math.random and produces 16 alphanumeric characters", async () => {
  let calls = 0;
  const context = {
    module: { exports: {} },

    recordCall: () => calls++,
  };
  vm.createContext(context);
  vm.runInContext("Math.random = () => { recordCall(); return 0.5; }", context);
  vm.runInContext(bundle, context);
  calls = 0;
  const secret = await context.module.exports.generateSecretKey("math-random");
  assert.match(secret, /^[A-Za-z0-9]{16}$/);
  assert.equal(calls, 16);
});

test("generating a replacement leaves storage unchanged until explicitly saved", async () => {
  const { default: settings, UserSettingKey: key, generateSecretKey } = loadSettings();
  await settings.saveSetting(key.SERVER_SECRET_KEY, "manual-key");
  for (const method of ["math-random", "crypto-hex"]) {
    const replacement = await generateSecretKey(method);
    assert.equal(await settings.getSetting(key.SERVER_SECRET_KEY), "manual-key");
    await settings.saveSetting(key.SERVER_SECRET_KEY, replacement);
    assert.equal(await settings.getSetting(key.SERVER_SECRET_KEY), replacement);
    await settings.saveSetting(key.SERVER_SECRET_KEY, "manual-key");
  }
});

test("secure generation failure never falls back to a legacy secret or changes storage", async () => {
  const bridge = { generateCryptoSecret: async () => { throw new Error("random source unavailable"); } };
  const { default: settings, UserSettingKey: key, generateSecretKey } = loadSettings(new Map(), bridge);
  const original = await settings.getSetting(key.SERVER_SECRET_KEY);
  await assert.rejects(generateSecretKey("crypto-hex"), /random source unavailable/);
  assert.equal(await settings.getSetting(key.SERVER_SECRET_KEY), original);
});

test("secure generation uses the preload IPC bridge and Node crypto handler", async () => {
  const handlers = new Map();
  const bundleNode = (file) => buildSync({
    entryPoints: [path.join(__dirname, '../src', file)],
    bundle: true, platform: 'node', format: 'cjs', external: ['electron'], write: false,
  }).outputFiles[0].text;
  vm.runInNewContext(bundleNode('main.ts'), {
    exports: {}, require: (name) => name === 'electron' ? {
      app: { whenReady: () => new Promise(() => {}), on() {} },
      ipcMain: { handle: (name, handler) => handlers.set(name, handler), on() {} },
    } : require(name),
    process, console, __dirname,
  });
  let bridge;
  vm.runInNewContext(bundleNode('preload.ts'), {
    require: (name) => name === 'electron' ? {
      contextBridge: { exposeInMainWorld: (_name, api) => { bridge = api; } },
      ipcRenderer: { invoke: async (name) => handlers.get(name)() },
    } : require(name),
  });
  const { generateSecretKey } = loadSettings(new Map(), bridge);
  const secret = await generateSecretKey('crypto-hex');
  assert.match(secret, /^[0-9a-f]{64}$/);
  assert.notEqual(await generateSecretKey('crypto-hex'), secret);
});
