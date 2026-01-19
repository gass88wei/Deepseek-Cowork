'use strict';

var chalk = require('chalk');
var os = require('node:os');
var node_crypto = require('node:crypto');
var types = require('./types-BMTKmjau.cjs');
var node_child_process = require('node:child_process');
var node_path = require('node:path');
var node_readline = require('node:readline');
var fs = require('node:fs');
var promises = require('node:fs/promises');
var fs$1 = require('fs/promises');
var ink = require('ink');
var React = require('react');
var node_url = require('node:url');
require('node:events');
require('socket.io-client');
var tweetnacl = require('tweetnacl');
require('expo-server-sdk');
var crypto = require('crypto');
var child_process = require('child_process');
var fs$2 = require('fs');
var path = require('path');
var psList = require('ps-list');
var spawn = require('cross-spawn');
var os$1 = require('os');
var tmp = require('tmp');
var qrcode = require('qrcode-terminal');
var open = require('open');
var fastify = require('fastify');
var z = require('zod');
var fastifyTypeProviderZod = require('fastify-type-provider-zod');
var mcp_js = require('@modelcontextprotocol/sdk/server/mcp.js');
var node_http = require('node:http');
var streamableHttp_js = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
var http = require('http');
var util = require('util');

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

var tmp__namespace = /*#__PURE__*/_interopNamespaceDefault(tmp);

class Session {
  path;
  logPath;
  api;
  client;
  queue;
  claudeEnvVars;
  claudeArgs;
  // Made mutable to allow filtering
  mcpServers;
  allowedTools;
  _onModeChange;
  /** Path to temporary settings file with SessionStart hook (required for session tracking) */
  hookSettingsPath;
  sessionId;
  mode = "local";
  thinking = false;
  /** Callbacks to be notified when session ID is found/changed */
  sessionFoundCallbacks = [];
  /** Keep alive interval reference for cleanup */
  keepAliveInterval;
  constructor(opts) {
    this.path = opts.path;
    this.api = opts.api;
    this.client = opts.client;
    this.logPath = opts.logPath;
    this.sessionId = opts.sessionId;
    this.queue = opts.messageQueue;
    this.claudeEnvVars = opts.claudeEnvVars;
    this.claudeArgs = opts.claudeArgs;
    this.mcpServers = opts.mcpServers;
    this.allowedTools = opts.allowedTools;
    this._onModeChange = opts.onModeChange;
    this.hookSettingsPath = opts.hookSettingsPath;
    this.client.keepAlive(this.thinking, this.mode);
    this.keepAliveInterval = setInterval(() => {
      this.client.keepAlive(this.thinking, this.mode);
    }, 2e3);
  }
  /**
   * Cleanup resources (call when session is no longer needed)
   */
  cleanup = () => {
    clearInterval(this.keepAliveInterval);
    this.sessionFoundCallbacks = [];
    types.logger.debug("[Session] Cleaned up resources");
  };
  onThinkingChange = (thinking) => {
    this.thinking = thinking;
    this.client.keepAlive(thinking, this.mode);
  };
  onModeChange = (mode) => {
    this.mode = mode;
    this.client.keepAlive(this.thinking, mode);
    this._onModeChange(mode);
  };
  /**
   * Called when Claude session ID is discovered or changed.
   * 
   * This is triggered by the SessionStart hook when:
   * - Claude starts a new session (fresh start)
   * - Claude resumes a session (--continue, --resume flags)
   * - Claude forks a session (/compact, double-escape fork)
   * 
   * Updates internal state, syncs to API metadata, and notifies
   * all registered callbacks (e.g., SessionScanner) about the change.
   */
  onSessionFound = (sessionId) => {
    this.sessionId = sessionId;
    this.client.updateMetadata((metadata) => ({
      ...metadata,
      claudeSessionId: sessionId
    }));
    types.logger.debug(`[Session] Claude Code session ID ${sessionId} added to metadata`);
    for (const callback of this.sessionFoundCallbacks) {
      callback(sessionId);
    }
  };
  /**
   * Register a callback to be notified when session ID is found/changed
   */
  addSessionFoundCallback = (callback) => {
    this.sessionFoundCallbacks.push(callback);
  };
  /**
   * Remove a session found callback
   */
  removeSessionFoundCallback = (callback) => {
    const index = this.sessionFoundCallbacks.indexOf(callback);
    if (index !== -1) {
      this.sessionFoundCallbacks.splice(index, 1);
    }
  };
  /**
   * Clear the current session ID (used by /clear command)
   */
  clearSessionId = () => {
    this.sessionId = null;
    types.logger.debug("[Session] Session ID cleared");
  };
  /**
   * Consume one-time Claude flags from claudeArgs after Claude spawn
   * Handles: --resume (with or without session ID), --continue
   */
  consumeOneTimeFlags = () => {
    if (!this.claudeArgs) return;
    const filteredArgs = [];
    for (let i = 0; i < this.claudeArgs.length; i++) {
      const arg = this.claudeArgs[i];
      if (arg === "--continue") {
        types.logger.debug("[Session] Consumed --continue flag");
        continue;
      }
      if (arg === "--resume") {
        if (i + 1 < this.claudeArgs.length) {
          const nextArg = this.claudeArgs[i + 1];
          if (!nextArg.startsWith("-") && nextArg.includes("-")) {
            i++;
            types.logger.debug(`[Session] Consumed --resume flag with session ID: ${nextArg}`);
          } else {
            types.logger.debug("[Session] Consumed --resume flag (no session ID)");
          }
        } else {
          types.logger.debug("[Session] Consumed --resume flag (no session ID)");
        }
        continue;
      }
      filteredArgs.push(arg);
    }
    this.claudeArgs = filteredArgs.length > 0 ? filteredArgs : void 0;
    types.logger.debug(`[Session] Consumed one-time flags, remaining args:`, this.claudeArgs);
  };
}

function getProjectPath(workingDirectory) {
  const projectId = node_path.resolve(workingDirectory).replace(/[\\\/\.:]/g, "-");
  const claudeConfigDir = process.env.CLAUDE_CONFIG_DIR || node_path.join(os.homedir(), ".claude");
  return node_path.join(claudeConfigDir, "projects", projectId);
}

function claudeCheckSession(sessionId, path) {
  const projectDir = getProjectPath(path);
  const sessionFile = node_path.join(projectDir, `${sessionId}.jsonl`);
  const sessionExists = fs.existsSync(sessionFile);
  if (!sessionExists) {
    types.logger.debug(`[claudeCheckSession] Path ${sessionFile} does not exist`);
    return false;
  }
  const sessionData = fs.readFileSync(sessionFile, "utf-8").split("\n");
  const hasGoodMessage = !!sessionData.find((v) => {
    try {
      return typeof JSON.parse(v).uuid === "string";
    } catch (e) {
      return false;
    }
  });
  return hasGoodMessage;
}

function trimIdent(text) {
  const lines = text.split("\n");
  while (lines.length > 0 && lines[0].trim() === "") {
    lines.shift();
  }
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
    lines.pop();
  }
  const minSpaces = lines.reduce((min, line) => {
    if (line.trim() === "") {
      return min;
    }
    const leadingSpaces = line.match(/^\s*/)[0].length;
    return Math.min(min, leadingSpaces);
  }, Infinity);
  const trimmedLines = lines.map((line) => line.slice(minSpaces));
  return trimmedLines.join("\n");
}

function getClaudeSettingsPath() {
  const claudeConfigDir = process.env.CLAUDE_CONFIG_DIR || node_path.join(os.homedir(), ".claude");
  return node_path.join(claudeConfigDir, "settings.json");
}
function readClaudeSettings() {
  try {
    const settingsPath = getClaudeSettingsPath();
    if (!fs.existsSync(settingsPath)) {
      types.logger.debug(`[ClaudeSettings] No Claude settings file found at ${settingsPath}`);
      return null;
    }
    const settingsContent = fs.readFileSync(settingsPath, "utf-8");
    const settings = JSON.parse(settingsContent);
    types.logger.debug(`[ClaudeSettings] Successfully read Claude settings from ${settingsPath}`);
    types.logger.debug(`[ClaudeSettings] includeCoAuthoredBy: ${settings.includeCoAuthoredBy}`);
    return settings;
  } catch (error) {
    types.logger.debug(`[ClaudeSettings] Error reading Claude settings: ${error}`);
    return null;
  }
}
function shouldIncludeCoAuthoredBy() {
  const settings = readClaudeSettings();
  if (!settings || settings.includeCoAuthoredBy === void 0) {
    return true;
  }
  return settings.includeCoAuthoredBy;
}

const BASE_SYSTEM_PROMPT = (() => trimIdent(`
    ALWAYS when you start a new chat - you must call a tool "mcp__happy__change_title" to set a chat title. When you think chat title is not relevant anymore - call the tool again to change it. When chat name is too generic and you have a change to make it more specific - call the tool again to change it. This title is needed to easily find the chat in the future. Help human.
`))();
const CO_AUTHORED_CREDITS = (() => trimIdent(`
    When making commit messages, instead of just giving co-credit to Claude, also give credit to Happy like so:

    <main commit message>

    Generated with [Claude Code](https://claude.ai/code)
    via [Happy](https://happy.engineering)

    Co-Authored-By: Claude <noreply@anthropic.com>
    Co-Authored-By: Happy <yesreply@happy.engineering>
`))();
const systemPrompt = (() => {
  const includeCoAuthored = shouldIncludeCoAuthoredBy();
  if (includeCoAuthored) {
    return BASE_SYSTEM_PROMPT + "\n\n" + CO_AUTHORED_CREDITS;
  } else {
    return BASE_SYSTEM_PROMPT;
  }
})();

const claudeCliPath = node_path.resolve(node_path.join(types.projectPath(), "scripts", "claude_local_launcher.cjs"));
async function claudeLocal(opts) {
  const projectDir = getProjectPath(opts.path);
  fs.mkdirSync(projectDir, { recursive: true });
  const hasContinueFlag = opts.claudeArgs?.includes("--continue");
  const hasResumeFlag = opts.claudeArgs?.includes("--resume");
  const hasUserSessionControl = hasContinueFlag || hasResumeFlag;
  let startFrom = opts.sessionId;
  if (opts.sessionId && !claudeCheckSession(opts.sessionId, opts.path)) {
    startFrom = null;
  }
  if (startFrom) {
    types.logger.debug(`[ClaudeLocal] Will resume existing session: ${startFrom}`);
  } else if (hasUserSessionControl) {
    types.logger.debug(`[ClaudeLocal] User passed ${hasContinueFlag ? "--continue" : "--resume"} flag, session ID will be determined by hook`);
  } else {
    types.logger.debug(`[ClaudeLocal] Fresh start, session ID will be provided by hook`);
  }
  let thinking = false;
  let stopThinkingTimeout = null;
  const updateThinking = (newThinking) => {
    if (thinking !== newThinking) {
      thinking = newThinking;
      types.logger.debug(`[ClaudeLocal] Thinking state changed to: ${thinking}`);
      if (opts.onThinkingChange) {
        opts.onThinkingChange(thinking);
      }
    }
  };
  try {
    process.stdin.pause();
    await new Promise((r, reject) => {
      const args = [];
      if (!hasUserSessionControl && startFrom) {
        args.push("--resume", startFrom);
      }
      args.push("--append-system-prompt", systemPrompt);
      if (opts.mcpServers && Object.keys(opts.mcpServers).length > 0) {
        args.push("--mcp-config", JSON.stringify({ mcpServers: opts.mcpServers }));
      }
      if (opts.allowedTools && opts.allowedTools.length > 0) {
        args.push("--allowedTools", opts.allowedTools.join(","));
      }
      if (opts.claudeArgs) {
        args.push(...opts.claudeArgs);
      }
      args.push("--settings", opts.hookSettingsPath);
      types.logger.debug(`[ClaudeLocal] Using hook settings: ${opts.hookSettingsPath}`);
      if (!claudeCliPath || !fs.existsSync(claudeCliPath)) {
        throw new Error("Claude local launcher not found. Please ensure HAPPY_PROJECT_ROOT is set correctly for development.");
      }
      const env = {
        ...process.env,
        ...opts.claudeEnvVars
      };
      types.logger.debug(`[ClaudeLocal] Spawning launcher: ${claudeCliPath}`);
      types.logger.debug(`[ClaudeLocal] Args: ${JSON.stringify(args)}`);
      const child = node_child_process.spawn("node", [claudeCliPath, ...args], {
        stdio: ["inherit", "inherit", "inherit", "pipe"],
        signal: opts.abort,
        cwd: opts.path,
        env
      });
      if (child.stdio[3]) {
        const rl = node_readline.createInterface({
          input: child.stdio[3],
          crlfDelay: Infinity
        });
        const activeFetches = /* @__PURE__ */ new Map();
        rl.on("line", (line) => {
          try {
            const message = JSON.parse(line);
            switch (message.type) {
              case "fetch-start":
                activeFetches.set(message.id, {
                  hostname: message.hostname,
                  path: message.path,
                  startTime: message.timestamp
                });
                if (stopThinkingTimeout) {
                  clearTimeout(stopThinkingTimeout);
                  stopThinkingTimeout = null;
                }
                updateThinking(true);
                break;
              case "fetch-end":
                activeFetches.delete(message.id);
                if (activeFetches.size === 0 && thinking && !stopThinkingTimeout) {
                  stopThinkingTimeout = setTimeout(() => {
                    if (activeFetches.size === 0) {
                      updateThinking(false);
                    }
                    stopThinkingTimeout = null;
                  }, 500);
                }
                break;
              default:
                types.logger.debug(`[ClaudeLocal] Unknown message type: ${message.type}`);
            }
          } catch (e) {
            types.logger.debug(`[ClaudeLocal] Non-JSON line from fd3: ${line}`);
          }
        });
        rl.on("error", (err) => {
          console.error("Error reading from fd 3:", err);
        });
        child.on("exit", () => {
          if (stopThinkingTimeout) {
            clearTimeout(stopThinkingTimeout);
          }
          updateThinking(false);
        });
      }
      child.on("error", (error) => {
      });
      child.on("exit", (code, signal) => {
        if (signal === "SIGTERM" && opts.abort.aborted) {
          r();
        } else if (signal) {
          reject(new Error(`Process terminated with signal: ${signal}`));
        } else {
          r();
        }
      });
    });
  } finally {
    process.stdin.resume();
    if (stopThinkingTimeout) {
      clearTimeout(stopThinkingTimeout);
      stopThinkingTimeout = null;
    }
    updateThinking(false);
  }
  return startFrom;
}

class Future {
  _resolve;
  _reject;
  _promise;
  constructor() {
    this._promise = new Promise((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
    });
  }
  resolve(value) {
    this._resolve(value);
  }
  reject(reason) {
    this._reject(reason);
  }
  get promise() {
    return this._promise;
  }
}

class InvalidateSync {
  _invalidated = false;
  _invalidatedDouble = false;
  _stopped = false;
  _command;
  _pendings = [];
  constructor(command) {
    this._command = command;
  }
  invalidate() {
    if (this._stopped) {
      return;
    }
    if (!this._invalidated) {
      this._invalidated = true;
      this._invalidatedDouble = false;
      this._doSync();
    } else {
      if (!this._invalidatedDouble) {
        this._invalidatedDouble = true;
      }
    }
  }
  async invalidateAndAwait() {
    if (this._stopped) {
      return;
    }
    await new Promise((resolve) => {
      this._pendings.push(resolve);
      this.invalidate();
    });
  }
  stop() {
    if (this._stopped) {
      return;
    }
    this._notifyPendings();
    this._stopped = true;
  }
  _notifyPendings = () => {
    for (let pending of this._pendings) {
      pending();
    }
    this._pendings = [];
  };
  _doSync = async () => {
    await types.backoff(async () => {
      if (this._stopped) {
        return;
      }
      await this._command();
    });
    if (this._stopped) {
      this._notifyPendings();
      return;
    }
    if (this._invalidatedDouble) {
      this._invalidatedDouble = false;
      this._doSync();
    } else {
      this._invalidated = false;
      this._notifyPendings();
    }
  };
}

function startFileWatcher(file, onFileChange) {
  const abortController = new AbortController();
  void (async () => {
    while (true) {
      try {
        types.logger.debug(`[FILE_WATCHER] Starting watcher for ${file}`);
        const watcher = fs$1.watch(file, { persistent: true, signal: abortController.signal });
        for await (const event of watcher) {
          if (abortController.signal.aborted) {
            return;
          }
          types.logger.debug(`[FILE_WATCHER] File changed: ${file}`);
          onFileChange(file);
        }
      } catch (e) {
        if (abortController.signal.aborted) {
          return;
        }
        types.logger.debug(`[FILE_WATCHER] Watch error: ${e.message}, restarting watcher in a second`);
        await types.delay(1e3);
      }
    }
  })();
  return () => {
    abortController.abort();
  };
}

const INTERNAL_CLAUDE_EVENT_TYPES = /* @__PURE__ */ new Set([
  "file-history-snapshot",
  "change",
  "queue-operation"
]);
async function createSessionScanner(opts) {
  const projectDir = getProjectPath(opts.workingDirectory);
  let finishedSessions = /* @__PURE__ */ new Set();
  let pendingSessions = /* @__PURE__ */ new Set();
  let currentSessionId = null;
  let watchers = /* @__PURE__ */ new Map();
  let processedMessageKeys = /* @__PURE__ */ new Set();
  if (opts.sessionId) {
    let messages = await readSessionLog(projectDir, opts.sessionId);
    types.logger.debug(`[SESSION_SCANNER] Marking ${messages.length} existing messages as processed from session ${opts.sessionId}`);
    for (let m of messages) {
      processedMessageKeys.add(messageKey(m));
    }
    currentSessionId = opts.sessionId;
  }
  const sync = new InvalidateSync(async () => {
    let sessions = [];
    for (let p of pendingSessions) {
      sessions.push(p);
    }
    if (currentSessionId && !pendingSessions.has(currentSessionId)) {
      sessions.push(currentSessionId);
    }
    for (let [sessionId] of watchers) {
      if (!sessions.includes(sessionId)) {
        sessions.push(sessionId);
      }
    }
    for (let session of sessions) {
      const sessionMessages = await readSessionLog(projectDir, session);
      let skipped = 0;
      let sent = 0;
      for (let file of sessionMessages) {
        let key = messageKey(file);
        if (processedMessageKeys.has(key)) {
          skipped++;
          continue;
        }
        processedMessageKeys.add(key);
        types.logger.debug(`[SESSION_SCANNER] Sending new message: type=${file.type}, uuid=${file.type === "summary" ? file.leafUuid : file.uuid}`);
        opts.onMessage(file);
        sent++;
      }
      if (sessionMessages.length > 0) {
        types.logger.debug(`[SESSION_SCANNER] Session ${session}: found=${sessionMessages.length}, skipped=${skipped}, sent=${sent}`);
      }
    }
    for (let p of sessions) {
      if (pendingSessions.has(p)) {
        pendingSessions.delete(p);
        finishedSessions.add(p);
      }
    }
    for (let p of sessions) {
      if (!watchers.has(p)) {
        types.logger.debug(`[SESSION_SCANNER] Starting watcher for session: ${p}`);
        watchers.set(p, startFileWatcher(node_path.join(projectDir, `${p}.jsonl`), () => {
          sync.invalidate();
        }));
      }
    }
  });
  await sync.invalidateAndAwait();
  const intervalId = setInterval(() => {
    sync.invalidate();
  }, 3e3);
  return {
    cleanup: async () => {
      clearInterval(intervalId);
      for (let w of watchers.values()) {
        w();
      }
      watchers.clear();
      await sync.invalidateAndAwait();
      sync.stop();
    },
    onNewSession: (sessionId) => {
      if (currentSessionId === sessionId) {
        types.logger.debug(`[SESSION_SCANNER] New session: ${sessionId} is the same as the current session, skipping`);
        return;
      }
      if (finishedSessions.has(sessionId)) {
        types.logger.debug(`[SESSION_SCANNER] New session: ${sessionId} is already finished, skipping`);
        return;
      }
      if (pendingSessions.has(sessionId)) {
        types.logger.debug(`[SESSION_SCANNER] New session: ${sessionId} is already pending, skipping`);
        return;
      }
      if (currentSessionId) {
        pendingSessions.add(currentSessionId);
      }
      types.logger.debug(`[SESSION_SCANNER] New session: ${sessionId}`);
      currentSessionId = sessionId;
      sync.invalidate();
    }
  };
}
function messageKey(message) {
  if (message.type === "user") {
    return message.uuid;
  } else if (message.type === "assistant") {
    return message.uuid;
  } else if (message.type === "summary") {
    return "summary: " + message.leafUuid + ": " + message.summary;
  } else if (message.type === "system") {
    return message.uuid;
  } else {
    throw Error();
  }
}
async function readSessionLog(projectDir, sessionId) {
  const expectedSessionFile = node_path.join(projectDir, `${sessionId}.jsonl`);
  types.logger.debug(`[SESSION_SCANNER] Reading session file: ${expectedSessionFile}`);
  let file;
  try {
    file = await promises.readFile(expectedSessionFile, "utf-8");
  } catch (error) {
    types.logger.debug(`[SESSION_SCANNER] Session file not found: ${expectedSessionFile}`);
    return [];
  }
  let lines = file.split("\n");
  let messages = [];
  for (let l of lines) {
    try {
      if (l.trim() === "") {
        continue;
      }
      let message = JSON.parse(l);
      if (message.type && INTERNAL_CLAUDE_EVENT_TYPES.has(message.type)) {
        continue;
      }
      let parsed = types.RawJSONLinesSchema.safeParse(message);
      if (!parsed.success) {
        continue;
      }
      messages.push(parsed.data);
    } catch (e) {
      types.logger.debug(`[SESSION_SCANNER] Error processing message: ${e}`);
      continue;
    }
  }
  return messages;
}

async function claudeLocalLauncher(session) {
  const scanner = await createSessionScanner({
    sessionId: session.sessionId,
    workingDirectory: session.path,
    onMessage: (message) => {
      if (message.type !== "summary") {
        session.client.sendClaudeSessionMessage(message);
      }
    }
  });
  const scannerSessionCallback = (sessionId) => {
    scanner.onNewSession(sessionId);
  };
  session.addSessionFoundCallback(scannerSessionCallback);
  let exitReason = null;
  const processAbortController = new AbortController();
  let exutFuture = new Future();
  try {
    async function abort() {
      if (!processAbortController.signal.aborted) {
        processAbortController.abort();
      }
      await exutFuture.promise;
    }
    async function doAbort() {
      types.logger.debug("[local]: doAbort");
      if (!exitReason) {
        exitReason = "switch";
      }
      session.queue.reset();
      await abort();
    }
    async function doSwitch() {
      types.logger.debug("[local]: doSwitch");
      if (!exitReason) {
        exitReason = "switch";
      }
      await abort();
    }
    session.client.rpcHandlerManager.registerHandler("abort", doAbort);
    session.client.rpcHandlerManager.registerHandler("switch", doSwitch);
    session.queue.setOnMessage((message, mode) => {
      doSwitch();
    });
    if (session.queue.size() > 0) {
      return "switch";
    }
    const handleSessionStart = (sessionId) => {
      session.onSessionFound(sessionId);
      scanner.onNewSession(sessionId);
    };
    while (true) {
      if (exitReason) {
        return exitReason;
      }
      types.logger.debug("[local]: launch");
      try {
        await claudeLocal({
          path: session.path,
          sessionId: session.sessionId,
          onSessionFound: handleSessionStart,
          onThinkingChange: session.onThinkingChange,
          abort: processAbortController.signal,
          claudeEnvVars: session.claudeEnvVars,
          claudeArgs: session.claudeArgs,
          mcpServers: session.mcpServers,
          allowedTools: session.allowedTools,
          hookSettingsPath: session.hookSettingsPath
        });
        session.consumeOneTimeFlags();
        if (!exitReason) {
          exitReason = "exit";
          break;
        }
      } catch (e) {
        types.logger.debug("[local]: launch error", e);
        if (!exitReason) {
          session.client.sendSessionEvent({ type: "message", message: "Process exited unexpectedly" });
          continue;
        } else {
          break;
        }
      }
      types.logger.debug("[local]: launch done");
    }
  } finally {
    exutFuture.resolve(void 0);
    session.client.rpcHandlerManager.registerHandler("abort", async () => {
    });
    session.client.rpcHandlerManager.registerHandler("switch", async () => {
    });
    session.queue.setOnMessage(null);
    session.removeSessionFoundCallback(scannerSessionCallback);
    await scanner.cleanup();
  }
  return exitReason || "exit";
}

class MessageBuffer {
  messages = [];
  listeners = [];
  nextId = 1;
  addMessage(content, type = "assistant") {
    const message = {
      id: `msg-${this.nextId++}`,
      timestamp: /* @__PURE__ */ new Date(),
      content,
      type
    };
    this.messages.push(message);
    this.notifyListeners();
  }
  /**
   * Update the last message of a specific type by appending content to it
   * Useful for streaming responses where deltas should accumulate in one message
   */
  updateLastMessage(contentDelta, type = "assistant") {
    for (let i = this.messages.length - 1; i >= 0; i--) {
      if (this.messages[i].type === type) {
        const oldMessage = this.messages[i];
        const updatedMessage = {
          ...oldMessage,
          content: oldMessage.content + contentDelta
        };
        this.messages[i] = updatedMessage;
        this.notifyListeners();
        return;
      }
    }
    this.addMessage(contentDelta, type);
  }
  /**
   * Remove the last message of a specific type
   * Useful for removing placeholder messages like "Thinking..." when actual response starts
   */
  removeLastMessage(type) {
    for (let i = this.messages.length - 1; i >= 0; i--) {
      if (this.messages[i].type === type) {
        this.messages.splice(i, 1);
        this.notifyListeners();
        return true;
      }
    }
    return false;
  }
  getMessages() {
    return [...this.messages];
  }
  clear() {
    this.messages = [];
    this.nextId = 1;
    this.notifyListeners();
  }
  onUpdate(listener) {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }
  notifyListeners() {
    const messages = this.getMessages();
    this.listeners.forEach((listener) => listener(messages));
  }
}

