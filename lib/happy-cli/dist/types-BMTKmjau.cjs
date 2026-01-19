'use strict';

var chalk = require('chalk');
var fs$1 = require('fs');
var fs = require('node:fs');
var os = require('node:os');
var node_path = require('node:path');
var promises = require('node:fs/promises');
var z = require('zod');
var node_crypto = require('node:crypto');
var tweetnacl = require('tweetnacl');
var node_events = require('node:events');
var socket_ioClient = require('socket.io-client');
var child_process = require('child_process');
var util = require('util');
var fs$2 = require('fs/promises');
var crypto = require('crypto');
var path = require('path');
var url = require('url');
var os$1 = require('os');
var axios = require('axios');
var expoServerSdk = require('expo-server-sdk');

var _documentCurrentScript = typeof document !== 'undefined' ? document.currentScript : null;
function _interopNamespaceDefault(e) {
  var n = Object.create(null);
  if (e) {
    Object.keys(e).forEach(function (k) {
      if (k !== 'default') {
        var d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: function () { return e[k]; }
        });
      }
    });
  }
  n.default = e;
  return Object.freeze(n);
}

var z__namespace = /*#__PURE__*/_interopNamespaceDefault(z);

var name = "happy-coder";
var version = "0.13.0";
var description = "Mobile and Web client for Claude Code and Codex";
var author = "Kirill Dubovitskiy";
var license = "MIT";
var type = "module";
var homepage = "https://github.com/slopus/happy-cli";
var bugs = "https://github.com/slopus/happy-cli/issues";
var repository = "slopus/happy-cli";
var bin = {
	happy: "./bin/happy.mjs",
	"happy-mcp": "./bin/happy-mcp.mjs"
};
var main = "./dist/index.cjs";
var module$1 = "./dist/index.mjs";
var types = "./dist/index.d.cts";
var exports$1 = {
	".": {
		require: {
			types: "./dist/index.d.cts",
			"default": "./dist/index.cjs"
		},
		"import": {
			types: "./dist/index.d.mts",
			"default": "./dist/index.mjs"
		}
	},
	"./lib": {
		require: {
			types: "./dist/lib.d.cts",
			"default": "./dist/lib.cjs"
		},
		"import": {
			types: "./dist/lib.d.mts",
			"default": "./dist/lib.mjs"
		}
	},
	"./codex/happyMcpStdioBridge": {
		require: {
			types: "./dist/codex/happyMcpStdioBridge.d.cts",
			"default": "./dist/codex/happyMcpStdioBridge.cjs"
		},
		"import": {
			types: "./dist/codex/happyMcpStdioBridge.d.mts",
			"default": "./dist/codex/happyMcpStdioBridge.mjs"
		}
	}
};
var files = [
	"dist",
	"bin",
	"scripts",
	"tools",
	"package.json"
];
var scripts = {
	"why do we need to build before running tests / dev?": "We need the binary to be built so we run daemon commands which directly run the binary - we don't want them to go out of sync or have custom spawn logic depending how we started happy",
	typecheck: "tsc --noEmit",
	build: "shx rm -rf dist && npx tsc --noEmit && pkgroll",
	test: "yarn build && vitest run",
	start: "yarn build && node ./bin/happy.mjs",
	dev: "tsx src/index.ts",
	"dev:local-server": "yarn build && tsx --env-file .env.dev-local-server src/index.ts",
	"dev:integration-test-env": "yarn build && tsx --env-file .env.integration-test src/index.ts",
	prepublishOnly: "yarn build && yarn test",
	release: "yarn install && release-it",
	postinstall: "node scripts/unpack-tools.cjs"
};
var dependencies = {
	"@agentclientprotocol/sdk": "^0.8.0",
	"@modelcontextprotocol/sdk": "^1.22.0",
	"@stablelib/base64": "^2.0.1",
	"@stablelib/hex": "^2.0.1",
	"@types/cross-spawn": "^6.0.6",
	"@types/http-proxy": "^1.17.17",
	"@types/ps-list": "^6.2.1",
	"@types/qrcode-terminal": "^0.12.2",
	"@types/react": "^19.2.7",
	"@types/tmp": "^0.2.6",
	ai: "^5.0.107",
	axios: "^1.13.2",
	chalk: "^5.6.2",
	"cross-spawn": "^7.0.6",
	"expo-server-sdk": "^3.15.0",
	fastify: "^5.6.2",
	"fastify-type-provider-zod": "4.0.2",
	"http-proxy": "^1.18.1",
	"http-proxy-middleware": "^3.0.5",
	ink: "^6.5.1",
	open: "^10.2.0",
	"ps-list": "^8.1.1",
	"qrcode-terminal": "^0.12.0",
	react: "^19.2.0",
	"socket.io-client": "^4.8.1",
	tar: "^7.5.2",
	tmp: "^0.2.5",
	tweetnacl: "^1.0.3",
	zod: "^3.23.8"
};
var devDependencies = {
	"@eslint/compat": "^1",
	"@types/node": ">=20",
	"cross-env": "^10.1.0",
	dotenv: "^16.6.1",
	eslint: "^9",
	"eslint-config-prettier": "^10",
	pkgroll: "^2.14.2",
	"release-it": "^19.0.6",
	shx: "^0.3.3",
	"ts-node": "^10",
	tsx: "^4.20.6",
	typescript: "^5",
	vitest: "^3.2.4"
};
var resolutions = {
	"whatwg-url": "14.2.0",
	"parse-path": "7.0.3",
	"@types/parse-path": "7.0.3"
};
var publishConfig = {
	registry: "https://registry.npmjs.org"
};
var packageManager = "yarn@1.22.22";
var packageJson = {
	name: name,
	version: version,
	description: description,
	author: author,
	license: license,
	type: type,
	homepage: homepage,
	bugs: bugs,
	repository: repository,
	bin: bin,
	main: main,
	module: module$1,
	types: types,
	exports: exports$1,
	files: files,
	scripts: scripts,
	dependencies: dependencies,
	devDependencies: devDependencies,
	resolutions: resolutions,
	publishConfig: publishConfig,
	packageManager: packageManager
};

class Configuration {
  serverUrl;
  webappUrl;
  isDaemonProcess;
  // Directories and paths (from persistence)
  happyHomeDir;
  logsDir;
  settingsFile;
  privateKeyFile;
  daemonStateFile;
  daemonLockFile;
  currentCliVersion;
  isExperimentalEnabled;
  disableCaffeinate;
  // API Key for service-level authentication (X-API-Key header)
  apiKey;
  constructor() {
    const args = process.argv.slice(2);
    this.isDaemonProcess = args.length >= 2 && args[0] === "daemon" && args[1] === "start-sync";
    if (process.env.HAPPY_HOME_DIR) {
      const expandedPath = process.env.HAPPY_HOME_DIR.replace(/^~/, os.homedir());
      this.happyHomeDir = expandedPath;
    } else {
      this.happyHomeDir = node_path.join(os.homedir(), ".happy");
    }
    this.logsDir = node_path.join(this.happyHomeDir, "logs");
    this.settingsFile = node_path.join(this.happyHomeDir, "settings.json");
    this.privateKeyFile = node_path.join(this.happyHomeDir, "access.key");
    this.daemonStateFile = node_path.join(this.happyHomeDir, "daemon.state.json");
    this.daemonLockFile = node_path.join(this.happyHomeDir, "daemon.state.json.lock");
    if (!fs.existsSync(this.happyHomeDir)) {
      fs.mkdirSync(this.happyHomeDir, { recursive: true });
    }
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
    let configFileSettings = {};
    try {
      if (fs.existsSync(this.settingsFile)) {
        const content = fs.readFileSync(this.settingsFile, "utf8");
        const parsed = JSON.parse(content);
        if (parsed.serverUrl && typeof parsed.serverUrl === "string") {
          configFileSettings.serverUrl = parsed.serverUrl;
        }
        if (parsed.webappUrl && typeof parsed.webappUrl === "string") {
          configFileSettings.webappUrl = parsed.webappUrl;
        }
        if (parsed.apiKey && typeof parsed.apiKey === "string") {
          configFileSettings.apiKey = parsed.apiKey;
        }
      }
    } catch {
    }
    this.serverUrl = process.env.HAPPY_SERVER_URL || configFileSettings.serverUrl || "https://api.cluster-fluster.com";
    this.webappUrl = process.env.HAPPY_WEBAPP_URL || configFileSettings.webappUrl || "https://app.happy.engineering";
    this.apiKey = process.env.HAPPY_API_KEY || configFileSettings.apiKey || null;
    this.isExperimentalEnabled = ["true", "1", "yes"].includes(process.env.HAPPY_EXPERIMENTAL?.toLowerCase() || "");
    this.disableCaffeinate = ["true", "1", "yes"].includes(process.env.HAPPY_DISABLE_CAFFEINATE?.toLowerCase() || "");
    this.currentCliVersion = packageJson.version;
  }
}
const configuration = new Configuration();

