import { useStdout, useInput, Box, Text, render } from 'ink';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { l as logger, A as ApiClient, r as readSettings, p as projectPath, c as configuration, b as packageJson } from './types-2X3BxmSO.mjs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { z } from 'zod';
import { ElicitRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { execSync } from 'child_process';
import { randomUUID } from 'node:crypto';
import { i as initialMachineMetadata, n as notifyDaemonSessionStarted, M as MessageQueue2, h as hashObject, r as registerKillSessionHandler, a as MessageBuffer, s as startHappyServer, b as stopCaffeinate } from './index-Rxv9jgYl.mjs';
import os from 'node:os';
import { resolve, join } from 'node:path';
import fs from 'node:fs';
import { C as CHANGE_TITLE_INSTRUCTION } from './constants-CmM6FmsE.mjs';
import 'chalk';
import 'fs';
import 'node:fs/promises';
import 'tweetnacl';
import 'node:events';
import 'socket.io-client';
import 'util';
import 'fs/promises';
import 'crypto';
import 'path';
import 'url';
import 'os';
import 'axios';
import 'expo-server-sdk';
import 'node:child_process';
import 'node:readline';
import 'node:url';
import 'ps-list';
import 'cross-spawn';
import 'tmp';
import 'qrcode-terminal';
import 'open';
import 'fastify';
import 'fastify-type-provider-zod';
import '@modelcontextprotocol/sdk/server/mcp.js';
import 'node:http';
import '@modelcontextprotocol/sdk/server/streamableHttp.js';
import 'http';

const DEFAULT_TIMEOUT = 14 * 24 * 60 * 60 * 1e3;
function getCodexMcpCommand() {
  try {
    const version = execSync("codex --version", { encoding: "utf8", windowsHide: true }).trim();
    const match = version.match(/codex-cli\s+(\d+\.\d+\.\d+(?:-alpha\.\d+)?)/);
    if (!match) return "mcp-server";
    const versionStr = match[1];
    const [major, minor, patch] = versionStr.split(/[-.]/).map(Number);
    if (major > 0 || minor > 43) return "mcp-server";
    if (minor === 43 && patch === 0) {
      if (versionStr.includes("-alpha.")) {
        const alphaNum = parseInt(versionStr.split("-alpha.")[1]);
        return alphaNum >= 5 ? "mcp-server" : "mcp";
      }
      return "mcp-server";
    }
    return "mcp";
  } catch (error) {
    logger.debug("[CodexMCP] Error detecting codex version, defaulting to mcp-server:", error);
    return "mcp-server";
  }
}
class CodexMcpClient {
  client;
  transport = null;
  connected = false;
  sessionId = null;
  conversationId = null;
  handler = null;
  permissionHandler = null;
  constructor() {
    this.client = new Client(
      { name: "happy-codex-client", version: "1.0.0" },
      { capabilities: { elicitation: {} } }
    );
    this.client.setNotificationHandler(z.object({
      method: z.literal("codex/event"),
      params: z.object({
        msg: z.any()
      })
    }).passthrough(), (data) => {
      const msg = data.params.msg;
      this.updateIdentifiersFromEvent(msg);
      this.handler?.(msg);
    });
  }
  setHandler(handler) {
    this.handler = handler;
  }
  /**
   * Set the permission handler for tool approval
   */
  setPermissionHandler(handler) {
    this.permissionHandler = handler;
  }
  async connect() {
    if (this.connected) return;
    const mcpCommand = getCodexMcpCommand();
    logger.debug(`[CodexMCP] Connecting to Codex MCP server using command: codex ${mcpCommand}`);
    this.transport = new StdioClientTransport({
      command: "codex",
      args: [mcpCommand],
      env: Object.keys(process.env).reduce((acc, key) => {
        const value = process.env[key];
        if (typeof value === "string") acc[key] = value;
        return acc;
      }, {})
    });
    this.registerPermissionHandlers();
    await this.client.connect(this.transport);
    this.connected = true;
    logger.debug("[CodexMCP] Connected to Codex");
  }
  registerPermissionHandlers() {
    this.client.setRequestHandler(
      ElicitRequestSchema,
      async (request) => {
        console.log("[CodexMCP] Received elicitation request:", request.params);
        const params = request.params;
        const toolName = "CodexBash";
        if (!this.permissionHandler) {
          logger.debug("[CodexMCP] No permission handler set, denying by default");
          return {
            decision: "denied"
          };
        }
        try {
          const result = await this.permissionHandler.handleToolCall(
            params.codex_call_id,
            toolName,
            {
              command: params.codex_command,
              cwd: params.codex_cwd
            }
          );
          logger.debug("[CodexMCP] Permission result:", result);
          return {
            decision: result.decision
          };
        } catch (error) {
          logger.debug("[CodexMCP] Error handling permission request:", error);
          return {
            decision: "denied",
            reason: error instanceof Error ? error.message : "Permission request failed"
          };
        }
      }
    );
    logger.debug("[CodexMCP] Permission handlers registered");
  }
  async startSession(config, options) {
    if (!this.connected) await this.connect();
    logger.debug("[CodexMCP] Starting Codex session:", config);
    const response = await this.client.callTool({
      name: "codex",
      arguments: config
    }, void 0, {
      signal: options?.signal,
      timeout: DEFAULT_TIMEOUT
      // maxTotalTimeout: 10000000000 
    });
    logger.debug("[CodexMCP] startSession response:", response);
    this.extractIdentifiers(response);
    return response;
  }
  async continueSession(prompt, options) {
    if (!this.connected) await this.connect();
    if (!this.sessionId) {
      throw new Error("No active session. Call startSession first.");
    }
    if (!this.conversationId) {
      this.conversationId = this.sessionId;
      logger.debug("[CodexMCP] conversationId missing, defaulting to sessionId:", this.conversationId);
    }
    const args = { sessionId: this.sessionId, conversationId: this.conversationId, prompt };
    logger.debug("[CodexMCP] Continuing Codex session:", args);
    const response = await this.client.callTool({
      name: "codex-reply",
      arguments: args
    }, void 0, {
      signal: options?.signal,
      timeout: DEFAULT_TIMEOUT
    });
    logger.debug("[CodexMCP] continueSession response:", response);
    this.extractIdentifiers(response);
    return response;
  }
  updateIdentifiersFromEvent(event) {
    if (!event || typeof event !== "object") {
      return;
    }
    const candidates = [event];
    if (event.data && typeof event.data === "object") {
      candidates.push(event.data);
    }
    for (const candidate of candidates) {
      const sessionId = candidate.session_id ?? candidate.sessionId;
      if (sessionId) {
        this.sessionId = sessionId;
        logger.debug("[CodexMCP] Session ID extracted from event:", this.sessionId);
      }
      const conversationId = candidate.conversation_id ?? candidate.conversationId;
      if (conversationId) {
        this.conversationId = conversationId;
        logger.debug("[CodexMCP] Conversation ID extracted from event:", this.conversationId);
      }
    }
  }
  extractIdentifiers(response) {
    const meta = response?.meta || {};
    if (meta.sessionId) {
      this.sessionId = meta.sessionId;
      logger.debug("[CodexMCP] Session ID extracted:", this.sessionId);
    } else if (response?.sessionId) {
      this.sessionId = response.sessionId;
      logger.debug("[CodexMCP] Session ID extracted:", this.sessionId);
    }
    if (meta.conversationId) {
      this.conversationId = meta.conversationId;
      logger.debug("[CodexMCP] Conversation ID extracted:", this.conversationId);
    } else if (response?.conversationId) {
      this.conversationId = response.conversationId;
      logger.debug("[CodexMCP] Conversation ID extracted:", this.conversationId);
    }
    const content = response?.content;
    if (Array.isArray(content)) {
      for (const item of content) {
        if (!this.sessionId && item?.sessionId) {
          this.sessionId = item.sessionId;
          logger.debug("[CodexMCP] Session ID extracted from content:", this.sessionId);
        }
        if (!this.conversationId && item && typeof item === "object" && "conversationId" in item && item.conversationId) {
          this.conversationId = item.conversationId;
          logger.debug("[CodexMCP] Conversation ID extracted from content:", this.conversationId);
        }
      }
    }
  }
  getSessionId() {
    return this.sessionId;
  }
  hasActiveSession() {
    return this.sessionId !== null;
  }
  clearSession() {
    const previousSessionId = this.sessionId;
    this.sessionId = null;
    this.conversationId = null;
    logger.debug("[CodexMCP] Session cleared, previous sessionId:", previousSessionId);
  }
  /**
   * Store the current session ID without clearing it, useful for abort handling
   */
  storeSessionForResume() {
    logger.debug("[CodexMCP] Storing session for potential resume:", this.sessionId);
    return this.sessionId;
  }
  async disconnect() {
    if (!this.connected) return;
    const pid = this.transport?.pid ?? null;
    logger.debug(`[CodexMCP] Disconnecting; child pid=${pid ?? "none"}`);
    try {
      logger.debug("[CodexMCP] client.close begin");
      await this.client.close();
      logger.debug("[CodexMCP] client.close done");
    } catch (e) {
      logger.debug("[CodexMCP] Error closing client, attempting transport close directly", e);
      try {
        logger.debug("[CodexMCP] transport.close begin");
        await this.transport?.close?.();
        logger.debug("[CodexMCP] transport.close done");
      } catch {
      }
    }
    if (pid) {
      try {
        process.kill(pid, 0);
        logger.debug("[CodexMCP] Child still alive, sending SIGKILL");
        try {
          process.kill(pid, "SIGKILL");
        } catch {
        }
      } catch {
      }
    }
    this.transport = null;
    this.connected = false;
    this.sessionId = null;
    this.conversationId = null;
    logger.debug("[CodexMCP] Disconnected");
  }
}

class CodexPermissionHandler {
  pendingRequests = /* @__PURE__ */ new Map();
  session;
  constructor(session) {
    this.session = session;
    this.setupRpcHandler();
  }
  /**
   * Handle a tool permission request
   * @param toolCallId - The unique ID of the tool call
   * @param toolName - The name of the tool being called
   * @param input - The input parameters for the tool
   * @returns Promise resolving to permission result
   */
  async handleToolCall(toolCallId, toolName, input) {
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(toolCallId, {
        resolve,
        reject,
        toolName,
        input
      });
      this.session.updateAgentState((currentState) => ({
        ...currentState,
        requests: {
          ...currentState.requests,
          [toolCallId]: {
            tool: toolName,
            arguments: input,
            createdAt: Date.now()
          }
        }
      }));
      logger.debug(`[Codex] Permission request sent for tool: ${toolName} (${toolCallId})`);
    });
  }
  /**
   * Setup RPC handler for permission responses
   */
  setupRpcHandler() {
    this.session.rpcHandlerManager.registerHandler(
      "permission",
      async (response) => {
        const pending = this.pendingRequests.get(response.id);
        if (!pending) {
          logger.debug("[Codex] Permission request not found or already resolved");
          return;
        }
        this.pendingRequests.delete(response.id);
        const result = response.approved ? { decision: response.decision === "approved_for_session" ? "approved_for_session" : "approved" } : { decision: response.decision === "denied" ? "denied" : "abort" };
        pending.resolve(result);
        this.session.updateAgentState((currentState) => {
          const request = currentState.requests?.[response.id];
          if (!request) return currentState;
          const { [response.id]: _, ...remainingRequests } = currentState.requests || {};
          let res = {
            ...currentState,
            requests: remainingRequests,
            completedRequests: {
              ...currentState.completedRequests,
              [response.id]: {
                ...request,
                completedAt: Date.now(),
                status: response.approved ? "approved" : "denied",
                decision: result.decision
              }
            }
          };
          return res;
        });
        logger.debug(`[Codex] Permission ${response.approved ? "approved" : "denied"} for ${pending.toolName}`);
      }
    );
  }
  /**
   * Reset state for new sessions
   */
  reset() {
    for (const [id, pending] of this.pendingRequests.entries()) {
      pending.reject(new Error("Session reset"));
    }
    this.pendingRequests.clear();
    this.session.updateAgentState((currentState) => {
      const pendingRequests = currentState.requests || {};
      const completedRequests = { ...currentState.completedRequests };
      for (const [id, request] of Object.entries(pendingRequests)) {
        completedRequests[id] = {
          ...request,
          completedAt: Date.now(),
          status: "canceled",
          reason: "Session reset"
        };
      }
      return {
        ...currentState,
        requests: {},
        completedRequests
      };
    });
    logger.debug("[Codex] Permission handler reset");
  }
}