const RemoteModeDisplay = ({ messageBuffer, logPath, onExit, onSwitchToLocal }) => {
  const [messages, setMessages] = React.useState([]);
  const [confirmationMode, setConfirmationMode] = React.useState(null);
  const [actionInProgress, setActionInProgress] = React.useState(null);
  const confirmationTimeoutRef = React.useRef(null);
  const { stdout } = ink.useStdout();
  const terminalWidth = stdout.columns || 80;
  const terminalHeight = stdout.rows || 24;
  React.useEffect(() => {
    setMessages(messageBuffer.getMessages());
    const unsubscribe = messageBuffer.onUpdate((newMessages) => {
      setMessages(newMessages);
    });
    return () => {
      unsubscribe();
      if (confirmationTimeoutRef.current) {
        clearTimeout(confirmationTimeoutRef.current);
      }
    };
  }, [messageBuffer]);
  const resetConfirmation = React.useCallback(() => {
    setConfirmationMode(null);
    if (confirmationTimeoutRef.current) {
      clearTimeout(confirmationTimeoutRef.current);
      confirmationTimeoutRef.current = null;
    }
  }, []);
  const setConfirmationWithTimeout = React.useCallback((mode) => {
    setConfirmationMode(mode);
    if (confirmationTimeoutRef.current) {
      clearTimeout(confirmationTimeoutRef.current);
    }
    confirmationTimeoutRef.current = setTimeout(() => {
      resetConfirmation();
    }, 15e3);
  }, [resetConfirmation]);
  ink.useInput(React.useCallback(async (input, key) => {
    if (actionInProgress) return;
    if (key.ctrl && input === "c") {
      if (confirmationMode === "exit") {
        resetConfirmation();
        setActionInProgress("exiting");
        await new Promise((resolve) => setTimeout(resolve, 100));
        onExit?.();
      } else {
        setConfirmationWithTimeout("exit");
      }
      return;
    }
    if (input === " ") {
      if (confirmationMode === "switch") {
        resetConfirmation();
        setActionInProgress("switching");
        await new Promise((resolve) => setTimeout(resolve, 100));
        onSwitchToLocal?.();
      } else {
        setConfirmationWithTimeout("switch");
      }
      return;
    }
    if (confirmationMode) {
      resetConfirmation();
    }
  }, [confirmationMode, actionInProgress, onExit, onSwitchToLocal, setConfirmationWithTimeout, resetConfirmation]));
  const getMessageColor = (type) => {
    switch (type) {
      case "user":
        return "magenta";
      case "assistant":
        return "cyan";
      case "system":
        return "blue";
      case "tool":
        return "yellow";
      case "result":
        return "green";
      case "status":
        return "gray";
      default:
        return "white";
    }
  };
  const formatMessage = (msg) => {
    const lines = msg.content.split("\n");
    const maxLineLength = terminalWidth - 10;
    return lines.map((line) => {
      if (line.length <= maxLineLength) return line;
      const chunks = [];
      for (let i = 0; i < line.length; i += maxLineLength) {
        chunks.push(line.slice(i, i + maxLineLength));
      }
      return chunks.join("\n");
    }).join("\n");
  };
  return /* @__PURE__ */ React.createElement(ink.Box, { flexDirection: "column", width: terminalWidth, height: terminalHeight }, /* @__PURE__ */ React.createElement(
    ink.Box,
    {
      flexDirection: "column",
      width: terminalWidth,
      height: terminalHeight - 4,
      borderStyle: "round",
      borderColor: "gray",
      paddingX: 1,
      overflow: "hidden"
    },
    /* @__PURE__ */ React.createElement(ink.Box, { flexDirection: "column", marginBottom: 1 }, /* @__PURE__ */ React.createElement(ink.Text, { color: "gray", bold: true }, "\u{1F4E1} Remote Mode - Claude Messages"), /* @__PURE__ */ React.createElement(ink.Text, { color: "gray", dimColor: true }, "\u2500".repeat(Math.min(terminalWidth - 4, 60)))),
    /* @__PURE__ */ React.createElement(ink.Box, { flexDirection: "column", height: terminalHeight - 10, overflow: "hidden" }, messages.length === 0 ? /* @__PURE__ */ React.createElement(ink.Text, { color: "gray", dimColor: true }, "Waiting for messages...") : (
      // Show only the last messages that fit in the available space
      messages.slice(-Math.max(1, terminalHeight - 10)).map((msg) => /* @__PURE__ */ React.createElement(ink.Box, { key: msg.id, flexDirection: "column", marginBottom: 1 }, /* @__PURE__ */ React.createElement(ink.Text, { color: getMessageColor(msg.type), dimColor: true }, formatMessage(msg))))
    ))
  ), /* @__PURE__ */ React.createElement(
    ink.Box,
    {
      width: terminalWidth,
      borderStyle: "round",
      borderColor: actionInProgress ? "gray" : confirmationMode === "exit" ? "red" : confirmationMode === "switch" ? "yellow" : "green",
      paddingX: 2,
      justifyContent: "center",
      alignItems: "center",
      flexDirection: "column"
    },
    /* @__PURE__ */ React.createElement(ink.Box, { flexDirection: "column", alignItems: "center" }, actionInProgress === "exiting" ? /* @__PURE__ */ React.createElement(ink.Text, { color: "gray", bold: true }, "Exiting...") : actionInProgress === "switching" ? /* @__PURE__ */ React.createElement(ink.Text, { color: "gray", bold: true }, "Switching to local mode...") : confirmationMode === "exit" ? /* @__PURE__ */ React.createElement(ink.Text, { color: "red", bold: true }, "\u26A0\uFE0F  Press Ctrl-C again to exit completely") : confirmationMode === "switch" ? /* @__PURE__ */ React.createElement(ink.Text, { color: "yellow", bold: true }, "\u23F8\uFE0F  Press space again to switch to local mode") : /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(ink.Text, { color: "green", bold: true }, "\u{1F4F1} Press space to switch to local mode \u2022 Ctrl-C to exit")), process.env.DEBUG && logPath && /* @__PURE__ */ React.createElement(ink.Text, { color: "gray", dimColor: true }, "Debug logs: ", logPath))
  ));
};

class Stream {
  constructor(returned) {
    this.returned = returned;
  }
  queue = [];
  readResolve;
  readReject;
  isDone = false;
  hasError;
  started = false;
  /**
   * Implements async iterable protocol
   */
  [Symbol.asyncIterator]() {
    if (this.started) {
      throw new Error("Stream can only be iterated once");
    }
    this.started = true;
    return this;
  }
  /**
   * Gets the next value from the stream
   */
  async next() {
    if (this.queue.length > 0) {
      return Promise.resolve({
        done: false,
        value: this.queue.shift()
      });
    }
    if (this.isDone) {
      return Promise.resolve({ done: true, value: void 0 });
    }
    if (this.hasError) {
      return Promise.reject(this.hasError);
    }
    return new Promise((resolve, reject) => {
      this.readResolve = resolve;
      this.readReject = reject;
    });
  }
  /**
   * Adds a value to the stream
   */
  enqueue(value) {
    if (this.readResolve) {
      const resolve = this.readResolve;
      this.readResolve = void 0;
      this.readReject = void 0;
      resolve({ done: false, value });
    } else {
      this.queue.push(value);
    }
  }
  /**
   * Marks the stream as complete
   */
  done() {
    this.isDone = true;
    if (this.readResolve) {
      const resolve = this.readResolve;
      this.readResolve = void 0;
      this.readReject = void 0;
      resolve({ done: true, value: void 0 });
    }
  }
  /**
   * Propagates an error through the stream
   */
  error(error) {
    this.hasError = error;
    if (this.readReject) {
      const reject = this.readReject;
      this.readResolve = void 0;
      this.readReject = void 0;
      reject(error);
    }
  }
  /**
   * Implements async iterator cleanup
   */
  async return() {
    this.isDone = true;
    if (this.returned) {
      this.returned();
    }
    return Promise.resolve({ done: true, value: void 0 });
  }
}

class AbortError extends Error {
  constructor(message) {
    super(message);
    this.name = "AbortError";
  }
}

const __filename$1 = node_url.fileURLToPath((typeof document === 'undefined' ? require('u' + 'rl').pathToFileURL(__filename).href : (_documentCurrentScript && _documentCurrentScript.tagName.toUpperCase() === 'SCRIPT' && _documentCurrentScript.src || new URL('index-gMG9ykdp.cjs', document.baseURI).href)));
const __dirname$1 = node_path.join(__filename$1, "..");
function getGlobalClaudeVersion() {
  try {
    const cleanEnv = getCleanEnv();
    const output = node_child_process.execSync("claude --version", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      cwd: os.homedir(),
      env: cleanEnv,
      windowsHide: true
      // Prevent opening a new console window on Windows
    }).trim();
    const match = output.match(/(\d+\.\d+\.\d+)/);
    types.logger.debug(`[Claude SDK] Global claude --version output: ${output}`);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}
function getCleanEnv() {
  const env = { ...process.env };
  const cwd = process.cwd();
  const pathSep = process.platform === "win32" ? ";" : ":";
  const pathKey = process.platform === "win32" ? "Path" : "PATH";
  const actualPathKey = Object.keys(env).find((k) => k.toLowerCase() === "path") || pathKey;
  if (env[actualPathKey]) {
    const cleanPath = env[actualPathKey].split(pathSep).filter((p) => {
      const normalizedP = p.replace(/\\/g, "/").toLowerCase();
      const normalizedCwd = cwd.replace(/\\/g, "/").toLowerCase();
      return !normalizedP.startsWith(normalizedCwd);
    }).join(pathSep);
    env[actualPathKey] = cleanPath;
    types.logger.debug(`[Claude SDK] Cleaned PATH, removed local paths from: ${cwd}`);
  }
  return env;
}
function findGlobalClaudePath() {
  const homeDir = os.homedir();
  const cleanEnv = getCleanEnv();
  try {
    node_child_process.execSync("claude --version", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      cwd: homeDir,
      env: cleanEnv,
      windowsHide: true
      // Prevent opening a new console window on Windows
    });
    types.logger.debug("[Claude SDK] Global claude command available (checked with clean PATH)");
    return "claude";
  } catch {
  }
  if (process.platform !== "win32") {
    try {
      const result = node_child_process.execSync("which claude", {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
        cwd: homeDir,
        env: cleanEnv,
        windowsHide: true
        // Prevent opening a new console window on Windows
      }).trim();
      if (result && fs.existsSync(result)) {
        types.logger.debug(`[Claude SDK] Found global claude path via which: ${result}`);
        return result;
      }
    } catch {
    }
  }
  return null;
}
function getDefaultClaudeCodePath() {
  const nodeModulesPath = node_path.join(__dirname$1, "..", "..", "..", "node_modules", "@anthropic-ai", "claude-code", "cli.js");
  if (process.env.HAPPY_CLAUDE_PATH) {
    types.logger.debug(`[Claude SDK] Using HAPPY_CLAUDE_PATH: ${process.env.HAPPY_CLAUDE_PATH}`);
    return process.env.HAPPY_CLAUDE_PATH;
  }
  if (process.env.HAPPY_USE_BUNDLED_CLAUDE === "1") {
    types.logger.debug(`[Claude SDK] Forced bundled version: ${nodeModulesPath}`);
    return nodeModulesPath;
  }
  const globalPath = findGlobalClaudePath();
  if (!globalPath) {
    types.logger.debug(`[Claude SDK] No global claude found, using bundled: ${nodeModulesPath}`);
    return nodeModulesPath;
  }
  const globalVersion = getGlobalClaudeVersion();
  types.logger.debug(`[Claude SDK] Global version: ${globalVersion || "unknown"}`);
  if (!globalVersion) {
    types.logger.debug(`[Claude SDK] Cannot compare versions, using global: ${globalPath}`);
    return globalPath;
  }
  return globalPath;
}
function logDebug(message) {
  if (process.env.DEBUG) {
    types.logger.debug(message);
    console.log(message);
  }
}
async function streamToStdin(stream, stdin, abort) {
  for await (const message of stream) {
    if (abort?.aborted) break;
    stdin.write(JSON.stringify(message) + "\n");
  }
  stdin.end();
}

class Query {
  constructor(childStdin, childStdout, processExitPromise, canCallTool) {
    this.childStdin = childStdin;
    this.childStdout = childStdout;
    this.processExitPromise = processExitPromise;
    this.canCallTool = canCallTool;
    this.readMessages();
    this.sdkMessages = this.readSdkMessages();
  }
  pendingControlResponses = /* @__PURE__ */ new Map();
  cancelControllers = /* @__PURE__ */ new Map();
  sdkMessages;
  inputStream = new Stream();
  canCallTool;
  /**
   * Set an error on the stream
   */
  setError(error) {
    this.inputStream.error(error);
  }
  /**
   * AsyncIterableIterator implementation
   */
  next(...args) {
    return this.sdkMessages.next(...args);
  }
  return(value) {
    if (this.sdkMessages.return) {
      return this.sdkMessages.return(value);
    }
    return Promise.resolve({ done: true, value: void 0 });
  }
  throw(e) {
    if (this.sdkMessages.throw) {
      return this.sdkMessages.throw(e);
    }
    return Promise.reject(e);
  }
  [Symbol.asyncIterator]() {
    return this.sdkMessages;
  }
  /**
   * Read messages from Claude process stdout
   */
  async readMessages() {
    const rl = node_readline.createInterface({ input: this.childStdout });
    try {
      for await (const line of rl) {
        if (line.trim()) {
          try {
            const message = JSON.parse(line);
            if (message.type === "control_response") {
              const controlResponse = message;
              const handler = this.pendingControlResponses.get(controlResponse.response.request_id);
              if (handler) {
                handler(controlResponse.response);
              }
              continue;
            } else if (message.type === "control_request") {
              await this.handleControlRequest(message);
              continue;
            } else if (message.type === "control_cancel_request") {
              this.handleControlCancelRequest(message);
              continue;
            }
            this.inputStream.enqueue(message);
          } catch (e) {
            types.logger.debug(line);
          }
        }
      }
      await this.processExitPromise;
    } catch (error) {
      this.inputStream.error(error);
    } finally {
      this.inputStream.done();
      this.cleanupControllers();
      rl.close();
    }
  }
  /**
   * Async generator for SDK messages
   */
  async *readSdkMessages() {
    for await (const message of this.inputStream) {
      yield message;
    }
  }
  /**
   * Send interrupt request to Claude
   */
  async interrupt() {
    if (!this.childStdin) {
      throw new Error("Interrupt requires --input-format stream-json");
    }
    await this.request({
      subtype: "interrupt"
    }, this.childStdin);
  }
  /**
   * Send control request to Claude process
   */
  request(request, childStdin) {
    const requestId = Math.random().toString(36).substring(2, 15);
    const sdkRequest = {
      request_id: requestId,
      type: "control_request",
      request
    };
    return new Promise((resolve, reject) => {
      this.pendingControlResponses.set(requestId, (response) => {
        if (response.subtype === "success") {
          resolve(response);
        } else {
          reject(new Error(response.error));
        }
      });
      childStdin.write(JSON.stringify(sdkRequest) + "\n");
    });
  }
  /**
   * Handle incoming control requests for tool permissions
   * Replicates the exact logic from the SDK's handleControlRequest method
   */
  async handleControlRequest(request) {
    if (!this.childStdin) {
      logDebug("Cannot handle control request - no stdin available");
      return;
    }
    const controller = new AbortController();
    this.cancelControllers.set(request.request_id, controller);
    try {
      const response = await this.processControlRequest(request, controller.signal);
      const controlResponse = {
        type: "control_response",
        response: {
          subtype: "success",
          request_id: request.request_id,
          response
        }
      };
      this.childStdin.write(JSON.stringify(controlResponse) + "\n");
    } catch (error) {
      const controlErrorResponse = {
        type: "control_response",
        response: {
          subtype: "error",
          request_id: request.request_id,
          error: error instanceof Error ? error.message : String(error)
        }
      };
      this.childStdin.write(JSON.stringify(controlErrorResponse) + "\n");
    } finally {
      this.cancelControllers.delete(request.request_id);
    }
  }
  /**
   * Handle control cancel requests
   * Replicates the exact logic from the SDK's handleControlCancelRequest method
   */
  handleControlCancelRequest(request) {
    const controller = this.cancelControllers.get(request.request_id);
    if (controller) {
      controller.abort();
      this.cancelControllers.delete(request.request_id);
    }
  }
  /**
   * Process control requests based on subtype
   * Replicates the exact logic from the SDK's processControlRequest method
   */
  async processControlRequest(request, signal) {
    if (request.request.subtype === "can_use_tool") {
      if (!this.canCallTool) {
        throw new Error("canCallTool callback is not provided.");
      }
      return this.canCallTool(request.request.tool_name, request.request.input, {
        signal
      });
    }
    throw new Error("Unsupported control request subtype: " + request.request.subtype);
  }
  /**
   * Cleanup method to abort all pending control requests
   */
  cleanupControllers() {
    for (const [requestId, controller] of this.cancelControllers.entries()) {
      controller.abort();
      this.cancelControllers.delete(requestId);
    }
  }
}
function query(config) {
  const {
    prompt,
    options: {
      allowedTools = [],
      appendSystemPrompt,
      customSystemPrompt,
      cwd,
      disallowedTools = [],
      executable = "node",
      executableArgs = [],
      maxTurns,
      mcpServers,
      pathToClaudeCodeExecutable = getDefaultClaudeCodePath(),
      permissionMode = "default",
      continue: continueConversation,
      resume,
      model,
      fallbackModel,
      strictMcpConfig,
      canCallTool,
      settingsPath
    } = {}
  } = config;
  if (!process.env.CLAUDE_CODE_ENTRYPOINT) {
    process.env.CLAUDE_CODE_ENTRYPOINT = "sdk-ts";
  }
  const args = ["--output-format", "stream-json", "--verbose"];
  if (customSystemPrompt) args.push("--system-prompt", customSystemPrompt);
  if (appendSystemPrompt) args.push("--append-system-prompt", appendSystemPrompt);
  if (maxTurns) args.push("--max-turns", maxTurns.toString());
  if (model) args.push("--model", model);
  if (canCallTool) {
    if (typeof prompt === "string") {
      throw new Error("canCallTool callback requires --input-format stream-json. Please set prompt as an AsyncIterable.");
    }
    args.push("--permission-prompt-tool", "stdio");
  }
  if (continueConversation) args.push("--continue");
  if (resume) args.push("--resume", resume);
  if (allowedTools.length > 0) args.push("--allowedTools", allowedTools.join(","));
  if (disallowedTools.length > 0) args.push("--disallowedTools", disallowedTools.join(","));
  if (mcpServers && Object.keys(mcpServers).length > 0) {
    args.push("--mcp-config", JSON.stringify({ mcpServers }));
  }
  if (strictMcpConfig) args.push("--strict-mcp-config");
  if (permissionMode) args.push("--permission-mode", permissionMode);
  if (settingsPath) args.push("--settings", settingsPath);
  if (fallbackModel) {
    if (model && fallbackModel === model) {
      throw new Error("Fallback model cannot be the same as the main model. Please specify a different model for fallbackModel option.");
    }
    args.push("--fallback-model", fallbackModel);
  }
  if (typeof prompt === "string") {
    args.push("--print", prompt.trim());
  } else {
    args.push("--input-format", "stream-json");
  }
  const isJsFile = pathToClaudeCodeExecutable.endsWith(".js") || pathToClaudeCodeExecutable.endsWith(".cjs");
  const isCommandOnly = pathToClaudeCodeExecutable === "claude";
  if (!isCommandOnly && !fs.existsSync(pathToClaudeCodeExecutable)) {
    throw new ReferenceError(`Claude Code executable not found at ${pathToClaudeCodeExecutable}. Is options.pathToClaudeCodeExecutable set?`);
  }
  const spawnCommand = isJsFile ? executable : pathToClaudeCodeExecutable;
  const spawnArgs = isJsFile ? [...executableArgs, pathToClaudeCodeExecutable, ...args] : args;
  const spawnEnv = isCommandOnly ? getCleanEnv() : process.env;
  logDebug(`Spawning Claude Code process: ${spawnCommand} ${spawnArgs.join(" ")} (using ${isCommandOnly ? "clean" : "normal"} env)`);
  const child = node_child_process.spawn(spawnCommand, spawnArgs, {
    cwd,
    stdio: ["pipe", "pipe", "pipe"],
    signal: config.options?.abort,
    env: spawnEnv,
    // Use shell on Windows for global binaries and command-only mode
    shell: !isJsFile && process.platform === "win32",
    windowsHide: true
    // Prevent opening a new console window on Windows
  });
  let childStdin = null;
  if (typeof prompt === "string") {
    child.stdin.end();
  } else {
    streamToStdin(prompt, child.stdin, config.options?.abort);
    childStdin = child.stdin;
  }
  if (process.env.DEBUG) {
    child.stderr.on("data", (data) => {
      console.error("Claude Code stderr:", data.toString());
    });
  }
  const cleanup = () => {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  };
  config.options?.abort?.addEventListener("abort", cleanup);
  process.on("exit", cleanup);
  const processExitPromise = new Promise((resolve) => {
    child.on("close", (code) => {
      if (config.options?.abort?.aborted) {
        query2.setError(new AbortError("Claude Code process aborted by user"));
      }
      if (code !== 0) {
        query2.setError(new Error(`Claude Code process exited with code ${code}`));
      } else {
        resolve();
      }
    });
  });
  const query2 = new Query(childStdin, child.stdout, processExitPromise, canCallTool);
  child.on("error", (error) => {
    if (config.options?.abort?.aborted) {
      query2.setError(new AbortError("Claude Code process aborted by user"));
    } else {
      query2.setError(new Error(`Failed to spawn Claude Code process: ${error.message}`));
    }
  });
  processExitPromise.finally(() => {
    cleanup();
    config.options?.abort?.removeEventListener("abort", cleanup);
    if (process.env.CLAUDE_SDK_MCP_SERVERS) {
      delete process.env.CLAUDE_SDK_MCP_SERVERS;
    }
  });
  return query2;
}

function parseCompact(message) {
  const trimmed = message.trim();
  if (trimmed === "/compact") {
    return {
      isCompact: true,
      originalMessage: trimmed
    };
  }
  if (trimmed.startsWith("/compact ")) {
    return {
      isCompact: true,
      originalMessage: trimmed
    };
  }
  return {
    isCompact: false,
    originalMessage: message
  };
}
function parseClear(message) {
  const trimmed = message.trim();
  return {
    isClear: trimmed === "/clear"
  };
}
function parseSpecialCommand(message) {
  const compactResult = parseCompact(message);
  if (compactResult.isCompact) {
    return {
      type: "compact",
      originalMessage: compactResult.originalMessage
    };
  }
  const clearResult = parseClear(message);
  if (clearResult.isClear) {
    return {
      type: "clear"
    };
  }
  return {
    type: null
  };
}

class PushableAsyncIterable {
  queue = [];
  waiters = [];
  isDone = false;
  error = null;
  started = false;
  constructor() {
  }
  /**
   * Push a value to the iterable
   */
  push(value) {
    if (this.isDone) {
      throw new Error("Cannot push to completed iterable");
    }
    if (this.error) {
      throw this.error;
    }
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter.resolve({ done: false, value });
    } else {
      this.queue.push(value);
    }
  }
  /**
   * Mark the iterable as complete
   */
  end() {
    if (this.isDone) {
      return;
    }
    this.isDone = true;
    this.cleanup();
  }
  /**
   * Set an error on the iterable
   */
  setError(err) {
    if (this.isDone) {
      return;
    }
    this.error = err;
    this.isDone = true;
    this.cleanup();
  }
  /**
   * Cleanup waiting consumers
   */
  cleanup() {
    while (this.waiters.length > 0) {
      const waiter = this.waiters.shift();
      if (this.error) {
        waiter.reject(this.error);
      } else {
        waiter.resolve({ done: true, value: void 0 });
      }
    }
  }
  /**
   * AsyncIterableIterator implementation
   */
  async next() {
    if (this.queue.length > 0) {
      return { done: false, value: this.queue.shift() };
    }
    if (this.isDone) {
      if (this.error) {
        throw this.error;
      }
      return { done: true, value: void 0 };
    }
    return new Promise((resolve, reject) => {
      this.waiters.push({ resolve, reject });
    });
  }
  /**
   * AsyncIterableIterator return implementation
   */
  async return(_value) {
    this.end();
    return { done: true, value: void 0 };
  }
  /**
   * AsyncIterableIterator throw implementation
   */
  async throw(e) {
    this.setError(e instanceof Error ? e : new Error(String(e)));
    throw this.error;
  }
  /**
   * Make this iterable
   */
  [Symbol.asyncIterator]() {
    if (this.started) {
      throw new Error("PushableAsyncIterable can only be iterated once");
    }
    this.started = true;
    return this;
  }
  /**
   * Check if the iterable is done
   */
  get done() {
    return this.isDone;
  }
  /**
   * Check if the iterable has an error
   */
  get hasError() {
    return this.error !== null;
  }
  /**
   * Get the current queue size
   */
  get queueSize() {
    return this.queue.length;
  }
  /**
   * Get the number of waiting consumers
   */
  get waiterCount() {
    return this.waiters.length;
  }
}

async function awaitFileExist(file, timeout = 1e4) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    try {
      await fs$1.access(file);
      return true;
    } catch (e) {
      await types.delay(1e3);
    }
  }
  return false;
}

async function claudeRemote(opts) {
  let startFrom = opts.sessionId;
  if (opts.sessionId && !claudeCheckSession(opts.sessionId, opts.path)) {
    startFrom = null;
  }
  if (!startFrom && opts.claudeArgs) {
    for (let i = 0; i < opts.claudeArgs.length; i++) {
      if (opts.claudeArgs[i] === "--resume") {
        if (i + 1 < opts.claudeArgs.length) {
          const nextArg = opts.claudeArgs[i + 1];
          if (!nextArg.startsWith("-") && nextArg.includes("-")) {
            startFrom = nextArg;
            types.logger.debug(`[claudeRemote] Found --resume with session ID: ${startFrom}`);
            break;
          } else {
            types.logger.debug("[claudeRemote] Found --resume without session ID - not supported in remote mode");
            break;
          }
        } else {
          types.logger.debug("[claudeRemote] Found --resume without session ID - not supported in remote mode");
          break;
        }
      }
    }
  }
  if (opts.claudeEnvVars) {
    Object.entries(opts.claudeEnvVars).forEach(([key, value]) => {
      process.env[key] = value;
    });
  }
  const initial = await opts.nextMessage();
  if (!initial) {
    return;
  }
  const specialCommand = parseSpecialCommand(initial.message);
  if (specialCommand.type === "clear") {
    if (opts.onCompletionEvent) {
      opts.onCompletionEvent("Context was reset");
    }
    if (opts.onSessionReset) {
      opts.onSessionReset();
    }
    return;
  }
  let isCompactCommand = false;
  if (specialCommand.type === "compact") {
    types.logger.debug("[claudeRemote] /compact command detected - will process as normal but with compaction behavior");
    isCompactCommand = true;
    if (opts.onCompletionEvent) {
      opts.onCompletionEvent("Compaction started");
    }
  }
  let mode = initial.mode;
  const sdkOptions = {
    cwd: opts.path,
    resume: startFrom ?? void 0,
    mcpServers: opts.mcpServers,
    permissionMode: initial.mode.permissionMode === "plan" ? "plan" : "default",
    model: initial.mode.model,
    fallbackModel: initial.mode.fallbackModel,
    customSystemPrompt: initial.mode.customSystemPrompt ? initial.mode.customSystemPrompt + "\n\n" + systemPrompt : void 0,
    appendSystemPrompt: initial.mode.appendSystemPrompt ? initial.mode.appendSystemPrompt + "\n\n" + systemPrompt : systemPrompt,
    allowedTools: initial.mode.allowedTools ? initial.mode.allowedTools.concat(opts.allowedTools) : opts.allowedTools,
    disallowedTools: initial.mode.disallowedTools,
    canCallTool: (toolName, input, options) => opts.canCallTool(toolName, input, mode, options),
    executable: "node",
    abort: opts.signal,
    pathToClaudeCodeExecutable: (() => {
      return node_path.resolve(node_path.join(types.projectPath(), "scripts", "claude_remote_launcher.cjs"));
    })(),
    settingsPath: opts.hookSettingsPath
  };
  let thinking = false;
  const updateThinking = (newThinking) => {
    if (thinking !== newThinking) {
      thinking = newThinking;
      types.logger.debug(`[claudeRemote] Thinking state changed to: ${thinking}`);
      if (opts.onThinkingChange) {
        opts.onThinkingChange(thinking);
      }
    }
  };
  let messages = new PushableAsyncIterable();
  messages.push({
    type: "user",
    message: {
      role: "user",
      content: initial.message
    }
  });
  const response = query({
    prompt: messages,
    options: sdkOptions
  });
  updateThinking(true);
  try {
    types.logger.debug(`[claudeRemote] Starting to iterate over response`);
    for await (const message of response) {
      types.logger.debugLargeJson(`[claudeRemote] Message ${message.type}`, message);
      opts.onMessage(message);
      if (message.type === "system" && message.subtype === "init") {
        updateThinking(true);
        const systemInit = message;
        if (systemInit.session_id) {
          types.logger.debug(`[claudeRemote] Waiting for session file to be written to disk: ${systemInit.session_id}`);
          const projectDir = getProjectPath(opts.path);
          const found = await awaitFileExist(node_path.join(projectDir, `${systemInit.session_id}.jsonl`));
          types.logger.debug(`[claudeRemote] Session file found: ${systemInit.session_id} ${found}`);
          opts.onSessionFound(systemInit.session_id);
        }
      }
      if (message.type === "result") {
        updateThinking(false);
        types.logger.debug("[claudeRemote] Result received, exiting claudeRemote");
        if (isCompactCommand) {
          types.logger.debug("[claudeRemote] Compaction completed");
          if (opts.onCompletionEvent) {
            opts.onCompletionEvent("Compaction completed");
          }
          isCompactCommand = false;
        }
        opts.onReady();
        const next = await opts.nextMessage();
        if (!next) {
          messages.end();
          return;
        }
        mode = next.mode;
        messages.push({ type: "user", message: { role: "user", content: next.message } });
      }
      if (message.type === "user") {
        const msg = message;
        if (msg.message.role === "user" && Array.isArray(msg.message.content)) {
          for (let c of msg.message.content) {
            if (c.type === "tool_result" && c.tool_use_id && opts.isAborted(c.tool_use_id)) {
              types.logger.debug("[claudeRemote] Tool aborted, exiting claudeRemote");
              return;
            }
          }
        }
      }
    }
  } catch (e) {
    if (e instanceof AbortError) {
      types.logger.debug(`[claudeRemote] Aborted`);
    } else {
      throw e;
    }
  } finally {
    updateThinking(false);
  }
}