function encodeBase64(buffer, variant = "base64") {
  if (variant === "base64url") {
    return encodeBase64Url(buffer);
  }
  return Buffer.from(buffer).toString("base64");
}
function encodeBase64Url(buffer) {
  return Buffer.from(buffer).toString("base64").replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
function decodeBase64(base64, variant = "base64") {
  if (variant === "base64url") {
    const base64Standard = base64.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - base64.length % 4) % 4);
    return new Uint8Array(Buffer.from(base64Standard, "base64"));
  }
  return new Uint8Array(Buffer.from(base64, "base64"));
}
function getRandomBytes(size) {
  return new Uint8Array(node_crypto.randomBytes(size));
}
function libsodiumEncryptForPublicKey(data, recipientPublicKey) {
  const ephemeralKeyPair = tweetnacl.box.keyPair();
  const nonce = getRandomBytes(tweetnacl.box.nonceLength);
  const encrypted = tweetnacl.box(data, nonce, recipientPublicKey, ephemeralKeyPair.secretKey);
  const result = new Uint8Array(ephemeralKeyPair.publicKey.length + nonce.length + encrypted.length);
  result.set(ephemeralKeyPair.publicKey, 0);
  result.set(nonce, ephemeralKeyPair.publicKey.length);
  result.set(encrypted, ephemeralKeyPair.publicKey.length + nonce.length);
  return result;
}
function encryptLegacy(data, secret) {
  const nonce = getRandomBytes(tweetnacl.secretbox.nonceLength);
  const encrypted = tweetnacl.secretbox(new TextEncoder().encode(JSON.stringify(data)), nonce, secret);
  const result = new Uint8Array(nonce.length + encrypted.length);
  result.set(nonce);
  result.set(encrypted, nonce.length);
  return result;
}
function decryptLegacy(data, secret) {
  const nonce = data.slice(0, tweetnacl.secretbox.nonceLength);
  const encrypted = data.slice(tweetnacl.secretbox.nonceLength);
  const decrypted = tweetnacl.secretbox.open(encrypted, nonce, secret);
  if (!decrypted) {
    return null;
  }
  return JSON.parse(new TextDecoder().decode(decrypted));
}
function encryptWithDataKey(data, dataKey) {
  const nonce = getRandomBytes(12);
  const cipher = node_crypto.createCipheriv("aes-256-gcm", dataKey, nonce);
  const plaintext = new TextEncoder().encode(JSON.stringify(data));
  const encrypted = Buffer.concat([
    cipher.update(plaintext),
    cipher.final()
  ]);
  const authTag = cipher.getAuthTag();
  const bundle = new Uint8Array(12 + encrypted.length + 16 + 1);
  bundle.set([0], 0);
  bundle.set(nonce, 1);
  bundle.set(new Uint8Array(encrypted), 13);
  bundle.set(new Uint8Array(authTag), 13 + encrypted.length);
  return bundle;
}
function decryptWithDataKey(bundle, dataKey) {
  if (bundle.length < 1) {
    return null;
  }
  if (bundle[0] !== 0) {
    return null;
  }
  if (bundle.length < 12 + 16 + 1) {
    return null;
  }
  const nonce = bundle.slice(1, 13);
  const authTag = bundle.slice(bundle.length - 16);
  const ciphertext = bundle.slice(13, bundle.length - 16);
  try {
    const decipher = node_crypto.createDecipheriv("aes-256-gcm", dataKey, nonce);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ]);
    return JSON.parse(new TextDecoder().decode(decrypted));
  } catch (error) {
    return null;
  }
}
function encrypt(key, variant, data) {
  if (variant === "legacy") {
    return encryptLegacy(data, key);
  } else {
    return encryptWithDataKey(data, key);
  }
}
function decrypt(key, variant, data) {
  if (variant === "legacy") {
    return decryptLegacy(data, key);
  } else {
    return decryptWithDataKey(data, key);
  }
}

const defaultSettings = {
  onboardingCompleted: false
};
async function readSettings() {
  if (!fs.existsSync(configuration.settingsFile)) {
    return { ...defaultSettings };
  }
  try {
    const content = await promises.readFile(configuration.settingsFile, "utf8");
    return JSON.parse(content);
  } catch {
    return { ...defaultSettings };
  }
}
async function updateSettings(updater) {
  const LOCK_RETRY_INTERVAL_MS = 100;
  const MAX_LOCK_ATTEMPTS = 50;
  const STALE_LOCK_TIMEOUT_MS = 1e4;
  const lockFile = configuration.settingsFile + ".lock";
  const tmpFile = configuration.settingsFile + ".tmp";
  let fileHandle;
  let attempts = 0;
  while (attempts < MAX_LOCK_ATTEMPTS) {
    try {
      fileHandle = await promises.open(lockFile, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY);
      break;
    } catch (err) {
      if (err.code === "EEXIST") {
        attempts++;
        await new Promise((resolve) => setTimeout(resolve, LOCK_RETRY_INTERVAL_MS));
        try {
          const stats = await promises.stat(lockFile);
          if (Date.now() - stats.mtimeMs > STALE_LOCK_TIMEOUT_MS) {
            await promises.unlink(lockFile).catch(() => {
            });
          }
        } catch {
        }
      } else {
        throw err;
      }
    }
  }
  if (!fileHandle) {
    throw new Error(`Failed to acquire settings lock after ${MAX_LOCK_ATTEMPTS * LOCK_RETRY_INTERVAL_MS / 1e3} seconds`);
  }
  try {
    const current = await readSettings() || { ...defaultSettings };
    const updated = await updater(current);
    if (!fs.existsSync(configuration.happyHomeDir)) {
      await promises.mkdir(configuration.happyHomeDir, { recursive: true });
    }
    await promises.writeFile(tmpFile, JSON.stringify(updated, null, 2));
    await promises.rename(tmpFile, configuration.settingsFile);
    return updated;
  } finally {
    await fileHandle.close();
    await promises.unlink(lockFile).catch(() => {
    });
  }
}
const credentialsSchema = z__namespace.object({
  token: z__namespace.string(),
  secret: z__namespace.string().base64().nullish(),
  // Legacy
  encryption: z__namespace.object({
    publicKey: z__namespace.string().base64(),
    machineKey: z__namespace.string().base64()
  }).nullish()
});
async function readCredentials() {
  if (!fs.existsSync(configuration.privateKeyFile)) {
    return null;
  }
  try {
    const keyBase64 = await promises.readFile(configuration.privateKeyFile, "utf8");
    const credentials = credentialsSchema.parse(JSON.parse(keyBase64));
    if (credentials.secret) {
      return {
        token: credentials.token,
        encryption: {
          type: "legacy",
          secret: new Uint8Array(Buffer.from(credentials.secret, "base64"))
        }
      };
    } else if (credentials.encryption) {
      return {
        token: credentials.token,
        encryption: {
          type: "dataKey",
          publicKey: new Uint8Array(Buffer.from(credentials.encryption.publicKey, "base64")),
          machineKey: new Uint8Array(Buffer.from(credentials.encryption.machineKey, "base64"))
        }
      };
    }
  } catch {
    return null;
  }
  return null;
}
async function writeCredentialsLegacy(credentials) {
  if (!fs.existsSync(configuration.happyHomeDir)) {
    await promises.mkdir(configuration.happyHomeDir, { recursive: true });
  }
  await promises.writeFile(configuration.privateKeyFile, JSON.stringify({
    secret: encodeBase64(credentials.secret),
    token: credentials.token
  }, null, 2));
}
async function writeCredentialsDataKey(credentials) {
  if (!fs.existsSync(configuration.happyHomeDir)) {
    await promises.mkdir(configuration.happyHomeDir, { recursive: true });
  }
  await promises.writeFile(configuration.privateKeyFile, JSON.stringify({
    encryption: { publicKey: encodeBase64(credentials.publicKey), machineKey: encodeBase64(credentials.machineKey) },
    token: credentials.token
  }, null, 2));
}
async function clearCredentials() {
  if (fs.existsSync(configuration.privateKeyFile)) {
    await promises.unlink(configuration.privateKeyFile);
  }
}
async function clearMachineId() {
  await updateSettings((settings) => ({
    ...settings,
    machineId: void 0
  }));
}
async function readDaemonState() {
  try {
    if (!fs.existsSync(configuration.daemonStateFile)) {
      return null;
    }
    const content = await promises.readFile(configuration.daemonStateFile, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    console.error(`[PERSISTENCE] Daemon state file corrupted: ${configuration.daemonStateFile}`, error);
    return null;
  }
}
function writeDaemonState(state) {
  fs.writeFileSync(configuration.daemonStateFile, JSON.stringify(state, null, 2), "utf-8");
}
async function clearDaemonState() {
  if (fs.existsSync(configuration.daemonStateFile)) {
    await promises.unlink(configuration.daemonStateFile);
  }
  if (fs.existsSync(configuration.daemonLockFile)) {
    try {
      await promises.unlink(configuration.daemonLockFile);
    } catch {
    }
  }
}
async function acquireDaemonLock(maxAttempts = 5, delayIncrementMs = 200) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const fileHandle = await promises.open(
        configuration.daemonLockFile,
        fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY
      );
      await fileHandle.writeFile(String(process.pid));
      return fileHandle;
    } catch (error) {
      if (error.code === "EEXIST") {
        try {
          const lockPid = fs.readFileSync(configuration.daemonLockFile, "utf-8").trim();
          if (lockPid && !isNaN(Number(lockPid))) {
            try {
              process.kill(Number(lockPid), 0);
            } catch {
              fs.unlinkSync(configuration.daemonLockFile);
              continue;
            }
          }
        } catch {
        }
      }
      if (attempt === maxAttempts) {
        return null;
      }
      const delayMs = attempt * delayIncrementMs;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return null;
}
async function releaseDaemonLock(lockHandle) {
  try {
    await lockHandle.close();
  } catch {
  }
  try {
    if (fs.existsSync(configuration.daemonLockFile)) {
      fs.unlinkSync(configuration.daemonLockFile);
    }
  } catch {
  }
}