class ReasoningProcessor {
  accumulator = "";
  inTitleCapture = false;
  titleBuffer = "";
  contentBuffer = "";
  hasTitle = false;
  currentCallId = null;
  toolCallStarted = false;
  currentTitle = null;
  onMessage = null;
  constructor(onMessage) {
    this.onMessage = onMessage || null;
    this.reset();
  }
  /**
   * Set the message callback for sending messages directly
   */
  setMessageCallback(callback) {
    this.onMessage = callback;
  }
  /**
   * Process a reasoning section break - indicates a new reasoning section is starting
   */
  handleSectionBreak() {
    this.finishCurrentToolCall("canceled");
    this.resetState();
    logger.debug("[ReasoningProcessor] Section break - reset state");
  }
  /**
   * Process a reasoning delta and accumulate content
   */
  processDelta(delta) {
    this.accumulator += delta;
    if (!this.inTitleCapture && !this.hasTitle && !this.contentBuffer) {
      if (this.accumulator.startsWith("**")) {
        this.inTitleCapture = true;
        this.titleBuffer = this.accumulator.substring(2);
        logger.debug("[ReasoningProcessor] Started title capture");
      } else if (this.accumulator.length > 0) {
        this.contentBuffer = this.accumulator;
      }
    } else if (this.inTitleCapture) {
      this.titleBuffer = this.accumulator.substring(2);
      const titleEndIndex = this.titleBuffer.indexOf("**");
      if (titleEndIndex !== -1) {
        const title = this.titleBuffer.substring(0, titleEndIndex);
        const afterTitle = this.titleBuffer.substring(titleEndIndex + 2);
        this.hasTitle = true;
        this.inTitleCapture = false;
        this.currentTitle = title;
        this.contentBuffer = afterTitle;
        this.currentCallId = randomUUID();
        logger.debug(`[ReasoningProcessor] Title captured: "${title}"`);
        this.sendToolCallStart(title);
      }
    } else if (this.hasTitle) {
      this.contentBuffer = this.accumulator.substring(
        this.accumulator.indexOf("**") + 2 + this.currentTitle.length + 2
      );
    } else {
      this.contentBuffer = this.accumulator;
    }
  }
  /**
   * Send the tool call start message
   */
  sendToolCallStart(title) {
    if (!this.currentCallId || this.toolCallStarted) {
      return;
    }
    const toolCall = {
      type: "tool-call",
      name: "CodexReasoning",
      callId: this.currentCallId,
      input: {
        title
      },
      id: randomUUID()
    };
    logger.debug(`[ReasoningProcessor] Sending tool call start for: "${title}"`);
    this.onMessage?.(toolCall);
    this.toolCallStarted = true;
  }
  /**
   * Complete the reasoning section with final text
   */
  complete(fullText) {
    let title;
    let content = fullText;
    if (fullText.startsWith("**")) {
      const titleEndIndex = fullText.indexOf("**", 2);
      if (titleEndIndex !== -1) {
        title = fullText.substring(2, titleEndIndex);
        content = fullText.substring(titleEndIndex + 2).trim();
      }
    }
    logger.debug(`[ReasoningProcessor] Complete reasoning - Title: "${title}", Has content: ${content.length > 0}`);
    if (title && !this.toolCallStarted) {
      this.currentCallId = this.currentCallId || randomUUID();
      this.sendToolCallStart(title);
    }
    if (this.toolCallStarted && this.currentCallId) {
      const toolResult = {
        type: "tool-call-result",
        callId: this.currentCallId,
        output: {
          content,
          status: "completed"
        },
        id: randomUUID()
      };
      logger.debug("[ReasoningProcessor] Sending tool call result");
      this.onMessage?.(toolResult);
    } else {
      const reasoningMessage = {
        type: "reasoning",
        message: content,
        id: randomUUID()
      };
      logger.debug("[ReasoningProcessor] Sending reasoning message");
      this.onMessage?.(reasoningMessage);
    }
    this.resetState();
  }
  /**
   * Abort the current reasoning section
   */
  abort() {
    logger.debug("[ReasoningProcessor] Abort called");
    this.finishCurrentToolCall("canceled");
    this.resetState();
  }
  /**
   * Reset the processor state
   */
  reset() {
    this.finishCurrentToolCall("canceled");
    this.resetState();
  }
  /**
   * Finish current tool call if one is in progress
   */
  finishCurrentToolCall(status) {
    if (this.toolCallStarted && this.currentCallId) {
      const toolResult = {
        type: "tool-call-result",
        callId: this.currentCallId,
        output: {
          content: this.contentBuffer || "",
          status
        },
        id: randomUUID()
      };
      logger.debug(`[ReasoningProcessor] Sending tool call result with status: ${status}`);
      this.onMessage?.(toolResult);
    }
  }
  /**
   * Reset internal state
   */
  resetState() {
    this.accumulator = "";
    this.inTitleCapture = false;
    this.titleBuffer = "";
    this.contentBuffer = "";
    this.hasTitle = false;
    this.currentCallId = null;
    this.toolCallStarted = false;
    this.currentTitle = null;
  }
  /**
   * Get the current call ID for tool result matching
   */
  getCurrentCallId() {
    return this.currentCallId;
  }
  /**
   * Check if a tool call has been started
   */
  hasStartedToolCall() {
    return this.toolCallStarted;
  }
}