const PLAN_FAKE_REJECT = `User approved plan, but you need to be restarted. STOP IMMEDIATELY TO SWITCH FROM PLAN MODE. DO NOT REPLY TO THIS MESSAGE.`;
const PLAN_FAKE_RESTART = `PlEaZe Continue with plan.`;

function deepEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== "object" || typeof b !== "object") return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }
  return true;
}

const STANDARD_TOOLS = {
  // File operations
  "Read": "Read File",
  "Write": "Write File",
  "Edit": "Edit File",
  "MultiEdit": "Edit File",
  "NotebookEdit": "Edit Notebook",
  // Search and navigation
  "Glob": "Find Files",
  "Grep": "Search in Files",
  "LS": "List Directory",
  // Command execution
  "Bash": "Run Command",
  "BashOutput": "Check Command Output",
  "KillBash": "Stop Command",
  // Task management
  "TodoWrite": "Update Tasks",
  "TodoRead": "Read Tasks",
  "Task": "Launch Agent",
  // Web tools
  "WebFetch": "Fetch Web Page",
  "WebSearch": "Search Web",
  // Special cases
  "exit_plan_mode": "Execute Plan",
  "ExitPlanMode": "Execute Plan"
};
function toTitleCase(str) {
  return str.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}
function getToolName(toolName) {
  if (STANDARD_TOOLS[toolName]) {
    return STANDARD_TOOLS[toolName];
  }
  if (toolName.startsWith("mcp__")) {
    const parts = toolName.split("__");
    if (parts.length >= 3) {
      const server = toTitleCase(parts[1]);
      const action = toTitleCase(parts.slice(2).join("_"));
      return `${server}: ${action}`;
    }
  }
  return toTitleCase(toolName);
}

function getToolDescriptor(toolName) {
  if (toolName === "exit_plan_mode" || toolName === "ExitPlanMode") {
    return { edit: false, exitPlan: true };
  }
  if (toolName === "Edit" || toolName === "MultiEdit" || toolName === "Write" || toolName === "NotebookEdit") {
    return { edit: true, exitPlan: false };
  }
  return { edit: false, exitPlan: false };
}

class PermissionHandler {
  toolCalls = [];
  responses = /* @__PURE__ */ new Map();
  pendingRequests = /* @__PURE__ */ new Map();
  session;
  allowedTools = /* @__PURE__ */ new Set();
  allowedBashLiterals = /* @__PURE__ */ new Set();
  allowedBashPrefixes = /* @__PURE__ */ new Set();
  permissionMode = "default";
  onPermissionRequestCallback;
  constructor(session) {
    this.session = session;
    this.setupClientHandler();
  }
  /**
   * Set callback to trigger when permission request is made
   */
  setOnPermissionRequest(callback) {
    this.onPermissionRequestCallback = callback;
  }
  handleModeChange(mode) {
    this.permissionMode = mode;
  }
  /**
   * Handler response
   */
  handlePermissionResponse(response, pending) {
    if (response.allowTools && response.allowTools.length > 0) {
      response.allowTools.forEach((tool) => {
        if (tool.startsWith("Bash(") || tool === "Bash") {
          this.parseBashPermission(tool);
        } else {
          this.allowedTools.add(tool);
        }
      });
    }
    if (response.mode) {
      this.permissionMode = response.mode;
    }
    if (pending.toolName === "exit_plan_mode" || pending.toolName === "ExitPlanMode") {
      types.logger.debug("Plan mode result received", response);
      if (response.approved) {
        types.logger.debug("Plan approved - injecting PLAN_FAKE_RESTART");
        if (response.mode && ["default", "acceptEdits", "bypassPermissions"].includes(response.mode)) {
          this.session.queue.unshift(PLAN_FAKE_RESTART, { permissionMode: response.mode });
        } else {
          this.session.queue.unshift(PLAN_FAKE_RESTART, { permissionMode: "default" });
        }
        pending.resolve({ behavior: "deny", message: PLAN_FAKE_REJECT });
      } else {
        pending.resolve({ behavior: "deny", message: response.reason || "Plan rejected" });
      }
    } else {
      const result = response.approved ? { behavior: "allow", updatedInput: pending.input || {} } : { behavior: "deny", message: response.reason || `The user doesn't want to proceed with this tool use. The tool use was rejected (eg. if it was a file edit, the new_string was NOT written to the file). STOP what you are doing and wait for the user to tell you how to proceed.` };
      pending.resolve(result);
    }
  }
  /**
   * Creates the canCallTool callback for the SDK
   */
  handleToolCall = async (toolName, input, mode, options) => {
    if (toolName === "Bash") {
      const inputObj = input;
      if (inputObj?.command) {
        if (this.allowedBashLiterals.has(inputObj.command)) {
          return { behavior: "allow", updatedInput: input };
        }
        for (const prefix of this.allowedBashPrefixes) {
          if (inputObj.command.startsWith(prefix)) {
            return { behavior: "allow", updatedInput: input };
          }
        }
      }
    } else if (this.allowedTools.has(toolName)) {
      return { behavior: "allow", updatedInput: input };
    }
    const descriptor = getToolDescriptor(toolName);
    if (this.permissionMode === "bypassPermissions") {
      return { behavior: "allow", updatedInput: input };
    }
    if (this.permissionMode === "acceptEdits" && descriptor.edit) {
      return { behavior: "allow", updatedInput: input };
    }
    let toolCallId = this.resolveToolCallId(toolName, input);
    if (!toolCallId) {
      await types.delay(1e3);
      toolCallId = this.resolveToolCallId(toolName, input);
      if (!toolCallId) {
        throw new Error(`Could not resolve tool call ID for ${toolName}`);
      }
    }
    return this.handlePermissionRequest(toolCallId, toolName, input, options.signal);
  };
  /**
   * Handles individual permission requests
   */
  async handlePermissionRequest(id, toolName, input, signal) {
    return new Promise((resolve, reject) => {
      const abortHandler = () => {
        this.pendingRequests.delete(id);
        reject(new Error("Permission request aborted"));
      };
      signal.addEventListener("abort", abortHandler, { once: true });
      this.pendingRequests.set(id, {
        resolve: (result) => {
          signal.removeEventListener("abort", abortHandler);
          resolve(result);
        },
        reject: (error) => {
          signal.removeEventListener("abort", abortHandler);
          reject(error);
        },
        toolName,
        input
      });
      if (this.onPermissionRequestCallback) {
        this.onPermissionRequestCallback(id);
      }
      this.session.api.push().sendToAllDevices(
        "Permission Request",
        `Claude wants to ${getToolName(toolName)}`,
        {
          sessionId: this.session.client.sessionId,
          requestId: id,
          tool: toolName,
          type: "permission_request"
        }
      );
      this.session.client.updateAgentState((currentState) => ({
        ...currentState,
        requests: {
          ...currentState.requests,
          [id]: {
            tool: toolName,
            arguments: input,
            createdAt: Date.now()
          }
        }
      }));
      types.logger.debug(`Permission request sent for tool call ${id}: ${toolName}`);
    });
  }
  /**
   * Parses Bash permission strings into literal and prefix sets
   */
  parseBashPermission(permission) {
    if (permission === "Bash") {
      return;
    }
    const bashPattern = /^Bash\((.+?)\)$/;
    const match = permission.match(bashPattern);
    if (!match) {
      return;
    }
    const command = match[1];
    if (command.endsWith(":*")) {
      const prefix = command.slice(0, -2);
      this.allowedBashPrefixes.add(prefix);
    } else {
      this.allowedBashLiterals.add(command);
    }
  }
  /**
   * Resolves tool call ID based on tool name and input
   */
  resolveToolCallId(name, args) {
    for (let i = this.toolCalls.length - 1; i >= 0; i--) {
      const call = this.toolCalls[i];
      if (call.name === name && deepEqual(call.input, args)) {
        if (call.used) {
          return null;
        }
        call.used = true;
        return call.id;
      }
    }
    return null;
  }
  /**
   * Handles messages to track tool calls
   */
  onMessage(message) {
    if (message.type === "assistant") {
      const assistantMsg = message;
      if (assistantMsg.message && assistantMsg.message.content) {
        for (const block of assistantMsg.message.content) {
          if (block.type === "tool_use") {
            this.toolCalls.push({
              id: block.id,
              name: block.name,
              input: block.input,
              used: false
            });
          }
        }
      }
    }
    if (message.type === "user") {
      const userMsg = message;
      if (userMsg.message && userMsg.message.content && Array.isArray(userMsg.message.content)) {
        for (const block of userMsg.message.content) {
          if (block.type === "tool_result" && block.tool_use_id) {
            const toolCall = this.toolCalls.find((tc) => tc.id === block.tool_use_id);
            if (toolCall && !toolCall.used) {
              toolCall.used = true;
            }
          }
        }
      }
    }
  }
  /**
   * Checks if a tool call is rejected
   */
  isAborted(toolCallId) {
    if (this.responses.get(toolCallId)?.approved === false) {
      return true;
    }
    const toolCall = this.toolCalls.find((tc) => tc.id === toolCallId);
    if (toolCall && (toolCall.name === "exit_plan_mode" || toolCall.name === "ExitPlanMode")) {
      return true;
    }
    return false;
  }
  /**
   * Resets all state for new sessions
   */
  reset() {
    this.toolCalls = [];
    this.responses.clear();
    this.allowedTools.clear();
    this.allowedBashLiterals.clear();
    this.allowedBashPrefixes.clear();
    for (const [, pending] of this.pendingRequests.entries()) {
      pending.reject(new Error("Session reset"));
    }
    this.pendingRequests.clear();
    this.session.client.updateAgentState((currentState) => {
      const pendingRequests = currentState.requests || {};
      const completedRequests = { ...currentState.completedRequests };
      for (const [id, request] of Object.entries(pendingRequests)) {
        completedRequests[id] = {
          ...request,
          completedAt: Date.now(),
          status: "canceled",
          reason: "Session switched to local mode"
        };
      }
      return {
        ...currentState,
        requests: {},
        // Clear all pending requests
        completedRequests
      };
    });
  }
  /**
   * Sets up the client handler for permission responses
   */
  setupClientHandler() {
    this.session.client.rpcHandlerManager.registerHandler("permission", async (message) => {
      types.logger.debug(`Permission response: ${JSON.stringify(message)}`);
      const id = message.id;
      const pending = this.pendingRequests.get(id);
      if (!pending) {
        types.logger.debug("Permission request not found or already resolved");
        return;
      }
      this.responses.set(id, { ...message, receivedAt: Date.now() });
      this.pendingRequests.delete(id);
      this.handlePermissionResponse(message, pending);
      this.session.client.updateAgentState((currentState) => {
        const request = currentState.requests?.[id];
        if (!request) return currentState;
        let r = { ...currentState.requests };
        delete r[id];
        return {
          ...currentState,
          requests: r,
          completedRequests: {
            ...currentState.completedRequests,
            [id]: {
              ...request,
              completedAt: Date.now(),
              status: message.approved ? "approved" : "denied",
              reason: message.reason,
              mode: message.mode,
              allowTools: message.allowTools
            }
          }
        };
      });
    });
  }
  /**
   * Gets the responses map (for compatibility with existing code)
   */
  getResponses() {
    return this.responses;
  }
}

function formatClaudeMessageForInk(message, messageBuffer, onAssistantResult) {
  types.logger.debugLargeJson("[CLAUDE INK] Message from remote mode:", message);
  switch (message.type) {
    case "system": {
      const sysMsg = message;
      if (sysMsg.subtype === "init") {
        messageBuffer.addMessage("\u2500".repeat(40), "status");
        messageBuffer.addMessage(`\u{1F680} Session initialized: ${sysMsg.session_id}`, "system");
        messageBuffer.addMessage(`  Model: ${sysMsg.model}`, "status");
        messageBuffer.addMessage(`  CWD: ${sysMsg.cwd}`, "status");
        if (sysMsg.tools && sysMsg.tools.length > 0) {
          messageBuffer.addMessage(`  Tools: ${sysMsg.tools.join(", ")}`, "status");
        }
        messageBuffer.addMessage("\u2500".repeat(40), "status");
      }
      break;
    }
    case "user": {
      const userMsg = message;
      if (userMsg.message && typeof userMsg.message === "object" && "content" in userMsg.message) {
        const content = userMsg.message.content;
        if (typeof content === "string") {
          messageBuffer.addMessage(`\u{1F464} User: ${content}`, "user");
        } else if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === "text") {
              messageBuffer.addMessage(`\u{1F464} User: ${block.text}`, "user");
            } else if (block.type === "tool_result") {
              messageBuffer.addMessage(`\u2705 Tool Result (ID: ${block.tool_use_id})`, "result");
              if (block.content) {
                const outputStr = typeof block.content === "string" ? block.content : JSON.stringify(block.content, null, 2);
                const maxLength = 200;
                if (outputStr.length > maxLength) {
                  messageBuffer.addMessage(outputStr.substring(0, maxLength) + "... (truncated)", "result");
                } else {
                  messageBuffer.addMessage(outputStr, "result");
                }
              }
            }
          }
        } else {
          messageBuffer.addMessage(`\u{1F464} User: ${JSON.stringify(content, null, 2)}`, "user");
        }
      }
      break;
    }
    case "assistant": {
      const assistantMsg = message;
      if (assistantMsg.message && assistantMsg.message.content) {
        messageBuffer.addMessage("\u{1F916} Assistant:", "assistant");
        for (const block of assistantMsg.message.content) {
          if (block.type === "text") {
            messageBuffer.addMessage(block.text || "", "assistant");
          } else if (block.type === "tool_use") {
            messageBuffer.addMessage(`\u{1F527} Tool: ${block.name}`, "tool");
            if (block.input) {
              const inputStr = JSON.stringify(block.input, null, 2);
              const maxLength = 500;
              if (inputStr.length > maxLength) {
                messageBuffer.addMessage(`Input: ${inputStr.substring(0, maxLength)}... (truncated)`, "tool");
              } else {
                messageBuffer.addMessage(`Input: ${inputStr}`, "tool");
              }
            }
          }
        }
      }
      break;
    }
    case "result": {
      const resultMsg = message;
      if (resultMsg.subtype === "success") {
        if ("result" in resultMsg && resultMsg.result) {
          messageBuffer.addMessage("\u2728 Summary:", "result");
          messageBuffer.addMessage(resultMsg.result || "", "result");
        }
        if (resultMsg.usage) {
          messageBuffer.addMessage("\u{1F4CA} Session Stats:", "status");
          messageBuffer.addMessage(`  \u2022 Turns: ${resultMsg.num_turns}`, "status");
          messageBuffer.addMessage(`  \u2022 Input tokens: ${resultMsg.usage.input_tokens}`, "status");
          messageBuffer.addMessage(`  \u2022 Output tokens: ${resultMsg.usage.output_tokens}`, "status");
          if (resultMsg.usage.cache_read_input_tokens) {
            messageBuffer.addMessage(`  \u2022 Cache read tokens: ${resultMsg.usage.cache_read_input_tokens}`, "status");
          }
          if (resultMsg.usage.cache_creation_input_tokens) {
            messageBuffer.addMessage(`  \u2022 Cache creation tokens: ${resultMsg.usage.cache_creation_input_tokens}`, "status");
          }
          messageBuffer.addMessage(`  \u2022 Cost: $${resultMsg.total_cost_usd.toFixed(4)}`, "status");
          messageBuffer.addMessage(`  \u2022 Duration: ${resultMsg.duration_ms}ms`, "status");
        }
      } else if (resultMsg.subtype === "error_max_turns") {
        messageBuffer.addMessage("\u274C Error: Maximum turns reached", "result");
        messageBuffer.addMessage(`Completed ${resultMsg.num_turns} turns`, "status");
      } else if (resultMsg.subtype === "error_during_execution") {
        messageBuffer.addMessage("\u274C Error during execution", "result");
        messageBuffer.addMessage(`Completed ${resultMsg.num_turns} turns before error`, "status");
        types.logger.debugLargeJson("[RESULT] Error during execution", resultMsg);
      }
      break;
    }
    default: {
      if (process.env.DEBUG) {
        messageBuffer.addMessage(`[Unknown message type: ${message.type}]`, "status");
      }
    }
  }
}

function getGitBranch(cwd) {
  try {
    const branch = node_child_process.execSync("git rev-parse --abbrev-ref HEAD", {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      windowsHide: true
      // Prevent opening a new console window on Windows
    }).trim();
    return branch || void 0;
  } catch {
    return void 0;
  }
}
class SDKToLogConverter {
  lastUuid = null;
  context;
  responses;
  sidechainLastUUID = /* @__PURE__ */ new Map();
  constructor(context, responses) {
    this.context = {
      ...context,
      gitBranch: context.gitBranch ?? getGitBranch(context.cwd),
      version: context.version ?? process.env.npm_package_version ?? "0.0.0",
      parentUuid: null
    };
    this.responses = responses;
  }
  /**
   * Update session ID (for when session changes during resume)
   */
  updateSessionId(sessionId) {
    this.context.sessionId = sessionId;
  }
  /**
   * Reset parent chain (useful when starting new conversation)
   */
  resetParentChain() {
    this.lastUuid = null;
    this.context.parentUuid = null;
  }
  /**
   * Convert SDK message to log format
   */
  convert(sdkMessage) {
    const uuid = node_crypto.randomUUID();
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    let parentUuid = this.lastUuid;
    let isSidechain = false;
    if (sdkMessage.parent_tool_use_id) {
      isSidechain = true;
      parentUuid = this.sidechainLastUUID.get(sdkMessage.parent_tool_use_id) ?? null;
      this.sidechainLastUUID.set(sdkMessage.parent_tool_use_id, uuid);
    }
    const baseFields = {
      parentUuid,
      isSidechain,
      userType: "external",
      cwd: this.context.cwd,
      sessionId: this.context.sessionId,
      version: this.context.version,
      gitBranch: this.context.gitBranch,
      uuid,
      timestamp
    };
    let logMessage = null;
    switch (sdkMessage.type) {
      case "user": {
        const userMsg = sdkMessage;
        logMessage = {
          ...baseFields,
          type: "user",
          message: userMsg.message
        };
        if (Array.isArray(userMsg.message.content)) {
          for (const content of userMsg.message.content) {
            if (content.type === "tool_result" && content.tool_use_id && this.responses?.has(content.tool_use_id)) {
              const response = this.responses.get(content.tool_use_id);
              if (response?.mode) {
                logMessage.mode = response.mode;
              }
            }
          }
        } else if (typeof userMsg.message.content === "string") ;
        break;
      }
      case "assistant": {
        const assistantMsg = sdkMessage;
        logMessage = {
          ...baseFields,
          type: "assistant",
          message: assistantMsg.message,
          // Assistant messages often have additional fields
          requestId: assistantMsg.requestId
        };
        break;
      }
      case "system": {
        const systemMsg = sdkMessage;
        if (systemMsg.subtype === "init" && systemMsg.session_id) {
          this.updateSessionId(systemMsg.session_id);
        }
        logMessage = {
          ...baseFields,
          type: "system",
          subtype: systemMsg.subtype,
          model: systemMsg.model,
          tools: systemMsg.tools,
          // Include all other fields
          ...systemMsg
        };
        break;
      }
      case "result": {
        break;
      }
      // Handle tool use results (often comes as user messages)
      case "tool_result": {
        const toolMsg = sdkMessage;
        const baseLogMessage = {
          ...baseFields,
          type: "user",
          message: {
            role: "user",
            content: [{
              type: "tool_result",
              tool_use_id: toolMsg.tool_use_id,
              content: toolMsg.content
            }]
          },
          toolUseResult: toolMsg.content
        };
        if (toolMsg.tool_use_id && this.responses?.has(toolMsg.tool_use_id)) {
          const response = this.responses.get(toolMsg.tool_use_id);
          if (response?.mode) {
            baseLogMessage.mode = response.mode;
          }
        }
        logMessage = baseLogMessage;
        break;
      }
      default:
        logMessage = {
          ...baseFields,
          ...sdkMessage,
          type: sdkMessage.type
          // Override type last to ensure it's set
        };
    }
    if (logMessage && logMessage.type !== "summary") {
      this.lastUuid = uuid;
    }
    return logMessage;
  }
  /**
   * Convert multiple SDK messages to log format
   */
  convertMany(sdkMessages) {
    return sdkMessages.map((msg) => this.convert(msg)).filter((msg) => msg !== null);
  }
  /**
   * Convert a simple string content to a sidechain user message
   * Used for Task tool sub-agent prompts
   */
  convertSidechainUserMessage(toolUseId, content) {
    const uuid = node_crypto.randomUUID();
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    this.sidechainLastUUID.set(toolUseId, uuid);
    return {
      parentUuid: null,
      isSidechain: true,
      userType: "external",
      cwd: this.context.cwd,
      sessionId: this.context.sessionId,
      version: this.context.version,
      gitBranch: this.context.gitBranch,
      type: "user",
      message: {
        role: "user",
        content
      },
      uuid,
      timestamp
    };
  }
  /**
   * Generate an interrupted tool result message
   * Used when a tool call is interrupted by the user
   * @param toolUseId - The ID of the tool that was interrupted
   * @param parentToolUseId - Optional parent tool ID if this is a sidechain tool
   */
  generateInterruptedToolResult(toolUseId, parentToolUseId) {
    const uuid = node_crypto.randomUUID();
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    const errorMessage = "[Request interrupted by user for tool use]";
    let isSidechain = false;
    let parentUuid = this.lastUuid;
    if (parentToolUseId) {
      isSidechain = true;
      parentUuid = this.sidechainLastUUID.get(parentToolUseId) ?? null;
      this.sidechainLastUUID.set(parentToolUseId, uuid);
    }
    const logMessage = {
      type: "user",
      isSidechain,
      uuid,
      message: {
        role: "user",
        content: [
          {
            type: "tool_result",
            content: errorMessage,
            is_error: true,
            tool_use_id: toolUseId
          }
        ]
      },
      parentUuid,
      userType: "external",
      cwd: this.context.cwd,
      sessionId: this.context.sessionId,
      version: this.context.version,
      gitBranch: this.context.gitBranch,
      timestamp,
      toolUseResult: `Error: ${errorMessage}`
    };
    this.lastUuid = uuid;
    return logMessage;
  }
}

class OutgoingMessageQueue {
  constructor(sendFunction) {
    this.sendFunction = sendFunction;
  }
  queue = [];
  nextId = 1;
  lock = new types.AsyncLock();
  processTimer;
  delayTimers = /* @__PURE__ */ new Map();
  /**
   * Add message to queue
   */
  enqueue(logMessage, options) {
    this.lock.inLock(async () => {
      const item = {
        id: this.nextId++,
        logMessage,
        delayed: !!options?.delay,
        delayMs: options?.delay || 0,
        toolCallIds: options?.toolCallIds,
        released: !options?.delay,
        // Not delayed = already released
        sent: false
      };
      this.queue.push(item);
      if (item.delayed) {
        const timer = setTimeout(() => {
          this.releaseItem(item.id);
        }, item.delayMs);
        this.delayTimers.set(item.id, timer);
      }
    });
    this.scheduleProcessing();
  }
  /**
   * Release specific item by ID
   */
  async releaseItem(itemId) {
    await this.lock.inLock(async () => {
      const item = this.queue.find((i) => i.id === itemId);
      if (item && !item.released) {
        item.released = true;
        const timer = this.delayTimers.get(itemId);
        if (timer) {
          clearTimeout(timer);
          this.delayTimers.delete(itemId);
        }
      }
    });
    this.scheduleProcessing();
  }
  /**
   * Release all messages with specific tool call ID
   */
  async releaseToolCall(toolCallId) {
    await this.lock.inLock(async () => {
      for (const item of this.queue) {
        if (item.toolCallIds?.includes(toolCallId) && !item.released) {
          item.released = true;
          const timer = this.delayTimers.get(item.id);
          if (timer) {
            clearTimeout(timer);
            this.delayTimers.delete(item.id);
          }
        }
      }
    });
    this.scheduleProcessing();
  }
  /**
   * Process queue - send messages in ID order that are released
   * (Internal implementation without lock)
   */
  processQueueInternal() {
    this.queue.sort((a, b) => a.id - b.id);
    while (this.queue.length > 0) {
      const item = this.queue[0];
      if (!item.released) {
        break;
      }
      if (!item.sent) {
        if (item.logMessage.type !== "system") {
          this.sendFunction(item.logMessage);
        }
        item.sent = true;
      }
      this.queue.shift();
    }
  }
  /**
   * Process queue - send messages in ID order that are released
   */
  async processQueue() {
    await this.lock.inLock(async () => {
      this.processQueueInternal();
    });
  }
  /**
   * Flush all messages immediately (for cleanup)
   */
  async flush() {
    await this.lock.inLock(async () => {
      for (const timer of this.delayTimers.values()) {
        clearTimeout(timer);
      }
      this.delayTimers.clear();
      for (const item of this.queue) {
        item.released = true;
      }
      this.processQueueInternal();
    });
  }
  /**
   * Schedule processing on next tick
   */
  scheduleProcessing() {
    if (this.processTimer) {
      clearTimeout(this.processTimer);
    }
    this.processTimer = setTimeout(() => {
      this.processQueue();
    }, 0);
  }
  /**
   * Cleanup timers and resources
   */
  destroy() {
    if (this.processTimer) {
      clearTimeout(this.processTimer);
    }
    for (const timer of this.delayTimers.values()) {
      clearTimeout(timer);
    }
    this.delayTimers.clear();
  }
}