function createTimestampForFilename(date = /* @__PURE__ */ new Date()) {
  return date.toLocaleString("sv-SE", {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).replace(/[: ]/g, "-").replace(/,/g, "") + "-pid-" + process.pid;
}
function createTimestampForLogEntry(date = /* @__PURE__ */ new Date()) {
  return date.toLocaleTimeString("en-US", {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3
  });
}
function getSessionLogPath() {
  const timestamp = createTimestampForFilename();
  const filename = configuration.isDaemonProcess ? `${timestamp}-daemon.log` : `${timestamp}.log`;
  return node_path.join(configuration.logsDir, filename);
}
class Logger {
  constructor(logFilePath = getSessionLogPath()) {
    this.logFilePath = logFilePath;
    if (process.env.DANGEROUSLY_LOG_TO_SERVER_FOR_AI_AUTO_DEBUGGING && process.env.HAPPY_SERVER_URL) {
      this.dangerouslyUnencryptedServerLoggingUrl = process.env.HAPPY_SERVER_URL;
      console.log(chalk.yellow("[REMOTE LOGGING] Sending logs to server for AI debugging"));
    }
  }
  dangerouslyUnencryptedServerLoggingUrl;
  // Use local timezone for simplicity of locating the logs,
  // in practice you will not need absolute timestamps
  localTimezoneTimestamp() {
    return createTimestampForLogEntry();
  }
  debug(message, ...args) {
    this.logToFile(`[${this.localTimezoneTimestamp()}]`, message, ...args);
  }
  debugLargeJson(message, object, maxStringLength = 100, maxArrayLength = 10) {
    if (!process.env.DEBUG) {
      this.debug(`In production, skipping message inspection`);
    }
    const truncateStrings = (obj) => {
      if (typeof obj === "string") {
        return obj.length > maxStringLength ? obj.substring(0, maxStringLength) + "... [truncated for logs]" : obj;
      }
      if (Array.isArray(obj)) {
        const truncatedArray = obj.map((item) => truncateStrings(item)).slice(0, maxArrayLength);
        if (obj.length > maxArrayLength) {
          truncatedArray.push(`... [truncated array for logs up to ${maxArrayLength} items]`);
        }
        return truncatedArray;
      }
      if (obj && typeof obj === "object") {
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
          if (key === "usage") {
            continue;
          }
          result[key] = truncateStrings(value);
        }
        return result;
      }
      return obj;
    };
    const truncatedObject = truncateStrings(object);
    const json = JSON.stringify(truncatedObject, null, 2);
    this.logToFile(`[${this.localTimezoneTimestamp()}]`, message, "\n", json);
  }
  info(message, ...args) {
    this.logToConsole("info", "", message, ...args);
    this.debug(message, args);
  }
  infoDeveloper(message, ...args) {
    this.debug(message, ...args);
    if (process.env.DEBUG) {
      this.logToConsole("info", "[DEV]", message, ...args);
    }
  }
  warn(message, ...args) {
    this.logToConsole("warn", "", message, ...args);
    this.debug(`[WARN] ${message}`, ...args);
  }
  getLogPath() {
    return this.logFilePath;
  }
  logToConsole(level, prefix, message, ...args) {
    switch (level) {
      case "debug": {
        console.log(chalk.gray(prefix), message, ...args);
        break;
      }
      case "error": {
        console.error(chalk.red(prefix), message, ...args);
        break;
      }
      case "info": {
        console.log(chalk.blue(prefix), message, ...args);
        break;
      }
      case "warn": {
        console.log(chalk.yellow(prefix), message, ...args);
        break;
      }
      default: {
        this.debug("Unknown log level:", level);
        console.log(chalk.blue(prefix), message, ...args);
        break;
      }
    }
  }
  async sendToRemoteServer(level, message, ...args) {
    if (!this.dangerouslyUnencryptedServerLoggingUrl) return;
    try {
      await fetch(this.dangerouslyUnencryptedServerLoggingUrl + "/logs-combined-from-cli-and-mobile-for-simple-ai-debugging", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          level,
          message: `${message} ${args.map(
            (a) => typeof a === "object" ? JSON.stringify(a, null, 2) : String(a)
          ).join(" ")}`,
          source: "cli",
          platform: process.platform
        })
      });
    } catch (error) {
    }
  }
  logToFile(prefix, message, ...args) {
    const logLine = `${prefix} ${message} ${args.map(
      (arg) => typeof arg === "string" ? arg : JSON.stringify(arg)
    ).join(" ")}
`;
    if (this.dangerouslyUnencryptedServerLoggingUrl) {
      let level = "info";
      if (prefix.includes(this.localTimezoneTimestamp())) {
        level = "debug";
      }
      this.sendToRemoteServer(level, message, ...args).catch(() => {
      });
    }
    try {
      fs$1.appendFileSync(this.logFilePath, logLine);
    } catch (appendError) {
      if (process.env.DEBUG) {
        console.error("[DEV MODE ONLY THROWING] Failed to append to log file:", appendError);
        throw appendError;
      }
    }
  }
}
let logger = new Logger();
async function listDaemonLogFiles(limit = 50) {
  try {
    const logsDir = configuration.logsDir;
    if (!fs.existsSync(logsDir)) {
      return [];
    }
    const logs = fs.readdirSync(logsDir).filter((file) => file.endsWith("-daemon.log")).map((file) => {
      const fullPath = node_path.join(logsDir, file);
      const stats = fs.statSync(fullPath);
      return { file, path: fullPath, modified: stats.mtime };
    }).sort((a, b) => b.modified.getTime() - a.modified.getTime());
    try {
      const state = await readDaemonState();
      if (!state) {
        return logs;
      }
      if (state.daemonLogPath && fs.existsSync(state.daemonLogPath)) {
        const stats = fs.statSync(state.daemonLogPath);
        const persisted = {
          file: node_path.basename(state.daemonLogPath),
          path: state.daemonLogPath,
          modified: stats.mtime
        };
        const idx = logs.findIndex((l) => l.path === persisted.path);
        if (idx >= 0) {
          const [found] = logs.splice(idx, 1);
          logs.unshift(found);
        } else {
          logs.unshift(persisted);
        }
      }
    } catch {
    }
    return logs.slice(0, Math.max(0, limit));
  } catch {
    return [];
  }
}
async function getLatestDaemonLog() {
  const [latest] = await listDaemonLogFiles(1);
  return latest || null;
}

const SessionMessageContentSchema = z.z.object({
  c: z.z.string(),
  // Base64 encoded encrypted content
  t: z.z.literal("encrypted")
});
const UpdateBodySchema = z.z.object({
  message: z.z.object({
    id: z.z.string(),
    seq: z.z.number(),
    content: SessionMessageContentSchema
  }),
  sid: z.z.string(),
  // Session ID
  t: z.z.literal("new-message")
});
const UpdateSessionBodySchema = z.z.object({
  t: z.z.literal("update-session"),
  sid: z.z.string(),
  metadata: z.z.object({
    version: z.z.number(),
    value: z.z.string()
  }).nullish(),
  agentState: z.z.object({
    version: z.z.number(),
    value: z.z.string()
  }).nullish()
});
const UpdateMachineBodySchema = z.z.object({
  t: z.z.literal("update-machine"),
  machineId: z.z.string(),
  metadata: z.z.object({
    version: z.z.number(),
    value: z.z.string()
  }).nullish(),
  daemonState: z.z.object({
    version: z.z.number(),
    value: z.z.string()
  }).nullish()
});
z.z.object({
  id: z.z.string(),
  seq: z.z.number(),
  body: z.z.union([
    UpdateBodySchema,
    UpdateSessionBodySchema,
    UpdateMachineBodySchema
  ]),
  createdAt: z.z.number()
});
z.z.object({
  host: z.z.string(),
  platform: z.z.string(),
  happyCliVersion: z.z.string(),
  homeDir: z.z.string(),
  happyHomeDir: z.z.string(),
  happyLibDir: z.z.string()
});
z.z.object({
  status: z.z.union([
    z.z.enum(["running", "shutting-down"]),
    z.z.string()
    // Forward compatibility
  ]),
  pid: z.z.number().optional(),
  httpPort: z.z.number().optional(),
  startedAt: z.z.number().optional(),
  shutdownRequestedAt: z.z.number().optional(),
  shutdownSource: z.z.union([
    z.z.enum(["mobile-app", "cli", "os-signal", "unknown"]),
    z.z.string()
    // Forward compatibility
  ]).optional()
});
z.z.object({
  content: SessionMessageContentSchema,
  createdAt: z.z.number(),
  id: z.z.string(),
  seq: z.z.number(),
  updatedAt: z.z.number()
});
const MessageMetaSchema = z.z.object({
  sentFrom: z.z.string().optional(),
  // Source identifier
  permissionMode: z.z.string().optional(),
  // Permission mode for this message
  model: z.z.string().nullable().optional(),
  // Model name for this message (null = reset)
  fallbackModel: z.z.string().nullable().optional(),
  // Fallback model for this message (null = reset)
  customSystemPrompt: z.z.string().nullable().optional(),
  // Custom system prompt for this message (null = reset)
  appendSystemPrompt: z.z.string().nullable().optional(),
  // Append to system prompt for this message (null = reset)
  allowedTools: z.z.array(z.z.string()).nullable().optional(),
  // Allowed tools for this message (null = reset)
  disallowedTools: z.z.array(z.z.string()).nullable().optional()
  // Disallowed tools for this message (null = reset)
});
z.z.object({
  session: z.z.object({
    id: z.z.string(),
    tag: z.z.string(),
    seq: z.z.number(),
    createdAt: z.z.number(),
    updatedAt: z.z.number(),
    metadata: z.z.string(),
    metadataVersion: z.z.number(),
    agentState: z.z.string().nullable(),
    agentStateVersion: z.z.number()
  })
});
const UserMessageSchema = z.z.object({
  role: z.z.literal("user"),
  content: z.z.object({
    type: z.z.literal("text"),
    text: z.z.string()
  }),
  localKey: z.z.string().optional(),
  // Mobile messages include this
  meta: MessageMetaSchema.optional()
});
const AgentMessageSchema = z.z.object({
  role: z.z.literal("agent"),
  content: z.z.object({
    type: z.z.literal("output"),
    data: z.z.any()
  }),
  meta: MessageMetaSchema.optional()
});
z.z.union([UserMessageSchema, AgentMessageSchema]);

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function exponentialBackoffDelay(currentFailureCount, minDelay, maxDelay, maxFailureCount) {
  let maxDelayRet = minDelay + (maxDelay - minDelay) / maxFailureCount * Math.min(currentFailureCount, maxFailureCount);
  return Math.round(Math.random() * maxDelayRet);
}
function createBackoff(opts) {
  return async (callback) => {
    let currentFailureCount = 0;
    const minDelay = 250;
    const maxDelay = 1e3;
    const maxFailureCount = 50;
    while (true) {
      try {
        return await callback();
      } catch (e) {
        if (currentFailureCount < maxFailureCount) {
          currentFailureCount++;
        }
        let waitForRequest = exponentialBackoffDelay(currentFailureCount, minDelay, maxDelay, maxFailureCount);
        await delay(waitForRequest);
      }
    }
  };
}
let backoff = createBackoff();