class DiffProcessor {
  previousDiff = null;
  onMessage = null;
  constructor(onMessage) {
    this.onMessage = onMessage || null;
  }
  /**
   * Process a turn_diff message and check if the unified_diff has changed
   */
  processDiff(unifiedDiff) {
    if (this.previousDiff !== unifiedDiff) {
      logger.debug("[DiffProcessor] Unified diff changed, sending CodexDiff tool call");
      const callId = randomUUID();
      const toolCall = {
        type: "tool-call",
        name: "CodexDiff",
        callId,
        input: {
          unified_diff: unifiedDiff
        },
        id: randomUUID()
      };
      this.onMessage?.(toolCall);
      const toolResult = {
        type: "tool-call-result",
        callId,
        output: {
          status: "completed"
        },
        id: randomUUID()
      };
      this.onMessage?.(toolResult);
    }
    this.previousDiff = unifiedDiff;
    logger.debug("[DiffProcessor] Updated stored diff");
  }
  /**
   * Reset the processor state (called on task_complete or turn_aborted)
   */
  reset() {
    logger.debug("[DiffProcessor] Resetting diff state");
    this.previousDiff = null;
  }
  /**
   * Set the message callback for sending messages directly
   */
  setMessageCallback(callback) {
    this.onMessage = callback;
  }
  /**
   * Get the current diff value
   */
  getCurrentDiff() {
    return this.previousDiff;
  }
}