async function claudeRemoteLauncher(session) {
  types.logger.debug("[claudeRemoteLauncher] Starting remote launcher");
  const hasTTY = process.stdout.isTTY && process.stdin.isTTY;
  types.logger.debug(`[claudeRemoteLauncher] TTY available: ${hasTTY}`);
  let messageBuffer = new MessageBuffer();
  let inkInstance = null;
  if (hasTTY) {
    console.clear();
    inkInstance = ink.render(React.createElement(RemoteModeDisplay, {
      messageBuffer,
      logPath: process.env.DEBUG ? session.logPath : void 0,
      onExit: async () => {
        types.logger.debug("[remote]: Exiting client via Ctrl-C");
        if (!exitReason) {
          exitReason = "exit";
        }
        await abort();
      },
      onSwitchToLocal: () => {
        types.logger.debug("[remote]: Switching to local mode via double space");
        doSwitch();
      }
    }), {
      exitOnCtrlC: false,
      patchConsole: false
    });
  }
  if (hasTTY) {
    process.stdin.resume();
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.setEncoding("utf8");
  }
  let exitReason = null;
  let abortController = null;
  let abortFuture = null;
  async function abort() {
    if (abortController && !abortController.signal.aborted) {
      abortController.abort();
    }
    await abortFuture?.promise;
  }
  async function doAbort() {
    types.logger.debug("[remote]: doAbort");
    await abort();
  }
  async function doSwitch() {
    types.logger.debug("[remote]: doSwitch");
    if (!exitReason) {
      exitReason = "switch";
    }
    await abort();
  }
  session.client.rpcHandlerManager.registerHandler("abort", doAbort);
  session.client.rpcHandlerManager.registerHandler("switch", doSwitch);
  const permissionHandler = new PermissionHandler(session);
  const messageQueue = new OutgoingMessageQueue(
    (logMessage) => session.client.sendClaudeSessionMessage(logMessage)
  );
  permissionHandler.setOnPermissionRequest((toolCallId) => {
    messageQueue.releaseToolCall(toolCallId);
  });
  const sdkToLogConverter = new SDKToLogConverter({
    sessionId: session.sessionId || "unknown",
    cwd: session.path,
    version: process.env.npm_package_version
  }, permissionHandler.getResponses());
  let planModeToolCalls = /* @__PURE__ */ new Set();
  let ongoingToolCalls = /* @__PURE__ */ new Map();
  function onMessage(message) {
    formatClaudeMessageForInk(message, messageBuffer);
    permissionHandler.onMessage(message);
    if (message.type === "assistant") {
      let umessage = message;
      if (umessage.message.content && Array.isArray(umessage.message.content)) {
        for (let c of umessage.message.content) {
          if (c.type === "tool_use" && (c.name === "exit_plan_mode" || c.name === "ExitPlanMode")) {
            types.logger.debug("[remote]: detected plan mode tool call " + c.id);
            planModeToolCalls.add(c.id);
          }
        }
      }
    }
    if (message.type === "assistant") {
      let umessage = message;
      if (umessage.message.content && Array.isArray(umessage.message.content)) {
        for (let c of umessage.message.content) {
          if (c.type === "tool_use") {
            types.logger.debug("[remote]: detected tool use " + c.id + " parent: " + umessage.parent_tool_use_id);
            ongoingToolCalls.set(c.id, { parentToolCallId: umessage.parent_tool_use_id ?? null });
          }
        }
      }
    }
    if (message.type === "user") {
      let umessage = message;
      if (umessage.message.content && Array.isArray(umessage.message.content)) {
        for (let c of umessage.message.content) {
          if (c.type === "tool_result" && c.tool_use_id) {
            ongoingToolCalls.delete(c.tool_use_id);
            messageQueue.releaseToolCall(c.tool_use_id);
          }
        }
      }
    }
    let msg = message;
    if (message.type === "user") {
      let umessage = message;
      if (umessage.message.content && Array.isArray(umessage.message.content)) {
        msg = {
          ...umessage,
          message: {
            ...umessage.message,
            content: umessage.message.content.map((c) => {
              if (c.type === "tool_result" && c.tool_use_id && planModeToolCalls.has(c.tool_use_id)) {
                if (c.content === PLAN_FAKE_REJECT) {
                  types.logger.debug("[remote]: hack plan mode exit");
                  types.logger.debugLargeJson("[remote]: hack plan mode exit", c);
                  return {
                    ...c,
                    is_error: false,
                    content: "Plan approved",
                    mode: c.mode
                  };
                } else {
                  return c;
                }
              }
              return c;
            })
          }
        };
      }
    }
    const logMessage = sdkToLogConverter.convert(msg);
    if (logMessage) {
      if (logMessage.type === "user" && logMessage.message?.content) {
        const content = Array.isArray(logMessage.message.content) ? logMessage.message.content : [];
        for (let i = 0; i < content.length; i++) {
          const c = content[i];
          if (c.type === "tool_result" && c.tool_use_id) {
            const responses = permissionHandler.getResponses();
            const response = responses.get(c.tool_use_id);
            if (response) {
              const permissions = {
                date: response.receivedAt || Date.now(),
                result: response.approved ? "approved" : "denied"
              };
              if (response.mode) {
                permissions.mode = response.mode;
              }
              if (response.allowTools && response.allowTools.length > 0) {
                permissions.allowedTools = response.allowTools;
              }
              content[i] = {
                ...c,
                permissions
              };
            }
          }
        }
      }
      if (logMessage.type === "assistant" && message.type === "assistant") {
        const assistantMsg = message;
        const toolCallIds = [];
        if (assistantMsg.message.content && Array.isArray(assistantMsg.message.content)) {
          for (const block of assistantMsg.message.content) {
            if (block.type === "tool_use" && block.id) {
              toolCallIds.push(block.id);
            }
          }
        }
        if (toolCallIds.length > 0) {
          const isSidechain = assistantMsg.parent_tool_use_id !== void 0;
          if (!isSidechain) {
            messageQueue.enqueue(logMessage, {
              delay: 250,
              toolCallIds
            });
            return;
          }
        }
      }
      messageQueue.enqueue(logMessage);
    }
    if (message.type === "assistant") {
      let umessage = message;
      if (umessage.message.content && Array.isArray(umessage.message.content)) {
        for (let c of umessage.message.content) {
          if (c.type === "tool_use" && c.name === "Task" && c.input && typeof c.input.prompt === "string") {
            const logMessage2 = sdkToLogConverter.convertSidechainUserMessage(c.id, c.input.prompt);
            if (logMessage2) {
              messageQueue.enqueue(logMessage2);
            }
          }
        }
      }
    }
  }
  try {
    let pending = null;
    let previousSessionId = null;
    while (!exitReason) {
      types.logger.debug("[remote]: launch");
      messageBuffer.addMessage("\u2550".repeat(40), "status");
      const isNewSession = session.sessionId !== previousSessionId;
      if (isNewSession) {
        messageBuffer.addMessage("Starting new Claude session...", "status");
        permissionHandler.reset();
        sdkToLogConverter.resetParentChain();
        types.logger.debug(`[remote]: New session detected (previous: ${previousSessionId}, current: ${session.sessionId})`);
      } else {
        messageBuffer.addMessage("Continuing Claude session...", "status");
        types.logger.debug(`[remote]: Continuing existing session: ${session.sessionId}`);
      }
      previousSessionId = session.sessionId;
      const controller = new AbortController();
      abortController = controller;
      abortFuture = new Future();
      let modeHash = null;
      let mode = null;
      try {
        const remoteResult = await claudeRemote({
          sessionId: session.sessionId,
          path: session.path,
          allowedTools: session.allowedTools ?? [],
          mcpServers: session.mcpServers,
          hookSettingsPath: session.hookSettingsPath,
          canCallTool: permissionHandler.handleToolCall,
          isAborted: (toolCallId) => {
            return permissionHandler.isAborted(toolCallId);
          },
          nextMessage: async () => {
            if (pending) {
              let p = pending;
              pending = null;
              permissionHandler.handleModeChange(p.mode.permissionMode);
              return p;
            }
            let msg = await session.queue.waitForMessagesAndGetAsString(controller.signal);
            if (msg) {
              if (modeHash && msg.hash !== modeHash || msg.isolate) {
                types.logger.debug("[remote]: mode has changed, pending message");
                pending = msg;
                return null;
              }
              modeHash = msg.hash;
              mode = msg.mode;
              permissionHandler.handleModeChange(mode.permissionMode);
              return {
                message: msg.message,
                mode: msg.mode
              };
            }
            return null;
          },
          onSessionFound: (sessionId) => {
            sdkToLogConverter.updateSessionId(sessionId);
            session.onSessionFound(sessionId);
          },
          onThinkingChange: session.onThinkingChange,
          claudeEnvVars: session.claudeEnvVars,
          claudeArgs: session.claudeArgs,
          onMessage,
          onCompletionEvent: (message) => {
            types.logger.debug(`[remote]: Completion event: ${message}`);
            session.client.sendSessionEvent({ type: "message", message });
          },
          onSessionReset: () => {
            types.logger.debug("[remote]: Session reset");
            session.clearSessionId();
          },
          onReady: () => {
            if (!pending && session.queue.size() === 0) {
              session.client.sendSessionEvent({ type: "ready" });
              session.api.push().sendToAllDevices(
                "It's ready!",
                `Claude is waiting for your command`,
                { sessionId: session.client.sessionId }
              );
            }
          },
          signal: abortController.signal
        });
        session.consumeOneTimeFlags();
        if (!exitReason && abortController.signal.aborted) {
          session.client.sendSessionEvent({ type: "message", message: "Aborted by user" });
        }
      } catch (e) {
        types.logger.debug("[remote]: launch error", e);
        if (!exitReason) {
          session.client.sendSessionEvent({ type: "message", message: "Process exited unexpectedly" });
          continue;
        }
      } finally {
        types.logger.debug("[remote]: launch finally");
        for (let [toolCallId, { parentToolCallId }] of ongoingToolCalls) {
          const converted = sdkToLogConverter.generateInterruptedToolResult(toolCallId, parentToolCallId);
          if (converted) {
            types.logger.debug("[remote]: terminating tool call " + toolCallId + " parent: " + parentToolCallId);
            session.client.sendClaudeSessionMessage(converted);
          }
        }
        ongoingToolCalls.clear();
        types.logger.debug("[remote]: flushing message queue");
        await messageQueue.flush();
        messageQueue.destroy();
        types.logger.debug("[remote]: message queue flushed");
        abortController = null;
        abortFuture?.resolve(void 0);
        abortFuture = null;
        types.logger.debug("[remote]: launch done");
        permissionHandler.reset();
        modeHash = null;
        mode = null;
      }
    }
  } finally {
    permissionHandler.reset();
    process.stdin.off("data", abort);
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    if (inkInstance) {
      inkInstance.unmount();
    }
    messageBuffer.clear();
    if (abortFuture) {
      abortFuture.resolve(void 0);
    }
  }
  return exitReason || "exit";
}

async function loop(opts) {
  const logPath = types.logger.logFilePath;
  let session = new Session({
    api: opts.api,
    client: opts.session,
    path: opts.path,
    sessionId: null,
    claudeEnvVars: opts.claudeEnvVars,
    claudeArgs: opts.claudeArgs,
    mcpServers: opts.mcpServers,
    logPath,
    messageQueue: opts.messageQueue,
    allowedTools: opts.allowedTools,
    onModeChange: opts.onModeChange,
    hookSettingsPath: opts.hookSettingsPath
  });
  if (opts.onSessionReady) {
    opts.onSessionReady(session);
  }
  let mode = opts.startingMode ?? "local";
  while (true) {
    types.logger.debug(`[loop] Iteration with mode: ${mode}`);
    if (mode === "local") {
      let reason = await claudeLocalLauncher(session);
      if (reason === "exit") {
        return;
      }
      mode = "remote";
      if (opts.onModeChange) {
        opts.onModeChange(mode);
      }
      continue;
    }
    if (mode === "remote") {
      let reason = await claudeRemoteLauncher(session);
      if (reason === "exit") {
        return;
      }
      mode = "local";
      if (opts.onModeChange) {
        opts.onModeChange(mode);
      }
      continue;
    }
  }
}

class MessageQueue2 {
  queue = [];
  // Made public for testing
  waiter = null;
  closed = false;
  onMessageHandler = null;
  modeHasher;
  constructor(modeHasher, onMessageHandler = null) {
    this.modeHasher = modeHasher;
    this.onMessageHandler = onMessageHandler;
    types.logger.debug(`[MessageQueue2] Initialized`);
  }
  /**
   * Set a handler that will be called when a message arrives
   */
  setOnMessage(handler) {
    this.onMessageHandler = handler;
  }
  /**
   * Push a message to the queue with a mode.
   */
  push(message, mode) {
    if (this.closed) {
      throw new Error("Cannot push to closed queue");
    }
    const modeHash = this.modeHasher(mode);
    types.logger.debug(`[MessageQueue2] push() called with mode hash: ${modeHash}`);
    this.queue.push({
      message,
      mode,
      modeHash,
      isolate: false
    });
    if (this.onMessageHandler) {
      this.onMessageHandler(message, mode);
    }
    if (this.waiter) {
      types.logger.debug(`[MessageQueue2] Notifying waiter`);
      const waiter = this.waiter;
      this.waiter = null;
      waiter(true);
    }
    types.logger.debug(`[MessageQueue2] push() completed. Queue size: ${this.queue.length}`);
  }
  /**
   * Push a message immediately without batching delay.
   * Does not clear the queue or enforce isolation.
   */
  pushImmediate(message, mode) {
    if (this.closed) {
      throw new Error("Cannot push to closed queue");
    }
    const modeHash = this.modeHasher(mode);
    types.logger.debug(`[MessageQueue2] pushImmediate() called with mode hash: ${modeHash}`);
    this.queue.push({
      message,
      mode,
      modeHash,
      isolate: false
    });
    if (this.onMessageHandler) {
      this.onMessageHandler(message, mode);
    }
    if (this.waiter) {
      types.logger.debug(`[MessageQueue2] Notifying waiter for immediate message`);
      const waiter = this.waiter;
      this.waiter = null;
      waiter(true);
    }
    types.logger.debug(`[MessageQueue2] pushImmediate() completed. Queue size: ${this.queue.length}`);
  }
  /**
   * Push a message that must be processed in complete isolation.
   * Clears any pending messages and ensures this message is never batched with others.
   * Used for special commands that require dedicated processing.
   */
  pushIsolateAndClear(message, mode) {
    if (this.closed) {
      throw new Error("Cannot push to closed queue");
    }
    const modeHash = this.modeHasher(mode);
    types.logger.debug(`[MessageQueue2] pushIsolateAndClear() called with mode hash: ${modeHash} - clearing ${this.queue.length} pending messages`);
    this.queue = [];
    this.queue.push({
      message,
      mode,
      modeHash,
      isolate: true
    });
    if (this.onMessageHandler) {
      this.onMessageHandler(message, mode);
    }
    if (this.waiter) {
      types.logger.debug(`[MessageQueue2] Notifying waiter for isolated message`);
      const waiter = this.waiter;
      this.waiter = null;
      waiter(true);
    }
    types.logger.debug(`[MessageQueue2] pushIsolateAndClear() completed. Queue size: ${this.queue.length}`);
  }
  /**
   * Push a message to the beginning of the queue with a mode.
   */
  unshift(message, mode) {
    if (this.closed) {
      throw new Error("Cannot unshift to closed queue");
    }
    const modeHash = this.modeHasher(mode);
    types.logger.debug(`[MessageQueue2] unshift() called with mode hash: ${modeHash}`);
    this.queue.unshift({
      message,
      mode,
      modeHash,
      isolate: false
    });
    if (this.onMessageHandler) {
      this.onMessageHandler(message, mode);
    }
    if (this.waiter) {
      types.logger.debug(`[MessageQueue2] Notifying waiter`);
      const waiter = this.waiter;
      this.waiter = null;
      waiter(true);
    }
    types.logger.debug(`[MessageQueue2] unshift() completed. Queue size: ${this.queue.length}`);
  }
  /**
   * Reset the queue - clears all messages and resets to empty state
   */
  reset() {
    types.logger.debug(`[MessageQueue2] reset() called. Clearing ${this.queue.length} messages`);
    this.queue = [];
    this.closed = false;
    this.waiter = null;
  }
  /**
   * Close the queue - no more messages can be pushed
   */
  close() {
    types.logger.debug(`[MessageQueue2] close() called`);
    this.closed = true;
    if (this.waiter) {
      const waiter = this.waiter;
      this.waiter = null;
      waiter(false);
    }
  }
  /**
   * Check if the queue is closed
   */
  isClosed() {
    return this.closed;
  }
  /**
   * Get the current queue size
   */
  size() {
    return this.queue.length;
  }
  /**
   * Wait for messages and return all messages with the same mode as a single string
   * Returns { message: string, mode: T } or null if aborted/closed
   */
  async waitForMessagesAndGetAsString(abortSignal) {
    if (this.queue.length > 0) {
      return this.collectBatch();
    }
    if (this.closed || abortSignal?.aborted) {
      return null;
    }
    const hasMessages = await this.waitForMessages(abortSignal);
    if (!hasMessages) {
      return null;
    }
    return this.collectBatch();
  }
  /**
   * Collect a batch of messages with the same mode, respecting isolation requirements
   */
  collectBatch() {
    if (this.queue.length === 0) {
      return null;
    }
    const firstItem = this.queue[0];
    const sameModeMessages = [];
    let mode = firstItem.mode;
    let isolate = firstItem.isolate ?? false;
    const targetModeHash = firstItem.modeHash;
    if (firstItem.isolate) {
      const item = this.queue.shift();
      sameModeMessages.push(item.message);
      types.logger.debug(`[MessageQueue2] Collected isolated message with mode hash: ${targetModeHash}`);
    } else {
      while (this.queue.length > 0 && this.queue[0].modeHash === targetModeHash && !this.queue[0].isolate) {
        const item = this.queue.shift();
        sameModeMessages.push(item.message);
      }
      types.logger.debug(`[MessageQueue2] Collected batch of ${sameModeMessages.length} messages with mode hash: ${targetModeHash}`);
    }
    const combinedMessage = sameModeMessages.join("\n");
    return {
      message: combinedMessage,
      mode,
      hash: targetModeHash,
      isolate
    };
  }
  /**
   * Wait for messages to arrive
   */
  waitForMessages(abortSignal) {
    return new Promise((resolve) => {
      let abortHandler = null;
      if (abortSignal) {
        abortHandler = () => {
          types.logger.debug("[MessageQueue2] Wait aborted");
          if (this.waiter === waiterFunc) {
            this.waiter = null;
          }
          resolve(false);
        };
        abortSignal.addEventListener("abort", abortHandler);
      }
      const waiterFunc = (hasMessages) => {
        if (abortHandler && abortSignal) {
          abortSignal.removeEventListener("abort", abortHandler);
        }
        resolve(hasMessages);
      };
      if (this.queue.length > 0) {
        if (abortHandler && abortSignal) {
          abortSignal.removeEventListener("abort", abortHandler);
        }
        resolve(true);
        return;
      }
      if (this.closed || abortSignal?.aborted) {
        if (abortHandler && abortSignal) {
          abortSignal.removeEventListener("abort", abortHandler);
        }
        resolve(false);
        return;
      }
      this.waiter = waiterFunc;
      types.logger.debug("[MessageQueue2] Waiting for messages...");
    });
  }
}

function deterministicStringify(obj, options = {}) {
  const {
    undefinedBehavior = "omit",
    sortArrays = false,
    replacer,
    includeSymbols = false
  } = options;
  const seen = /* @__PURE__ */ new WeakSet();
  function processValue(value, key) {
    if (replacer && key !== void 0) {
      value = replacer(key, value);
    }
    if (value === null) return null;
    if (value === void 0) {
      switch (undefinedBehavior) {
        case "omit":
          return void 0;
        case "null":
          return null;
        case "throw":
          throw new Error(`Undefined value at key: ${key}`);
      }
    }
    if (typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
      return value;
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (value instanceof RegExp) {
      return value.toString();
    }
    if (typeof value === "function") {
      return void 0;
    }
    if (typeof value === "symbol") {
      return includeSymbols ? value.toString() : void 0;
    }
    if (typeof value === "bigint") {
      return value.toString() + "n";
    }
    if (seen.has(value)) {
      throw new Error("Circular reference detected");
    }
    seen.add(value);
    if (Array.isArray(value)) {
      const processed2 = value.map((item, index) => processValue(item, String(index))).filter((item) => item !== void 0);
      if (sortArrays) {
        processed2.sort((a, b) => {
          const aStr = JSON.stringify(processValue(a));
          const bStr = JSON.stringify(processValue(b));
          return aStr.localeCompare(bStr);
        });
      }
      seen.delete(value);
      return processed2;
    }
    if (value.constructor === Object || value.constructor === void 0) {
      const processed2 = {};
      const keys = Object.keys(value).sort();
      for (const k of keys) {
        const processedValue = processValue(value[k], k);
        if (processedValue !== void 0) {
          processed2[k] = processedValue;
        }
      }
      seen.delete(value);
      return processed2;
    }
    try {
      const plain = { ...value };
      seen.delete(value);
      return processValue(plain, key);
    } catch {
      seen.delete(value);
      return String(value);
    }
  }
  const processed = processValue(obj);
  return JSON.stringify(processed);
}
function hashObject(obj, options, encoding = "hex") {
  const jsonString = deterministicStringify(obj, options);
  return crypto.createHash("sha256").update(jsonString).digest(encoding);
}

let caffeinateProcess = null;
function startCaffeinate() {
  if (types.configuration.disableCaffeinate) {
    types.logger.debug("[caffeinate] Caffeinate disabled via HAPPY_DISABLE_CAFFEINATE environment variable");
    return false;
  }
  if (process.platform !== "darwin") {
    types.logger.debug("[caffeinate] Not on macOS, skipping caffeinate");
    return false;
  }
  if (caffeinateProcess && !caffeinateProcess.killed) {
    types.logger.debug("[caffeinate] Caffeinate already running");
    return true;
  }
  try {
    caffeinateProcess = child_process.spawn("caffeinate", ["-im"], {
      stdio: "ignore",
      detached: false
    });
    caffeinateProcess.on("error", (error) => {
      types.logger.debug("[caffeinate] Error starting caffeinate:", error);
      caffeinateProcess = null;
    });
    caffeinateProcess.on("exit", (code, signal) => {
      types.logger.debug(`[caffeinate] Process exited with code ${code}, signal ${signal}`);
      caffeinateProcess = null;
    });
    types.logger.debug(`[caffeinate] Started with PID ${caffeinateProcess.pid}`);
    setupCleanupHandlers();
    return true;
  } catch (error) {
    types.logger.debug("[caffeinate] Failed to start caffeinate:", error);
    return false;
  }
}
let isStopping = false;
async function stopCaffeinate() {
  if (isStopping) {
    types.logger.debug("[caffeinate] Already stopping, skipping");
    return;
  }
  if (caffeinateProcess && !caffeinateProcess.killed) {
    isStopping = true;
    types.logger.debug(`[caffeinate] Stopping caffeinate process PID ${caffeinateProcess.pid}`);
    try {
      caffeinateProcess.kill("SIGTERM");
      await new Promise((resolve) => setTimeout(resolve, 1e3));
      if (caffeinateProcess && !caffeinateProcess.killed) {
        types.logger.debug("[caffeinate] Force killing caffeinate process");
        caffeinateProcess.kill("SIGKILL");
      }
      caffeinateProcess = null;
      isStopping = false;
    } catch (error) {
      types.logger.debug("[caffeinate] Error stopping caffeinate:", error);
      isStopping = false;
    }
  }
}
let cleanupHandlersSet = false;
function setupCleanupHandlers() {
  if (cleanupHandlersSet) {
    return;
  }
  cleanupHandlersSet = true;
  const cleanup = () => {
    stopCaffeinate();
  };
  process.on("exit", cleanup);
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
  process.on("SIGUSR1", cleanup);
  process.on("SIGUSR2", cleanup);
  process.on("uncaughtException", (error) => {
    types.logger.debug("[caffeinate] Uncaught exception, cleaning up:", error);
    cleanup();
  });
  process.on("unhandledRejection", (reason, promise) => {
    types.logger.debug("[caffeinate] Unhandled rejection, cleaning up:", reason);
    cleanup();
  });
}

async function extractSDKMetadata() {
  const abortController = new AbortController();
  try {
    types.logger.debug("[metadataExtractor] Starting SDK metadata extraction");
    const sdkQuery = query({
      prompt: "hello",
      options: {
        allowedTools: ["Bash(echo)"],
        maxTurns: 1,
        abort: abortController.signal
      }
    });
    for await (const message of sdkQuery) {
      if (message.type === "system" && message.subtype === "init") {
        const systemMessage = message;
        const metadata = {
          tools: systemMessage.tools,
          slashCommands: systemMessage.slash_commands
        };
        types.logger.debug("[metadataExtractor] Captured SDK metadata:", metadata);
        abortController.abort();
        return metadata;
      }
    }
    types.logger.debug("[metadataExtractor] No init message received from SDK");
    return {};
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      types.logger.debug("[metadataExtractor] SDK query aborted after capturing metadata");
      return {};
    }
    types.logger.debug("[metadataExtractor] Error extracting SDK metadata:", error);
    return {};
  }
}
function extractSDKMetadataAsync(onComplete) {
  extractSDKMetadata().then((metadata) => {
    if (metadata.tools || metadata.slashCommands) {
      onComplete(metadata);
    }
  }).catch((error) => {
    types.logger.debug("[metadataExtractor] Async extraction failed:", error);
  });
}