class AsyncLock {
  permits = 1;
  promiseResolverQueue = [];
  async inLock(func) {
    try {
      await this.lock();
      return await func();
    } finally {
      this.unlock();
    }
  }
  async lock() {
    if (this.permits > 0) {
      this.permits = this.permits - 1;
      return;
    }
    await new Promise((resolve) => this.promiseResolverQueue.push(resolve));
  }
  unlock() {
    this.permits += 1;
    if (this.permits > 1 && this.promiseResolverQueue.length > 0) {
      throw new Error("this.permits should never be > 0 when there is someone waiting.");
    } else if (this.permits === 1 && this.promiseResolverQueue.length > 0) {
      this.permits -= 1;
      const nextResolver = this.promiseResolverQueue.shift();
      if (nextResolver) {
        setTimeout(() => {
          nextResolver(true);
        }, 0);
      }
    }
  }
}

class RpcHandlerManager {
  handlers = /* @__PURE__ */ new Map();
  scopePrefix;
  encryptionKey;
  encryptionVariant;
  logger;
  socket = null;
  constructor(config) {
    this.scopePrefix = config.scopePrefix;
    this.encryptionKey = config.encryptionKey;
    this.encryptionVariant = config.encryptionVariant;
    this.logger = config.logger || ((msg, data) => logger.debug(msg, data));
  }
  /**
   * Register an RPC handler for a specific method
   * @param method - The method name (without prefix)
   * @param handler - The handler function
   */
  registerHandler(method, handler) {
    const prefixedMethod = this.getPrefixedMethod(method);
    this.handlers.set(prefixedMethod, handler);
    if (this.socket) {
      this.socket.emit("rpc-register", { method: prefixedMethod });
    }
  }
  /**
   * Handle an incoming RPC request
   * @param request - The RPC request data
   * @param callback - The response callback
   */
  async handleRequest(request) {
    try {
      const handler = this.handlers.get(request.method);
      if (!handler) {
        this.logger("[RPC] [ERROR] Method not found", { method: request.method });
        const errorResponse = { error: "Method not found" };
        const encryptedError = encodeBase64(encrypt(this.encryptionKey, this.encryptionVariant, errorResponse));
        return encryptedError;
      }
      const decryptedParams = decrypt(this.encryptionKey, this.encryptionVariant, decodeBase64(request.params));
      const result = await handler(decryptedParams);
      const encryptedResponse = encodeBase64(encrypt(this.encryptionKey, this.encryptionVariant, result));
      return encryptedResponse;
    } catch (error) {
      this.logger("[RPC] [ERROR] Error handling request", { error });
      const errorResponse = {
        error: error instanceof Error ? error.message : "Unknown error"
      };
      return encodeBase64(encrypt(this.encryptionKey, this.encryptionVariant, errorResponse));
    }
  }
  onSocketConnect(socket) {
    this.socket = socket;
    for (const [prefixedMethod] of this.handlers) {
      socket.emit("rpc-register", { method: prefixedMethod });
    }
  }
  onSocketDisconnect() {
    this.socket = null;
  }
  /**
   * Get the number of registered handlers
   */
  getHandlerCount() {
    return this.handlers.size;
  }
  /**
   * Check if a handler is registered
   * @param method - The method name (without prefix)
   */
  hasHandler(method) {
    const prefixedMethod = this.getPrefixedMethod(method);
    return this.handlers.has(prefixedMethod);
  }
  /**
   * Clear all handlers
   */
  clearHandlers() {
    this.handlers.clear();
    this.logger("Cleared all RPC handlers");
  }
  /**
   * Get the prefixed method name
   * @param method - The method name
   */
  getPrefixedMethod(method) {
    return `${this.scopePrefix}:${method}`;
  }
}

const __dirname$1 = path.dirname(url.fileURLToPath((typeof document === 'undefined' ? require('u' + 'rl').pathToFileURL(__filename).href : (_documentCurrentScript && _documentCurrentScript.tagName.toUpperCase() === 'SCRIPT' && _documentCurrentScript.src || new URL('types-BMTKmjau.cjs', document.baseURI).href))));
function projectPath() {
  const path$1 = path.resolve(__dirname$1, "..");
  return path$1;
}

function run$1(args, options) {
  const RUNNER_PATH = path.resolve(path.join(projectPath(), "scripts", "ripgrep_launcher.cjs"));
  return new Promise((resolve2, reject) => {
    const child = child_process.spawn("node", [RUNNER_PATH, JSON.stringify(args)], {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: options?.cwd,
      windowsHide: true
      // Prevent opening a new console window on Windows
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });
    child.on("close", (code) => {
      resolve2({
        exitCode: code || 0,
        stdout,
        stderr
      });
    });
    child.on("error", (err) => {
      reject(err);
    });
  });
}

function getBinaryPath() {
  const platformName = os$1.platform();
  const binaryName = platformName === "win32" ? "difft.exe" : "difft";
  return path.resolve(path.join(projectPath(), "tools", "unpacked", binaryName));
}
function run(args, options) {
  const binaryPath = getBinaryPath();
  return new Promise((resolve2, reject) => {
    const child = child_process.spawn(binaryPath, args, {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: options?.cwd,
      env: {
        ...process.env,
        // Force color output when needed
        FORCE_COLOR: "1"
      },
      windowsHide: true
      // Prevent opening a new console window on Windows
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });
    child.on("close", (code) => {
      resolve2({
        exitCode: code || 0,
        stdout,
        stderr
      });
    });
    child.on("error", (err) => {
      reject(err);
    });
  });
}

function validatePath(targetPath, workingDirectory) {
  const resolvedTarget = path.resolve(workingDirectory, targetPath);
  const resolvedWorkingDir = path.resolve(workingDirectory);
  if (!resolvedTarget.startsWith(resolvedWorkingDir + "/") && resolvedTarget !== resolvedWorkingDir) {
    return {
      valid: false,
      error: `Access denied: Path '${targetPath}' is outside the working directory`
    };
  }
  return { valid: true };
}

const execAsync = util.promisify(child_process.exec);
function registerCommonHandlers(rpcHandlerManager, workingDirectory) {
  rpcHandlerManager.registerHandler("bash", async (data) => {
    logger.debug("Shell command request:", data.command);
    if (data.cwd) {
      const validation = validatePath(data.cwd, workingDirectory);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }
    }
    try {
      const options = {
        cwd: data.cwd,
        timeout: data.timeout || 3e4,
        // Default 30 seconds timeout
        windowsHide: true
        // Prevent opening a new console window on Windows
      };
      const { stdout, stderr } = await execAsync(data.command, options);
      return {
        success: true,
        stdout: stdout ? stdout.toString() : "",
        stderr: stderr ? stderr.toString() : "",
        exitCode: 0
      };
    } catch (error) {
      const execError = error;
      if (execError.code === "ETIMEDOUT" || execError.killed) {
        return {
          success: false,
          stdout: execError.stdout || "",
          stderr: execError.stderr || "",
          exitCode: typeof execError.code === "number" ? execError.code : -1,
          error: "Command timed out"
        };
      }
      return {
        success: false,
        stdout: execError.stdout ? execError.stdout.toString() : "",
        stderr: execError.stderr ? execError.stderr.toString() : execError.message || "Command failed",
        exitCode: typeof execError.code === "number" ? execError.code : 1,
        error: execError.message || "Command failed"
      };
    }
  });
  rpcHandlerManager.registerHandler("readFile", async (data) => {
    logger.debug("Read file request:", data.path);
    const validation = validatePath(data.path, workingDirectory);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }
    try {
      const buffer = await fs$2.readFile(data.path);
      const content = buffer.toString("base64");
      return { success: true, content };
    } catch (error) {
      logger.debug("Failed to read file:", error);
      return { success: false, error: error instanceof Error ? error.message : "Failed to read file" };
    }
  });
  rpcHandlerManager.registerHandler("writeFile", async (data) => {
    logger.debug("Write file request:", data.path);
    const validation = validatePath(data.path, workingDirectory);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }
    try {
      if (data.expectedHash !== null && data.expectedHash !== void 0) {
        try {
          const existingBuffer = await fs$2.readFile(data.path);
          const existingHash = crypto.createHash("sha256").update(existingBuffer).digest("hex");
          if (existingHash !== data.expectedHash) {
            return {
              success: false,
              error: `File hash mismatch. Expected: ${data.expectedHash}, Actual: ${existingHash}`
            };
          }
        } catch (error) {
          const nodeError = error;
          if (nodeError.code !== "ENOENT") {
            throw error;
          }
          return {
            success: false,
            error: "File does not exist but hash was provided"
          };
        }
      } else {
        try {
          await fs$2.stat(data.path);
          return {
            success: false,
            error: "File already exists but was expected to be new"
          };
        } catch (error) {
          const nodeError = error;
          if (nodeError.code !== "ENOENT") {
            throw error;
          }
        }
      }
      const buffer = Buffer.from(data.content, "base64");
      await fs$2.writeFile(data.path, buffer);
      const hash = crypto.createHash("sha256").update(buffer).digest("hex");
      return { success: true, hash };
    } catch (error) {
      logger.debug("Failed to write file:", error);
      return { success: false, error: error instanceof Error ? error.message : "Failed to write file" };
    }
  });
  rpcHandlerManager.registerHandler("listDirectory", async (data) => {
    logger.debug("List directory request:", data.path);
    const validation = validatePath(data.path, workingDirectory);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }
    try {
      const entries = await fs$2.readdir(data.path, { withFileTypes: true });
      const directoryEntries = await Promise.all(
        entries.map(async (entry) => {
          const fullPath = path.join(data.path, entry.name);
          let type = "other";
          let size;
          let modified;
          if (entry.isDirectory()) {
            type = "directory";
          } else if (entry.isFile()) {
            type = "file";
          }
          try {
            const stats = await fs$2.stat(fullPath);
            size = stats.size;
            modified = stats.mtime.getTime();
          } catch (error) {
            logger.debug(`Failed to stat ${fullPath}:`, error);
          }
          return {
            name: entry.name,
            type,
            size,
            modified
          };
        })
      );
      directoryEntries.sort((a, b) => {
        if (a.type === "directory" && b.type !== "directory") return -1;
        if (a.type !== "directory" && b.type === "directory") return 1;
        return a.name.localeCompare(b.name);
      });
      return { success: true, entries: directoryEntries };
    } catch (error) {
      logger.debug("Failed to list directory:", error);
      return { success: false, error: error instanceof Error ? error.message : "Failed to list directory" };
    }
  });
  rpcHandlerManager.registerHandler("getDirectoryTree", async (data) => {
    logger.debug("Get directory tree request:", data.path, "maxDepth:", data.maxDepth);
    const validation = validatePath(data.path, workingDirectory);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }
    async function buildTree(path$1, name, currentDepth) {
      try {
        const stats = await fs$2.stat(path$1);
        const node = {
          name,
          path: path$1,
          type: stats.isDirectory() ? "directory" : "file",
          size: stats.size,
          modified: stats.mtime.getTime()
        };
        if (stats.isDirectory() && currentDepth < data.maxDepth) {
          const entries = await fs$2.readdir(path$1, { withFileTypes: true });
          const children = [];
          await Promise.all(
            entries.map(async (entry) => {
              if (entry.isSymbolicLink()) {
                logger.debug(`Skipping symlink: ${path.join(path$1, entry.name)}`);
                return;
              }
              const childPath = path.join(path$1, entry.name);
              const childNode = await buildTree(childPath, entry.name, currentDepth + 1);
              if (childNode) {
                children.push(childNode);
              }
            })
          );
          children.sort((a, b) => {
            if (a.type === "directory" && b.type !== "directory") return -1;
            if (a.type !== "directory" && b.type === "directory") return 1;
            return a.name.localeCompare(b.name);
          });
          node.children = children;
        }
        return node;
      } catch (error) {
        logger.debug(`Failed to process ${path$1}:`, error instanceof Error ? error.message : String(error));
        return null;
      }
    }
    try {
      if (data.maxDepth < 0) {
        return { success: false, error: "maxDepth must be non-negative" };
      }
      const baseName = data.path === "/" ? "/" : data.path.split("/").pop() || data.path;
      const tree = await buildTree(data.path, baseName, 0);
      if (!tree) {
        return { success: false, error: "Failed to access the specified path" };
      }
      return { success: true, tree };
    } catch (error) {
      logger.debug("Failed to get directory tree:", error);
      return { success: false, error: error instanceof Error ? error.message : "Failed to get directory tree" };
    }
  });
  rpcHandlerManager.registerHandler("ripgrep", async (data) => {
    logger.debug("Ripgrep request with args:", data.args, "cwd:", data.cwd);
    if (data.cwd) {
      const validation = validatePath(data.cwd, workingDirectory);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }
    }
    try {
      const result = await run$1(data.args, { cwd: data.cwd });
      return {
        success: true,
        exitCode: result.exitCode,
        stdout: result.stdout.toString(),
        stderr: result.stderr.toString()
      };
    } catch (error) {
      logger.debug("Failed to run ripgrep:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to run ripgrep"
      };
    }
  });
  rpcHandlerManager.registerHandler("difftastic", async (data) => {
    logger.debug("Difftastic request with args:", data.args, "cwd:", data.cwd);
    if (data.cwd) {
      const validation = validatePath(data.cwd, workingDirectory);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }
    }
    try {
      const result = await run(data.args, { cwd: data.cwd });
      return {
        success: true,
        exitCode: result.exitCode,
        stdout: result.stdout.toString(),
        stderr: result.stderr.toString()
      };
    } catch (error) {
      logger.debug("Failed to run difftastic:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to run difftastic"
      };
    }
  });
}