const CodexDisplay = ({ messageBuffer, logPath, onExit }) => {
  const [messages, setMessages] = useState([]);
  const [confirmationMode, setConfirmationMode] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(false);
  const confirmationTimeoutRef = useRef(null);
  const { stdout } = useStdout();
  const terminalWidth = stdout.columns || 80;
  const terminalHeight = stdout.rows || 24;
  useEffect(() => {
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
  const resetConfirmation = useCallback(() => {
    setConfirmationMode(false);
    if (confirmationTimeoutRef.current) {
      clearTimeout(confirmationTimeoutRef.current);
      confirmationTimeoutRef.current = null;
    }
  }, []);
  const setConfirmationWithTimeout = useCallback(() => {
    setConfirmationMode(true);
    if (confirmationTimeoutRef.current) {
      clearTimeout(confirmationTimeoutRef.current);
    }
    confirmationTimeoutRef.current = setTimeout(() => {
      resetConfirmation();
    }, 15e3);
  }, [resetConfirmation]);
  useInput(useCallback(async (input, key) => {
    if (actionInProgress) return;
    if (key.ctrl && input === "c") {
      if (confirmationMode) {
        resetConfirmation();
        setActionInProgress(true);
        await new Promise((resolve) => setTimeout(resolve, 100));
        onExit?.();
      } else {
        setConfirmationWithTimeout();
      }
      return;
    }
    if (confirmationMode) {
      resetConfirmation();
    }
  }, [confirmationMode, actionInProgress, onExit, setConfirmationWithTimeout, resetConfirmation]));
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
  return /* @__PURE__ */ React.createElement(Box, { flexDirection: "column", width: terminalWidth, height: terminalHeight }, /* @__PURE__ */ React.createElement(
    Box,
    {
      flexDirection: "column",
      width: terminalWidth,
      height: terminalHeight - 4,
      borderStyle: "round",
      borderColor: "gray",
      paddingX: 1,
      overflow: "hidden"
    },
    /* @__PURE__ */ React.createElement(Box, { flexDirection: "column", marginBottom: 1 }, /* @__PURE__ */ React.createElement(Text, { color: "gray", bold: true }, "\u{1F916} Codex Agent Messages"), /* @__PURE__ */ React.createElement(Text, { color: "gray", dimColor: true }, "\u2500".repeat(Math.min(terminalWidth - 4, 60)))),
    /* @__PURE__ */ React.createElement(Box, { flexDirection: "column", height: terminalHeight - 10, overflow: "hidden" }, messages.length === 0 ? /* @__PURE__ */ React.createElement(Text, { color: "gray", dimColor: true }, "Waiting for messages...") : (
      // Show only the last messages that fit in the available space
      messages.slice(-Math.max(1, terminalHeight - 10)).map((msg) => /* @__PURE__ */ React.createElement(Box, { key: msg.id, flexDirection: "column", marginBottom: 1 }, /* @__PURE__ */ React.createElement(Text, { color: getMessageColor(msg.type), dimColor: true }, formatMessage(msg))))
    ))
  ), /* @__PURE__ */ React.createElement(
    Box,
    {
      width: terminalWidth,
      borderStyle: "round",
      borderColor: actionInProgress ? "gray" : confirmationMode ? "red" : "green",
      paddingX: 2,
      justifyContent: "center",
      alignItems: "center",
      flexDirection: "column"
    },
    /* @__PURE__ */ React.createElement(Box, { flexDirection: "column", alignItems: "center" }, actionInProgress ? /* @__PURE__ */ React.createElement(Text, { color: "gray", bold: true }, "Exiting agent...") : confirmationMode ? /* @__PURE__ */ React.createElement(Text, { color: "red", bold: true }, "\u26A0\uFE0F  Press Ctrl-C again to exit the agent") : /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(Text, { color: "green", bold: true }, "\u{1F916} Codex Agent Running \u2022 Ctrl-C to exit")), process.env.DEBUG && logPath && /* @__PURE__ */ React.createElement(Text, { color: "gray", dimColor: true }, "Debug logs: ", logPath))
  ));
};

function emitReadyIfIdle({ pending, queueSize, shouldExit, sendReady, notify }) {
  if (shouldExit) {
    return false;
  }
  if (pending) {
    return false;
  }
  if (queueSize() > 0) {
    return false;
  }
  sendReady();
  notify?.();
  return true;
}
async function runCodex(opts) {
  const sessionTag = randomUUID();
  const api = await ApiClient.create(opts.credentials);
  logger.debug(`[codex] Starting with options: startedBy=${opts.startedBy || "terminal"}`);
  const settings = await readSettings();
  let machineId = settings?.machineId;
  if (!machineId) {
    console.error(`[START] No machine ID found in settings, which is unexpected since authAndSetupMachineIfNeeded should have created it. Please report this issue on https://github.com/slopus/happy-cli/issues`);
    process.exit(1);
  }
  logger.debug(`Using machineId: ${machineId}`);
  await api.getOrCreateMachine({
    machineId,
    metadata: initialMachineMetadata
  });
  let state = {
    controlledByUser: false
  };
  let metadata = {
    path: process.cwd(),
    host: os.hostname(),
    version: packageJson.version,
    os: os.platform(),
    machineId,
    homeDir: os.homedir(),
    happyHomeDir: configuration.happyHomeDir,
    happyLibDir: projectPath(),
    happyToolsDir: resolve(projectPath(), "tools", "unpacked"),
    startedFromDaemon: opts.startedBy === "daemon",
    hostPid: process.pid,
    startedBy: opts.startedBy || "terminal",
    // Initialize lifecycle state
    lifecycleState: "running",
    lifecycleStateSince: Date.now(),
    flavor: "codex"
  };
  const response = await api.getOrCreateSession({ tag: sessionTag, metadata, state });
  const session = api.sessionSyncClient(response);
  try {
    logger.debug(`[START] Reporting session ${response.id} to daemon`);
    const result = await notifyDaemonSessionStarted(response.id, metadata);
    if (result.error) {
      logger.debug(`[START] Failed to report to daemon (may not be running):`, result.error);
    } else {
      logger.debug(`[START] Reported session ${response.id} to daemon`);
    }
  } catch (error) {
    logger.debug("[START] Failed to report to daemon (may not be running):", error);
  }
  const messageQueue = new MessageQueue2((mode) => hashObject({
    permissionMode: mode.permissionMode,
    model: mode.model
  }));
  let currentPermissionMode = void 0;
  let currentModel = void 0;
  session.onUserMessage((message) => {
    let messagePermissionMode = currentPermissionMode;
    if (message.meta?.permissionMode) {
      const validModes = ["default", "read-only", "safe-yolo", "yolo"];
      if (validModes.includes(message.meta.permissionMode)) {
        messagePermissionMode = message.meta.permissionMode;
        currentPermissionMode = messagePermissionMode;
        logger.debug(`[Codex] Permission mode updated from user message to: ${currentPermissionMode}`);
      } else {
        logger.debug(`[Codex] Invalid permission mode received: ${message.meta.permissionMode}`);
      }
    } else {
      logger.debug(`[Codex] User message received with no permission mode override, using current: ${currentPermissionMode ?? "default (effective)"}`);
    }
    let messageModel = currentModel;
    if (message.meta?.hasOwnProperty("model")) {
      messageModel = message.meta.model || void 0;
      currentModel = messageModel;
      logger.debug(`[Codex] Model updated from user message: ${messageModel || "reset to default"}`);
    } else {
      logger.debug(`[Codex] User message received with no model override, using current: ${currentModel || "default"}`);
    }
    const enhancedMode = {
      permissionMode: messagePermissionMode || "default",
      model: messageModel
    };
    messageQueue.push(message.content.text, enhancedMode);
  });
  let thinking = false;
  session.keepAlive(thinking, "remote");
  const keepAliveInterval = setInterval(() => {
    session.keepAlive(thinking, "remote");
  }, 2e3);
  const sendReady = () => {
    session.sendSessionEvent({ type: "ready" });
    try {
      api.push().sendToAllDevices(
        "It's ready!",
        "Codex is waiting for your command",
        { sessionId: session.sessionId }
      );
    } catch (pushError) {
      logger.debug("[Codex] Failed to send ready push", pushError);
    }
  };
  function logActiveHandles(tag) {
    if (!process.env.DEBUG) return;
    const anyProc = process;
    const handles = typeof anyProc._getActiveHandles === "function" ? anyProc._getActiveHandles() : [];
    const requests = typeof anyProc._getActiveRequests === "function" ? anyProc._getActiveRequests() : [];
    logger.debug(`[codex][handles] ${tag}: handles=${handles.length} requests=${requests.length}`);
    try {
      const kinds = handles.map((h) => h && h.constructor ? h.constructor.name : typeof h);
      logger.debug(`[codex][handles] kinds=${JSON.stringify(kinds)}`);
    } catch {
    }
  }
  let abortController = new AbortController();
  let shouldExit = false;
  let storedSessionIdForResume = null;
  async function handleAbort() {
    logger.debug("[Codex] Abort requested - stopping current task");
    try {
      if (client.hasActiveSession()) {
        storedSessionIdForResume = client.storeSessionForResume();
        logger.debug("[Codex] Stored session for resume:", storedSessionIdForResume);
      }
      abortController.abort();
      messageQueue.reset();
      permissionHandler.reset();
      reasoningProcessor.abort();
      diffProcessor.reset();
      logger.debug("[Codex] Abort completed - session remains active");
    } catch (error) {
      logger.debug("[Codex] Error during abort:", error);
    } finally {
      abortController = new AbortController();
    }
  }
  const handleKillSession = async () => {
    logger.debug("[Codex] Kill session requested - terminating process");
    await handleAbort();
    logger.debug("[Codex] Abort completed, proceeding with termination");
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
      logger.debug("[Codex] Session termination complete, exiting");
      process.exit(0);
    } catch (error) {
      logger.debug("[Codex] Error during session termination:", error);
      process.exit(1);
    }
  };
  session.rpcHandlerManager.registerHandler("abort", handleAbort);
  registerKillSessionHandler(session.rpcHandlerManager, handleKillSession);
  const messageBuffer = new MessageBuffer();
  const hasTTY = process.stdout.isTTY && process.stdin.isTTY;
  let inkInstance = null;
  if (hasTTY) {
    console.clear();
    inkInstance = render(React.createElement(CodexDisplay, {
      messageBuffer,
      logPath: process.env.DEBUG ? logger.getLogPath() : void 0,
      onExit: async () => {
        logger.debug("[codex]: Exiting agent via Ctrl-C");
        shouldExit = true;
        await handleAbort();
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
  const client = new CodexMcpClient();
  function findCodexResumeFile(sessionId) {
    if (!sessionId) return null;
    try {
      let collectFilesRecursive2 = function(dir, acc = []) {
        let entries;
        try {
          entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
          return acc;
        }
        for (const entry of entries) {
          const full = join(dir, entry.name);
          if (entry.isDirectory()) {
            collectFilesRecursive2(full, acc);
          } else if (entry.isFile()) {
            acc.push(full);
          }
        }
        return acc;
      };
      var collectFilesRecursive = collectFilesRecursive2;
      const codexHomeDir = process.env.CODEX_HOME || join(os.homedir(), ".codex");
      const rootDir = join(codexHomeDir, "sessions");
      const candidates = collectFilesRecursive2(rootDir).filter((full) => full.endsWith(`-${sessionId}.jsonl`)).filter((full) => {
        try {
          return fs.statSync(full).isFile();
        } catch {
          return false;
        }
      }).sort((a, b) => {
        const sa = fs.statSync(a).mtimeMs;
        const sb = fs.statSync(b).mtimeMs;
        return sb - sa;
      });
      return candidates[0] || null;
    } catch {
      return null;
    }
  }
  const permissionHandler = new CodexPermissionHandler(session);
  const reasoningProcessor = new ReasoningProcessor((message) => {
    session.sendCodexMessage(message);
  });
  const diffProcessor = new DiffProcessor((message) => {
    session.sendCodexMessage(message);
  });
  client.setPermissionHandler(permissionHandler);
  client.setHandler((msg) => {
    logger.debug(`[Codex] MCP message: ${JSON.stringify(msg)}`);
    if (msg.type === "agent_message") {
      messageBuffer.addMessage(msg.message, "assistant");
    } else if (msg.type === "agent_reasoning_delta") ; else if (msg.type === "agent_reasoning") {
      messageBuffer.addMessage(`[Thinking] ${msg.text.substring(0, 100)}...`, "system");
    } else if (msg.type === "exec_command_begin") {
      messageBuffer.addMessage(`Executing: ${msg.command}`, "tool");
    } else if (msg.type === "exec_command_end") {
      const output = msg.output || msg.error || "Command completed";
      const truncatedOutput = output.substring(0, 200);
      messageBuffer.addMessage(
        `Result: ${truncatedOutput}${output.length > 200 ? "..." : ""}`,
        "result"
      );
    } else if (msg.type === "task_started") {
      messageBuffer.addMessage("Starting task...", "status");
    } else if (msg.type === "task_complete") {
      messageBuffer.addMessage("Task completed", "status");
      sendReady();
    } else if (msg.type === "turn_aborted") {
      messageBuffer.addMessage("Turn aborted", "status");
      sendReady();
    }
    if (msg.type === "task_started") {
      if (!thinking) {
        logger.debug("thinking started");
        thinking = true;
        session.keepAlive(thinking, "remote");
      }
    }
    if (msg.type === "task_complete" || msg.type === "turn_aborted") {
      if (thinking) {
        logger.debug("thinking completed");
        thinking = false;
        session.keepAlive(thinking, "remote");
      }
      diffProcessor.reset();
    }
    if (msg.type === "agent_reasoning_section_break") {
      reasoningProcessor.handleSectionBreak();
    }
    if (msg.type === "agent_reasoning_delta") {
      reasoningProcessor.processDelta(msg.delta);
    }
    if (msg.type === "agent_reasoning") {
      reasoningProcessor.complete(msg.text);
    }
    if (msg.type === "agent_message") {
      session.sendCodexMessage({
        type: "message",
        message: msg.message,
        id: randomUUID()
      });
    }
    if (msg.type === "exec_command_begin" || msg.type === "exec_approval_request") {
      let { call_id, type, ...inputs } = msg;
      session.sendCodexMessage({
        type: "tool-call",
        name: "CodexBash",
        callId: call_id,
        input: inputs,
        id: randomUUID()
      });
    }
    if (msg.type === "exec_command_end") {
      let { call_id, type, ...output } = msg;
      session.sendCodexMessage({
        type: "tool-call-result",
        callId: call_id,
        output,
        id: randomUUID()
      });
    }
    if (msg.type === "token_count") {
      session.sendCodexMessage({
        ...msg,
        id: randomUUID()
      });
    }
    if (msg.type === "patch_apply_begin") {
      let { call_id, auto_approved, changes } = msg;
      const changeCount = Object.keys(changes).length;
      const filesMsg = changeCount === 1 ? "1 file" : `${changeCount} files`;
      messageBuffer.addMessage(`Modifying ${filesMsg}...`, "tool");
      session.sendCodexMessage({
        type: "tool-call",
        name: "CodexPatch",
        callId: call_id,
        input: {
          auto_approved,
          changes
        },
        id: randomUUID()
      });
    }
    if (msg.type === "patch_apply_end") {
      let { call_id, stdout, stderr, success } = msg;
      if (success) {
        const message = stdout || "Files modified successfully";
        messageBuffer.addMessage(message.substring(0, 200), "result");
      } else {
        const errorMsg = stderr || "Failed to modify files";
        messageBuffer.addMessage(`Error: ${errorMsg.substring(0, 200)}`, "result");
      }
      session.sendCodexMessage({
        type: "tool-call-result",
        callId: call_id,
        output: {
          stdout,
          stderr,
          success
        },
        id: randomUUID()
      });
    }
    if (msg.type === "turn_diff") {
      if (msg.unified_diff) {
        diffProcessor.processDiff(msg.unified_diff);
      }
    }
  });
  const happyServer = await startHappyServer(session);
  const bridgeCommand = join(projectPath(), "bin", "happy-mcp.mjs");
  const mcpServers = {
    happy: {
      command: bridgeCommand,
      args: ["--url", happyServer.url]
    }
  };
  let first = true;
  try {
    logger.debug("[codex]: client.connect begin");
    await client.connect();
    logger.debug("[codex]: client.connect done");
    let wasCreated = false;
    let currentModeHash = null;
    let pending = null;
    let nextExperimentalResume = null;
    while (!shouldExit) {
      logActiveHandles("loop-top");
      let message = pending;
      pending = null;
      if (!message) {
        const waitSignal = abortController.signal;
        const batch = await messageQueue.waitForMessagesAndGetAsString(waitSignal);
        if (!batch) {
          if (waitSignal.aborted && !shouldExit) {
            logger.debug("[codex]: Wait aborted while idle; ignoring and continuing");
            continue;
          }
          logger.debug(`[codex]: batch=${!!batch}, shouldExit=${shouldExit}`);
          break;
        }
        message = batch;
      }
      if (!message) {
        break;
      }
      if (wasCreated && currentModeHash && message.hash !== currentModeHash) {
        logger.debug("[Codex] Mode changed \u2013 restarting Codex session");
        messageBuffer.addMessage("\u2550".repeat(40), "status");
        messageBuffer.addMessage("Starting new Codex session (mode changed)...", "status");
        try {
          const prevSessionId = client.getSessionId();
          nextExperimentalResume = findCodexResumeFile(prevSessionId);
          if (nextExperimentalResume) {
            logger.debug(`[Codex] Found resume file for session ${prevSessionId}: ${nextExperimentalResume}`);
            messageBuffer.addMessage("Resuming previous context\u2026", "status");
          } else {
            logger.debug("[Codex] No resume file found for previous session");
          }
        } catch (e) {
          logger.debug("[Codex] Error while searching resume file", e);
        }
        client.clearSession();
        wasCreated = false;
        currentModeHash = null;
        pending = message;
        permissionHandler.reset();
        reasoningProcessor.abort();
        diffProcessor.reset();
        thinking = false;
        session.keepAlive(thinking, "remote");
        continue;
      }
      messageBuffer.addMessage(message.message, "user");
      currentModeHash = message.hash;
      try {
        const approvalPolicy = (() => {
          switch (message.mode.permissionMode) {
            case "default":
              return "untrusted";
            case "read-only":
              return "never";
            case "safe-yolo":
              return "on-failure";
            case "yolo":
              return "on-failure";
          }
        })();
        const sandbox = (() => {
          switch (message.mode.permissionMode) {
            case "default":
              return "workspace-write";
            case "read-only":
              return "read-only";
            case "safe-yolo":
              return "workspace-write";
            case "yolo":
              return "danger-full-access";
          }
        })();
        if (!wasCreated) {
          const startConfig = {
            prompt: first ? message.message + "\n\n" + CHANGE_TITLE_INSTRUCTION : message.message,
            sandbox,
            "approval-policy": approvalPolicy,
            config: { mcp_servers: mcpServers }
          };
          if (message.mode.model) {
            startConfig.model = message.mode.model;
          }
          let resumeFile = null;
          if (nextExperimentalResume) {
            resumeFile = nextExperimentalResume;
            nextExperimentalResume = null;
            logger.debug("[Codex] Using resume file from mode change:", resumeFile);
          } else if (storedSessionIdForResume) {
            const abortResumeFile = findCodexResumeFile(storedSessionIdForResume);
            if (abortResumeFile) {
              resumeFile = abortResumeFile;
              logger.debug("[Codex] Using resume file from aborted session:", resumeFile);
              messageBuffer.addMessage("Resuming from aborted session...", "status");
            }
            storedSessionIdForResume = null;
          }
          if (resumeFile) {
            startConfig.config.experimental_resume = resumeFile;
          }
          await client.startSession(
            startConfig,
            { signal: abortController.signal }
          );
          wasCreated = true;
          first = false;
        } else {
          const response2 = await client.continueSession(
            message.message,
            { signal: abortController.signal }
          );
          logger.debug("[Codex] continueSession response:", response2);
        }
      } catch (error) {
        logger.warn("Error in codex session:", error);
        const isAbortError = error instanceof Error && error.name === "AbortError";
        if (isAbortError) {
          messageBuffer.addMessage("Aborted by user", "status");
          session.sendSessionEvent({ type: "message", message: "Aborted by user" });
          wasCreated = false;
          currentModeHash = null;
          logger.debug("[Codex] Marked session as not created after abort for proper resume");
        } else {
          messageBuffer.addMessage("Process exited unexpectedly", "status");
          session.sendSessionEvent({ type: "message", message: "Process exited unexpectedly" });
          if (client.hasActiveSession()) {
            storedSessionIdForResume = client.storeSessionForResume();
            logger.debug("[Codex] Stored session after unexpected error:", storedSessionIdForResume);
          }
        }
      } finally {
        permissionHandler.reset();
        reasoningProcessor.abort();
        diffProcessor.reset();
        thinking = false;
        session.keepAlive(thinking, "remote");
        emitReadyIfIdle({
          pending,
          queueSize: () => messageQueue.size(),
          shouldExit,
          sendReady
        });
        logActiveHandles("after-turn");
      }
    }
  } finally {
    logger.debug("[codex]: Final cleanup start");
    logActiveHandles("cleanup-start");
    try {
      logger.debug("[codex]: sendSessionDeath");
      session.sendSessionDeath();
      logger.debug("[codex]: flush begin");
      await session.flush();
      logger.debug("[codex]: flush done");
      logger.debug("[codex]: session.close begin");
      await session.close();
      logger.debug("[codex]: session.close done");
    } catch (e) {
      logger.debug("[codex]: Error while closing session", e);
    }
    logger.debug("[codex]: client.disconnect begin");
    await client.disconnect();
    logger.debug("[codex]: client.disconnect done");
    logger.debug("[codex]: happyServer.stop");
    happyServer.stop();
    if (process.stdin.isTTY) {
      logger.debug("[codex]: setRawMode(false)");
      try {
        process.stdin.setRawMode(false);
      } catch {
      }
    }
    if (hasTTY) {
      logger.debug("[codex]: stdin.pause()");
      try {
        process.stdin.pause();
      } catch {
      }
    }
    logger.debug("[codex]: clearInterval(keepAlive)");
    clearInterval(keepAliveInterval);
    if (inkInstance) {
      logger.debug("[codex]: inkInstance.unmount()");
      inkInstance.unmount();
    }
    messageBuffer.clear();
    logActiveHandles("cleanup-end");
    logger.debug("[codex]: Final cleanup completed");
  }
}

export { emitReadyIfIdle, runCodex };