async function daemonPost(path, body) {
  const state = await types.readDaemonState();
  if (!state?.httpPort) {
    const errorMessage = "No daemon running, no state file found";
    types.logger.debug(`[CONTROL CLIENT] ${errorMessage}`);
    return {
      error: errorMessage
    };
  }
  try {
    process.kill(state.pid, 0);
  } catch (error) {
    const errorMessage = "Daemon is not running, file is stale";
    types.logger.debug(`[CONTROL CLIENT] ${errorMessage}`);
    return {
      error: errorMessage
    };
  }
  try {
    const timeout = process.env.HAPPY_DAEMON_HTTP_TIMEOUT ? parseInt(process.env.HAPPY_DAEMON_HTTP_TIMEOUT) : 1e4;
    const response = await fetch(`http://127.0.0.1:${state.httpPort}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
      // Mostly increased for stress test
      signal: AbortSignal.timeout(timeout)
    });
    if (!response.ok) {
      const errorMessage = `Request failed: ${path}, HTTP ${response.status}`;
      types.logger.debug(`[CONTROL CLIENT] ${errorMessage}`);
      return {
        error: errorMessage
      };
    }
    return await response.json();
  } catch (error) {
    const errorMessage = `Request failed: ${path}, ${error instanceof Error ? error.message : "Unknown error"}`;
    types.logger.debug(`[CONTROL CLIENT] ${errorMessage}`);
    return {
      error: errorMessage
    };
  }
}
async function notifyDaemonSessionStarted(sessionId, metadata) {
  return await daemonPost("/session-started", {
    sessionId,
    metadata
  });
}
async function listDaemonSessions() {
  const result = await daemonPost("/list");
  return result.children || [];
}
async function stopDaemonSession(sessionId) {
  const result = await daemonPost("/stop-session", { sessionId });
  return result.success || false;
}
async function stopDaemonHttp() {
  await daemonPost("/stop");
}
async function checkIfDaemonRunningAndCleanupStaleState() {
  const state = await types.readDaemonState();
  if (!state) {
    return false;
  }
  try {
    process.kill(state.pid, 0);
    return true;
  } catch {
    types.logger.debug("[DAEMON RUN] Daemon PID not running, cleaning up state");
    await cleanupDaemonState();
    return false;
  }
}
async function isDaemonRunningCurrentlyInstalledHappyVersion() {
  types.logger.debug("[DAEMON CONTROL] Checking if daemon is running same version");
  const runningDaemon = await checkIfDaemonRunningAndCleanupStaleState();
  if (!runningDaemon) {
    types.logger.debug("[DAEMON CONTROL] No daemon running, returning false");
    return false;
  }
  const state = await types.readDaemonState();
  if (!state) {
    types.logger.debug("[DAEMON CONTROL] No daemon state found, returning false");
    return false;
  }
  try {
    const packageJsonPath = path.join(types.projectPath(), "package.json");
    const packageJson = JSON.parse(fs$2.readFileSync(packageJsonPath, "utf-8"));
    const currentCliVersion = packageJson.version;
    types.logger.debug(`[DAEMON CONTROL] Current CLI version: ${currentCliVersion}, Daemon started with version: ${state.startedWithCliVersion}`);
    return currentCliVersion === state.startedWithCliVersion;
  } catch (error) {
    types.logger.debug("[DAEMON CONTROL] Error checking daemon version", error);
    return false;
  }
}
async function cleanupDaemonState() {
  try {
    await types.clearDaemonState();
    types.logger.debug("[DAEMON RUN] Daemon state file removed");
  } catch (error) {
    types.logger.debug("[DAEMON RUN] Error cleaning up daemon metadata", error);
  }
}
async function stopDaemon() {
  try {
    const state = await types.readDaemonState();
    if (!state) {
      types.logger.debug("No daemon state found");
      return;
    }
    types.logger.debug(`Stopping daemon with PID ${state.pid}`);
    try {
      await stopDaemonHttp();
      await waitForProcessDeath(state.pid, 2e3);
      types.logger.debug("Daemon stopped gracefully via HTTP");
      return;
    } catch (error) {
      types.logger.debug("HTTP stop failed, will force kill", error);
    }
    try {
      process.kill(state.pid, "SIGKILL");
      types.logger.debug("Force killed daemon");
    } catch (error) {
      types.logger.debug("Daemon already dead");
    }
  } catch (error) {
    types.logger.debug("Error stopping daemon", error);
  }
}
async function waitForProcessDeath(pid, timeout) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      process.kill(pid, 0);
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch {
      return;
    }
  }
  throw new Error("Process did not die within timeout");
}

async function findAllHappyProcesses() {
  try {
    const processes = await psList();
    const allProcesses = [];
    for (const proc of processes) {
      const cmd = proc.cmd || "";
      const name = proc.name || "";
      const isHappy = name.includes("happy") || name === "node" && (cmd.includes("happy-cli") || cmd.includes("dist/index.mjs")) || cmd.includes("happy.mjs") || cmd.includes("happy-coder") || cmd.includes("tsx") && cmd.includes("src/index.ts") && cmd.includes("happy-cli");
      if (!isHappy) continue;
      let type = "unknown";
      if (proc.pid === process.pid) {
        type = "current";
      } else if (cmd.includes("--version")) {
        type = cmd.includes("tsx") ? "dev-daemon-version-check" : "daemon-version-check";
      } else if (cmd.includes("daemon start-sync") || cmd.includes("daemon start")) {
        type = cmd.includes("tsx") ? "dev-daemon" : "daemon";
      } else if (cmd.includes("--started-by daemon")) {
        type = cmd.includes("tsx") ? "dev-daemon-spawned" : "daemon-spawned-session";
      } else if (cmd.includes("doctor")) {
        type = cmd.includes("tsx") ? "dev-doctor" : "doctor";
      } else if (cmd.includes("--yolo")) {
        type = "dev-session";
      } else {
        type = cmd.includes("tsx") ? "dev-related" : "user-session";
      }
      allProcesses.push({ pid: proc.pid, command: cmd || name, type });
    }
    return allProcesses;
  } catch (error) {
    return [];
  }
}
async function findRunawayHappyProcesses() {
  const allProcesses = await findAllHappyProcesses();
  return allProcesses.filter(
    (p) => p.pid !== process.pid && (p.type === "daemon" || p.type === "dev-daemon" || p.type === "daemon-spawned-session" || p.type === "dev-daemon-spawned" || p.type === "daemon-version-check" || p.type === "dev-daemon-version-check")
  ).map((p) => ({ pid: p.pid, command: p.command }));
}
async function killRunawayHappyProcesses() {
  const runawayProcesses = await findRunawayHappyProcesses();
  const errors = [];
  let killed = 0;
  for (const { pid, command } of runawayProcesses) {
    try {
      console.log(`Killing runaway process PID ${pid}: ${command}`);
      if (process.platform === "win32") {
        const result = spawn.sync("taskkill", ["/F", "/PID", pid.toString()], { stdio: "pipe" });
        if (result.error) throw result.error;
        if (result.status !== 0) throw new Error(`taskkill exited with code ${result.status}`);
      } else {
        process.kill(pid, "SIGTERM");
        await new Promise((resolve) => setTimeout(resolve, 1e3));
        const processes = await psList();
        const stillAlive = processes.find((p) => p.pid === pid);
        if (stillAlive) {
          console.log(`Process PID ${pid} ignored SIGTERM, using SIGKILL`);
          process.kill(pid, "SIGKILL");
        }
      }
      console.log(`Successfully killed runaway process PID ${pid}`);
      killed++;
    } catch (error) {
      const errorMessage = error.message;
      errors.push({ pid, error: errorMessage });
      console.log(`Failed to kill process PID ${pid}: ${errorMessage}`);
    }
  }
  return { killed, errors };
}

function getEnvironmentInfo() {
  return {
    PWD: process.env.PWD,
    HAPPY_HOME_DIR: process.env.HAPPY_HOME_DIR,
    HAPPY_SERVER_URL: process.env.HAPPY_SERVER_URL,
    HAPPY_PROJECT_ROOT: process.env.HAPPY_PROJECT_ROOT,
    DANGEROUSLY_LOG_TO_SERVER_FOR_AI_AUTO_DEBUGGING: process.env.DANGEROUSLY_LOG_TO_SERVER_FOR_AI_AUTO_DEBUGGING,
    NODE_ENV: process.env.NODE_ENV,
    DEBUG: process.env.DEBUG,
    workingDirectory: process.cwd(),
    processArgv: process.argv,
    happyDir: types.configuration?.happyHomeDir,
    serverUrl: types.configuration?.serverUrl,
    logsDir: types.configuration?.logsDir,
    processPid: process.pid,
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    user: process.env.USER,
    home: process.env.HOME,
    shell: process.env.SHELL,
    terminal: process.env.TERM
  };
}
function getLogFiles(logDir) {
  if (!fs.existsSync(logDir)) {
    return [];
  }
  try {
    return fs.readdirSync(logDir).filter((file) => file.endsWith(".log")).map((file) => {
      const path = node_path.join(logDir, file);
      const stats = fs.statSync(path);
      return { file, path, modified: stats.mtime };
    }).sort((a, b) => b.modified.getTime() - a.modified.getTime());
  } catch {
    return [];
  }
}
async function runDoctorCommand(filter) {
  if (!filter) {
    filter = "all";
  }
  console.log(chalk.bold.cyan("\n\u{1FA7A} Happy CLI Doctor\n"));
  if (filter === "all") {
    console.log(chalk.bold("\u{1F4CB} Basic Information"));
    console.log(`Happy CLI Version: ${chalk.green(types.packageJson.version)}`);
    console.log(`Platform: ${chalk.green(process.platform)} ${process.arch}`);
    console.log(`Node.js Version: ${chalk.green(process.version)}`);
    console.log("");
    console.log(chalk.bold("\u{1F527} Daemon Spawn Diagnostics"));
    const projectRoot = types.projectPath();
    const wrapperPath = node_path.join(projectRoot, "bin", "happy.mjs");
    const cliEntrypoint = node_path.join(projectRoot, "dist", "index.mjs");
    console.log(`Project Root: ${chalk.blue(projectRoot)}`);
    console.log(`Wrapper Script: ${chalk.blue(wrapperPath)}`);
    console.log(`CLI Entrypoint: ${chalk.blue(cliEntrypoint)}`);
    console.log(`Wrapper Exists: ${fs.existsSync(wrapperPath) ? chalk.green("\u2713 Yes") : chalk.red("\u274C No")}`);
    console.log(`CLI Exists: ${fs.existsSync(cliEntrypoint) ? chalk.green("\u2713 Yes") : chalk.red("\u274C No")}`);
    console.log("");
    console.log(chalk.bold("\u2699\uFE0F  Configuration"));
    console.log(`Happy Home: ${chalk.blue(types.configuration.happyHomeDir)}`);
    console.log(`Server URL: ${chalk.blue(types.configuration.serverUrl)}`);
    console.log(`Logs Dir: ${chalk.blue(types.configuration.logsDir)}`);
    console.log(chalk.bold("\n\u{1F30D} Environment Variables"));
    const env = getEnvironmentInfo();
    console.log(`HAPPY_HOME_DIR: ${env.HAPPY_HOME_DIR ? chalk.green(env.HAPPY_HOME_DIR) : chalk.gray("not set")}`);
    console.log(`HAPPY_SERVER_URL: ${env.HAPPY_SERVER_URL ? chalk.green(env.HAPPY_SERVER_URL) : chalk.gray("not set")}`);
    console.log(`DANGEROUSLY_LOG_TO_SERVER: ${env.DANGEROUSLY_LOG_TO_SERVER_FOR_AI_AUTO_DEBUGGING ? chalk.yellow("ENABLED") : chalk.gray("not set")}`);
    console.log(`DEBUG: ${env.DEBUG ? chalk.green(env.DEBUG) : chalk.gray("not set")}`);
    console.log(`NODE_ENV: ${env.NODE_ENV ? chalk.green(env.NODE_ENV) : chalk.gray("not set")}`);
    try {
      const settings = await types.readSettings();
      console.log(chalk.bold("\n\u{1F4C4} Settings (settings.json):"));
      console.log(chalk.gray(JSON.stringify(settings, null, 2)));
    } catch (error) {
      console.log(chalk.bold("\n\u{1F4C4} Settings:"));
      console.log(chalk.red("\u274C Failed to read settings"));
    }
    console.log(chalk.bold("\n\u{1F510} Authentication"));
    try {
      const credentials = await types.readCredentials();
      if (credentials) {
        console.log(chalk.green("\u2713 Authenticated (credentials found)"));
      } else {
        console.log(chalk.yellow("\u26A0\uFE0F  Not authenticated (no credentials)"));
      }
    } catch (error) {
      console.log(chalk.red("\u274C Error reading credentials"));
    }
  }
  console.log(chalk.bold("\n\u{1F916} Daemon Status"));
  try {
    const isRunning = await checkIfDaemonRunningAndCleanupStaleState();
    const state = await types.readDaemonState();
    if (isRunning && state) {
      console.log(chalk.green("\u2713 Daemon is running"));
      console.log(`  PID: ${state.pid}`);
      console.log(`  Started: ${new Date(state.startTime).toLocaleString()}`);
      console.log(`  CLI Version: ${state.startedWithCliVersion}`);
      if (state.httpPort) {
        console.log(`  HTTP Port: ${state.httpPort}`);
      }
    } else if (state && !isRunning) {
      console.log(chalk.yellow("\u26A0\uFE0F  Daemon state exists but process not running (stale)"));
    } else {
      console.log(chalk.red("\u274C Daemon is not running"));
    }
    if (state) {
      console.log(chalk.bold("\n\u{1F4C4} Daemon State:"));
      console.log(chalk.blue(`Location: ${types.configuration.daemonStateFile}`));
      console.log(chalk.gray(JSON.stringify(state, null, 2)));
    }
    const allProcesses = await findAllHappyProcesses();
    if (allProcesses.length > 0) {
      console.log(chalk.bold("\n\u{1F50D} All Happy CLI Processes"));
      const grouped = allProcesses.reduce((groups, process2) => {
        if (!groups[process2.type]) groups[process2.type] = [];
        groups[process2.type].push(process2);
        return groups;
      }, {});
      Object.entries(grouped).forEach(([type, processes]) => {
        const typeLabels = {
          "current": "\u{1F4CD} Current Process",
          "daemon": "\u{1F916} Daemon",
          "daemon-version-check": "\u{1F50D} Daemon Version Check (stuck)",
          "daemon-spawned-session": "\u{1F517} Daemon-Spawned Sessions",
          "user-session": "\u{1F464} User Sessions",
          "dev-daemon": "\u{1F6E0}\uFE0F  Dev Daemon",
          "dev-daemon-version-check": "\u{1F6E0}\uFE0F  Dev Daemon Version Check (stuck)",
          "dev-session": "\u{1F6E0}\uFE0F  Dev Sessions",
          "dev-doctor": "\u{1F6E0}\uFE0F  Dev Doctor",
          "dev-related": "\u{1F6E0}\uFE0F  Dev Related",
          "doctor": "\u{1FA7A} Doctor",
          "unknown": "\u2753 Unknown"
        };
        console.log(chalk.blue(`
${typeLabels[type] || type}:`));
        processes.forEach(({ pid, command }) => {
          const color = type === "current" ? chalk.green : type.startsWith("dev") ? chalk.cyan : type.includes("daemon") ? chalk.blue : chalk.gray;
          console.log(`  ${color(`PID ${pid}`)}: ${chalk.gray(command)}`);
        });
      });
    } else {
      console.log(chalk.red("\u274C No happy processes found"));
    }
    if (filter === "all" && allProcesses.length > 1) {
      console.log(chalk.bold("\n\u{1F4A1} Process Management"));
      console.log(chalk.gray("To clean up runaway processes: happy doctor clean"));
    }
  } catch (error) {
    console.log(chalk.red("\u274C Error checking daemon status"));
  }
  if (filter === "all") {
    console.log(chalk.bold("\n\u{1F4DD} Log Files"));
    const allLogs = getLogFiles(types.configuration.logsDir);
    if (allLogs.length > 0) {
      const daemonLogs = allLogs.filter(({ file }) => file.includes("daemon"));
      const regularLogs = allLogs.filter(({ file }) => !file.includes("daemon"));
      if (regularLogs.length > 0) {
        console.log(chalk.blue("\nRecent Logs:"));
        const logsToShow = regularLogs.slice(0, 10);
        logsToShow.forEach(({ file, path, modified }) => {
          console.log(`  ${chalk.green(file)} - ${modified.toLocaleString()}`);
          console.log(chalk.gray(`    ${path}`));
        });
        if (regularLogs.length > 10) {
          console.log(chalk.gray(`  ... and ${regularLogs.length - 10} more log files`));
        }
      }
      if (daemonLogs.length > 0) {
        console.log(chalk.blue("\nDaemon Logs:"));
        const daemonLogsToShow = daemonLogs.slice(0, 5);
        daemonLogsToShow.forEach(({ file, path, modified }) => {
          console.log(`  ${chalk.green(file)} - ${modified.toLocaleString()}`);
          console.log(chalk.gray(`    ${path}`));
        });
        if (daemonLogs.length > 5) {
          console.log(chalk.gray(`  ... and ${daemonLogs.length - 5} more daemon log files`));
        }
      } else {
        console.log(chalk.yellow("\nNo daemon log files found"));
      }
    } else {
      console.log(chalk.yellow("No log files found"));
    }
    console.log(chalk.bold("\n\u{1F41B} Support & Bug Reports"));
    console.log(`Report issues: ${chalk.blue("https://github.com/slopus/happy-cli/issues")}`);
    console.log(`Documentation: ${chalk.blue("https://happy.engineering/")}`);
  }
  console.log(chalk.green("\n\u2705 Doctor diagnosis complete!\n"));
}

function displayQRCode(url) {
  console.log("=".repeat(80));
  console.log("\u{1F4F1} To authenticate, scan this QR code with your mobile device:");
  console.log("=".repeat(80));
  qrcode.generate(url, { small: true }, (qr) => {
    for (let l of qr.split("\n")) {
      console.log(" ".repeat(10) + l);
    }
  });
  console.log("=".repeat(80));
}

function generateWebAuthUrl(publicKey) {
  const publicKeyBase64 = types.encodeBase64(publicKey, "base64url");
  return `${types.configuration.webappUrl}/terminal/connect#key=${publicKeyBase64}`;
}

async function openBrowser(url) {
  try {
    if (!process.stdout.isTTY || process.env.CI || process.env.HEADLESS) {
      types.logger.debug("[browser] Headless environment detected, skipping browser open");
      return false;
    }
    types.logger.debug(`[browser] Attempting to open URL: ${url}`);
    await open(url);
    types.logger.debug("[browser] Browser opened successfully");
    return true;
  } catch (error) {
    types.logger.debug("[browser] Failed to open browser:", error);
    return false;
  }
}

const AuthSelector = ({ onSelect, onCancel }) => {
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const options = [
    {
      method: "mobile",
      label: "Mobile App"
    },
    {
      method: "web",
      label: "Web Browser"
    }
  ];
  ink.useInput((input, key) => {
    if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setSelectedIndex((prev) => Math.min(options.length - 1, prev + 1));
    } else if (key.return) {
      onSelect(options[selectedIndex].method);
    } else if (key.escape || key.ctrl && input === "c") {
      onCancel();
    } else if (input === "1") {
      setSelectedIndex(0);
      onSelect("mobile");
    } else if (input === "2") {
      setSelectedIndex(1);
      onSelect("web");
    }
  });
  return /* @__PURE__ */ React.createElement(ink.Box, { flexDirection: "column", paddingY: 1 }, /* @__PURE__ */ React.createElement(ink.Box, { marginBottom: 1 }, /* @__PURE__ */ React.createElement(ink.Text, null, "How would you like to authenticate?")), /* @__PURE__ */ React.createElement(ink.Box, { flexDirection: "column" }, options.map((option, index) => {
    const isSelected = selectedIndex === index;
    return /* @__PURE__ */ React.createElement(ink.Box, { key: option.method, marginY: 0 }, /* @__PURE__ */ React.createElement(ink.Text, { color: isSelected ? "cyan" : "gray" }, isSelected ? "\u203A " : "  ", index + 1, ". ", option.label));
  })), /* @__PURE__ */ React.createElement(ink.Box, { marginTop: 1 }, /* @__PURE__ */ React.createElement(ink.Text, { dimColor: true }, "Use arrows or 1-2 to select, Enter to confirm")));
};

async function doAuth() {
  console.clear();
  const authMethod = await selectAuthenticationMethod();
  if (!authMethod) {
    console.log("\nAuthentication cancelled.\n");
    process.exit(0);
  }
  const secret = new Uint8Array(node_crypto.randomBytes(32));
  const keypair = tweetnacl.box.keyPair.fromSecretKey(secret);
  try {
    console.log(`[AUTH DEBUG] Sending auth request to: ${types.configuration.serverUrl}/v1/auth/request`);
    console.log(`[AUTH DEBUG] Public key: ${types.encodeBase64(keypair.publicKey).substring(0, 20)}...`);
    await types.httpClient.post(`${types.configuration.serverUrl}/v1/auth/request`, {
      publicKey: types.encodeBase64(keypair.publicKey),
      supportsV2: true
    });
    console.log(`[AUTH DEBUG] Auth request sent successfully`);
  } catch (error) {
    console.log(`[AUTH DEBUG] Failed to send auth request:`, error);
    if (error instanceof types.ApiKeyAuthError) {
      console.log("API Key authentication failed. Please check your API Key configuration.");
      console.log('Use "happy config set-api-key <key>" or set HAPPY_API_KEY environment variable.');
    } else {
      console.log("Failed to create authentication request, please try again later.");
    }
    return null;
  }
  if (authMethod === "mobile") {
    return await doMobileAuth(keypair);
  } else {
    return await doWebAuth(keypair);
  }
}
function selectAuthenticationMethod() {
  return new Promise((resolve) => {
    let hasResolved = false;
    const onSelect = (method) => {
      if (!hasResolved) {
        hasResolved = true;
        app.unmount();
        resolve(method);
      }
    };
    const onCancel = () => {
      if (!hasResolved) {
        hasResolved = true;
        app.unmount();
        resolve(null);
      }
    };
    const app = ink.render(React.createElement(AuthSelector, { onSelect, onCancel }), {
      exitOnCtrlC: false,
      patchConsole: false
    });
  });
}
async function doMobileAuth(keypair) {
  console.clear();
  console.log("\nMobile Authentication\n");
  console.log("Scan this QR code with your Happy mobile app:\n");
  const authUrl = "happy://terminal?" + types.encodeBase64Url(keypair.publicKey);
  displayQRCode(authUrl);
  console.log("\nOr manually enter this URL:");
  console.log(authUrl);
  console.log("");
  return await waitForAuthentication(keypair);
}
async function doWebAuth(keypair) {
  console.clear();
  console.log("\nWeb Authentication\n");
  const webUrl = generateWebAuthUrl(keypair.publicKey);
  console.log("Opening your browser...");
  const browserOpened = await openBrowser(webUrl);
  if (browserOpened) {
    console.log("\u2713 Browser opened\n");
    console.log("Complete authentication in your browser window.");
  } else {
    console.log("Could not open browser automatically.");
  }
  console.log("\nIf the browser did not open, please copy and paste this URL:");
  console.log(webUrl);
  console.log("");
  return await waitForAuthentication(keypair);
}
async function waitForAuthentication(keypair) {
  process.stdout.write("Waiting for authentication");
  let dots = 0;
  let cancelled = false;
  const handleInterrupt = () => {
    cancelled = true;
    console.log("\n\nAuthentication cancelled.");
    process.exit(0);
  };
  process.on("SIGINT", handleInterrupt);
  try {
    while (!cancelled) {
      try {
        const response = await types.httpClient.post(`${types.configuration.serverUrl}/v1/auth/request`, {
          publicKey: types.encodeBase64(keypair.publicKey),
          supportsV2: true
        });
        if (response.data.state === "authorized") {
          let token = response.data.token;
          let r = types.decodeBase64(response.data.response);
          let decrypted = decryptWithEphemeralKey(r, keypair.secretKey);
          if (decrypted) {
            if (decrypted.length === 32) {
              const credentials = {
                secret: decrypted,
                token
              };
              await types.writeCredentialsLegacy(credentials);
              console.log("\n\n\u2713 Authentication successful\n");
              return {
                encryption: {
                  type: "legacy",
                  secret: decrypted
                },
                token
              };
            } else {
              if (decrypted[0] === 0) {
                const credentials = {
                  publicKey: decrypted.slice(1, 33),
                  machineKey: node_crypto.randomBytes(32),
                  token
                };
                await types.writeCredentialsDataKey(credentials);
                console.log("\n\n\u2713 Authentication successful\n");
                return {
                  encryption: {
                    type: "dataKey",
                    publicKey: credentials.publicKey,
                    machineKey: credentials.machineKey
                  },
                  token
                };
              } else {
                console.log("\n\nFailed to decrypt response. Please try again.");
                return null;
              }
            }
          } else {
            console.log("\n\nFailed to decrypt response. Please try again.");
            return null;
          }
        }
      } catch (error) {
        if (error instanceof types.ApiKeyAuthError) {
          console.log("\n\nAPI Key authentication failed. Please check your API Key configuration.");
        } else {
          console.log("\n\nFailed to check authentication status. Please try again.");
        }
        return null;
      }
      process.stdout.write("\rWaiting for authentication" + ".".repeat(dots % 3 + 1) + "   ");
      dots++;
      await types.delay(1e3);
    }
  } finally {
    process.off("SIGINT", handleInterrupt);
  }
  return null;
}
function decryptWithEphemeralKey(encryptedBundle, recipientSecretKey) {
  const ephemeralPublicKey = encryptedBundle.slice(0, 32);
  const nonce = encryptedBundle.slice(32, 32 + tweetnacl.box.nonceLength);
  const encrypted = encryptedBundle.slice(32 + tweetnacl.box.nonceLength);
  const decrypted = tweetnacl.box.open(encrypted, nonce, ephemeralPublicKey, recipientSecretKey);
  if (!decrypted) {
    return null;
  }
  return decrypted;
}
async function authAndSetupMachineIfNeeded() {
  types.logger.debug("[AUTH] Starting auth and machine setup...");
  let credentials = await types.readCredentials();
  let newAuth = false;
  if (!credentials) {
    types.logger.debug("[AUTH] No credentials found, starting authentication flow...");
    const authResult = await doAuth();
    if (!authResult) {
      throw new Error("Authentication failed or was cancelled");
    }
    credentials = authResult;
    newAuth = true;
  } else {
    types.logger.debug("[AUTH] Using existing credentials");
  }
  const settings = await types.updateSettings(async (s) => {
    if (newAuth || !s.machineId) {
      return {
        ...s,
        machineId: node_crypto.randomUUID()
      };
    }
    return s;
  });
  types.logger.debug(`[AUTH] Machine ID: ${settings.machineId}`);
  return { credentials, machineId: settings.machineId };
}

function spawnHappyCLI(args, options = {}) {
  const projectRoot = types.projectPath();
  const entrypoint = node_path.join(projectRoot, "dist", "index.mjs");
  let directory;
  if ("cwd" in options) {
    directory = options.cwd;
  } else {
    directory = process.cwd();
  }
  const fullCommand = `happy ${args.join(" ")}`;
  types.logger.debug(`[SPAWN HAPPY CLI] Spawning: ${fullCommand} in ${directory}`);
  const nodeArgs = [
    "--no-warnings",
    "--no-deprecation",
    entrypoint,
    ...args
  ];
  if (!fs.existsSync(entrypoint)) {
    const errorMessage = `Entrypoint ${entrypoint} does not exist`;
    types.logger.debug(`[SPAWN HAPPY CLI] ${errorMessage}`);
    throw new Error(errorMessage);
  }
  return child_process.spawn("node", nodeArgs, options);
}

function startDaemonControlServer({
  getChildren,
  stopSession,
  spawnSession,
  requestShutdown,
  onHappySessionWebhook
}) {
  return new Promise((resolve) => {
    const app = fastify({
      logger: false
      // We use our own logger
    });
    app.setValidatorCompiler(fastifyTypeProviderZod.validatorCompiler);
    app.setSerializerCompiler(fastifyTypeProviderZod.serializerCompiler);
    const typed = app.withTypeProvider();
    typed.post("/session-started", {
      schema: {
        body: z.z.object({
          sessionId: z.z.string(),
          metadata: z.z.any()
          // Metadata type from API
        }),
        response: {
          200: z.z.object({
            status: z.z.literal("ok")
          })
        }
      }
    }, async (request) => {
      const { sessionId, metadata } = request.body;
      types.logger.debug(`[CONTROL SERVER] Session started: ${sessionId}`);
      onHappySessionWebhook(sessionId, metadata);
      return { status: "ok" };
    });
    typed.post("/list", {
      schema: {
        response: {
          200: z.z.object({
            children: z.z.array(z.z.object({
              startedBy: z.z.string(),
              happySessionId: z.z.string(),
              pid: z.z.number()
            }))
          })
        }
      }
    }, async () => {
      const children = getChildren();
      types.logger.debug(`[CONTROL SERVER] Listing ${children.length} sessions`);
      return {
        children: children.filter((child) => child.happySessionId !== void 0).map((child) => ({
          startedBy: child.startedBy,
          happySessionId: child.happySessionId,
          pid: child.pid
        }))
      };
    });
    typed.post("/stop-session", {
      schema: {
        body: z.z.object({
          sessionId: z.z.string()
        }),
        response: {
          200: z.z.object({
            success: z.z.boolean()
          })
        }
      }
    }, async (request) => {
      const { sessionId } = request.body;
      types.logger.debug(`[CONTROL SERVER] Stop session request: ${sessionId}`);
      const success = stopSession(sessionId);
      return { success };
    });
    typed.post("/spawn-session", {
      schema: {
        body: z.z.object({
          directory: z.z.string(),
          sessionId: z.z.string().optional()
        }),
        response: {
          200: z.z.object({
            success: z.z.boolean(),
            sessionId: z.z.string().optional(),
            approvedNewDirectoryCreation: z.z.boolean().optional()
          }),
          409: z.z.object({
            success: z.z.boolean(),
            requiresUserApproval: z.z.boolean().optional(),
            actionRequired: z.z.string().optional(),
            directory: z.z.string().optional()
          }),
          500: z.z.object({
            success: z.z.boolean(),
            error: z.z.string().optional()
          })
        }
      }
    }, async (request, reply) => {
      const { directory, sessionId } = request.body;
      types.logger.debug(`[CONTROL SERVER] Spawn session request: dir=${directory}, sessionId=${sessionId || "new"}`);
      const result = await spawnSession({ directory, sessionId });
      switch (result.type) {
        case "success":
          if (!result.sessionId) {
            reply.code(500);
            return {
              success: false,
              error: "Failed to spawn session: no session ID returned"
            };
          }
          return {
            success: true,
            sessionId: result.sessionId,
            approvedNewDirectoryCreation: true
          };
        case "requestToApproveDirectoryCreation":
          reply.code(409);
          return {
            success: false,
            requiresUserApproval: true,
            actionRequired: "CREATE_DIRECTORY",
            directory: result.directory
          };
        case "error":
          reply.code(500);
          return {
            success: false,
            error: result.errorMessage
          };
      }
    });
    typed.post("/stop", {
      schema: {
        response: {
          200: z.z.object({
            status: z.z.string()
          })
        }
      }
    }, async () => {
      types.logger.debug("[CONTROL SERVER] Stop daemon request received");
      setTimeout(() => {
        types.logger.debug("[CONTROL SERVER] Triggering daemon shutdown");
        requestShutdown();
      }, 50);
      return { status: "stopping" };
    });
    app.listen({ port: 0, host: "127.0.0.1" }, (err, address) => {
      if (err) {
        types.logger.debug("[CONTROL SERVER] Failed to start:", err);
        throw err;
      }
      const port = parseInt(address.split(":").pop());
      types.logger.debug(`[CONTROL SERVER] Started on port ${port}`);
      resolve({
        port,
        stop: async () => {
          types.logger.debug("[CONTROL SERVER] Stopping server");
          await app.close();
          types.logger.debug("[CONTROL SERVER] Server stopped");
        }
      });
    });
  });
}

const initialMachineMetadata = {
  host: os$1.hostname(),
  platform: os$1.platform(),
  happyCliVersion: types.packageJson.version,
  homeDir: os$1.homedir(),
  happyHomeDir: types.configuration.happyHomeDir,
  happyLibDir: types.projectPath()
};
async function startDaemon() {
  let requestShutdown;
  let resolvesWhenShutdownRequested = new Promise((resolve) => {
    requestShutdown = (source, errorMessage) => {
      types.logger.debug(`[DAEMON RUN] Requesting shutdown (source: ${source}, errorMessage: ${errorMessage})`);
      setTimeout(async () => {
        types.logger.debug("[DAEMON RUN] Startup malfunctioned, forcing exit with code 1");
        await new Promise((resolve2) => setTimeout(resolve2, 100));
        process.exit(1);
      }, 1e3);
      resolve({ source, errorMessage });
    };
  });
  process.on("SIGINT", () => {
    types.logger.debug("[DAEMON RUN] Received SIGINT");
    requestShutdown("os-signal");
  });
  process.on("SIGTERM", () => {
    types.logger.debug("[DAEMON RUN] Received SIGTERM");
    requestShutdown("os-signal");
  });
  process.on("uncaughtException", (error) => {
    types.logger.debug("[DAEMON RUN] FATAL: Uncaught exception", error);
    types.logger.debug(`[DAEMON RUN] Stack trace: ${error.stack}`);
    requestShutdown("exception", error.message);
  });
  process.on("unhandledRejection", (reason, promise) => {
    types.logger.debug("[DAEMON RUN] FATAL: Unhandled promise rejection", reason);
    types.logger.debug(`[DAEMON RUN] Rejected promise:`, promise);
    const error = reason instanceof Error ? reason : new Error(`Unhandled promise rejection: ${reason}`);
    types.logger.debug(`[DAEMON RUN] Stack trace: ${error.stack}`);
    requestShutdown("exception", error.message);
  });
  process.on("exit", (code) => {
    types.logger.debug(`[DAEMON RUN] Process exiting with code: ${code}`);
  });
  process.on("beforeExit", (code) => {
    types.logger.debug(`[DAEMON RUN] Process about to exit with code: ${code}`);
  });
  types.logger.debug("[DAEMON RUN] Starting daemon process...");
  types.logger.debugLargeJson("[DAEMON RUN] Environment", getEnvironmentInfo());
  const runningDaemonVersionMatches = await isDaemonRunningCurrentlyInstalledHappyVersion();
  if (!runningDaemonVersionMatches) {
    types.logger.debug("[DAEMON RUN] Daemon version mismatch detected, restarting daemon with current CLI version");
    await stopDaemon();
  } else {
    types.logger.debug("[DAEMON RUN] Daemon version matches, keeping existing daemon");
    console.log("Daemon already running with matching version");
    process.exit(0);
  }
  const daemonLockHandle = await types.acquireDaemonLock(5, 200);
  if (!daemonLockHandle) {
    types.logger.debug("[DAEMON RUN] Daemon lock file already held, another daemon is running");
    process.exit(0);
  }
  try {
    const caffeinateStarted = startCaffeinate();
    if (caffeinateStarted) {
      types.logger.debug("[DAEMON RUN] Sleep prevention enabled");
    }
    const { credentials, machineId } = await authAndSetupMachineIfNeeded();
    types.logger.debug("[DAEMON RUN] Auth and machine setup complete");
    const pidToTrackedSession = /* @__PURE__ */ new Map();
    const pidToAwaiter = /* @__PURE__ */ new Map();
    const getCurrentChildren = () => Array.from(pidToTrackedSession.values());
    const onHappySessionWebhook = (sessionId, sessionMetadata) => {
      types.logger.debugLargeJson(`[DAEMON RUN] Session reported`, sessionMetadata);
      const pid = sessionMetadata.hostPid;
      if (!pid) {
        types.logger.debug(`[DAEMON RUN] Session webhook missing hostPid for sessionId: ${sessionId}`);
        return;
      }
      types.logger.debug(`[DAEMON RUN] Session webhook: ${sessionId}, PID: ${pid}, started by: ${sessionMetadata.startedBy || "unknown"}`);
      types.logger.debug(`[DAEMON RUN] Current tracked sessions before webhook: ${Array.from(pidToTrackedSession.keys()).join(", ")}`);
      const existingSession = pidToTrackedSession.get(pid);
      if (existingSession && existingSession.startedBy === "daemon") {
        existingSession.happySessionId = sessionId;
        existingSession.happySessionMetadataFromLocalWebhook = sessionMetadata;
        types.logger.debug(`[DAEMON RUN] Updated daemon-spawned session ${sessionId} with metadata`);
        const awaiter = pidToAwaiter.get(pid);
        if (awaiter) {
          pidToAwaiter.delete(pid);
          awaiter(existingSession);
          types.logger.debug(`[DAEMON RUN] Resolved session awaiter for PID ${pid}`);
        }
      } else if (!existingSession) {
        const trackedSession = {
          startedBy: "happy directly - likely by user from terminal",
          happySessionId: sessionId,
          happySessionMetadataFromLocalWebhook: sessionMetadata,
          pid
        };
        pidToTrackedSession.set(pid, trackedSession);
        types.logger.debug(`[DAEMON RUN] Registered externally-started session ${sessionId}`);
      }
    };
    const spawnSession = async (options) => {
      types.logger.debugLargeJson("[DAEMON RUN] Spawning session", options);
      const { directory, sessionId, machineId: machineId2, approvedNewDirectoryCreation = true } = options;
      let directoryCreated = false;
      try {
        await fs$1.access(directory);
        types.logger.debug(`[DAEMON RUN] Directory exists: ${directory}`);
      } catch (error) {
        types.logger.debug(`[DAEMON RUN] Directory doesn't exist, creating: ${directory}`);
        if (!approvedNewDirectoryCreation) {
          types.logger.debug(`[DAEMON RUN] Directory creation not approved for: ${directory}`);
          return {
            type: "requestToApproveDirectoryCreation",
            directory
          };
        }
        try {
          await fs$1.mkdir(directory, { recursive: true });
          types.logger.debug(`[DAEMON RUN] Successfully created directory: ${directory}`);
          directoryCreated = true;
        } catch (mkdirError) {
          let errorMessage = `Unable to create directory at '${directory}'. `;
          if (mkdirError.code === "EACCES") {
            errorMessage += `Permission denied. You don't have write access to create a folder at this location. Try using a different path or check your permissions.`;
          } else if (mkdirError.code === "ENOTDIR") {
            errorMessage += `A file already exists at this path or in the parent path. Cannot create a directory here. Please choose a different location.`;
          } else if (mkdirError.code === "ENOSPC") {
            errorMessage += `No space left on device. Your disk is full. Please free up some space and try again.`;
          } else if (mkdirError.code === "EROFS") {
            errorMessage += `The file system is read-only. Cannot create directories here. Please choose a writable location.`;
          } else {
            errorMessage += `System error: ${mkdirError.message || mkdirError}. Please verify the path is valid and you have the necessary permissions.`;
          }
          types.logger.debug(`[DAEMON RUN] Directory creation failed: ${errorMessage}`);
          return {
            type: "error",
            errorMessage
          };
        }
      }
      try {
        let extraEnv = {};
        if (options.token) {
          if (options.agent === "codex") {
            const codexHomeDir = tmp__namespace.dirSync();
            fs$1.writeFile(path.join(codexHomeDir.name, "auth.json"), options.token);
            extraEnv = {
              CODEX_HOME: codexHomeDir.name
            };
          } else {
            extraEnv = {
              CLAUDE_CODE_OAUTH_TOKEN: options.token
            };
          }
        }
        let agentCommand;
        switch (options.agent) {
          case "claude":
          case void 0:
            agentCommand = "claude";
            break;
          case "codex":
            agentCommand = "codex";
            break;
          case "gemini":
            agentCommand = "gemini";
            break;
          default:
            return {
              type: "error",
              errorMessage: `Unsupported agent type: '${options.agent}'. Please update your CLI to the latest version.`
            };
        }
        const args = [
          agentCommand,
          "--happy-starting-mode",
          "remote",
          "--started-by",
          "daemon"
        ];
        const happyProcess = spawnHappyCLI(args, {
          cwd: directory,
          detached: true,
          // Sessions stay alive when daemon stops
          stdio: ["ignore", "pipe", "pipe"],
          // Capture stdout/stderr for debugging
          env: {
            ...process.env,
            ...extraEnv
          },
          windowsHide: true
          // Prevent opening a new console window on Windows
        });
        if (process.env.DEBUG) {
          happyProcess.stdout?.on("data", (data) => {
            types.logger.debug(`[DAEMON RUN] Child stdout: ${data.toString()}`);
          });
          happyProcess.stderr?.on("data", (data) => {
            types.logger.debug(`[DAEMON RUN] Child stderr: ${data.toString()}`);
          });
        }
        if (!happyProcess.pid) {
          types.logger.debug("[DAEMON RUN] Failed to spawn process - no PID returned");
          return {
            type: "error",
            errorMessage: "Failed to spawn Happy process - no PID returned"
          };
        }
        types.logger.debug(`[DAEMON RUN] Spawned process with PID ${happyProcess.pid}`);
        const trackedSession = {
          startedBy: "daemon",
          pid: happyProcess.pid,
          childProcess: happyProcess,
          directoryCreated,
          message: directoryCreated ? `The path '${directory}' did not exist. We created a new folder and spawned a new session there.` : void 0
        };
        pidToTrackedSession.set(happyProcess.pid, trackedSession);
        happyProcess.on("exit", (code, signal) => {
          types.logger.debug(`[DAEMON RUN] Child PID ${happyProcess.pid} exited with code ${code}, signal ${signal}`);
          if (happyProcess.pid) {
            onChildExited(happyProcess.pid);
          }
        });
        happyProcess.on("error", (error) => {
          types.logger.debug(`[DAEMON RUN] Child process error:`, error);
          if (happyProcess.pid) {
            onChildExited(happyProcess.pid);
          }
        });
        types.logger.debug(`[DAEMON RUN] Waiting for session webhook for PID ${happyProcess.pid}`);
        return new Promise((resolve) => {
          const timeout = setTimeout(() => {
            pidToAwaiter.delete(happyProcess.pid);
            types.logger.debug(`[DAEMON RUN] Session webhook timeout for PID ${happyProcess.pid}`);
            resolve({
              type: "error",
              errorMessage: `Session webhook timeout for PID ${happyProcess.pid}`
            });
          }, 15e3);
          pidToAwaiter.set(happyProcess.pid, (completedSession) => {
            clearTimeout(timeout);
            types.logger.debug(`[DAEMON RUN] Session ${completedSession.happySessionId} fully spawned with webhook`);
            resolve({
              type: "success",
              sessionId: completedSession.happySessionId
            });
          });
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        types.logger.debug("[DAEMON RUN] Failed to spawn session:", error);
        return {
          type: "error",
          errorMessage: `Failed to spawn session: ${errorMessage}`
        };
      }
    };
    const stopSession = (sessionId) => {
      types.logger.debug(`[DAEMON RUN] Attempting to stop session ${sessionId}`);
      for (const [pid, session] of pidToTrackedSession.entries()) {
        if (session.happySessionId === sessionId || sessionId.startsWith("PID-") && pid === parseInt(sessionId.replace("PID-", ""))) {
          if (session.startedBy === "daemon" && session.childProcess) {
            try {
              session.childProcess.kill("SIGTERM");
              types.logger.debug(`[DAEMON RUN] Sent SIGTERM to daemon-spawned session ${sessionId}`);
            } catch (error) {
              types.logger.debug(`[DAEMON RUN] Failed to kill session ${sessionId}:`, error);
            }
          } else {
            try {
              process.kill(pid, "SIGTERM");
              types.logger.debug(`[DAEMON RUN] Sent SIGTERM to external session PID ${pid}`);
            } catch (error) {
              types.logger.debug(`[DAEMON RUN] Failed to kill external session PID ${pid}:`, error);
            }
          }
          pidToTrackedSession.delete(pid);
          types.logger.debug(`[DAEMON RUN] Removed session ${sessionId} from tracking`);
          return true;
        }
      }
      types.logger.debug(`[DAEMON RUN] Session ${sessionId} not found`);
      return false;
    };
    const onChildExited = (pid) => {
      types.logger.debug(`[DAEMON RUN] Removing exited process PID ${pid} from tracking`);
      pidToTrackedSession.delete(pid);
    };
    const { port: controlPort, stop: stopControlServer } = await startDaemonControlServer({
      getChildren: getCurrentChildren,
      stopSession,
      spawnSession,
      requestShutdown: () => requestShutdown("happy-cli"),
      onHappySessionWebhook
    });
    const fileState = {
      pid: process.pid,
      httpPort: controlPort,
      startTime: (/* @__PURE__ */ new Date()).toLocaleString(),
      startedWithCliVersion: types.packageJson.version,
      daemonLogPath: types.logger.logFilePath
    };
    types.writeDaemonState(fileState);
    types.logger.debug("[DAEMON RUN] Daemon state written");
    const initialDaemonState = {
      status: "offline",
      pid: process.pid,
      httpPort: controlPort,
      startedAt: Date.now()
    };
    const api = await types.ApiClient.create(credentials);
    const machine = await api.getOrCreateMachine({
      machineId,
      metadata: initialMachineMetadata,
      daemonState: initialDaemonState
    });
    types.logger.debug(`[DAEMON RUN] Machine registered: ${machine.id}`);
    const apiMachine = api.machineSyncClient(machine);
    apiMachine.setRPCHandlers({
      spawnSession,
      stopSession,
      requestShutdown: () => requestShutdown("happy-app")
    });
    apiMachine.connect();
    const heartbeatIntervalMs = parseInt(process.env.HAPPY_DAEMON_HEARTBEAT_INTERVAL || "60000");
    let heartbeatRunning = false;
    const restartOnStaleVersionAndHeartbeat = setInterval(async () => {
      if (heartbeatRunning) {
        return;
      }
      heartbeatRunning = true;
      if (process.env.DEBUG) {
        types.logger.debug(`[DAEMON RUN] Health check started at ${(/* @__PURE__ */ new Date()).toLocaleString()}`);
      }
      for (const [pid, _] of pidToTrackedSession.entries()) {
        try {
          process.kill(pid, 0);
        } catch (error) {
          types.logger.debug(`[DAEMON RUN] Removing stale session with PID ${pid} (process no longer exists)`);
          pidToTrackedSession.delete(pid);
        }
      }
      const projectVersion = JSON.parse(fs$2.readFileSync(path.join(types.projectPath(), "package.json"), "utf-8")).version;
      if (projectVersion !== types.configuration.currentCliVersion) {
        types.logger.debug("[DAEMON RUN] Daemon is outdated, triggering self-restart with latest version, clearing heartbeat interval");
        clearInterval(restartOnStaleVersionAndHeartbeat);
        try {
          spawnHappyCLI(["daemon", "start"], {
            detached: true,
            stdio: "ignore",
            windowsHide: true
            // Prevent opening a new console window on Windows
          });
        } catch (error) {
          types.logger.debug("[DAEMON RUN] Failed to spawn new daemon, this is quite likely to happen during integration tests as we are cleaning out dist/ directory", error);
        }
        types.logger.debug("[DAEMON RUN] Hanging for a bit - waiting for CLI to kill us because we are running outdated version of the code");
        await new Promise((resolve) => setTimeout(resolve, 1e4));
        process.exit(0);
      }
      const daemonState = await types.readDaemonState();
      if (daemonState && daemonState.pid !== process.pid) {
        types.logger.debug("[DAEMON RUN] Somehow a different daemon was started without killing us. We should kill ourselves.");
        requestShutdown("exception", "A different daemon was started without killing us. We should kill ourselves.");
      }
      try {
        const updatedState = {
          pid: process.pid,
          httpPort: controlPort,
          startTime: fileState.startTime,
          startedWithCliVersion: types.packageJson.version,
          lastHeartbeat: (/* @__PURE__ */ new Date()).toLocaleString(),
          daemonLogPath: fileState.daemonLogPath
        };
        types.writeDaemonState(updatedState);
        if (process.env.DEBUG) {
          types.logger.debug(`[DAEMON RUN] Health check completed at ${updatedState.lastHeartbeat}`);
        }
      } catch (error) {
        types.logger.debug("[DAEMON RUN] Failed to write heartbeat", error);
      }
      heartbeatRunning = false;
    }, heartbeatIntervalMs);
    const cleanupAndShutdown = async (source, errorMessage) => {
      types.logger.debug(`[DAEMON RUN] Starting proper cleanup (source: ${source}, errorMessage: ${errorMessage})...`);
      if (restartOnStaleVersionAndHeartbeat) {
        clearInterval(restartOnStaleVersionAndHeartbeat);
        types.logger.debug("[DAEMON RUN] Health check interval cleared");
      }
      await apiMachine.updateDaemonState((state) => ({
        ...state,
        status: "shutting-down",
        shutdownRequestedAt: Date.now(),
        shutdownSource: source
      }));
      await new Promise((resolve) => setTimeout(resolve, 100));
      apiMachine.shutdown();
      await stopControlServer();
      await cleanupDaemonState();
      await stopCaffeinate();
      await types.releaseDaemonLock(daemonLockHandle);
      types.logger.debug("[DAEMON RUN] Cleanup completed, exiting process");
      process.exit(0);
    };
    types.logger.debug("[DAEMON RUN] Daemon started successfully, waiting for shutdown request");
    const shutdownRequest = await resolvesWhenShutdownRequested;
    await cleanupAndShutdown(shutdownRequest.source, shutdownRequest.errorMessage);
  } catch (error) {
    types.logger.debug("[DAEMON RUN][FATAL] Failed somewhere unexpectedly - exiting with code 1", error);
    process.exit(1);
  }
}

async function startHappyServer(client) {
  const handler = async (title) => {
    types.logger.debug("[happyMCP] Changing title to:", title);
    try {
      client.sendClaudeSessionMessage({
        type: "summary",
        summary: title,
        leafUuid: node_crypto.randomUUID()
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  };
  const mcp = new mcp_js.McpServer({
    name: "Happy MCP",
    version: "1.0.0"
  });
  mcp.registerTool("change_title", {
    description: "Change the title of the current chat session",
    title: "Change Chat Title",
    inputSchema: {
      title: z.z.string().describe("The new title for the chat session")
    }
  }, async (args) => {
    const response = await handler(args.title);
    types.logger.debug("[happyMCP] Response:", response);
    if (response.success) {
      return {
        content: [
          {
            type: "text",
            text: `Successfully changed chat title to: "${args.title}"`
          }
        ],
        isError: false
      };
    } else {
      return {
        content: [
          {
            type: "text",
            text: `Failed to change chat title: ${response.error || "Unknown error"}`
          }
        ],
        isError: true
      };
    }
  });
  const transport = new streamableHttp_js.StreamableHTTPServerTransport({
    // NOTE: Returning session id here will result in claude
    // sdk spawn to fail with `Invalid Request: Server already initialized`
    sessionIdGenerator: void 0
  });
  await mcp.connect(transport);
  const server = node_http.createServer(async (req, res) => {
    try {
      await transport.handleRequest(req, res);
    } catch (error) {
      types.logger.debug("Error handling request:", error);
      if (!res.headersSent) {
        res.writeHead(500).end();
      }
    }
  });
  const baseUrl = await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      resolve(new URL(`http://127.0.0.1:${addr.port}`));
    });
  });
  return {
    url: baseUrl.toString(),
    toolNames: ["change_title"],
    stop: () => {
      types.logger.debug("[happyMCP] Stopping server");
      mcp.close();
      server.close();
    }
  };
}

async function startHookServer(options) {
  const { onSessionHook } = options;
  return new Promise((resolve, reject) => {
    const server = node_http.createServer(async (req, res) => {
      if (req.method === "POST" && req.url === "/hook/session-start") {
        const timeout = setTimeout(() => {
          if (!res.headersSent) {
            types.logger.debug("[hookServer] Request timeout");
            res.writeHead(408).end("timeout");
          }
        }, 5e3);
        try {
          const chunks = [];
          for await (const chunk of req) {
            chunks.push(chunk);
          }
          clearTimeout(timeout);
          const body = Buffer.concat(chunks).toString("utf-8");
          types.logger.debug("[hookServer] Received session hook:", body);
          let data = {};
          try {
            data = JSON.parse(body);
          } catch (parseError) {
            types.logger.debug("[hookServer] Failed to parse hook data as JSON:", parseError);
          }
          const sessionId = data.session_id || data.sessionId;
          if (sessionId) {
            types.logger.debug(`[hookServer] Session hook received session ID: ${sessionId}`);
            onSessionHook(sessionId, data);
          } else {
            types.logger.debug("[hookServer] Session hook received but no session_id found in data");
          }
          res.writeHead(200, { "Content-Type": "text/plain" }).end("ok");
        } catch (error) {
          clearTimeout(timeout);
          types.logger.debug("[hookServer] Error handling session hook:", error);
          if (!res.headersSent) {
            res.writeHead(500).end("error");
          }
        }
        return;
      }
      res.writeHead(404).end("not found");
    });
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Failed to get server address"));
        return;
      }
      const port = address.port;
      types.logger.debug(`[hookServer] Started on port ${port}`);
      resolve({
        port,
        stop: () => {
          server.close();
          types.logger.debug("[hookServer] Stopped");
        }
      });
    });
    server.on("error", (err) => {
      types.logger.debug("[hookServer] Server error:", err);
      reject(err);
    });
  });
}