class ApiKeyAuthError extends Error {
  constructor(message) {
    super(message);
    this.name = "ApiKeyAuthError";
  }
}
class TokenAuthError extends Error {
  constructor(message) {
    super(message);
    this.name = "TokenAuthError";
  }
}
function createHttpClient() {
  const instance = axios.create();
  instance.interceptors.request.use(
    (config) => {
      if (configuration.apiKey) {
        config.headers = config.headers || {};
        config.headers["X-API-Key"] = configuration.apiKey;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );
  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        const errorData = error.response.data;
        const errorMessage = errorData?.error || errorData?.message || "";
        if (errorMessage.toLowerCase().includes("api key") || errorMessage.toLowerCase().includes("api-key") || errorMessage.toLowerCase().includes("x-api-key")) {
          logger.debug("[HTTP] API Key authentication failed:", errorMessage);
          return Promise.reject(new ApiKeyAuthError(
            `API Key authentication failed: ${errorMessage}. Please check your API Key configuration using "happy config show" or set HAPPY_API_KEY environment variable.`
          ));
        }
        logger.debug("[HTTP] Token authentication failed:", errorMessage);
        return Promise.reject(new TokenAuthError(
          `Authentication failed: ${errorMessage || "Invalid or expired token"}. Please try "happy auth login --force" to re-authenticate.`
        ));
      }
      return Promise.reject(error);
    }
  );
  return instance;
}
const httpClient = createHttpClient();
function getAuthHeaders(token) {
  const headers = {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json"
  };
  if (configuration.apiKey) {
    headers["X-API-Key"] = configuration.apiKey;
  }
  return headers;
}
function getSocketExtraHeaders() {
  const headers = {};
  if (configuration.apiKey) {
    headers["X-API-Key"] = configuration.apiKey;
  }
  return headers;
}

class ApiSessionClient extends node_events.EventEmitter {
  token;
  sessionId;
  metadata;
  metadataVersion;
  agentState;
  agentStateVersion;
  socket;
  pendingMessages = [];
  pendingMessageCallback = null;
  rpcHandlerManager;
  agentStateLock = new AsyncLock();
  metadataLock = new AsyncLock();
  encryptionKey;
  encryptionVariant;
  constructor(token, session) {
    super();
    this.token = token;
    this.sessionId = session.id;
    this.metadata = session.metadata;
    this.metadataVersion = session.metadataVersion;
    this.agentState = session.agentState;
    this.agentStateVersion = session.agentStateVersion;
    this.encryptionKey = session.encryptionKey;
    this.encryptionVariant = session.encryptionVariant;
    this.rpcHandlerManager = new RpcHandlerManager({
      scopePrefix: this.sessionId,
      encryptionKey: this.encryptionKey,
      encryptionVariant: this.encryptionVariant,
      logger: (msg, data) => logger.debug(msg, data)
    });
    registerCommonHandlers(this.rpcHandlerManager, this.metadata.path);
    this.socket = socket_ioClient.io(configuration.serverUrl, {
      auth: {
        token: this.token,
        clientType: "session-scoped",
        sessionId: this.sessionId
      },
      extraHeaders: getSocketExtraHeaders(),
      path: "/v1/updates",
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1e3,
      reconnectionDelayMax: 5e3,
      transports: ["websocket"],
      withCredentials: true,
      autoConnect: false
    });
    this.socket.on("connect", () => {
      logger.debug("Socket connected successfully");
      this.rpcHandlerManager.onSocketConnect(this.socket);
    });
    this.socket.on("rpc-request", async (data, callback) => {
      callback(await this.rpcHandlerManager.handleRequest(data));
    });
    this.socket.on("disconnect", (reason) => {
      logger.debug("[API] Socket disconnected:", reason);
      this.rpcHandlerManager.onSocketDisconnect();
    });
    this.socket.on("connect_error", (error) => {
      logger.debug("[API] Socket connection error:", error);
      this.rpcHandlerManager.onSocketDisconnect();
    });
    this.socket.on("update", (data) => {
      try {
        logger.debugLargeJson("[SOCKET] [UPDATE] Received update:", data);
        if (!data.body) {
          logger.debug("[SOCKET] [UPDATE] [ERROR] No body in update!");
          return;
        }
        if (data.body.t === "new-message" && data.body.message.content.t === "encrypted") {
          const body = decrypt(this.encryptionKey, this.encryptionVariant, decodeBase64(data.body.message.content.c));
          logger.debugLargeJson("[SOCKET] [UPDATE] Received update:", body);
          const userResult = UserMessageSchema.safeParse(body);
          if (userResult.success) {
            if (this.pendingMessageCallback) {
              this.pendingMessageCallback(userResult.data);
            } else {
              this.pendingMessages.push(userResult.data);
            }
          } else {
            this.emit("message", body);
          }
        } else if (data.body.t === "update-session") {
          if (data.body.metadata && data.body.metadata.version > this.metadataVersion) {
            this.metadata = decrypt(this.encryptionKey, this.encryptionVariant, decodeBase64(data.body.metadata.value));
            this.metadataVersion = data.body.metadata.version;
          }
          if (data.body.agentState && data.body.agentState.version > this.agentStateVersion) {
            this.agentState = data.body.agentState.value ? decrypt(this.encryptionKey, this.encryptionVariant, decodeBase64(data.body.agentState.value)) : null;
            this.agentStateVersion = data.body.agentState.version;
          }
        } else if (data.body.t === "update-machine") {
          logger.debug(`[SOCKET] WARNING: Session client received unexpected machine update - ignoring`);
        } else {
          this.emit("message", data.body);
        }
      } catch (error) {
        logger.debug("[SOCKET] [UPDATE] [ERROR] Error handling update", { error });
      }
    });
    this.socket.on("error", (error) => {
      logger.debug("[API] Socket error:", error);
    });
    this.socket.connect();
  }
  onUserMessage(callback) {
    this.pendingMessageCallback = callback;
    while (this.pendingMessages.length > 0) {
      callback(this.pendingMessages.shift());
    }
  }
  /**
   * Send message to session
   * @param body - Message body (can be MessageContent or raw content for agent messages)
   */
  sendClaudeSessionMessage(body) {
    let content;
    if (body.type === "user" && typeof body.message.content === "string" && body.isSidechain !== true && body.isMeta !== true) {
      content = {
        role: "user",
        content: {
          type: "text",
          text: body.message.content
        },
        meta: {
          sentFrom: "cli"
        }
      };
    } else {
      content = {
        role: "agent",
        content: {
          type: "output",
          data: body
          // This wraps the entire Claude message
        },
        meta: {
          sentFrom: "cli"
        }
      };
    }
    logger.debugLargeJson("[SOCKET] Sending message through socket:", content);
    const encrypted = encodeBase64(encrypt(this.encryptionKey, this.encryptionVariant, content));
    this.socket.emit("message", {
      sid: this.sessionId,
      message: encrypted
    });
    if (body.type === "assistant" && body.message?.usage) {
      try {
        this.sendUsageData(body.message.usage);
      } catch (error) {
        logger.debug("[SOCKET] Failed to send usage data:", error);
      }
    }
    if (body.type === "summary" && "summary" in body && "leafUuid" in body) {
      this.updateMetadata((metadata) => ({
        ...metadata,
        summary: {
          text: body.summary,
          updatedAt: Date.now()
        }
      }));
    }
  }
  sendCodexMessage(body) {
    let content = {
      role: "agent",
      content: {
        type: "codex",
        data: body
        // This wraps the entire Claude message
      },
      meta: {
        sentFrom: "cli"
      }
    };
    const encrypted = encodeBase64(encrypt(this.encryptionKey, this.encryptionVariant, content));
    if (!this.socket.connected) {
      logger.debug("[API] Socket not connected, cannot send message. Message will be lost:", { type: body.type });
    }
    this.socket.emit("message", {
      sid: this.sessionId,
      message: encrypted
    });
  }
  /**
   * Send a generic agent message to the session.
   * Works for any agent type (Gemini, Codex, Claude, etc.)
   * 
   * @param agentType - The type of agent sending the message (e.g., 'gemini', 'codex', 'claude')
   * @param body - The message payload
   */
  sendAgentMessage(agentType, body) {
    let content = {
      role: "agent",
      content: {
        type: agentType,
        data: body
      },
      meta: {
        sentFrom: "cli"
      }
    };
    logger.debug(`[SOCKET] Sending ${agentType} message:`, { type: body.type, hasMessage: !!body.message });
    const encrypted = encodeBase64(encrypt(this.encryptionKey, this.encryptionVariant, content));
    this.socket.emit("message", {
      sid: this.sessionId,
      message: encrypted
    });
  }
  sendSessionEvent(event, id) {
    let content = {
      role: "agent",
      content: {
        id: id ?? node_crypto.randomUUID(),
        type: "event",
        data: event
      }
    };
    const encrypted = encodeBase64(encrypt(this.encryptionKey, this.encryptionVariant, content));
    this.socket.emit("message", {
      sid: this.sessionId,
      message: encrypted
    });
  }
  /**
   * Send a ping message to keep the connection alive
   */
  keepAlive(thinking, mode) {
    if (process.env.DEBUG) {
      logger.debug(`[API] Sending keep alive message: ${thinking}`);
    }
    this.socket.volatile.emit("session-alive", {
      sid: this.sessionId,
      time: Date.now(),
      thinking,
      mode
    });
  }
  /**
   * Send session death message
   */
  sendSessionDeath() {
    this.socket.emit("session-end", { sid: this.sessionId, time: Date.now() });
  }
  /**
   * Send usage data to the server
   */
  sendUsageData(usage) {
    const totalTokens = usage.input_tokens + usage.output_tokens + (usage.cache_creation_input_tokens || 0) + (usage.cache_read_input_tokens || 0);
    const usageReport = {
      key: "claude-session",
      sessionId: this.sessionId,
      tokens: {
        total: totalTokens,
        input: usage.input_tokens,
        output: usage.output_tokens,
        cache_creation: usage.cache_creation_input_tokens || 0,
        cache_read: usage.cache_read_input_tokens || 0
      },
      cost: {
        // TODO: Calculate actual costs based on pricing
        // For now, using placeholder values
        total: 0,
        input: 0,
        output: 0
      }
    };
    logger.debugLargeJson("[SOCKET] Sending usage data:", usageReport);
    this.socket.emit("usage-report", usageReport);
  }
  /**
   * Update session metadata
   * @param handler - Handler function that returns the updated metadata
   */
  updateMetadata(handler) {
    this.metadataLock.inLock(async () => {
      await backoff(async () => {
        let updated = handler(this.metadata);
        const answer = await this.socket.emitWithAck("update-metadata", { sid: this.sessionId, expectedVersion: this.metadataVersion, metadata: encodeBase64(encrypt(this.encryptionKey, this.encryptionVariant, updated)) });
        if (answer.result === "success") {
          this.metadata = decrypt(this.encryptionKey, this.encryptionVariant, decodeBase64(answer.metadata));
          this.metadataVersion = answer.version;
        } else if (answer.result === "version-mismatch") {
          if (answer.version > this.metadataVersion) {
            this.metadataVersion = answer.version;
            this.metadata = decrypt(this.encryptionKey, this.encryptionVariant, decodeBase64(answer.metadata));
          }
          throw new Error("Metadata version mismatch");
        } else if (answer.result === "error") ;
      });
    });
  }
  /**
   * Update session agent state
   * @param handler - Handler function that returns the updated agent state
   */
  updateAgentState(handler) {
    logger.debugLargeJson("Updating agent state", this.agentState);
    this.agentStateLock.inLock(async () => {
      await backoff(async () => {
        let updated = handler(this.agentState || {});
        const answer = await this.socket.emitWithAck("update-state", { sid: this.sessionId, expectedVersion: this.agentStateVersion, agentState: updated ? encodeBase64(encrypt(this.encryptionKey, this.encryptionVariant, updated)) : null });
        if (answer.result === "success") {
          this.agentState = answer.agentState ? decrypt(this.encryptionKey, this.encryptionVariant, decodeBase64(answer.agentState)) : null;
          this.agentStateVersion = answer.version;
          logger.debug("Agent state updated", this.agentState);
        } else if (answer.result === "version-mismatch") {
          if (answer.version > this.agentStateVersion) {
            this.agentStateVersion = answer.version;
            this.agentState = answer.agentState ? decrypt(this.encryptionKey, this.encryptionVariant, decodeBase64(answer.agentState)) : null;
          }
          throw new Error("Agent state version mismatch");
        } else if (answer.result === "error") ;
      });
    });
  }
  /**
   * Wait for socket buffer to flush
   */
  async flush() {
    if (!this.socket.connected) {
      return;
    }
    return new Promise((resolve) => {
      this.socket.emit("ping", () => {
        resolve();
      });
      setTimeout(() => {
        resolve();
      }, 1e4);
    });
  }
  async close() {
    logger.debug("[API] socket.close() called");
    this.socket.close();
  }
}