function generateHookSettingsFile(port) {
  const hooksDir = node_path.join(types.configuration.happyHomeDir, "tmp", "hooks");
  fs.mkdirSync(hooksDir, { recursive: true });
  const filename = `session-hook-${process.pid}.json`;
  const filepath = node_path.join(hooksDir, filename);
  const forwarderScript = node_path.resolve(types.projectPath(), "scripts", "session_hook_forwarder.cjs");
  const hookCommand = `node "${forwarderScript}" ${port}`;
  const settings = {
    hooks: {
      SessionStart: [
        {
          matcher: "*",
          hooks: [
            {
              type: "command",
              command: hookCommand
            }
          ]
        }
      ]
    }
  };
  fs.writeFileSync(filepath, JSON.stringify(settings, null, 2));
  types.logger.debug(`[generateHookSettings] Created hook settings file: ${filepath}`);
  return filepath;
}
function cleanupHookSettingsFile(filepath) {
  try {
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
      types.logger.debug(`[generateHookSettings] Cleaned up hook settings file: ${filepath}`);
    }
  } catch (error) {
    types.logger.debug(`[generateHookSettings] Failed to cleanup hook settings file: ${error}`);
  }
}

function registerKillSessionHandler(rpcHandlerManager, killThisHappy) {
  rpcHandlerManager.registerHandler("killSession", async () => {
    types.logger.debug("Kill session request received");
    void killThisHappy();
    return {
      success: true,
      message: "Killing happy-cli process"
    };
  });
}