class ApiMachineClient {
  constructor(token, machine) {
    this.token = token;
    this.machine = machine;
    this.rpcHandlerManager = new RpcHandlerManager({
      scopePrefix: this.machine.id,
      encryptionKey: this.machine.encryptionKey,
      encryptionVariant: this.machine.encryptionVariant,
      logger: (msg, data) => logger.debug(msg, data)
    });
    registerCommonHandlers(this.rpcHandlerManager, process.cwd());
  }
  socket;
  keepAliveInterval = null;
  rpcHandlerManager;
  setRPCHandlers({
    spawnSession,
    stopSession,
    requestShutdown
  }) {
    this.rpcHandlerManager.registerHandler("spawn-happy-session", async (params) => {
      const { directory, sessionId, machineId, approvedNewDirectoryCreation, agent, token } = params || {};
      logger.debug(`[API MACHINE] Spawning session with params: ${JSON.stringify(params)}`);
      if (!directory) {
        throw new Error("Directory is required");
      }
      const result = await spawnSession({ directory, sessionId, machineId, approvedNewDirectoryCreation, agent: "claude", token });
      switch (result.type) {
        case "success":
          logger.debug(`[API MACHINE] Spawned session ${result.sessionId}`);
          return { type: "success", sessionId: result.sessionId };
        case "requestToApproveDirectoryCreation":
          logger.debug(`[API MACHINE] Requesting directory creation approval for: ${result.directory}`);
          return { type: "requestToApproveDirectoryCreation", directory: result.directory };
        case "error":
          throw new Error(result.errorMessage);
      }
    });
    this.rpcHandlerManager.registerHandler("stop-session", (params) => {
      const { sessionId } = params || {};
      if (!sessionId) {
        throw new Error("Session ID is required");
      }
      const success = stopSession(sessionId);
      if (!success) {
        throw new Error("Session not found or failed to stop");
      }
      logger.debug(`[API MACHINE] Stopped session ${sessionId}`);
      return { message: "Session stopped" };
    });
    this.rpcHandlerManager.registerHandler("stop-daemon", () => {
      logger.debug("[API MACHINE] Received stop-daemon RPC request");
      setTimeout(() => {
        logger.debug("[API MACHINE] Initiating daemon shutdown from RPC");
        requestShutdown();
      }, 100);
      return { message: "Daemon stop request acknowledged, starting shutdown sequence..." };
    });
  }
  /**
   * Update machine metadata
   * Currently unused, changes from the mobile client are more likely
   * for example to set a custom name.
   */
  async updateMachineMetadata(handler) {
    await backoff(async () => {
      const updated = handler(this.machine.metadata);
      const answer = await this.socket.emitWithAck("machine-update-metadata", {
        machineId: this.machine.id,
        metadata: encodeBase64(encrypt(this.machine.encryptionKey, this.machine.encryptionVariant, updated)),
        expectedVersion: this.machine.metadataVersion
      });
      if (answer.result === "success") {
        this.machine.metadata = decrypt(this.machine.encryptionKey, this.machine.encryptionVariant, decodeBase64(answer.metadata));
        this.machine.metadataVersion = answer.version;
        logger.debug("[API MACHINE] Metadata updated successfully");
      } else if (answer.result === "version-mismatch") {
        if (answer.version > this.machine.metadataVersion) {
          this.machine.metadataVersion = answer.version;
          this.machine.metadata = decrypt(this.machine.encryptionKey, this.machine.encryptionVariant, decodeBase64(answer.metadata));
        }
        throw new Error("Metadata version mismatch");
      }
    });
  }
  /**
   * Update daemon state (runtime info) - similar to session updateAgentState
   * Simplified without lock - relies on backoff for retry
   */
  async updateDaemonState(handler) {
    await backoff(async () => {
      const updated = handler(this.machine.daemonState);
      const answer = await this.socket.emitWithAck("machine-update-state", {
        machineId: this.machine.id,
        daemonState: encodeBase64(encrypt(this.machine.encryptionKey, this.machine.encryptionVariant, updated)),
        expectedVersion: this.machine.daemonStateVersion
      });
      if (answer.result === "success") {
        this.machine.daemonState = decrypt(this.machine.encryptionKey, this.machine.encryptionVariant, decodeBase64(answer.daemonState));
        this.machine.daemonStateVersion = answer.version;
        logger.debug("[API MACHINE] Daemon state updated successfully");
      } else if (answer.result === "version-mismatch") {
        if (answer.version > this.machine.daemonStateVersion) {
          this.machine.daemonStateVersion = answer.version;
          this.machine.daemonState = decrypt(this.machine.encryptionKey, this.machine.encryptionVariant, decodeBase64(answer.daemonState));
        }
        throw new Error("Daemon state version mismatch");
      }
    });
  }
  connect() {
    const serverUrl = configuration.serverUrl.replace(/^http/, "ws");
    logger.debug(`[API MACHINE] Connecting to ${serverUrl}`);
    this.socket = socket_ioClient.io(serverUrl, {
      transports: ["websocket"],
      auth: {
        token: this.token,
        clientType: "machine-scoped",
        machineId: this.machine.id
      },
      extraHeaders: getSocketExtraHeaders(),
      path: "/v1/updates",
      reconnection: true,
      reconnectionDelay: 1e3,
      reconnectionDelayMax: 5e3
    });
    this.socket.on("connect", () => {
      logger.debug("[API MACHINE] Connected to server");
      this.updateDaemonState((state) => ({
        ...state,
        status: "running",
        pid: process.pid,
        httpPort: this.machine.daemonState?.httpPort,
        startedAt: Date.now()
      }));
      this.rpcHandlerManager.onSocketConnect(this.socket);
      this.startKeepAlive();
    });
    this.socket.on("disconnect", () => {
      logger.debug("[API MACHINE] Disconnected from server");
      this.rpcHandlerManager.onSocketDisconnect();
      this.stopKeepAlive();
    });
    this.socket.on("rpc-request", async (data, callback) => {
      logger.debugLargeJson(`[API MACHINE] Received RPC request:`, data);
      callback(await this.rpcHandlerManager.handleRequest(data));
    });
    this.socket.on("update", (data) => {
      if (data.body.t === "update-machine" && data.body.machineId === this.machine.id) {
        const update = data.body;
        if (update.metadata) {
          logger.debug("[API MACHINE] Received external metadata update");
          this.machine.metadata = decrypt(this.machine.encryptionKey, this.machine.encryptionVariant, decodeBase64(update.metadata.value));
          this.machine.metadataVersion = update.metadata.version;
        }
        if (update.daemonState) {
          logger.debug("[API MACHINE] Received external daemon state update");
          this.machine.daemonState = decrypt(this.machine.encryptionKey, this.machine.encryptionVariant, decodeBase64(update.daemonState.value));
          this.machine.daemonStateVersion = update.daemonState.version;
        }
      } else {
        logger.debug(`[API MACHINE] Received unknown update type: ${data.body.t}`);
      }
    });
    this.socket.on("connect_error", (error) => {
      logger.debug(`[API MACHINE] Connection error: ${error.message}`);
    });
    this.socket.io.on("error", (error) => {
      logger.debug("[API MACHINE] Socket error:", error);
    });
  }
  startKeepAlive() {
    this.stopKeepAlive();
    this.keepAliveInterval = setInterval(() => {
      const payload = {
        machineId: this.machine.id,
        time: Date.now()
      };
      if (process.env.DEBUG) {
        logger.debugLargeJson(`[API MACHINE] Emitting machine-alive`, payload);
      }
      this.socket.emit("machine-alive", payload);
    }, 2e4);
    logger.debug("[API MACHINE] Keep-alive started (20s interval)");
  }
  stopKeepAlive() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
      logger.debug("[API MACHINE] Keep-alive stopped");
    }
  }
  shutdown() {
    logger.debug("[API MACHINE] Shutting down");
    this.stopKeepAlive();
    if (this.socket) {
      this.socket.close();
      logger.debug("[API MACHINE] Socket closed");
    }
  }
}