async function runClaude(credentials, options = {}) {
  types.logger.debug(`[CLAUDE] ===== CLAUDE MODE STARTING =====`);
  types.logger.debug(`[CLAUDE] This is the Claude agent, NOT Gemini`);
  const workingDirectory = process.cwd();
  const sessionTag = node_crypto.randomUUID();
  types.logger.debugLargeJson("[START] Happy process started", getEnvironmentInfo());
  types.logger.debug(`[START] Options: startedBy=${options.startedBy}, startingMode=${options.startingMode}`);
  if (options.startedBy === "daemon" && options.startingMode === "local") {
    types.logger.debug("Daemon spawn requested with local mode - forcing remote mode");
    options.startingMode = "remote";
  }
  const api = await types.ApiClient.create(credentials);
  let state = {};
  const settings = await types.readSettings();
  let machineId = settings?.machineId;
  if (!machineId) {
    console.error(`[START] No machine ID found in settings, which is unexpected since authAndSetupMachineIfNeeded should have created it. Please report this issue on https://github.com/slopus/happy-cli/issues`);
    process.exit(1);
  }
  types.logger.debug(`Using machineId: ${machineId}`);
  await api.getOrCreateMachine({
    machineId,
    metadata: initialMachineMetadata
  });
  let metadata = {
    path: workingDirectory,
    host: os.hostname(),
    version: types.packageJson.version,
    os: os.platform(),
    machineId,
    homeDir: os.homedir(),
    happyHomeDir: types.configuration.happyHomeDir,
    happyLibDir: types.projectPath(),
    happyToolsDir: node_path.resolve(types.projectPath(), "tools", "unpacked"),
    startedFromDaemon: options.startedBy === "daemon",
    hostPid: process.pid,
    startedBy: options.startedBy || "terminal",
    // Initialize lifecycle state
    lifecycleState: "running",
    lifecycleStateSince: Date.now(),
    flavor: "claude"
  };
  const response = await api.getOrCreateSession({ tag: sessionTag, metadata, state });
  types.logger.debug(`Session created: ${response.id}`);
  try {
    types.logger.debug(`[START] Reporting session ${response.id} to daemon`);
    const result = await notifyDaemonSessionStarted(response.id, metadata);
    if (result.error) {
      types.logger.debug(`[START] Failed to report to daemon (may not be running):`, result.error);
    } else {
      types.logger.debug(`[START] Reported session ${response.id} to daemon`);
    }
  } catch (error) {
    types.logger.debug("[START] Failed to report to daemon (may not be running):", error);
  }
  extractSDKMetadataAsync(async (sdkMetadata) => {
    types.logger.debug("[start] SDK metadata extracted, updating session:", sdkMetadata);
    try {
      api.sessionSyncClient(response).updateMetadata((currentMetadata) => ({
        ...currentMetadata,
        tools: sdkMetadata.tools,
        slashCommands: sdkMetadata.slashCommands
      }));
      types.logger.debug("[start] Session metadata updated with SDK capabilities");
    } catch (error) {
      types.logger.debug("[start] Failed to update session metadata:", error);
    }
  });
  const session = api.sessionSyncClient(response);
  const happyServer = await startHappyServer(session);
  types.logger.debug(`[START] Happy MCP server started at ${happyServer.url}`);
  let currentSession = null;
  const hookServer = await startHookServer({
    onSessionHook: (sessionId, data) => {
      types.logger.debug(`[START] Session hook received: ${sessionId}`, data);
      if (currentSession) {
        const previousSessionId = currentSession.sessionId;
        if (previousSessionId !== sessionId) {
          types.logger.debug(`[START] Claude session ID changed: ${previousSessionId} -> ${sessionId}`);
          currentSession.onSessionFound(sessionId);
        }
      }
    }
  });
  types.logger.debug(`[START] Hook server started on port ${hookServer.port}`);
  const hookSettingsPath = generateHookSettingsFile(hookServer.port);
  types.logger.debug(`[START] Generated hook settings file: ${hookSettingsPath}`);
  const logPath = types.logger.logFilePath;
  types.logger.infoDeveloper(`Session: ${response.id}`);
  types.logger.infoDeveloper(`Logs: ${logPath}`);
  session.updateAgentState((currentState) => ({
    ...currentState,
    controlledByUser: options.startingMode !== "remote"
  }));
  const caffeinateStarted = startCaffeinate();
  if (caffeinateStarted) {
    types.logger.infoDeveloper("Sleep prevention enabled (macOS)");
  }
  const messageQueue = new MessageQueue2((mode) => hashObject({
    isPlan: mode.permissionMode === "plan",
    model: mode.model,
    fallbackModel: mode.fallbackModel,
    customSystemPrompt: mode.customSystemPrompt,
    appendSystemPrompt: mode.appendSystemPrompt,
    allowedTools: mode.allowedTools,
    disallowedTools: mode.disallowedTools
  }));
  let currentPermissionMode = options.permissionMode;
  let currentModel = options.model;
  let currentFallbackModel = void 0;
  let currentCustomSystemPrompt = void 0;
  let currentAppendSystemPrompt = void 0;
  let currentAllowedTools = void 0;
  let currentDisallowedTools = void 0;
  session.onUserMessage((message) => {
    let messagePermissionMode = currentPermissionMode;
    if (message.meta?.permissionMode) {
      const validModes = ["default", "acceptEdits", "bypassPermissions", "plan"];
      if (validModes.includes(message.meta.permissionMode)) {
        messagePermissionMode = message.meta.permissionMode;
        currentPermissionMode = messagePermissionMode;
        types.logger.debug(`[loop] Permission mode updated from user message to: ${currentPermissionMode}`);
      } else {
        types.logger.debug(`[loop] Invalid permission mode received: ${message.meta.permissionMode}`);
      }
    } else {
      types.logger.debug(`[loop] User message received with no permission mode override, using current: ${currentPermissionMode}`);
    }
    let messageModel = currentModel;
    if (message.meta?.hasOwnProperty("model")) {
      messageModel = message.meta.model || void 0;
      currentModel = messageModel;
      types.logger.debug(`[loop] Model updated from user message: ${messageModel || "reset to default"}`);
    } else {
      types.logger.debug(`[loop] User message received with no model override, using current: ${currentModel || "default"}`);
    }
    let messageCustomSystemPrompt = currentCustomSystemPrompt;
    if (message.meta?.hasOwnProperty("customSystemPrompt")) {
      messageCustomSystemPrompt = message.meta.customSystemPrompt || void 0;
      currentCustomSystemPrompt = messageCustomSystemPrompt;
      types.logger.debug(`[loop] Custom system prompt updated from user message: ${messageCustomSystemPrompt ? "set" : "reset to none"}`);
    } else {
      types.logger.debug(`[loop] User message received with no custom system prompt override, using current: ${currentCustomSystemPrompt ? "set" : "none"}`);
    }
    let messageFallbackModel = currentFallbackModel;
    if (message.meta?.hasOwnProperty("fallbackModel")) {
      messageFallbackModel = message.meta.fallbackModel || void 0;
      currentFallbackModel = messageFallbackModel;
      types.logger.debug(`[loop] Fallback model updated from user message: ${messageFallbackModel || "reset to none"}`);
    } else {
      types.logger.debug(`[loop] User message received with no fallback model override, using current: ${currentFallbackModel || "none"}`);
    }
    let messageAppendSystemPrompt = currentAppendSystemPrompt;
    if (message.meta?.hasOwnProperty("appendSystemPrompt")) {
      messageAppendSystemPrompt = message.meta.appendSystemPrompt || void 0;
      currentAppendSystemPrompt = messageAppendSystemPrompt;
      types.logger.debug(`[loop] Append system prompt updated from user message: ${messageAppendSystemPrompt ? "set" : "reset to none"}`);
    } else {
      types.logger.debug(`[loop] User message received with no append system prompt override, using current: ${currentAppendSystemPrompt ? "set" : "none"}`);
    }
    let messageAllowedTools = currentAllowedTools;
    if (message.meta?.hasOwnProperty("allowedTools")) {
      messageAllowedTools = message.meta.allowedTools || void 0;
      currentAllowedTools = messageAllowedTools;
      types.logger.debug(`[loop] Allowed tools updated from user message: ${messageAllowedTools ? messageAllowedTools.join(", ") : "reset to none"}`);
    } else {
      types.logger.debug(`[loop] User message received with no allowed tools override, using current: ${currentAllowedTools ? currentAllowedTools.join(", ") : "none"}`);
    }
    let messageDisallowedTools = currentDisallowedTools;
    if (message.meta?.hasOwnProperty("disallowedTools")) {
      messageDisallowedTools = message.meta.disallowedTools || void 0;
      currentDisallowedTools = messageDisallowedTools;
      types.logger.debug(`[loop] Disallowed tools updated from user message: ${messageDisallowedTools ? messageDisallowedTools.join(", ") : "reset to none"}`);
    } else {
      types.logger.debug(`[loop] User message received with no disallowed tools override, using current: ${currentDisallowedTools ? currentDisallowedTools.join(", ") : "none"}`);
    }
    const specialCommand = parseSpecialCommand(message.content.text);
    if (specialCommand.type === "compact") {
      types.logger.debug("[start] Detected /compact command");
      const enhancedMode2 = {
        permissionMode: messagePermissionMode || "default",
        model: messageModel,
        fallbackModel: messageFallbackModel,
        customSystemPrompt: messageCustomSystemPrompt,
        appendSystemPrompt: messageAppendSystemPrompt,
        allowedTools: messageAllowedTools,
        disallowedTools: messageDisallowedTools
      };
      messageQueue.pushIsolateAndClear(specialCommand.originalMessage || message.content.text, enhancedMode2);
      types.logger.debugLargeJson("[start] /compact command pushed to queue:", message);
      return;
    }
    if (specialCommand.type === "clear") {
      types.logger.debug("[start] Detected /clear command");
      const enhancedMode2 = {
        permissionMode: messagePermissionMode || "default",
        model: messageModel,
        fallbackModel: messageFallbackModel,
        customSystemPrompt: messageCustomSystemPrompt,
        appendSystemPrompt: messageAppendSystemPrompt,
        allowedTools: messageAllowedTools,
        disallowedTools: messageDisallowedTools
      };
      messageQueue.pushIsolateAndClear(specialCommand.originalMessage || message.content.text, enhancedMode2);
      types.logger.debugLargeJson("[start] /compact command pushed to queue:", message);
      return;
    }
    const enhancedMode = {
      permissionMode: messagePermissionMode || "default",
      model: messageModel,
      fallbackModel: messageFallbackModel,
      customSystemPrompt: messageCustomSystemPrompt,
      appendSystemPrompt: messageAppendSystemPrompt,
      allowedTools: messageAllowedTools,
      disallowedTools: messageDisallowedTools
    };
    messageQueue.push(message.content.text, enhancedMode);
    types.logger.debugLargeJson("User message pushed to queue:", message);
  });
  const cleanup = async () => {
    types.logger.debug("[START] Received termination signal, cleaning up...");
    try {
      if (session) {
        session.updateMetadata((currentMetadata) => ({
          ...currentMetadata,
          lifecycleState: "archived",
          lifecycleStateSince: Date.now(),
          archivedBy: "cli",
          archiveReason: "User terminated"
        }));
        session.sendSessionDeath();
        await session.flush();
        await session.close();
      }
      stopCaffeinate();
      happyServer.stop();
      hookServer.stop();
      cleanupHookSettingsFile(hookSettingsPath);
      types.logger.debug("[START] Cleanup complete, exiting");
      process.exit(0);
    } catch (error) {
      types.logger.debug("[START] Error during cleanup:", error);
      process.exit(1);
    }
  };
  process.on("SIGTERM", cleanup);
  process.on("SIGINT", cleanup);
  process.on("uncaughtException", (error) => {
    types.logger.debug("[START] Uncaught exception:", error);
    cleanup();
  });
  process.on("unhandledRejection", (reason) => {
    types.logger.debug("[START] Unhandled rejection:", reason);
    cleanup();
  });
  registerKillSessionHandler(session.rpcHandlerManager, cleanup);
  await loop({
    path: workingDirectory,
    model: options.model,
    permissionMode: options.permissionMode,
    startingMode: options.startingMode,
    messageQueue,
    api,
    allowedTools: happyServer.toolNames.map((toolName) => `mcp__happy__${toolName}`),
    onModeChange: (newMode) => {
      session.sendSessionEvent({ type: "switch", mode: newMode });
      session.updateAgentState((currentState) => ({
        ...currentState,
        controlledByUser: newMode === "local"
      }));
    },
    onSessionReady: (sessionInstance) => {
      currentSession = sessionInstance;
    },
    mcpServers: {
      "happy": {
        type: "http",
        url: happyServer.url
      }
    },
    session,
    claudeEnvVars: options.claudeEnvVars,
    claudeArgs: options.claudeArgs,
    hookSettingsPath
  });
  session.sendSessionDeath();
  types.logger.debug("Waiting for socket to flush...");
  await session.flush();
  types.logger.debug("Closing session...");
  await session.close();
  stopCaffeinate();
  types.logger.debug("Stopped sleep prevention");
  happyServer.stop();
  types.logger.debug("Stopped Happy MCP server");
  hookServer.stop();
  cleanupHookSettingsFile(hookSettingsPath);
  types.logger.debug("Stopped Hook server and cleaned up settings file");
  process.exit(0);
}

const PLIST_LABEL$1 = "com.happy-cli.daemon";
const PLIST_FILE$1 = `/Library/LaunchDaemons/${PLIST_LABEL$1}.plist`;
async function install$1() {
  try {
    if (fs$2.existsSync(PLIST_FILE$1)) {
      types.logger.info("Daemon plist already exists. Uninstalling first...");
      child_process.execSync(`launchctl unload ${PLIST_FILE$1}`, { stdio: "inherit" });
    }
    const happyPath = process.argv[0];
    const scriptPath = process.argv[1];
    const plistContent = trimIdent(`
            <?xml version="1.0" encoding="UTF-8"?>
            <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
            <plist version="1.0">
            <dict>
                <key>Label</key>
                <string>${PLIST_LABEL$1}</string>
                
                <key>ProgramArguments</key>
                <array>
                    <string>${happyPath}</string>
                    <string>${scriptPath}</string>
                    <string>happy-daemon</string>
                </array>
                
                <key>EnvironmentVariables</key>
                <dict>
                    <key>HAPPY_DAEMON_MODE</key>
                    <string>true</string>
                </dict>
                
                <key>RunAtLoad</key>
                <true/>
                
                <key>KeepAlive</key>
                <true/>
                
                <key>StandardErrorPath</key>
                <string>${os$1.homedir()}/.happy/daemon.err</string>
                
                <key>StandardOutPath</key>
                <string>${os$1.homedir()}/.happy/daemon.log</string>
                
                <key>WorkingDirectory</key>
                <string>/tmp</string>
            </dict>
            </plist>
        `);
    fs$2.writeFileSync(PLIST_FILE$1, plistContent);
    fs$2.chmodSync(PLIST_FILE$1, 420);
    types.logger.info(`Created daemon plist at ${PLIST_FILE$1}`);
    child_process.execSync(`launchctl load ${PLIST_FILE$1}`, { stdio: "inherit" });
    types.logger.info("Daemon installed and started successfully");
    types.logger.info("Check logs at ~/.happy/daemon.log");
  } catch (error) {
    types.logger.debug("Failed to install daemon:", error);
    throw error;
  }
}

async function install() {
  if (process.platform !== "darwin") {
    throw new Error("Daemon installation is currently only supported on macOS");
  }
  if (process.getuid && process.getuid() !== 0) {
    throw new Error("Daemon installation requires sudo privileges. Please run with sudo.");
  }
  types.logger.info("Installing Happy CLI daemon for macOS...");
  await install$1();
}

const PLIST_LABEL = "com.happy-cli.daemon";
const PLIST_FILE = `/Library/LaunchDaemons/${PLIST_LABEL}.plist`;
async function uninstall$1() {
  try {
    if (!fs$2.existsSync(PLIST_FILE)) {
      types.logger.info("Daemon plist not found. Nothing to uninstall.");
      return;
    }
    try {
      child_process.execSync(`launchctl unload ${PLIST_FILE}`, { stdio: "inherit" });
      types.logger.info("Daemon stopped successfully");
    } catch (error) {
      types.logger.info("Failed to unload daemon (it might not be running)");
    }
    fs$2.unlinkSync(PLIST_FILE);
    types.logger.info(`Removed daemon plist from ${PLIST_FILE}`);
    types.logger.info("Daemon uninstalled successfully");
  } catch (error) {
    types.logger.debug("Failed to uninstall daemon:", error);
    throw error;
  }
}

async function uninstall() {
  if (process.platform !== "darwin") {
    throw new Error("Daemon uninstallation is currently only supported on macOS");
  }
  if (process.getuid && process.getuid() !== 0) {
    throw new Error("Daemon uninstallation requires sudo privileges. Please run with sudo.");
  }
  types.logger.info("Uninstalling Happy CLI daemon for macOS...");
  await uninstall$1();
}

async function handleAuthCommand(args) {
  const subcommand = args[0];
  if (!subcommand || subcommand === "help" || subcommand === "--help" || subcommand === "-h") {
    showAuthHelp();
    return;
  }
  switch (subcommand) {
    case "login":
      await handleAuthLogin(args.slice(1));
      break;
    case "logout":
      await handleAuthLogout();
      break;
    // case 'backup':
    //   await handleAuthShowBackup();
    //   break;
    case "status":
      await handleAuthStatus();
      break;
    default:
      console.error(chalk.red(`Unknown auth subcommand: ${subcommand}`));
      showAuthHelp();
      process.exit(1);
  }
}
function showAuthHelp() {
  console.log(`
${chalk.bold("happy auth")} - Authentication management

${chalk.bold("Usage:")}
  happy auth login [--force]    Authenticate with Happy
  happy auth logout             Remove authentication and machine data  
  happy auth status             Show authentication status
  happy auth show-backup        Display backup key for mobile/web clients
  happy auth help               Show this help message

${chalk.bold("Options:")}
  --force    Clear credentials, machine ID, and stop daemon before re-auth
`);
}
async function handleAuthLogin(args) {
  const forceAuth = args.includes("--force") || args.includes("-f");
  if (forceAuth) {
    console.log(chalk.yellow("Force authentication requested."));
    console.log(chalk.gray("This will:"));
    console.log(chalk.gray("  \u2022 Clear existing credentials"));
    console.log(chalk.gray("  \u2022 Clear machine ID"));
    console.log(chalk.gray("  \u2022 Stop daemon if running"));
    console.log(chalk.gray("  \u2022 Re-authenticate and register machine\n"));
    try {
      types.logger.debug("Stopping daemon for force auth...");
      await stopDaemon();
      console.log(chalk.gray("\u2713 Stopped daemon"));
    } catch (error) {
      types.logger.debug("Daemon was not running or failed to stop:", error);
    }
    await types.clearCredentials();
    console.log(chalk.gray("\u2713 Cleared credentials"));
    await types.clearMachineId();
    console.log(chalk.gray("\u2713 Cleared machine ID"));
    console.log("");
  }
  if (!forceAuth) {
    const existingCreds = await types.readCredentials();
    const settings = await types.readSettings();
    if (existingCreds && settings?.machineId) {
      console.log(chalk.green("\u2713 Already authenticated"));
      console.log(chalk.gray(`  Machine ID: ${settings.machineId}`));
      console.log(chalk.gray(`  Host: ${os.hostname()}`));
      console.log(chalk.gray(`  Use 'happy auth login --force' to re-authenticate`));
      return;
    } else if (existingCreds && !settings?.machineId) {
      console.log(chalk.yellow("\u26A0\uFE0F  Credentials exist but machine ID is missing"));
      console.log(chalk.gray("  This can happen if --auth flag was used previously"));
      console.log(chalk.gray("  Fixing by setting up machine...\n"));
    }
  }
  try {
    const result = await authAndSetupMachineIfNeeded();
    console.log(chalk.green("\n\u2713 Authentication successful"));
    console.log(chalk.gray(`  Machine ID: ${result.machineId}`));
  } catch (error) {
    console.error(chalk.red("Authentication failed:"), error instanceof Error ? error.message : "Unknown error");
    process.exit(1);
  }
}
async function handleAuthLogout() {
  const happyDir = types.configuration.happyHomeDir;
  const credentials = await types.readCredentials();
  if (!credentials) {
    console.log(chalk.yellow("Not currently authenticated"));
    return;
  }
  console.log(chalk.blue("This will log you out of Happy"));
  console.log(chalk.yellow("\u26A0\uFE0F  You will need to re-authenticate to use Happy again"));
  const rl = node_readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  const answer = await new Promise((resolve) => {
    rl.question(chalk.yellow("Are you sure you want to log out? (y/N): "), resolve);
  });
  rl.close();
  if (answer.toLowerCase() === "y" || answer.toLowerCase() === "yes") {
    try {
      try {
        await stopDaemon();
        console.log(chalk.gray("Stopped daemon"));
      } catch {
      }
      if (fs.existsSync(happyDir)) {
        fs.rmSync(happyDir, { recursive: true, force: true });
      }
      console.log(chalk.green("\u2713 Successfully logged out"));
      console.log(chalk.gray('  Run "happy auth login" to authenticate again'));
    } catch (error) {
      throw new Error(`Failed to logout: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  } else {
    console.log(chalk.blue("Logout cancelled"));
  }
}
async function handleAuthStatus() {
  const credentials = await types.readCredentials();
  const settings = await types.readSettings();
  console.log(chalk.bold("\nAuthentication Status\n"));
  if (!credentials) {
    console.log(chalk.red("\u2717 Not authenticated"));
    console.log(chalk.gray('  Run "happy auth login" to authenticate'));
    return;
  }
  console.log(chalk.green("\u2713 Authenticated"));
  const tokenPreview = credentials.token.substring(0, 30) + "...";
  console.log(chalk.gray(`  Token: ${tokenPreview}`));
  if (settings?.machineId) {
    console.log(chalk.green("\u2713 Machine registered"));
    console.log(chalk.gray(`  Machine ID: ${settings.machineId}`));
    console.log(chalk.gray(`  Host: ${os.hostname()}`));
  } else {
    console.log(chalk.yellow("\u26A0\uFE0F  Machine not registered"));
    console.log(chalk.gray('  Run "happy auth login --force" to fix this'));
  }
  console.log(chalk.gray(`
  Data directory: ${types.configuration.happyHomeDir}`));
  try {
    const running = await checkIfDaemonRunningAndCleanupStaleState();
    if (running) {
      console.log(chalk.green("\u2713 Daemon running"));
    } else {
      console.log(chalk.gray("\u2717 Daemon not running"));
    }
  } catch {
    console.log(chalk.gray("\u2717 Daemon not running"));
  }
}

async function handleConfigCommand(args) {
  const subcommand = args[0];
  if (!subcommand || subcommand === "help" || subcommand === "--help" || subcommand === "-h") {
    showConfigHelp();
    return;
  }
  switch (subcommand) {
    case "set-api-key":
      await handleSetApiKey(args.slice(1));
      break;
    case "show":
      await handleShowConfig();
      break;
    default:
      console.error(chalk.red(`Unknown config subcommand: ${subcommand}`));
      showConfigHelp();
      process.exit(1);
  }
}
function showConfigHelp() {
  console.log(`
${chalk.bold("happy config")} - Configuration management

${chalk.bold("Usage:")}
  happy config set-api-key <key>    Set the API Key for service authentication
  happy config show                 Show current configuration
  happy config help                 Show this help message

${chalk.bold("Environment Variables:")}
  HAPPY_API_KEY          API Key (overrides config file)
  HAPPY_SERVER_URL       Server URL (overrides config file)
  HAPPY_WEBAPP_URL       Web app URL (overrides config file)

${chalk.bold("Examples:")}
  happy config set-api-key sk-xxxx-xxxx-xxxx
  happy config show
`);
}
async function readSettingsJson() {
  try {
    if (fs.existsSync(types.configuration.settingsFile)) {
      const content = await promises.readFile(types.configuration.settingsFile, "utf8");
      return JSON.parse(content);
    }
  } catch {
  }
  return {};
}
async function writeSettingsJson(settings) {
  if (!fs.existsSync(types.configuration.happyHomeDir)) {
    await promises.mkdir(types.configuration.happyHomeDir, { recursive: true });
  }
  await promises.writeFile(types.configuration.settingsFile, JSON.stringify(settings, null, 2));
}
async function handleSetApiKey(args) {
  const apiKey = args[0];
  if (!apiKey) {
    console.error(chalk.red("Error: API Key is required"));
    console.log(chalk.gray("Usage: happy config set-api-key <key>"));
    process.exit(1);
  }
  const settings = await readSettingsJson();
  settings.apiKey = apiKey;
  await writeSettingsJson(settings);
  console.log(chalk.green("\u2713 API Key saved successfully"));
  console.log(chalk.gray(`  Config file: ${types.configuration.settingsFile}`));
  console.log(chalk.gray("  Note: Environment variable HAPPY_API_KEY takes priority if set"));
}
async function handleShowConfig() {
  console.log(chalk.bold("\nCurrent Configuration\n"));
  console.log(chalk.cyan("Server URL:"));
  console.log(`  ${types.configuration.serverUrl}`);
  if (process.env.HAPPY_SERVER_URL) {
    console.log(chalk.gray("  (from environment variable)"));
  }
  console.log(chalk.cyan("\nWeb App URL:"));
  console.log(`  ${types.configuration.webappUrl}`);
  if (process.env.HAPPY_WEBAPP_URL) {
    console.log(chalk.gray("  (from environment variable)"));
  }
  console.log(chalk.cyan("\nAPI Key:"));
  if (types.configuration.apiKey) {
    const masked = maskApiKey(types.configuration.apiKey);
    console.log(`  ${masked}`);
    if (process.env.HAPPY_API_KEY) {
      console.log(chalk.gray("  (from environment variable)"));
    } else {
      console.log(chalk.gray("  (from config file)"));
    }
  } else {
    console.log(chalk.yellow("  Not configured"));
    console.log(chalk.gray('  Use "happy config set-api-key <key>" or set HAPPY_API_KEY env var'));
  }
  console.log(chalk.cyan("\nData Directory:"));
  console.log(`  ${types.configuration.happyHomeDir}`);
  console.log(chalk.cyan("\nConfig File:"));
  console.log(`  ${types.configuration.settingsFile}`);
  if (fs.existsSync(types.configuration.settingsFile)) {
    console.log(chalk.gray("  (exists)"));
  } else {
    console.log(chalk.gray("  (not created yet)"));
  }
  console.log(chalk.cyan("\nCLI Version:"));
  console.log(`  ${types.configuration.currentCliVersion}`);
}
function maskApiKey(apiKey) {
  if (apiKey.length <= 12) {
    return "*".repeat(apiKey.length);
  }
  const prefix = apiKey.substring(0, 8);
  const suffix = apiKey.substring(apiKey.length - 4);
  const masked = "*".repeat(Math.min(apiKey.length - 12, 20));
  return `${prefix}${masked}${suffix}`;
}

const CLIENT_ID$2 = "app_EMoamEEZ73f0CkXaXp7hrann";
const AUTH_BASE_URL = "https://auth.openai.com";
const DEFAULT_PORT$2 = 1455;
function generatePKCE$2() {
  const verifier = crypto.randomBytes(32).toString("base64url").replace(/[^a-zA-Z0-9\-._~]/g, "");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return { verifier, challenge };
}
function generateState$2() {
  return crypto.randomBytes(16).toString("hex");
}
function parseJWT(token) {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT format");
  }
  const payload = Buffer.from(parts[1], "base64url").toString();
  return JSON.parse(payload);
}
async function findAvailablePort$2() {
  return new Promise((resolve) => {
    const server = http.createServer();
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}
async function isPortAvailable$2(port) {
  return new Promise((resolve) => {
    const testServer = http.createServer();
    testServer.once("error", () => {
      testServer.close();
      resolve(false);
    });
    testServer.listen(port, "127.0.0.1", () => {
      testServer.close(() => resolve(true));
    });
  });
}
async function exchangeCodeForTokens$2(code, verifier, port) {
  const response = await fetch(`${AUTH_BASE_URL}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: CLIENT_ID$2,
      code,
      code_verifier: verifier,
      redirect_uri: `http://localhost:${port}/auth/callback`
    })
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }
  const data = await response.json();
  const idTokenPayload = parseJWT(data.id_token);
  let accountId = idTokenPayload.chatgpt_account_id;
  if (!accountId) {
    const authClaim = idTokenPayload["https://api.openai.com/auth"];
    if (authClaim && typeof authClaim === "object") {
      accountId = authClaim.chatgpt_account_id || authClaim.account_id;
    }
  }
  return {
    id_token: data.id_token,
    access_token: data.access_token || data.id_token,
    refresh_token: data.refresh_token,
    account_id: accountId
  };
}
async function startCallbackServer$2(state, verifier, port) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, `http://localhost:${port}`);
      if (url.pathname === "/auth/callback") {
        const code = url.searchParams.get("code");
        const receivedState = url.searchParams.get("state");
        if (receivedState !== state) {
          res.writeHead(400);
          res.end("Invalid state parameter");
          server.close();
          reject(new Error("Invalid state parameter"));
          return;
        }
        if (!code) {
          res.writeHead(400);
          res.end("No authorization code received");
          server.close();
          reject(new Error("No authorization code received"));
          return;
        }
        try {
          const tokens = await exchangeCodeForTokens$2(code, verifier, port);
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(`
                        <html>
                        <body style="font-family: sans-serif; padding: 20px;">
                            <h2>\u2705 Authentication Successful!</h2>
                            <p>You can close this window and return to your terminal.</p>
                            <script>setTimeout(() => window.close(), 3000);<\/script>
                        </body>
                        </html>
                    `);
          server.close();
          resolve(tokens);
        } catch (error) {
          res.writeHead(500);
          res.end("Token exchange failed");
          server.close();
          reject(error);
        }
      }
    });
    server.listen(port, "127.0.0.1", () => {
    });
    setTimeout(() => {
      server.close();
      reject(new Error("Authentication timeout"));
    }, 5 * 60 * 1e3);
  });
}
async function authenticateCodex() {
  const { verifier, challenge } = generatePKCE$2();
  const state = generateState$2();
  let port = DEFAULT_PORT$2;
  const portAvailable = await isPortAvailable$2(port);
  if (!portAvailable) {
    port = await findAvailablePort$2();
  }
  const serverPromise = startCallbackServer$2(state, verifier, port);
  await new Promise((resolve) => setTimeout(resolve, 100));
  const redirect_uri = `http://localhost:${port}/auth/callback`;
  const params = [
    ["response_type", "code"],
    ["client_id", CLIENT_ID$2],
    ["redirect_uri", redirect_uri],
    ["scope", "openid profile email offline_access"],
    ["code_challenge", challenge],
    ["code_challenge_method", "S256"],
    ["id_token_add_organizations", "true"],
    ["codex_cli_simplified_flow", "true"],
    ["state", state]
  ];
  const queryString = params.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join("&");
  const authUrl = `${AUTH_BASE_URL}/oauth/authorize?${queryString}`;
  console.log("\u{1F4CB} Opening browser for authentication...");
  console.log(`If browser doesn't open, visit:
${authUrl}
`);
  await openBrowser(authUrl);
  const tokens = await serverPromise;
  console.log("\u{1F389} Authentication successful!");
  return tokens;
}