class PushNotificationClient {
  token;
  baseUrl;
  expo;
  constructor(token, baseUrl = "https://api.cluster-fluster.com") {
    this.token = token;
    this.baseUrl = baseUrl;
    this.expo = new expoServerSdk.Expo();
  }
  /**
   * Fetch all push tokens for the authenticated user
   */
  async fetchPushTokens() {
    try {
      const response = await httpClient.get(
        `${this.baseUrl}/v1/push-tokens`,
        {
          headers: getAuthHeaders(this.token)
        }
      );
      logger.debug(`Fetched ${response.data.tokens.length} push tokens`);
      response.data.tokens.forEach((token, index) => {
        logger.debug(`[PUSH] Token ${index + 1}: id=${token.id}, created=${new Date(token.createdAt).toISOString()}, updated=${new Date(token.updatedAt).toISOString()}`);
      });
      return response.data.tokens;
    } catch (error) {
      logger.debug("[PUSH] [ERROR] Failed to fetch push tokens:", error);
      throw new Error(`Failed to fetch push tokens: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
  /**
   * Send push notification via Expo Push API with retry
   * @param messages - Array of push messages to send
   */
  async sendPushNotifications(messages) {
    logger.debug(`Sending ${messages.length} push notifications`);
    const validMessages = messages.filter((message) => {
      if (Array.isArray(message.to)) {
        return message.to.every((token) => expoServerSdk.Expo.isExpoPushToken(token));
      }
      return expoServerSdk.Expo.isExpoPushToken(message.to);
    });
    if (validMessages.length === 0) {
      logger.debug("No valid Expo push tokens found");
      return;
    }
    const chunks = this.expo.chunkPushNotifications(validMessages);
    for (const chunk of chunks) {
      const startTime = Date.now();
      const timeout = 3e5;
      let attempt = 0;
      while (true) {
        try {
          const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
          const errors = ticketChunk.filter((ticket) => ticket.status === "error");
          if (errors.length > 0) {
            const errorDetails = errors.map((e) => ({ message: e.message, details: e.details }));
            logger.debug("[PUSH] Some notifications failed:", errorDetails);
          }
          if (errors.length === ticketChunk.length) {
            throw new Error("All push notifications in chunk failed");
          }
          break;
        } catch (error) {
          const elapsed = Date.now() - startTime;
          if (elapsed >= timeout) {
            logger.debug("[PUSH] Timeout reached after 5 minutes, giving up on chunk");
            break;
          }
          attempt++;
          const delay = Math.min(1e3 * Math.pow(2, attempt), 3e4);
          const remainingTime = timeout - elapsed;
          const waitTime = Math.min(delay, remainingTime);
          if (waitTime > 0) {
            logger.debug(`[PUSH] Retrying in ${waitTime}ms (attempt ${attempt})`);
            await new Promise((resolve) => setTimeout(resolve, waitTime));
          }
        }
      }
    }
    logger.debug(`Push notifications sent successfully`);
  }
  /**
   * Send a push notification to all registered devices for the user
   * @param title - Notification title
   * @param body - Notification body
   * @param data - Additional data to send with the notification
   */
  sendToAllDevices(title, body, data) {
    logger.debug(`[PUSH] sendToAllDevices called with title: "${title}", body: "${body}"`);
    (async () => {
      try {
        logger.debug("[PUSH] Fetching push tokens...");
        const tokens = await this.fetchPushTokens();
        logger.debug(`[PUSH] Fetched ${tokens.length} push tokens`);
        tokens.forEach((token, index) => {
          logger.debug(`[PUSH] Using token ${index + 1}: id=${token.id}`);
        });
        if (tokens.length === 0) {
          logger.debug("No push tokens found for user");
          return;
        }
        const messages = tokens.map((token, index) => {
          logger.debug(`[PUSH] Creating message ${index + 1} for token`);
          return {
            to: token.token,
            title,
            body,
            data,
            sound: "default",
            priority: "high"
          };
        });
        logger.debug(`[PUSH] Sending ${messages.length} push notifications...`);
        await this.sendPushNotifications(messages);
        logger.debug("[PUSH] Push notifications sent successfully");
      } catch (error) {
        logger.debug("[PUSH] Error sending to all devices:", error);
      }
    })();
  }
}

class ApiClient {
  static async create(credential) {
    return new ApiClient(credential);
  }
  credential;
  pushClient;
  constructor(credential) {
    this.credential = credential;
    this.pushClient = new PushNotificationClient(credential.token, configuration.serverUrl);
  }
  /**
   * Create a new session or load existing one with the given tag
   */
  async getOrCreateSession(opts) {
    let dataEncryptionKey = null;
    let encryptionKey;
    let encryptionVariant;
    if (this.credential.encryption.type === "dataKey") {
      encryptionKey = getRandomBytes(32);
      encryptionVariant = "dataKey";
      let encryptedDataKey = libsodiumEncryptForPublicKey(encryptionKey, this.credential.encryption.publicKey);
      dataEncryptionKey = new Uint8Array(encryptedDataKey.length + 1);
      dataEncryptionKey.set([0], 0);
      dataEncryptionKey.set(encryptedDataKey, 1);
    } else {
      encryptionKey = this.credential.encryption.secret;
      encryptionVariant = "legacy";
    }
    try {
      const response = await httpClient.post(
        `${configuration.serverUrl}/v1/sessions`,
        {
          tag: opts.tag,
          metadata: encodeBase64(encrypt(encryptionKey, encryptionVariant, opts.metadata)),
          agentState: opts.state ? encodeBase64(encrypt(encryptionKey, encryptionVariant, opts.state)) : null,
          dataEncryptionKey: dataEncryptionKey ? encodeBase64(dataEncryptionKey) : null
        },
        {
          headers: getAuthHeaders(this.credential.token),
          timeout: 6e4
          // 1 minute timeout for very bad network connections
        }
      );
      logger.debug(`Session created/loaded: ${response.data.session.id} (tag: ${opts.tag})`);
      let raw = response.data.session;
      let session = {
        id: raw.id,
        seq: raw.seq,
        metadata: decrypt(encryptionKey, encryptionVariant, decodeBase64(raw.metadata)),
        metadataVersion: raw.metadataVersion,
        agentState: raw.agentState ? decrypt(encryptionKey, encryptionVariant, decodeBase64(raw.agentState)) : null,
        agentStateVersion: raw.agentStateVersion,
        encryptionKey,
        encryptionVariant
      };
      return session;
    } catch (error) {
      logger.debug("[API] [ERROR] Failed to get or create session:", error);
      throw new Error(`Failed to get or create session: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
  /**
   * Register or update machine with the server
   * Returns the current machine state from the server with decrypted metadata and daemonState
   */
  async getOrCreateMachine(opts) {
    let dataEncryptionKey = null;
    let encryptionKey;
    let encryptionVariant;
    if (this.credential.encryption.type === "dataKey") {
      encryptionVariant = "dataKey";
      encryptionKey = this.credential.encryption.machineKey;
      let encryptedDataKey = libsodiumEncryptForPublicKey(this.credential.encryption.machineKey, this.credential.encryption.publicKey);
      dataEncryptionKey = new Uint8Array(encryptedDataKey.length + 1);
      dataEncryptionKey.set([0], 0);
      dataEncryptionKey.set(encryptedDataKey, 1);
    } else {
      encryptionKey = this.credential.encryption.secret;
      encryptionVariant = "legacy";
    }
    const response = await httpClient.post(
      `${configuration.serverUrl}/v1/machines`,
      {
        id: opts.machineId,
        metadata: encodeBase64(encrypt(encryptionKey, encryptionVariant, opts.metadata)),
        daemonState: opts.daemonState ? encodeBase64(encrypt(encryptionKey, encryptionVariant, opts.daemonState)) : void 0,
        dataEncryptionKey: dataEncryptionKey ? encodeBase64(dataEncryptionKey) : void 0
      },
      {
        headers: getAuthHeaders(this.credential.token),
        timeout: 6e4
        // 1 minute timeout for very bad network connections
      }
    );
    if (response.status !== 200) {
      console.error(chalk.red(`[API] Failed to create machine: ${response.statusText}`));
      console.log(chalk.yellow(`[API] Failed to create machine: ${response.statusText}, most likely you have re-authenticated, but you still have a machine associated with the old account. Now we are trying to re-associate the machine with the new account. That is not allowed. Please run 'happy doctor clean' to clean up your happy state, and try your original command again. Please create an issue on github if this is causing you problems. We apologize for the inconvenience.`));
      process.exit(1);
    }
    const raw = response.data.machine;
    logger.debug(`[API] Machine ${opts.machineId} registered/updated with server`);
    const machine = {
      id: raw.id,
      encryptionKey,
      encryptionVariant,
      metadata: raw.metadata ? decrypt(encryptionKey, encryptionVariant, decodeBase64(raw.metadata)) : null,
      metadataVersion: raw.metadataVersion || 0,
      daemonState: raw.daemonState ? decrypt(encryptionKey, encryptionVariant, decodeBase64(raw.daemonState)) : null,
      daemonStateVersion: raw.daemonStateVersion || 0
    };
    return machine;
  }
  sessionSyncClient(session) {
    return new ApiSessionClient(this.credential.token, session);
  }
  machineSyncClient(machine) {
    return new ApiMachineClient(this.credential.token, machine);
  }
  push() {
    return this.pushClient;
  }
  /**
   * Register a vendor API token with the server
   * The token is sent as a JSON string - server handles encryption
   */
  async registerVendorToken(vendor, apiKey) {
    try {
      const response = await httpClient.post(
        `${configuration.serverUrl}/v1/connect/${vendor}/register`,
        {
          token: JSON.stringify(apiKey)
        },
        {
          headers: getAuthHeaders(this.credential.token),
          timeout: 5e3
        }
      );
      if (response.status !== 200 && response.status !== 201) {
        throw new Error(`Server returned status ${response.status}`);
      }
      logger.debug(`[API] Vendor token for ${vendor} registered successfully`);
    } catch (error) {
      logger.debug(`[API] [ERROR] Failed to register vendor token:`, error);
      throw new Error(`Failed to register vendor token: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
  /**
   * Get vendor API token from the server
   * Returns the token if it exists, null otherwise
   */
  async getVendorToken(vendor) {
    try {
      const response = await httpClient.get(
        `${configuration.serverUrl}/v1/connect/${vendor}/token`,
        {
          headers: getAuthHeaders(this.credential.token),
          timeout: 5e3
        }
      );
      if (response.status === 404) {
        logger.debug(`[API] No vendor token found for ${vendor}`);
        return null;
      }
      if (response.status !== 200) {
        throw new Error(`Server returned status ${response.status}`);
      }
      logger.debug(`[API] Raw vendor token response:`, {
        status: response.status,
        dataKeys: Object.keys(response.data || {}),
        hasToken: "token" in (response.data || {}),
        tokenType: typeof response.data?.token
      });
      let tokenData = null;
      if (response.data?.token) {
        if (typeof response.data.token === "string") {
          try {
            tokenData = JSON.parse(response.data.token);
          } catch (parseError) {
            logger.debug(`[API] Failed to parse token as JSON, using as string:`, parseError);
            tokenData = response.data.token;
          }
        } else if (response.data.token !== null) {
          tokenData = response.data.token;
        } else {
          logger.debug(`[API] Token is null for ${vendor}, treating as not found`);
          return null;
        }
      } else if (response.data && typeof response.data === "object") {
        if (response.data.token === null && Object.keys(response.data).length === 1) {
          logger.debug(`[API] Response contains only null token for ${vendor}, treating as not found`);
          return null;
        }
        tokenData = response.data;
      }
      if (tokenData === null || tokenData && typeof tokenData === "object" && tokenData.token === null && Object.keys(tokenData).length === 1) {
        logger.debug(`[API] Token data is null for ${vendor}`);
        return null;
      }
      logger.debug(`[API] Vendor token for ${vendor} retrieved successfully`, {
        tokenDataType: typeof tokenData,
        tokenDataKeys: tokenData && typeof tokenData === "object" ? Object.keys(tokenData) : "not an object"
      });
      return tokenData;
    } catch (error) {
      if (error.response?.status === 404) {
        logger.debug(`[API] No vendor token found for ${vendor}`);
        return null;
      }
      logger.debug(`[API] [ERROR] Failed to get vendor token:`, error);
      return null;
    }
  }
}

const UsageSchema = z.z.object({
  input_tokens: z.z.number().int().nonnegative(),
  cache_creation_input_tokens: z.z.number().int().nonnegative().optional(),
  cache_read_input_tokens: z.z.number().int().nonnegative().optional(),
  output_tokens: z.z.number().int().nonnegative(),
  service_tier: z.z.string().optional()
}).passthrough();
const RawJSONLinesSchema = z.z.discriminatedUnion("type", [
  // User message - validates uuid and message.content
  z.z.object({
    type: z.z.literal("user"),
    isSidechain: z.z.boolean().optional(),
    isMeta: z.z.boolean().optional(),
    uuid: z.z.string(),
    // Used in getMessageKey()
    message: z.z.object({
      content: z.z.union([z.z.string(), z.z.any()])
      // Used in sessionScanner.ts
    }).passthrough()
  }).passthrough(),
  // Assistant message - only validates uuid and type
  // message object is optional to handle synthetic error messages (isApiErrorMessage: true)
  // which may have different structure than normal assistant messages
  z.z.object({
    uuid: z.z.string(),
    type: z.z.literal("assistant"),
    message: z.z.object({
      usage: UsageSchema.optional()
      // Used in apiSession.ts
    }).passthrough().optional()
  }).passthrough(),
  // Summary message - validates summary and leafUuid
  z.z.object({
    type: z.z.literal("summary"),
    summary: z.z.string(),
    // Used in apiSession.ts
    leafUuid: z.z.string()
    // Used in getMessageKey()
  }).passthrough(),
  // System message - validates uuid
  z.z.object({
    type: z.z.literal("system"),
    uuid: z.z.string()
    // Used in getMessageKey()
  }).passthrough()
]);

exports.ApiClient = ApiClient;
exports.ApiKeyAuthError = ApiKeyAuthError;
exports.ApiSessionClient = ApiSessionClient;
exports.AsyncLock = AsyncLock;
exports.RawJSONLinesSchema = RawJSONLinesSchema;
exports.acquireDaemonLock = acquireDaemonLock;
exports.backoff = backoff;
exports.clearCredentials = clearCredentials;
exports.clearDaemonState = clearDaemonState;
exports.clearMachineId = clearMachineId;
exports.configuration = configuration;
exports.decodeBase64 = decodeBase64;
exports.delay = delay;
exports.encodeBase64 = encodeBase64;
exports.encodeBase64Url = encodeBase64Url;
exports.getLatestDaemonLog = getLatestDaemonLog;
exports.httpClient = httpClient;
exports.logger = logger;
exports.packageJson = packageJson;
exports.projectPath = projectPath;
exports.readCredentials = readCredentials;
exports.readDaemonState = readDaemonState;
exports.readSettings = readSettings;
exports.releaseDaemonLock = releaseDaemonLock;
exports.updateSettings = updateSettings;
exports.writeCredentialsDataKey = writeCredentialsDataKey;
exports.writeCredentialsLegacy = writeCredentialsLegacy;
exports.writeDaemonState = writeDaemonState;