const CLIENT_ID$1 = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";
const CLAUDE_AI_AUTHORIZE_URL = "https://claude.ai/oauth/authorize";
const TOKEN_URL$1 = "https://console.anthropic.com/v1/oauth/token";
const DEFAULT_PORT$1 = 54545;
const SCOPE = "user:inference";
function generatePKCE$1() {
  const verifier = crypto.randomBytes(32).toString("base64url").replace(/[^a-zA-Z0-9\-._~]/g, "");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return { verifier, challenge };
}
function generateState$1() {
  return crypto.randomBytes(32).toString("base64url");
}
async function findAvailablePort$1() {
  return new Promise((resolve) => {
    const server = http.createServer();
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}
async function isPortAvailable$1(port) {
  return new Promise((resolve) => {
    const testServer = http.createServer();
    testServer.once("error", () => {
      testServer.close();
      resolve(false);
    });
    testServer.listen(port, "127.0.0.1", () => {
      testServer.close(() => resolve(true));
    });
  });
}
async function exchangeCodeForTokens$1(code, verifier, port, state) {
  const tokenResponse = await fetch(TOKEN_URL$1, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: `http://localhost:${port}/callback`,
      client_id: CLIENT_ID$1,
      code_verifier: verifier,
      state
    })
  });
  if (!tokenResponse.ok) {
    throw new Error(`Token exchange failed: ${tokenResponse.statusText}`);
  }
  const tokenData = await tokenResponse.json();
  return {
    raw: tokenData,
    token: tokenData.access_token,
    expires: Date.now() + tokenData.expires_in * 1e3
  };
}
async function startCallbackServer$1(state, verifier, port) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, `http://localhost:${port}`);
      if (url.pathname === "/callback") {
        const code = url.searchParams.get("code");
        const receivedState = url.searchParams.get("state");
        if (receivedState !== state) {
          res.writeHead(400);
          res.end("Invalid state parameter");
          server.close();
          reject(new Error("Invalid state parameter"));
          return;
        }
        if (!code) {
          res.writeHead(400);
          res.end("No authorization code received");
          server.close();
          reject(new Error("No authorization code received"));
          return;
        }
        try {
          const tokens = await exchangeCodeForTokens$1(code, verifier, port, state);
          res.writeHead(302, {
            "Location": "https://console.anthropic.com/oauth/code/success?app=claude-code"
          });
          res.end();
          server.close();
          resolve(tokens);
        } catch (error) {
          res.writeHead(500);
          res.end("Token exchange failed");
          server.close();
          reject(error);
        }
      }
    });
    server.listen(port, "127.0.0.1", () => {
    });
    setTimeout(() => {
      server.close();
      reject(new Error("Authentication timeout"));
    }, 5 * 60 * 1e3);
  });
}
async function authenticateClaude() {
  console.log("\u{1F680} Starting Anthropic Claude authentication...");
  const { verifier, challenge } = generatePKCE$1();
  const state = generateState$1();
  let port = DEFAULT_PORT$1;
  const portAvailable = await isPortAvailable$1(port);
  if (!portAvailable) {
    console.log(`Port ${port} is in use, finding an available port...`);
    port = await findAvailablePort$1();
  }
  console.log(`\u{1F4E1} Using callback port: ${port}`);
  const serverPromise = startCallbackServer$1(state, verifier, port);
  await new Promise((resolve) => setTimeout(resolve, 100));
  const redirect_uri = `http://localhost:${port}/callback`;
  const params = new URLSearchParams({
    code: "true",
    // This tells Claude.ai to show the code AND redirect
    client_id: CLIENT_ID$1,
    response_type: "code",
    redirect_uri,
    scope: SCOPE,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state
  });
  const authUrl = `${CLAUDE_AI_AUTHORIZE_URL}?${params}`;
  console.log("\u{1F4CB} Opening browser for authentication...");
  console.log("If browser doesn't open, visit this URL:");
  console.log();
  console.log(`${authUrl}`);
  console.log();
  await openBrowser(authUrl);
  try {
    const tokens = await serverPromise;
    console.log("\u{1F389} Authentication successful!");
    console.log("\u2705 OAuth tokens received");
    return tokens;
  } catch (error) {
    console.error("\n\u274C Failed to authenticate with Anthropic");
    throw error;
  }
}

const execAsync = util.promisify(child_process.exec);
const CLIENT_ID = "681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j.apps.googleusercontent.com";
const CLIENT_SECRET = "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";
const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DEFAULT_PORT = 54545;
const SCOPES = [
  "https://www.googleapis.com/auth/cloud-platform",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile"
].join(" ");
function generatePKCE() {
  const verifier = crypto.randomBytes(32).toString("base64url").replace(/[^a-zA-Z0-9\-._~]/g, "");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return { verifier, challenge };
}
function generateState() {
  return crypto.randomBytes(32).toString("hex");
}
async function findAvailablePort() {
  return new Promise((resolve) => {
    const server = http.createServer();
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}
async function isPortAvailable(port) {
  return new Promise((resolve) => {
    const testServer = http.createServer();
    testServer.once("error", () => {
      testServer.close();
      resolve(false);
    });
    testServer.listen(port, "127.0.0.1", () => {
      testServer.close(() => resolve(true));
    });
  });
}
async function exchangeCodeForTokens(code, verifier, port) {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      code_verifier: verifier,
      redirect_uri: `http://localhost:${port}/oauth2callback`
    })
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }
  const data = await response.json();
  return data;
}
async function startCallbackServer(state, verifier, port) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, `http://localhost:${port}`);
      if (url.pathname === "/oauth2callback") {
        const code = url.searchParams.get("code");
        const receivedState = url.searchParams.get("state");
        const error = url.searchParams.get("error");
        if (error) {
          res.writeHead(302, {
            "Location": "https://developers.google.com/gemini-code-assist/auth_failure_gemini"
          });
          res.end();
          server.close();
          reject(new Error(`Authentication error: ${error}`));
          return;
        }
        if (receivedState !== state) {
          res.writeHead(400);
          res.end("State mismatch. Possible CSRF attack");
          server.close();
          reject(new Error("Invalid state parameter"));
          return;
        }
        if (!code) {
          res.writeHead(400);
          res.end("No authorization code received");
          server.close();
          reject(new Error("No authorization code received"));
          return;
        }
        try {
          const tokens = await exchangeCodeForTokens(code, verifier, port);
          res.writeHead(302, {
            "Location": "https://developers.google.com/gemini-code-assist/auth_success_gemini"
          });
          res.end();
          server.close();
          resolve(tokens);
        } catch (error2) {
          res.writeHead(500);
          res.end("Token exchange failed");
          server.close();
          reject(error2);
        }
      }
    });
    server.listen(port, "127.0.0.1", () => {
    });
    setTimeout(() => {
      server.close();
      reject(new Error("Authentication timeout"));
    }, 5 * 60 * 1e3);
  });
}
async function authenticateGemini() {
  console.log("\u{1F680} Starting Google Gemini authentication...");
  const { verifier, challenge } = generatePKCE();
  const state = generateState();
  let port = DEFAULT_PORT;
  const portAvailable = await isPortAvailable(port);
  if (!portAvailable) {
    console.log(`Port ${port} is in use, finding an available port...`);
    port = await findAvailablePort();
  }
  console.log(`\u{1F4E1} Using callback port: ${port}`);
  const serverPromise = startCallbackServer(state, verifier, port);
  await new Promise((resolve) => setTimeout(resolve, 100));
  const redirect_uri = `http://localhost:${port}/oauth2callback`;
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri,
    scope: SCOPES,
    access_type: "offline",
    // To get refresh token
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
    prompt: "consent"
    // Force consent to get refresh token
  });
  const authUrl = `${AUTHORIZE_URL}?${params}`;
  console.log("\n\u{1F4CB} Opening browser for authentication...");
  console.log("If browser doesn't open, visit this URL:");
  console.log(`
${authUrl}
`);
  const platform = process.platform;
  const openCommand = platform === "darwin" ? "open" : platform === "win32" ? "start" : "xdg-open";
  try {
    await execAsync(`${openCommand} "${authUrl}"`);
  } catch {
    console.log("\u26A0\uFE0F  Could not open browser automatically");
  }
  try {
    const tokens = await serverPromise;
    console.log("\n\u{1F389} Authentication successful!");
    console.log("\u2705 OAuth tokens received");
    return tokens;
  } catch (error) {
    console.error("\n\u274C Failed to authenticate with Google");
    throw error;
  }
}

async function handleConnectCommand(args) {
  const subcommand = args[0];
  if (!subcommand || subcommand === "help" || subcommand === "--help" || subcommand === "-h") {
    showConnectHelp();
    return;
  }
  switch (subcommand.toLowerCase()) {
    case "codex":
      await handleConnectVendor("codex", "OpenAI");
      break;
    case "claude":
      await handleConnectVendor("claude", "Anthropic");
      break;
    case "gemini":
      await handleConnectVendor("gemini", "Gemini");
      break;
    default:
      console.error(chalk.red(`Unknown connect target: ${subcommand}`));
      showConnectHelp();
      process.exit(1);
  }
}
function showConnectHelp() {
  console.log(`
${chalk.bold("happy connect")} - Connect AI vendor API keys to Happy cloud

${chalk.bold("Usage:")}
  happy connect codex        Store your Codex API key in Happy cloud
  happy connect claude       Store your Anthropic API key in Happy cloud
  happy connect gemini       Store your Gemini API key in Happy cloud
  happy connect help         Show this help message

${chalk.bold("Description:")}
  The connect command allows you to securely store your AI vendor API keys
  in Happy cloud. This enables you to use these services through Happy
  without exposing your API keys locally.

${chalk.bold("Examples:")}
  happy connect codex
  happy connect claude
  happy connect gemini

${chalk.bold("Notes:")} 
  \u2022 You must be authenticated with Happy first (run 'happy auth login')
  \u2022 API keys are encrypted and stored securely in Happy cloud
  \u2022 You can manage your stored keys at app.happy.engineering
`);
}
async function handleConnectVendor(vendor, displayName) {
  console.log(chalk.bold(`
\u{1F50C} Connecting ${displayName} to Happy cloud
`));
  const credentials = await types.readCredentials();
  if (!credentials) {
    console.log(chalk.yellow("\u26A0\uFE0F  Not authenticated with Happy"));
    console.log(chalk.gray('  Please run "happy auth login" first'));
    process.exit(1);
  }
  const api = await types.ApiClient.create(credentials);
  if (vendor === "codex") {
    console.log("\u{1F680} Registering Codex token with server");
    const codexAuthTokens = await authenticateCodex();
    await api.registerVendorToken("openai", { oauth: codexAuthTokens });
    console.log("\u2705 Codex token registered with server");
    process.exit(0);
  } else if (vendor === "claude") {
    console.log("\u{1F680} Registering Anthropic token with server");
    const anthropicAuthTokens = await authenticateClaude();
    await api.registerVendorToken("anthropic", { oauth: anthropicAuthTokens });
    console.log("\u2705 Anthropic token registered with server");
    process.exit(0);
  } else if (vendor === "gemini") {
    console.log("\u{1F680} Registering Gemini token with server");
    const geminiAuthTokens = await authenticateGemini();
    await api.registerVendorToken("gemini", { oauth: geminiAuthTokens });
    console.log("\u2705 Gemini token registered with server");
    process.exit(0);
  } else {
    throw new Error(`Unsupported vendor: ${vendor}`);
  }
}

(async () => {
  const args = process.argv.slice(2);
  if (!args.includes("--version")) {
    types.logger.debug("Starting happy CLI with args: ", process.argv);
  }
  const subcommand = args[0];
  if (!args.includes("--version")) ;
  if (subcommand === "doctor") {
    if (args[1] === "clean") {
      const result = await killRunawayHappyProcesses();
      console.log(`Cleaned up ${result.killed} runaway processes`);
      if (result.errors.length > 0) {
        console.log("Errors:", result.errors);
      }
      process.exit(0);
    }
    await runDoctorCommand();
    return;
  } else if (subcommand === "auth") {
    try {
      await handleAuthCommand(args.slice(1));
    } catch (error) {
      console.error(chalk.red("Error:"), error instanceof Error ? error.message : "Unknown error");
      if (process.env.DEBUG) {
        console.error(error);
      }
      process.exit(1);
    }
    return;
  } else if (subcommand === "connect") {
    try {
      await handleConnectCommand(args.slice(1));
    } catch (error) {
      console.error(chalk.red("Error:"), error instanceof Error ? error.message : "Unknown error");
      if (process.env.DEBUG) {
        console.error(error);
      }
      process.exit(1);
    }
    return;
  } else if (subcommand === "config") {
    try {
      await handleConfigCommand(args.slice(1));
    } catch (error) {
      console.error(chalk.red("Error:"), error instanceof Error ? error.message : "Unknown error");
      if (process.env.DEBUG) {
        console.error(error);
      }
      process.exit(1);
    }
    return;
  } else if (subcommand === "codex") {
    try {
      const { runCodex } = await Promise.resolve().then(function () { return require('./runCodex-b5XMLtfn.cjs'); });
      let startedBy = void 0;
      for (let i = 1; i < args.length; i++) {
        if (args[i] === "--started-by") {
          startedBy = args[++i];
        }
      }
      const {
        credentials
      } = await authAndSetupMachineIfNeeded();
      await runCodex({ credentials, startedBy });
    } catch (error) {
      console.error(chalk.red("Error:"), error instanceof Error ? error.message : "Unknown error");
      if (process.env.DEBUG) {
        console.error(error);
      }
      process.exit(1);
    }
    return;
  } else if (subcommand === "gemini") {
    const geminiSubcommand = args[1];
    if (geminiSubcommand === "model" && args[2] === "set" && args[3]) {
      const modelName = args[3];
      const validModels = ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite"];
      if (!validModels.includes(modelName)) {
        console.error(`Invalid model: ${modelName}`);
        console.error(`Available models: ${validModels.join(", ")}`);
        process.exit(1);
      }
      try {
        const { existsSync, readFileSync, writeFileSync, mkdirSync } = require("fs");
        const { join } = require("path");
        const { homedir } = require("os");
        const configDir = join(homedir(), ".gemini");
        const configPath = join(configDir, "config.json");
        if (!existsSync(configDir)) {
          mkdirSync(configDir, { recursive: true });
        }
        let config = {};
        if (existsSync(configPath)) {
          try {
            config = JSON.parse(readFileSync(configPath, "utf-8"));
          } catch (error) {
            config = {};
          }
        }
        config.model = modelName;
        writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
        console.log(`\u2713 Model set to: ${modelName}`);
        console.log(`  Config saved to: ${configPath}`);
        console.log(`  This model will be used in future sessions.`);
        process.exit(0);
      } catch (error) {
        console.error("Failed to save model configuration:", error);
        process.exit(1);
      }
    }
    if (geminiSubcommand === "model" && args[2] === "get") {
      try {
        const { existsSync, readFileSync } = require("fs");
        const { join } = require("path");
        const { homedir } = require("os");
        const configPaths = [
          join(homedir(), ".gemini", "config.json"),
          join(homedir(), ".config", "gemini", "config.json")
        ];
        let model = null;
        for (const configPath of configPaths) {
          if (existsSync(configPath)) {
            try {
              const config = JSON.parse(readFileSync(configPath, "utf-8"));
              model = config.model || config.GEMINI_MODEL || null;
              if (model) break;
            } catch (error) {
            }
          }
        }
        if (model) {
          console.log(`Current model: ${model}`);
        } else if (process.env.GEMINI_MODEL) {
          console.log(`Current model: ${process.env.GEMINI_MODEL} (from GEMINI_MODEL env var)`);
        } else {
          console.log("Current model: gemini-2.5-pro (default)");
        }
        process.exit(0);
      } catch (error) {
        console.error("Failed to read model configuration:", error);
        process.exit(1);
      }
    }
    try {
      const { runGemini } = await Promise.resolve().then(function () { return require('./runGemini-nJtCkokH.cjs'); });
      let startedBy = void 0;
      for (let i = 1; i < args.length; i++) {
        if (args[i] === "--started-by") {
          startedBy = args[++i];
        }
      }
      const {
        credentials
      } = await authAndSetupMachineIfNeeded();
      types.logger.debug("Ensuring Happy background service is running & matches our version...");
      if (!await isDaemonRunningCurrentlyInstalledHappyVersion()) {
        types.logger.debug("Starting Happy background service...");
        const daemonProcess = spawnHappyCLI(["daemon", "start-sync"], {
          detached: true,
          stdio: "ignore",
          env: process.env
        });
        daemonProcess.unref();
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      await runGemini({ credentials, startedBy });
    } catch (error) {
      console.error(chalk.red("Error:"), error instanceof Error ? error.message : "Unknown error");
      if (process.env.DEBUG) {
        console.error(error);
      }
      process.exit(1);
    }
    return;
  } else if (subcommand === "logout") {
    console.log(chalk.yellow('Note: "happy logout" is deprecated. Use "happy auth logout" instead.\n'));
    try {
      await handleAuthCommand(["logout"]);
    } catch (error) {
      console.error(chalk.red("Error:"), error instanceof Error ? error.message : "Unknown error");
      if (process.env.DEBUG) {
        console.error(error);
      }
      process.exit(1);
    }
    return;
  } else if (subcommand === "notify") {
    try {
      await handleNotifyCommand(args.slice(1));
    } catch (error) {
      console.error(chalk.red("Error:"), error instanceof Error ? error.message : "Unknown error");
      if (process.env.DEBUG) {
        console.error(error);
      }
      process.exit(1);
    }
    return;
  } else if (subcommand === "daemon") {
    const daemonSubcommand = args[1];
    if (daemonSubcommand === "list") {
      try {
        const sessions = await listDaemonSessions();
        if (sessions.length === 0) {
          console.log("No active sessions this daemon is aware of (they might have been started by a previous version of the daemon)");
        } else {
          console.log("Active sessions:");
          console.log(JSON.stringify(sessions, null, 2));
        }
      } catch (error) {
        console.log("No daemon running");
      }
      return;
    } else if (daemonSubcommand === "stop-session") {
      const sessionId = args[2];
      if (!sessionId) {
        console.error("Session ID required");
        process.exit(1);
      }
      try {
        const success = await stopDaemonSession(sessionId);
        console.log(success ? "Session stopped" : "Failed to stop session");
      } catch (error) {
        console.log("No daemon running");
      }
      return;
    } else if (daemonSubcommand === "start") {
      const child = spawnHappyCLI(["daemon", "start-sync"], {
        detached: true,
        stdio: "ignore",
        env: process.env,
        windowsHide: true
        // Prevent opening a new console window on Windows
      });
      child.unref();
      let started = false;
      for (let i = 0; i < 50; i++) {
        if (await checkIfDaemonRunningAndCleanupStaleState()) {
          started = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (started) {
        console.log("Daemon started successfully");
      } else {
        console.error("Failed to start daemon");
        process.exit(1);
      }
      process.exit(0);
    } else if (daemonSubcommand === "start-sync") {
      await startDaemon();
      process.exit(0);
    } else if (daemonSubcommand === "stop") {
      await stopDaemon();
      process.exit(0);
    } else if (daemonSubcommand === "status") {
      await runDoctorCommand("daemon");
      process.exit(0);
    } else if (daemonSubcommand === "logs") {
      const latest = await types.getLatestDaemonLog();
      if (!latest) {
        console.log("No daemon logs found");
      } else {
        console.log(latest.path);
      }
      process.exit(0);
    } else if (daemonSubcommand === "install") {
      try {
        await install();
      } catch (error) {
        console.error(chalk.red("Error:"), error instanceof Error ? error.message : "Unknown error");
        process.exit(1);
      }
    } else if (daemonSubcommand === "uninstall") {
      try {
        await uninstall();
      } catch (error) {
        console.error(chalk.red("Error:"), error instanceof Error ? error.message : "Unknown error");
        process.exit(1);
      }
    } else {
      console.log(`
${chalk.bold("happy daemon")} - Daemon management

${chalk.bold("Usage:")}
  happy daemon start              Start the daemon (detached)
  happy daemon stop               Stop the daemon (sessions stay alive)
  happy daemon status             Show daemon status
  happy daemon list               List active sessions

  If you want to kill all happy related processes run 
  ${chalk.cyan("happy doctor clean")}

${chalk.bold("Note:")} The daemon runs in the background and manages Claude sessions.

${chalk.bold("To clean up runaway processes:")} Use ${chalk.cyan("happy doctor clean")}
`);
    }
    return;
  } else {
    if (args.length > 0 && args[0] === "claude") {
      args.shift();
    }
    const options = {};
    let showHelp = false;
    let showVersion = false;
    const unknownArgs = [];
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg === "-h" || arg === "--help") {
        showHelp = true;
        unknownArgs.push(arg);
      } else if (arg === "-v" || arg === "--version") {
        showVersion = true;
        unknownArgs.push(arg);
      } else if (arg === "--happy-starting-mode") {
        options.startingMode = z.z.enum(["local", "remote"]).parse(args[++i]);
      } else if (arg === "--yolo") {
        unknownArgs.push("--dangerously-skip-permissions");
      } else if (arg === "--started-by") {
        options.startedBy = args[++i];
      } else if (arg === "--claude-env") {
        const envArg = args[++i];
        if (envArg && envArg.includes("=")) {
          const eqIndex = envArg.indexOf("=");
          const key = envArg.substring(0, eqIndex);
          const value = envArg.substring(eqIndex + 1);
          options.claudeEnvVars = options.claudeEnvVars || {};
          options.claudeEnvVars[key] = value;
        } else {
          console.error(chalk.red(`Invalid --claude-env format: ${envArg}. Expected KEY=VALUE`));
          process.exit(1);
        }
      } else {
        unknownArgs.push(arg);
        if (i + 1 < args.length && !args[i + 1].startsWith("-")) {
          unknownArgs.push(args[++i]);
        }
      }
    }
    if (unknownArgs.length > 0) {
      options.claudeArgs = [...options.claudeArgs || [], ...unknownArgs];
    }
    if (showHelp) {
      console.log(`
${chalk.bold("happy")} - Claude Code On the Go

${chalk.bold("Usage:")}
  happy [options]         Start Claude with mobile control
  happy auth              Manage authentication
  happy codex             Start Codex mode
  happy config            Manage CLI configuration (API keys, etc.)
  happy gemini            Start Gemini mode (ACP)
  happy connect           Connect AI vendor API keys
  happy notify            Send push notification
  happy daemon            Manage background service that allows
                            to spawn new sessions away from your computer
  happy doctor            System diagnostics & troubleshooting

${chalk.bold("Examples:")}
  happy                    Start session
  happy --yolo             Start with bypassing permissions
                            happy sugar for --dangerously-skip-permissions
  happy --claude-env ANTHROPIC_BASE_URL=http://127.0.0.1:3456
                           Use a custom API endpoint (e.g., claude-code-router)
  happy auth login --force Authenticate
  happy doctor             Run diagnostics

${chalk.bold("Happy supports ALL Claude options!")}
  Use any claude flag with happy as you would with claude. Our favorite:

  happy --resume

${chalk.gray("\u2500".repeat(60))}
${chalk.bold.cyan("Claude Code Options (from `claude --help`):")}
`);
      try {
        const claudeHelp = node_child_process.execFileSync(process.execPath, [claudeCliPath, "--help"], { encoding: "utf8" });
        console.log(claudeHelp);
      } catch (e) {
        console.log(chalk.yellow("Could not retrieve claude help. Make sure claude is installed."));
      }
      process.exit(0);
    }
    if (showVersion) {
      console.log(`happy version: ${types.packageJson.version}`);
    }
    const {
      credentials
    } = await authAndSetupMachineIfNeeded();
    types.logger.debug("Ensuring Happy background service is running & matches our version...");
    if (!await isDaemonRunningCurrentlyInstalledHappyVersion()) {
      types.logger.debug("Starting Happy background service...");
      const daemonProcess = spawnHappyCLI(["daemon", "start-sync"], {
        detached: true,
        stdio: "ignore",
        env: process.env,
        windowsHide: true
        // Prevent opening a new console window on Windows
      });
      daemonProcess.unref();
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    try {
      await runClaude(credentials, options);
    } catch (error) {
      console.error(chalk.red("Error:"), error instanceof Error ? error.message : "Unknown error");
      if (process.env.DEBUG) {
        console.error(error);
      }
      process.exit(1);
    }
  }
})();
async function handleNotifyCommand(args) {
  let message = "";
  let title = "";
  let showHelp = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "-p" && i + 1 < args.length) {
      message = args[++i];
    } else if (arg === "-t" && i + 1 < args.length) {
      title = args[++i];
    } else if (arg === "-h" || arg === "--help") {
      showHelp = true;
    } else {
      console.error(chalk.red(`Unknown argument for notify command: ${arg}`));
      process.exit(1);
    }
  }
  if (showHelp) {
    console.log(`
${chalk.bold("happy notify")} - Send notification

${chalk.bold("Usage:")}
  happy notify -p <message> [-t <title>]    Send notification with custom message and optional title
  happy notify -h, --help                   Show this help

${chalk.bold("Options:")}
  -p <message>    Notification message (required)
  -t <title>      Notification title (optional, defaults to "Happy")

${chalk.bold("Examples:")}
  happy notify -p "Deployment complete!"
  happy notify -p "System update complete" -t "Server Status"
  happy notify -t "Alert" -p "Database connection restored"
`);
    return;
  }
  if (!message) {
    console.error(chalk.red('Error: Message is required. Use -p "your message" to specify the notification text.'));
    console.log(chalk.gray('Run "happy notify --help" for usage information.'));
    process.exit(1);
  }
  let credentials = await types.readCredentials();
  if (!credentials) {
    console.error(chalk.red('Error: Not authenticated. Please run "happy auth login" first.'));
    process.exit(1);
  }
  console.log(chalk.blue("\u{1F4F1} Sending push notification..."));
  try {
    const api = await types.ApiClient.create(credentials);
    const notificationTitle = title || "Happy";
    api.push().sendToAllDevices(
      notificationTitle,
      message,
      {
        source: "cli",
        timestamp: Date.now()
      }
    );
    console.log(chalk.green("\u2713 Push notification sent successfully!"));
    console.log(chalk.gray(`  Title: ${notificationTitle}`));
    console.log(chalk.gray(`  Message: ${message}`));
    console.log(chalk.gray("  Check your mobile device for the notification."));
    await new Promise((resolve) => setTimeout(resolve, 1e3));
  } catch (error) {
    console.error(chalk.red("\u2717 Failed to send push notification"));
    throw error;
  }
}

exports.MessageBuffer = MessageBuffer;
exports.MessageQueue2 = MessageQueue2;
exports.hashObject = hashObject;
exports.initialMachineMetadata = initialMachineMetadata;
exports.notifyDaemonSessionStarted = notifyDaemonSessionStarted;
exports.registerKillSessionHandler = registerKillSessionHandler;
exports.startHappyServer = startHappyServer;
exports.stopCaffeinate = stopCaffeinate;
exports.trimIdent = trimIdent;
