import { useStdout, useInput, Box, Text, render } from 'ink';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import { resolve, join as join$1 } from 'node:path';
import { l as logger, b as packageJson, A as ApiClient, r as readSettings, p as projectPath, c as configuration } from './types-2X3BxmSO.mjs';
import { i as initialMachineMetadata, n as notifyDaemonSessionStarted, M as MessageQueue2, h as hashObject, a as MessageBuffer, r as registerKillSessionHandler, s as startHappyServer, b as stopCaffeinate } from './index-Rxv9jgYl.mjs';
import { spawn } from 'node:child_process';
import { ndJsonStream, ClientSideConnection } from '@agentclientprotocol/sdk';
import { D as DEFAULT_GEMINI_MODEL, G as GEMINI_MODEL_ENV, a as GEMINI_API_KEY_ENV, b as GOOGLE_API_KEY_ENV, C as CHANGE_TITLE_INSTRUCTION } from './constants-CmM6FmsE.mjs';
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { execSync } from 'child_process';
import 'chalk';
import 'node:fs';
import 'node:fs/promises';
import 'zod';
import 'tweetnacl';
import 'node:events';
import 'socket.io-client';
import 'util';
import 'fs/promises';
import 'crypto';
import 'url';
import 'axios';
import 'expo-server-sdk';
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

const KNOWN_TOOL_PATTERNS = {
  change_title: ["change_title", "change-title", "happy__change_title"],
  save_memory: ["save_memory", "save-memory"],
  think: ["think"]
};
function isInvestigationTool(toolCallId, toolKind) {
  return toolCallId.includes("codebase_investigator") || toolCallId.includes("investigator") || typeof toolKind === "string" && toolKind.includes("investigator");
}
function extractToolNameFromId(toolCallId) {
  const lowerId = toolCallId.toLowerCase();
  for (const [toolName, patterns] of Object.entries(KNOWN_TOOL_PATTERNS)) {
    for (const pattern of patterns) {
      if (lowerId.includes(pattern.toLowerCase())) {
        return toolName;
      }
    }
  }
  return null;
}
function determineToolName(toolName, toolCallId, input, params, context) {
  if (toolName !== "other" && toolName !== "Unknown tool") {
    return toolName;
  }
  const idToolName = extractToolNameFromId(toolCallId);
  if (idToolName) {
    return idToolName;
  }
  if (input && typeof input === "object") {
    const inputStr = JSON.stringify(input).toLowerCase();
    for (const [toolName2, patterns] of Object.entries(KNOWN_TOOL_PATTERNS)) {
      for (const pattern of patterns) {
        if (inputStr.includes(pattern.toLowerCase())) {
          return toolName2;
        }
      }
    }
  }
  const paramsStr = JSON.stringify(params).toLowerCase();
  for (const [toolName2, patterns] of Object.entries(KNOWN_TOOL_PATTERNS)) {
    for (const pattern of patterns) {
      if (paramsStr.includes(pattern.toLowerCase())) {
        return toolName2;
      }
    }
  }
  if (context?.recentPromptHadChangeTitle && context.toolCallCountSincePrompt === 0) {
    const isEmptyInput = !input || Array.isArray(input) && input.length === 0 || typeof input === "object" && Object.keys(input).length === 0;
    if (isEmptyInput && toolName === "other") {
      return "change_title";
    }
  }
  return toolName;
}
function getRealToolName(toolCallId, toolKind) {
  const extracted = extractToolNameFromId(toolCallId);
  if (extracted) {
    return extracted;
  }
  return typeof toolKind === "string" ? toolKind : "unknown";
}
function getToolCallTimeout(toolCallId, toolKind) {
  const isInvestigation = isInvestigationTool(toolCallId, toolKind);
  const isThinkTool = toolKind === "think";
  if (isInvestigation) {
    return 6e5;
  } else if (isThinkTool) {
    return 3e4;
  } else {
    return 12e4;
  }
}

function hasChangeTitleInstruction(prompt) {
  return prompt.toLowerCase().includes("change_title") || prompt.toLowerCase().includes("happy__change_title");
}

const ACP_INIT_TIMEOUT_MS = 12e4;
function nodeToWebStreams(stdin, stdout) {
  const writable = new WritableStream({
    write(chunk) {
      return new Promise((resolve, reject) => {
        const ok = stdin.write(chunk, (err) => {
          if (err) {
            logger.debug(`[AcpSdkBackend] Error writing to stdin:`, err);
            reject(err);
          }
        });
        if (ok) {
          resolve();
        } else {
          stdin.once("drain", resolve);
        }
      });
    },
    close() {
      return new Promise((resolve) => {
        stdin.end(resolve);
      });
    },
    abort(reason) {
      stdin.destroy(reason instanceof Error ? reason : new Error(String(reason)));
    }
  });
  const readable = new ReadableStream({
    start(controller) {
      stdout.on("data", (chunk) => {
        controller.enqueue(new Uint8Array(chunk));
      });
      stdout.on("end", () => {
        controller.close();
      });
      stdout.on("error", (err) => {
        logger.debug(`[AcpSdkBackend] Stdout error:`, err);
        controller.error(err);
      });
    },
    cancel() {
      stdout.destroy();
    }
  });
  return { writable, readable };
}
class AcpSdkBackend {
  constructor(options) {
    this.options = options;
  }
  listeners = [];
  process = null;
  connection = null;
  acpSessionId = null;
  disposed = false;
  /** Track active tool calls to prevent duplicate events */
  activeToolCalls = /* @__PURE__ */ new Set();
  toolCallTimeouts = /* @__PURE__ */ new Map();
  /** Track tool call start times for performance monitoring */
  toolCallStartTimes = /* @__PURE__ */ new Map();
  /** Pending permission requests that need response */
  pendingPermissions = /* @__PURE__ */ new Map();
  /** Map from permission request ID to real tool call ID for tracking */
  permissionToToolCallMap = /* @__PURE__ */ new Map();
  /** Map from real tool call ID to tool name for auto-approval */
  toolCallIdToNameMap = /* @__PURE__ */ new Map();
  /** Track if we just sent a prompt with change_title instruction */
  recentPromptHadChangeTitle = false;
  /** Track tool calls count since last prompt (to identify first tool call) */
  toolCallCountSincePrompt = 0;
  /** Timeout for emitting 'idle' status after last message chunk */
  idleTimeout = null;
  onMessage(handler) {
    this.listeners.push(handler);
  }
  offMessage(handler) {
    const index = this.listeners.indexOf(handler);
    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
  }
  emit(msg) {
    if (this.disposed) return;
    for (const listener of this.listeners) {
      try {
        listener(msg);
      } catch (error) {
        logger.warn("[AcpSdkBackend] Error in message handler:", error);
      }
    }
  }
  async startSession(initialPrompt) {
    if (this.disposed) {
      throw new Error("Backend has been disposed");
    }
    const sessionId = randomUUID();
    this.emit({ type: "status", status: "starting" });
    try {
      logger.debug(`[AcpSdkBackend] Starting session: ${sessionId}`);
      const args = this.options.args || [];
      if (process.platform === "win32") {
        const fullCommand = [this.options.command, ...args].join(" ");
        this.process = spawn("cmd.exe", ["/c", fullCommand], {
          cwd: this.options.cwd,
          env: { ...process.env, ...this.options.env },
          stdio: ["pipe", "pipe", "pipe"],
          windowsHide: true
        });
      } else {
        this.process = spawn(this.options.command, args, {
          cwd: this.options.cwd,
          env: { ...process.env, ...this.options.env },
          // Use 'pipe' for all stdio to capture output without printing to console
          // stdout and stderr will be handled by our event listeners
          stdio: ["pipe", "pipe", "pipe"]
        });
      }
      if (this.process.stderr) {
      }
      if (!this.process.stdin || !this.process.stdout || !this.process.stderr) {
        throw new Error("Failed to create stdio pipes");
      }
      this.process.stderr.on("data", (data) => {
        const text = data.toString();
        if (text.trim()) {
          const hasActiveInvestigation = Array.from(this.activeToolCalls).some(
            (id) => isInvestigationTool(id)
          );
          if (hasActiveInvestigation) {
            logger.debug(`[AcpSdkBackend] \u{1F50D} Agent stderr (during investigation): ${text.trim()}`);
          } else {
            logger.debug(`[AcpSdkBackend] Agent stderr: ${text.trim()}`);
          }
          if (text.includes("status 429") || text.includes('code":429') || text.includes("rateLimitExceeded") || text.includes("RESOURCE_EXHAUSTED")) {
            logger.debug("[AcpSdkBackend] \u26A0\uFE0F Detected rate limit error (429) in stderr - gemini-cli will handle retry");
          } else if (text.includes("status 404") || text.includes('code":404')) {
            logger.debug("[AcpSdkBackend] \u26A0\uFE0F Detected 404 error in stderr");
            this.emit({
              type: "status",
              status: "error",
              detail: "Model not found. Available models: gemini-2.5-pro, gemini-2.5-flash, gemini-2.5-flash-lite"
            });
          } else if (hasActiveInvestigation && (text.includes("timeout") || text.includes("Timeout") || text.includes("failed") || text.includes("Failed") || text.includes("error") || text.includes("Error"))) {
            logger.debug(`[AcpSdkBackend] \u{1F50D} Investigation tool stderr error/timeout: ${text.trim()}`);
          }
        }
      });
      this.process.on("error", (err) => {
        logger.debug(`[AcpSdkBackend] Process error:`, err);
        this.emit({ type: "status", status: "error", detail: err.message });
      });
      this.process.on("exit", (code, signal) => {
        if (!this.disposed && code !== 0 && code !== null) {
          logger.debug(`[AcpSdkBackend] Process exited with code ${code}, signal ${signal}`);
          this.emit({ type: "status", status: "stopped", detail: `Exit code: ${code}` });
        }
      });
      const streams = nodeToWebStreams(
        this.process.stdin,
        this.process.stdout
      );
      const writable = streams.writable;
      const readable = streams.readable;
      const filteredReadable = new ReadableStream({
        async start(controller) {
          const reader = readable.getReader();
          const decoder = new TextDecoder();
          const encoder = new TextEncoder();
          let buffer = "";
          let filteredCount = 0;
          const isValidJSON = (str) => {
            const trimmed = str.trim();
            if (!trimmed || !trimmed.startsWith("{") && !trimmed.startsWith("[")) {
              return false;
            }
            try {
              JSON.parse(trimmed);
              return true;
            } catch {
              return false;
            }
          };
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                if (buffer.trim()) {
                  if (isValidJSON(buffer)) {
                    controller.enqueue(encoder.encode(buffer));
                  } else {
                    filteredCount++;
                  }
                }
                if (filteredCount > 0) {
                  logger.debug(`[AcpSdkBackend] Filtered out ${filteredCount} non-JSON lines from gemini CLI stdout`);
                }
                controller.close();
                break;
              }
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() || "";
              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) {
                  continue;
                }
                if (isValidJSON(trimmed)) {
                  controller.enqueue(encoder.encode(line + "\n"));
                } else {
                  filteredCount++;
                }
              }
            }
          } catch (error) {
            logger.debug(`[AcpSdkBackend] Error filtering stdout stream:`, error);
            controller.error(error);
          } finally {
            reader.releaseLock();
          }
        }
      });
      const stream = ndJsonStream(writable, filteredReadable);
      const client = {
        sessionUpdate: async (params) => {
          this.handleSessionUpdate(params);
        },
        requestPermission: async (params) => {
          const permissionId = randomUUID();
          const extendedParams = params;
          const toolCall = extendedParams.toolCall;
          let toolName = toolCall?.kind || toolCall?.toolName || extendedParams.kind || "Unknown tool";
          const toolCallId = toolCall?.id || permissionId;
          let input = {};
          if (toolCall) {
            input = toolCall.input || toolCall.arguments || toolCall.content || {};
          } else {
            input = extendedParams.input || extendedParams.arguments || extendedParams.content || {};
          }
          toolName = determineToolName(
            toolName,
            toolCallId,
            input,
            params,
            {
              recentPromptHadChangeTitle: this.recentPromptHadChangeTitle,
              toolCallCountSincePrompt: this.toolCallCountSincePrompt
            }
          );
          if (toolName !== (toolCall?.kind || toolCall?.toolName || extendedParams.kind || "Unknown tool")) {
            logger.debug(`[AcpSdkBackend] Detected tool name: ${toolName} from toolCallId: ${toolCallId}`);
          }
          this.toolCallCountSincePrompt++;
          const options = extendedParams.options || [];
          logger.debug(`[AcpSdkBackend] Permission request: tool=${toolName}, toolCallId=${toolCallId}, input=`, JSON.stringify(input));
          logger.debug(`[AcpSdkBackend] Permission request params structure:`, JSON.stringify({
            hasToolCall: !!toolCall,
            toolCallKind: toolCall?.kind,
            toolCallId: toolCall?.id,
            paramsKind: extendedParams.kind,
            paramsKeys: Object.keys(params)
          }, null, 2));
          this.emit({
            type: "permission-request",
            id: permissionId,
            reason: toolName,
            payload: {
              ...params,
              permissionId,
              toolCallId,
              toolName,
              input,
              options: options.map((opt) => ({
                id: opt.optionId,
                name: opt.name,
                kind: opt.kind
              }))
            }
          });
          if (this.options.permissionHandler) {
            try {
              const result = await this.options.permissionHandler.handleToolCall(
                toolCallId,
                toolName,
                input
              );
              let optionId = "cancel";
              if (result.decision === "approved" || result.decision === "approved_for_session") {
                const proceedOnceOption2 = options.find(
                  (opt) => opt.optionId === "proceed_once" || opt.name?.toLowerCase().includes("once")
                );
                const proceedAlwaysOption = options.find(
                  (opt) => opt.optionId === "proceed_always" || opt.name?.toLowerCase().includes("always")
                );
                if (result.decision === "approved_for_session" && proceedAlwaysOption) {
                  optionId = proceedAlwaysOption.optionId || "proceed_always";
                } else if (proceedOnceOption2) {
                  optionId = proceedOnceOption2.optionId || "proceed_once";
                } else if (options.length > 0) {
                  optionId = options[0].optionId || "proceed_once";
                }
              } else {
                const cancelOption = options.find(
                  (opt) => opt.optionId === "cancel" || opt.name?.toLowerCase().includes("cancel")
                );
                if (cancelOption) {
                  optionId = cancelOption.optionId || "cancel";
                }
              }
              return { outcome: { outcome: "selected", optionId } };
            } catch (error) {
              logger.debug("[AcpSdkBackend] Error in permission handler:", error);
              return { outcome: { outcome: "selected", optionId: "cancel" } };
            }
          }
          const proceedOnceOption = options.find(
            (opt) => opt.optionId === "proceed_once" || typeof opt.name === "string" && opt.name.toLowerCase().includes("once")
          );
          const defaultOptionId = proceedOnceOption?.optionId || (options.length > 0 && options[0].optionId ? options[0].optionId : "proceed_once");
          return { outcome: { outcome: "selected", optionId: defaultOptionId } };
        }
      };
      this.connection = new ClientSideConnection(
        (agent) => client,
        stream
      );
      const initRequest = {
        protocolVersion: 1,
        clientCapabilities: {
          fs: {
            readTextFile: false,
            writeTextFile: false
          }
        },
        clientInfo: {
          name: "happy-cli",
          version: packageJson.version
        }
      };
      logger.debug(`[AcpSdkBackend] Initializing connection...`);
      let initTimeout = null;
      const initResponse = await Promise.race([
        this.connection.initialize(initRequest).then((result) => {
          if (initTimeout) {
            clearTimeout(initTimeout);
            initTimeout = null;
          }
          return result;
        }),
        new Promise((_, reject) => {
          initTimeout = setTimeout(() => {
            logger.debug(`[AcpSdkBackend] Initialize timeout after ${ACP_INIT_TIMEOUT_MS}ms`);
            reject(new Error(`Initialize timeout after ${ACP_INIT_TIMEOUT_MS}ms - Gemini CLI did not respond`));
          }, ACP_INIT_TIMEOUT_MS);
        })
      ]);
      logger.debug(`[AcpSdkBackend] Initialize completed`);
      const mcpServers = this.options.mcpServers ? Object.entries(this.options.mcpServers).map(([name, config]) => ({
        name,
        command: config.command,
        args: config.args || [],
        env: config.env ? Object.entries(config.env).map(([envName, envValue]) => ({ name: envName, value: envValue })) : []
      })) : [];
      const newSessionRequest = {
        cwd: this.options.cwd,
        mcpServers
      };
      logger.debug(`[AcpSdkBackend] Creating new session...`);
      let newSessionTimeout = null;
      const sessionResponse = await Promise.race([
        this.connection.newSession(newSessionRequest).then((result) => {
          if (newSessionTimeout) {
            clearTimeout(newSessionTimeout);
            newSessionTimeout = null;
          }
          return result;
        }),
        new Promise((_, reject) => {
          newSessionTimeout = setTimeout(() => {
            logger.debug(`[AcpSdkBackend] NewSession timeout after ${ACP_INIT_TIMEOUT_MS}ms`);
            reject(new Error("New session timeout"));
          }, ACP_INIT_TIMEOUT_MS);
        })
      ]);
      this.acpSessionId = sessionResponse.sessionId;
      logger.debug(`[AcpSdkBackend] Session created: ${this.acpSessionId}`);
      this.emit({ type: "status", status: "idle" });
      if (initialPrompt) {
        this.sendPrompt(sessionId, initialPrompt).catch((error) => {
          logger.debug("[AcpSdkBackend] Error sending initial prompt:", error);
          this.emit({ type: "status", status: "error", detail: String(error) });
        });
      }
      return { sessionId };
    } catch (error) {
      logger.debug("[AcpSdkBackend] Error starting session:", error);
      this.emit({
        type: "status",
        status: "error",
        detail: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
  handleSessionUpdate(params) {
    const notification = params;
    const update = notification.update;
    if (!update) {
      logger.debug("[AcpSdkBackend] Received session update without update field:", params);
      return;
    }
    const sessionUpdateType = update.sessionUpdate;
    if (sessionUpdateType !== "agent_message_chunk") {
      logger.debug(`[AcpSdkBackend] Received session update: ${sessionUpdateType}`, JSON.stringify({
        sessionUpdate: sessionUpdateType,
        toolCallId: update.toolCallId,
        status: update.status,
        kind: update.kind,
        hasContent: !!update.content,
        hasLocations: !!update.locations
      }, null, 2));
    }
    if (sessionUpdateType === "agent_message_chunk") {
      const content = update.content;
      if (content && typeof content === "object" && "text" in content && typeof content.text === "string") {
        const text = content.text;
        const isThinking = /^\*\*[^*]+\*\*\n/.test(text);
        if (isThinking) {
          this.emit({
            type: "event",
            name: "thinking",
            payload: { text }
          });
        } else {
          logger.debug(`[AcpSdkBackend] Received message chunk (length: ${text.length}): ${text.substring(0, 50)}...`);
          this.emit({
            type: "model-output",
            textDelta: text
          });
          if (this.idleTimeout) {
            clearTimeout(this.idleTimeout);
            this.idleTimeout = null;
          }
          this.idleTimeout = setTimeout(() => {
            if (this.activeToolCalls.size === 0) {
              logger.debug("[AcpSdkBackend] No more chunks received, emitting idle status");
              this.emit({ type: "status", status: "idle" });
            } else {
              logger.debug(`[AcpSdkBackend] Delaying idle status - ${this.activeToolCalls.size} active tool calls`);
            }
            this.idleTimeout = null;
          }, 500);
        }
      }
    }
    if (sessionUpdateType === "tool_call_update") {
      const status = update.status;
      const toolCallId = update.toolCallId;
      if (!toolCallId) {
        logger.debug("[AcpSdkBackend] Tool call update without toolCallId:", update);
        return;
      }
      if (status === "in_progress" || status === "pending") {
        if (!this.activeToolCalls.has(toolCallId)) {
          const startTime = Date.now();
          const toolKind = update.kind || "unknown";
          const isInvestigation = isInvestigationTool(toolCallId, toolKind);
          const realToolName = getRealToolName(toolCallId, toolKind);
          this.toolCallIdToNameMap.set(toolCallId, realToolName);
          this.activeToolCalls.add(toolCallId);
          this.toolCallStartTimes.set(toolCallId, startTime);
          logger.debug(`[AcpSdkBackend] \u23F1\uFE0F Set startTime for ${toolCallId} at ${new Date(startTime).toISOString()} (from tool_call_update)`);
          this.toolCallCountSincePrompt++;
          logger.debug(`[AcpSdkBackend] \u{1F527} Tool call START: ${toolCallId} (${toolKind} -> ${realToolName})${isInvestigation ? " [INVESTIGATION TOOL]" : ""}`);
          if (isInvestigation) {
            logger.debug(`[AcpSdkBackend] \u{1F50D} Investigation tool detected (by toolCallId) - extended timeout (10min) will be used`);
          }
          const timeoutMs = getToolCallTimeout(toolCallId, toolKind);
          if (!this.toolCallTimeouts.has(toolCallId)) {
            const timeout = setTimeout(() => {
              const startTime2 = this.toolCallStartTimes.get(toolCallId);
              const duration = startTime2 ? Date.now() - startTime2 : null;
              const durationStr = duration ? `${(duration / 1e3).toFixed(2)}s` : "unknown";
              logger.debug(`[AcpSdkBackend] \u23F1\uFE0F Tool call TIMEOUT (from tool_call_update): ${toolCallId} (${toolKind}) after ${(timeoutMs / 1e3).toFixed(0)}s - Duration: ${durationStr}, removing from active set`);
              this.activeToolCalls.delete(toolCallId);
              this.toolCallStartTimes.delete(toolCallId);
              this.toolCallTimeouts.delete(toolCallId);
              if (this.activeToolCalls.size === 0) {
                logger.debug("[AcpSdkBackend] No more active tool calls after timeout, emitting idle status");
                this.emit({ type: "status", status: "idle" });
              }
            }, timeoutMs);
            this.toolCallTimeouts.set(toolCallId, timeout);
            logger.debug(`[AcpSdkBackend] \u23F1\uFE0F Set timeout for ${toolCallId}: ${(timeoutMs / 1e3).toFixed(0)}s${isInvestigation ? " (investigation tool)" : ""}`);
          } else {
            logger.debug(`[AcpSdkBackend] Timeout already set for ${toolCallId}, skipping`);
          }
          if (this.idleTimeout) {
            clearTimeout(this.idleTimeout);
            this.idleTimeout = null;
          }
          this.emit({ type: "status", status: "running" });
          let args = {};
          if (Array.isArray(update.content)) {
            args = { items: update.content };
          } else if (update.content && typeof update.content === "object" && update.content !== null) {
            args = update.content;
          }
          if (isInvestigation && args.objective) {
            logger.debug(`[AcpSdkBackend] \u{1F50D} Investigation tool objective: ${String(args.objective).substring(0, 100)}...`);
          }
          this.emit({
            type: "tool-call",
            toolName: typeof toolKind === "string" ? toolKind : "unknown",
            args,
            callId: toolCallId
          });
        } else {
          logger.debug(`[AcpSdkBackend] Tool call ${toolCallId} already tracked, status: ${status}`);
        }
      } else if (status === "completed") {
        const startTime = this.toolCallStartTimes.get(toolCallId);
        const duration = startTime ? Date.now() - startTime : null;
        const toolKind = update.kind || "unknown";
        this.activeToolCalls.delete(toolCallId);
        this.toolCallStartTimes.delete(toolCallId);
        const timeout = this.toolCallTimeouts.get(toolCallId);
        if (timeout) {
          clearTimeout(timeout);
          this.toolCallTimeouts.delete(toolCallId);
        }
        const durationStr = duration ? `${(duration / 1e3).toFixed(2)}s` : "unknown";
        logger.debug(`[AcpSdkBackend] \u2705 Tool call COMPLETED: ${toolCallId} (${toolKind}) - Duration: ${durationStr}. Active tool calls: ${this.activeToolCalls.size}`);
        this.emit({
          type: "tool-result",
          toolName: typeof toolKind === "string" ? toolKind : "unknown",
          result: update.content,
          callId: toolCallId
        });
        if (this.activeToolCalls.size === 0) {
          if (this.idleTimeout) {
            clearTimeout(this.idleTimeout);
            this.idleTimeout = null;
          }
          logger.debug("[AcpSdkBackend] All tool calls completed, emitting idle status");
          this.emit({ type: "status", status: "idle" });
        }
      } else if (status === "failed" || status === "cancelled") {
        const startTime = this.toolCallStartTimes.get(toolCallId);
        const duration = startTime ? Date.now() - startTime : null;
        const toolKind = update.kind || "unknown";
        const isInvestigation = isInvestigationTool(toolCallId, toolKind);
        const hadTimeout = this.toolCallTimeouts.has(toolCallId);
        if (isInvestigation) {
          const durationStr2 = duration ? `${(duration / 1e3).toFixed(2)}s` : "unknown";
          const durationMinutes = duration ? (duration / 1e3 / 60).toFixed(2) : "unknown";
          logger.debug(`[AcpSdkBackend] \u{1F50D} Investigation tool ${status.toUpperCase()} after ${durationMinutes} minutes (${durationStr2})`);
          if (duration) {
            const threeMinutes = 3 * 60 * 1e3;
            const tolerance = 5e3;
            if (Math.abs(duration - threeMinutes) < tolerance) {
              logger.debug(`[AcpSdkBackend] \u{1F50D} \u26A0\uFE0F Investigation tool failed at ~3 minutes - likely Gemini CLI timeout, not our timeout`);
            }
          }
          logger.debug(`[AcpSdkBackend] \u{1F50D} Investigation tool FAILED - full update.content:`, JSON.stringify(update.content, null, 2));
          logger.debug(`[AcpSdkBackend] \u{1F50D} Investigation tool timeout status BEFORE cleanup: ${hadTimeout ? "timeout was set" : "no timeout was set"}`);
          logger.debug(`[AcpSdkBackend] \u{1F50D} Investigation tool startTime status BEFORE cleanup: ${startTime ? `set at ${new Date(startTime).toISOString()}` : "not set"}`);
        }
        this.activeToolCalls.delete(toolCallId);
        this.toolCallStartTimes.delete(toolCallId);
        const timeout = this.toolCallTimeouts.get(toolCallId);
        if (timeout) {
          clearTimeout(timeout);
          this.toolCallTimeouts.delete(toolCallId);
          logger.debug(`[AcpSdkBackend] Cleared timeout for ${toolCallId} (tool call ${status})`);
        } else {
          logger.debug(`[AcpSdkBackend] No timeout found for ${toolCallId} (tool call ${status}) - timeout may not have been set`);
        }
        const durationStr = duration ? `${(duration / 1e3).toFixed(2)}s` : "unknown";
        logger.debug(`[AcpSdkBackend] \u274C Tool call ${status.toUpperCase()}: ${toolCallId} (${toolKind}) - Duration: ${durationStr}. Active tool calls: ${this.activeToolCalls.size}`);
        let errorDetail;
        if (update.content) {
          if (typeof update.content === "string") {
            errorDetail = update.content;
          } else if (typeof update.content === "object" && update.content !== null && !Array.isArray(update.content)) {
            const content = update.content;
            if (content.error) {
              const error = content.error;
              errorDetail = typeof error === "string" ? error : error && typeof error === "object" && "message" in error && typeof error.message === "string" ? error.message : JSON.stringify(error);
            } else if (typeof content.message === "string") {
              errorDetail = content.message;
            } else {
              const status2 = typeof content.status === "string" ? content.status : void 0;
              const reason = typeof content.reason === "string" ? content.reason : void 0;
              errorDetail = status2 || reason || JSON.stringify(content).substring(0, 500);
            }
          }
        }
        if (errorDetail) {
          logger.debug(`[AcpSdkBackend] \u274C Tool call error details: ${errorDetail.substring(0, 500)}`);
        } else {
          logger.debug(`[AcpSdkBackend] \u274C Tool call ${status} but no error details in update.content`);
        }
        this.emit({
          type: "tool-result",
          toolName: typeof toolKind === "string" ? toolKind : "unknown",
          result: errorDetail ? { error: errorDetail, status } : { error: `Tool call ${status}`, status },
          callId: toolCallId
        });
        if (this.activeToolCalls.size === 0) {
          if (this.idleTimeout) {
            clearTimeout(this.idleTimeout);
            this.idleTimeout = null;
          }
          logger.debug("[AcpSdkBackend] All tool calls completed/failed, emitting idle status");
          this.emit({ type: "status", status: "idle" });
        }
      }
    }
    if (update.messageChunk) {
      const chunk = update.messageChunk;
      if (chunk.textDelta) {
        this.emit({
          type: "model-output",
          textDelta: chunk.textDelta
        });
      }
    }
    if (update.plan) {
      this.emit({
        type: "event",
        name: "plan",
        payload: update.plan
      });
    }
    if (sessionUpdateType === "agent_thought_chunk") {
      const content = update.content;
      if (content && typeof content === "object" && "text" in content && typeof content.text === "string") {
        const text = content.text;
        const hasActiveInvestigation = Array.from(this.activeToolCalls).some(() => {
          return true;
        });
        if (hasActiveInvestigation && this.activeToolCalls.size > 0) {
          const activeToolCallsList = Array.from(this.activeToolCalls);
          logger.debug(`[AcpSdkBackend] \u{1F4AD} Thinking chunk received (${text.length} chars) during active tool calls: ${activeToolCallsList.join(", ")}`);
        }
        this.emit({
          type: "event",
          name: "thinking",
          payload: { text }
        });
      }
    }
    if (sessionUpdateType === "tool_call") {
      const toolCallId = update.toolCallId;
      const status = update.status;
      logger.debug(`[AcpSdkBackend] Received tool_call: toolCallId=${toolCallId}, status=${status}, kind=${update.kind}`);
      const isInProgress = !status || status === "in_progress" || status === "pending";
      if (toolCallId && isInProgress) {
        if (!this.activeToolCalls.has(toolCallId)) {
          const startTime = Date.now();
          this.activeToolCalls.add(toolCallId);
          this.toolCallStartTimes.set(toolCallId, startTime);
          logger.debug(`[AcpSdkBackend] Added tool call ${toolCallId} to active set. Total active: ${this.activeToolCalls.size}`);
          logger.debug(`[AcpSdkBackend] \u23F1\uFE0F Set startTime for ${toolCallId} at ${new Date(startTime).toISOString()}`);
          if (this.idleTimeout) {
            clearTimeout(this.idleTimeout);
            this.idleTimeout = null;
          }
          const isInvestigation = isInvestigationTool(toolCallId, update.kind);
          if (isInvestigation) {
            logger.debug(`[AcpSdkBackend] \u{1F50D} Investigation tool detected (toolCallId: ${toolCallId}, kind: ${update.kind}) - using extended timeout (10min)`);
          }
          const timeoutMs = getToolCallTimeout(toolCallId, update.kind);
          if (!this.toolCallTimeouts.has(toolCallId)) {
            const timeout = setTimeout(() => {
              const startTime2 = this.toolCallStartTimes.get(toolCallId);
              const duration = startTime2 ? Date.now() - startTime2 : null;
              const durationStr = duration ? `${(duration / 1e3).toFixed(2)}s` : "unknown";
              logger.debug(`[AcpSdkBackend] \u23F1\uFE0F Tool call TIMEOUT (from tool_call): ${toolCallId} (${update.kind}) after ${(timeoutMs / 1e3).toFixed(0)}s - Duration: ${durationStr}, removing from active set`);
              this.activeToolCalls.delete(toolCallId);
              this.toolCallStartTimes.delete(toolCallId);
              this.toolCallTimeouts.delete(toolCallId);
              if (this.activeToolCalls.size === 0) {
                logger.debug("[AcpSdkBackend] No more active tool calls after timeout, emitting idle status");
                this.emit({ type: "status", status: "idle" });
              }
            }, timeoutMs);
            this.toolCallTimeouts.set(toolCallId, timeout);
            logger.debug(`[AcpSdkBackend] \u23F1\uFE0F Set timeout for ${toolCallId}: ${(timeoutMs / 1e3).toFixed(0)}s${isInvestigation ? " (investigation tool)" : ""}`);
          } else {
            logger.debug(`[AcpSdkBackend] Timeout already set for ${toolCallId}, skipping`);
          }
          this.emit({ type: "status", status: "running" });
          let args = {};
          if (Array.isArray(update.content)) {
            args = { items: update.content };
          } else if (update.content && typeof update.content === "object") {
            args = update.content;
          }
          if (update.locations && Array.isArray(update.locations)) {
            args.locations = update.locations;
          }
          logger.debug(`[AcpSdkBackend] Emitting tool-call event: toolName=${update.kind}, toolCallId=${toolCallId}, args=`, JSON.stringify(args));
          this.emit({
            type: "tool-call",
            toolName: update.kind || "unknown",
            args,
            callId: toolCallId
          });
        } else {
          logger.debug(`[AcpSdkBackend] Tool call ${toolCallId} already in active set, skipping`);
        }
      } else {
        logger.debug(`[AcpSdkBackend] Tool call ${toolCallId} not in progress (status: ${status}), skipping`);
      }
    }
    if (update.thinking) {
      this.emit({
        type: "event",
        name: "thinking",
        payload: update.thinking
      });
    }
    if (sessionUpdateType && sessionUpdateType !== "agent_message_chunk" && sessionUpdateType !== "tool_call_update" && sessionUpdateType !== "agent_thought_chunk" && sessionUpdateType !== "tool_call" && !update.messageChunk && !update.plan && !update.thinking) {
      logger.debug(`[AcpSdkBackend] Unhandled session update type: ${sessionUpdateType}`, JSON.stringify(update, null, 2));
    }
  }
  async sendPrompt(sessionId, prompt) {
    const promptHasChangeTitle = hasChangeTitleInstruction(prompt);
    this.toolCallCountSincePrompt = 0;
    this.recentPromptHadChangeTitle = promptHasChangeTitle;
    if (promptHasChangeTitle) {
      logger.debug('[AcpSdkBackend] Prompt contains change_title instruction - will auto-approve first "other" tool call if it matches pattern');
    }
    if (this.disposed) {
      throw new Error("Backend has been disposed");
    }
    if (!this.connection || !this.acpSessionId) {
      throw new Error("Session not started");
    }
    this.emit({ type: "status", status: "running" });
    try {
      logger.debug(`[AcpSdkBackend] Sending prompt (length: ${prompt.length}): ${prompt.substring(0, 100)}...`);
      logger.debug(`[AcpSdkBackend] Full prompt: ${prompt}`);
      const contentBlock = {
        type: "text",
        text: prompt
      };
      const promptRequest = {
        sessionId: this.acpSessionId,
        prompt: [contentBlock]
      };
      logger.debug(`[AcpSdkBackend] Prompt request:`, JSON.stringify(promptRequest, null, 2));
      await this.connection.prompt(promptRequest);
      logger.debug("[AcpSdkBackend] Prompt request sent to ACP connection");
    } catch (error) {
      logger.debug("[AcpSdkBackend] Error sending prompt:", error);
      let errorDetail;
      if (error instanceof Error) {
        errorDetail = error.message;
      } else if (typeof error === "object" && error !== null) {
        const errObj = error;
        const fallbackMessage = (typeof errObj.message === "string" ? errObj.message : void 0) || String(error);
        if (errObj.code !== void 0) {
          errorDetail = JSON.stringify({ code: errObj.code, message: fallbackMessage });
        } else if (typeof errObj.message === "string") {
          errorDetail = errObj.message;
        } else {
          errorDetail = String(error);
        }
      } else {
        errorDetail = String(error);
      }
      this.emit({
        type: "status",
        status: "error",
        detail: errorDetail
      });
      throw error;
    }
  }
  async cancel(sessionId) {
    if (!this.connection || !this.acpSessionId) {
      return;
    }
    try {
      await this.connection.cancel({ sessionId: this.acpSessionId });
      this.emit({ type: "status", status: "stopped", detail: "Cancelled by user" });
    } catch (error) {
      logger.debug("[AcpSdkBackend] Error cancelling:", error);
    }
  }
  async respondToPermission(requestId, approved) {
    logger.debug(`[AcpSdkBackend] Permission response: ${requestId} = ${approved}`);
    this.emit({ type: "permission-response", id: requestId, approved });
  }
  async dispose() {
    if (this.disposed) return;
    logger.debug("[AcpSdkBackend] Disposing backend");
    this.disposed = true;
    if (this.connection && this.acpSessionId) {
      try {
        await Promise.race([
          this.connection.cancel({ sessionId: this.acpSessionId }),
          new Promise((resolve) => setTimeout(resolve, 2e3))
          // 2s timeout for graceful shutdown
        ]);
      } catch (error) {
        logger.debug("[AcpSdkBackend] Error during graceful shutdown:", error);
      }
    }
    if (this.process) {
      this.process.kill("SIGTERM");
      await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          if (this.process) {
            logger.debug("[AcpSdkBackend] Force killing process");
            this.process.kill("SIGKILL");
          }
          resolve();
        }, 1e3);
        this.process?.once("exit", () => {
          clearTimeout(timeout);
          resolve();
        });
      });
      this.process = null;
    }
    if (this.idleTimeout) {
      clearTimeout(this.idleTimeout);
      this.idleTimeout = null;
    }
    this.listeners = [];
    this.connection = null;
    this.acpSessionId = null;
    this.activeToolCalls.clear();
    for (const timeout of this.toolCallTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.toolCallTimeouts.clear();
    this.toolCallStartTimes.clear();
    this.pendingPermissions.clear();
  }
}

function readGeminiLocalConfig() {
  let token = null;
  let model = null;
  const possiblePaths = [
    join(homedir(), ".gemini", "oauth_creds.json"),
    // Main OAuth credentials file
    join(homedir(), ".gemini", "config.json"),
    join(homedir(), ".config", "gemini", "config.json"),
    join(homedir(), ".gemini", "auth.json"),
    join(homedir(), ".config", "gemini", "auth.json")
  ];
  for (const configPath of possiblePaths) {
    if (existsSync(configPath)) {
      try {
        const config = JSON.parse(readFileSync(configPath, "utf-8"));
        if (!token) {
          const foundToken = config.access_token || config.token || config.apiKey || config.GEMINI_API_KEY;
          if (foundToken && typeof foundToken === "string") {
            token = foundToken;
            logger.debug(`[Gemini] Found token in ${configPath}`);
          }
        }
        if (!model) {
          const foundModel = config.model || config.GEMINI_MODEL;
          if (foundModel && typeof foundModel === "string") {
            model = foundModel;
            logger.debug(`[Gemini] Found model in ${configPath}: ${model}`);
          }
        }
      } catch (error) {
        logger.debug(`[Gemini] Failed to read config from ${configPath}:`, error);
      }
    }
  }
  if (!token) {
    try {
      const gcloudToken = execSync("gcloud auth application-default print-access-token", {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 5e3
      }).trim();
      if (gcloudToken && gcloudToken.length > 0) {
        token = gcloudToken;
        logger.debug("[Gemini] Found token via gcloud Application Default Credentials");
      }
    } catch (error) {
      logger.debug("[Gemini] gcloud Application Default Credentials not available");
    }
  }
  return { token, model };
}
function determineGeminiModel(explicitModel, localConfig) {
  if (explicitModel !== void 0) {
    if (explicitModel === null) {
      return process.env[GEMINI_MODEL_ENV] || DEFAULT_GEMINI_MODEL;
    } else {
      return explicitModel;
    }
  } else {
    const envModel = process.env[GEMINI_MODEL_ENV];
    logger.debug(`[Gemini] Model selection: env[GEMINI_MODEL_ENV]=${envModel}, localConfig.model=${localConfig.model}, DEFAULT=${DEFAULT_GEMINI_MODEL}`);
    const model = envModel || localConfig.model || DEFAULT_GEMINI_MODEL;
    logger.debug(`[Gemini] Selected model: ${model}`);
    return model;
  }
}
function saveGeminiModelToConfig(model) {
  try {
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
        logger.debug(`[Gemini] Failed to read existing config, creating new one`);
        config = {};
      }
    }
    config.model = model;
    writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
    logger.debug(`[Gemini] Saved model "${model}" to ${configPath}`);
  } catch (error) {
    logger.debug(`[Gemini] Failed to save model to config:`, error);
  }
}
function getInitialGeminiModel() {
  const localConfig = readGeminiLocalConfig();
  return process.env[GEMINI_MODEL_ENV] || localConfig.model || DEFAULT_GEMINI_MODEL;
}
function getGeminiModelSource(explicitModel, localConfig) {
  if (explicitModel !== void 0 && explicitModel !== null) {
    return "explicit";
  } else if (process.env[GEMINI_MODEL_ENV]) {
    return "env-var";
  } else if (localConfig.model) {
    return "local-config";
  } else {
    return "default";
  }
}

function createGeminiBackend(options) {
  const localConfig = readGeminiLocalConfig();
  let apiKey = options.cloudToken || localConfig.token || process.env[GEMINI_API_KEY_ENV] || process.env[GOOGLE_API_KEY_ENV] || options.apiKey;
  if (!apiKey) {
    logger.warn(`[Gemini] No API key found. Run 'happy connect gemini' to authenticate via Google OAuth, or set ${GEMINI_API_KEY_ENV} environment variable.`);
  }
  const geminiCommand = "gemini";
  const model = determineGeminiModel(options.model, localConfig);
  const geminiArgs = ["--experimental-acp"];
  const backendOptions = {
    agentName: "gemini",
    cwd: options.cwd,
    command: geminiCommand,
    args: geminiArgs,
    env: {
      ...options.env,
      ...apiKey ? { [GEMINI_API_KEY_ENV]: apiKey, [GOOGLE_API_KEY_ENV]: apiKey } : {},
      // Pass model via env var - gemini CLI reads GEMINI_MODEL automatically
      [GEMINI_MODEL_ENV]: model,
      // Suppress debug output from gemini CLI to avoid stdout pollution
      NODE_ENV: "production",
      DEBUG: ""
    },
    mcpServers: options.mcpServers,
    permissionHandler: options.permissionHandler
  };
  const modelSource = getGeminiModelSource(options.model, localConfig);
  logger.debug("[Gemini] Creating ACP SDK backend with options:", {
    cwd: backendOptions.cwd,
    command: backendOptions.command,
    args: backendOptions.args,
    hasApiKey: !!apiKey,
    model,
    modelSource,
    mcpServerCount: options.mcpServers ? Object.keys(options.mcpServers).length : 0
  });
  return new AcpSdkBackend(backendOptions);
}

const GeminiDisplay = ({ messageBuffer, logPath, currentModel, onExit }) => {
  const [messages, setMessages] = useState([]);
  const [confirmationMode, setConfirmationMode] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [model, setModel] = useState(currentModel);
  const confirmationTimeoutRef = useRef(null);
  const { stdout } = useStdout();
  const terminalWidth = stdout.columns || 80;
  const terminalHeight = stdout.rows || 24;
  useEffect(() => {
    if (currentModel !== void 0 && currentModel !== model) {
      setModel(currentModel);
    }
  }, [currentModel]);
  useEffect(() => {
    setMessages(messageBuffer.getMessages());
    const unsubscribe = messageBuffer.onUpdate((newMessages) => {
      setMessages(newMessages);
      const modelMessage = newMessages.find(
        (msg) => msg.type === "system" && msg.content.startsWith("[MODEL:")
      );
      if (modelMessage) {
        const modelMatch = modelMessage.content.match(/\[MODEL:(.+?)\]/);
        if (modelMatch && modelMatch[1]) {
          const extractedModel = modelMatch[1];
          setModel((prevModel) => {
            if (extractedModel !== prevModel) {
              return extractedModel;
            }
            return prevModel;
          });
        }
      }
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
    /* @__PURE__ */ React.createElement(Box, { flexDirection: "column", marginBottom: 1 }, /* @__PURE__ */ React.createElement(Text, { color: "cyan", bold: true }, "\u2728 Gemini Agent Messages"), /* @__PURE__ */ React.createElement(Text, { color: "gray", dimColor: true }, "\u2500".repeat(Math.min(terminalWidth - 4, 60)))),
    /* @__PURE__ */ React.createElement(Box, { flexDirection: "column", height: terminalHeight - 10, overflow: "hidden" }, messages.length === 0 ? /* @__PURE__ */ React.createElement(Text, { color: "gray", dimColor: true }, "Waiting for messages...") : messages.filter((msg) => {
      if (msg.type === "system" && !msg.content.trim()) {
        return false;
      }
      if (msg.type === "system" && msg.content.startsWith("[MODEL:")) {
        return false;
      }
      if (msg.type === "system" && msg.content.startsWith("Using model:")) {
        return false;
      }
      return true;
    }).slice(-Math.max(1, terminalHeight - 10)).map((msg, index, array) => /* @__PURE__ */ React.createElement(Box, { key: msg.id, flexDirection: "column", marginBottom: index < array.length - 1 ? 1 : 0 }, /* @__PURE__ */ React.createElement(Text, { color: getMessageColor(msg.type), dimColor: true }, formatMessage(msg)))))
  ), /* @__PURE__ */ React.createElement(
    Box,
    {
      width: terminalWidth,
      borderStyle: "round",
      borderColor: actionInProgress ? "gray" : confirmationMode ? "red" : "cyan",
      paddingX: 2,
      justifyContent: "center",
      alignItems: "center",
      flexDirection: "column"
    },
    /* @__PURE__ */ React.createElement(Box, { flexDirection: "column", alignItems: "center" }, actionInProgress ? /* @__PURE__ */ React.createElement(Text, { color: "gray", bold: true }, "Exiting agent...") : confirmationMode ? /* @__PURE__ */ React.createElement(Text, { color: "red", bold: true }, "\u26A0\uFE0F  Press Ctrl-C again to exit the agent") : /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(Text, { color: "cyan", bold: true }, "\u2728 Gemini Agent Running \u2022 Ctrl-C to exit"), model && /* @__PURE__ */ React.createElement(Text, { color: "gray", dimColor: true }, "Model: ", model)), process.env.DEBUG && logPath && /* @__PURE__ */ React.createElement(Text, { color: "gray", dimColor: true }, "Debug logs: ", logPath))
  ));
};

class GeminiPermissionHandler {
  pendingRequests = /* @__PURE__ */ new Map();
  session;
  currentPermissionMode = "default";
  constructor(session) {
    this.session = session;
    this.setupRpcHandler();
  }
  /**
   * Set the current permission mode
   * This affects how tool calls are automatically approved/denied
   */
  setPermissionMode(mode) {
    this.currentPermissionMode = mode;
    logger.debug(`[Gemini] Permission mode set to: ${mode}`);
  }
  /**
   * Check if a tool should be auto-approved based on permission mode
   */
  shouldAutoApprove(toolName, toolCallId, input) {
    const alwaysAutoApproveNames = ["change_title", "happy__change_title", "GeminiReasoning", "CodexReasoning", "think", "save_memory"];
    const alwaysAutoApproveIds = ["change_title", "save_memory"];
    if (alwaysAutoApproveNames.some((name) => toolName.toLowerCase().includes(name.toLowerCase()))) {
      return true;
    }
    if (alwaysAutoApproveIds.some((id) => toolCallId.toLowerCase().includes(id.toLowerCase()))) {
      return true;
    }
    switch (this.currentPermissionMode) {
      case "yolo":
        return true;
      case "safe-yolo":
        return true;
      case "read-only":
        const writeTools = ["write", "edit", "create", "delete", "patch", "fs-edit"];
        const isWriteTool = writeTools.some((wt) => toolName.toLowerCase().includes(wt));
        return !isWriteTool;
      case "default":
      default:
        return false;
    }
  }
  /**
   * Handle a tool permission request
   * @param toolCallId - The unique ID of the tool call
   * @param toolName - The name of the tool being called
   * @param input - The input parameters for the tool
   * @returns Promise resolving to permission result
   */
  async handleToolCall(toolCallId, toolName, input) {
    if (this.shouldAutoApprove(toolName, toolCallId, input)) {
      logger.debug(`[Gemini] Auto-approving tool ${toolName} (${toolCallId}) in ${this.currentPermissionMode} mode`);
      this.session.updateAgentState((currentState) => ({
        ...currentState,
        completedRequests: {
          ...currentState.completedRequests,
          [toolCallId]: {
            tool: toolName,
            arguments: input,
            createdAt: Date.now(),
            completedAt: Date.now(),
            status: "approved",
            decision: this.currentPermissionMode === "yolo" ? "approved_for_session" : "approved"
          }
        }
      }));
      return {
        decision: this.currentPermissionMode === "yolo" ? "approved_for_session" : "approved"
      };
    }
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
      logger.debug(`[Gemini] Permission request sent for tool: ${toolName} (${toolCallId}) in ${this.currentPermissionMode} mode`);
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
          logger.debug("[Gemini] Permission request not found or already resolved");
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
        logger.debug(`[Gemini] Permission ${response.approved ? "approved" : "denied"} for ${pending.toolName}`);
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
    logger.debug("[Gemini] Permission handler reset");
  }
}

class GeminiReasoningProcessor {
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
    logger.debug("[GeminiReasoningProcessor] Section break - reset state");
  }
  /**
   * Process a reasoning chunk from agent_thought_chunk
   * Gemini sends reasoning as chunks, we accumulate them similar to Codex
   */
  processChunk(chunk) {
    this.accumulator += chunk;
    if (!this.inTitleCapture && !this.hasTitle && !this.contentBuffer) {
      if (this.accumulator.startsWith("**")) {
        this.inTitleCapture = true;
        this.titleBuffer = this.accumulator.substring(2);
        logger.debug("[GeminiReasoningProcessor] Started title capture");
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
        logger.debug(`[GeminiReasoningProcessor] Title captured: "${title}"`);
        this.sendToolCallStart(title);
      }
    } else if (this.hasTitle) {
      const titleStartIndex = this.accumulator.indexOf("**");
      if (titleStartIndex !== -1) {
        this.contentBuffer = this.accumulator.substring(
          titleStartIndex + 2 + this.currentTitle.length + 2
        );
      }
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
      name: "GeminiReasoning",
      callId: this.currentCallId,
      input: {
        title
      },
      id: randomUUID()
    };
    logger.debug(`[GeminiReasoningProcessor] Sending tool call start for: "${title}"`);
    this.onMessage?.(toolCall);
    this.toolCallStarted = true;
  }
  /**
   * Complete the reasoning section with final text
   * Called when reasoning is complete (e.g., when status changes to idle)
   * Returns true if reasoning was actually completed, false if there was nothing to complete
   */
  complete() {
    const fullText = this.accumulator;
    if (!fullText.trim() && !this.toolCallStarted) {
      logger.debug("[GeminiReasoningProcessor] Complete called but no content accumulated, skipping");
      return false;
    }
    let title;
    let content = fullText;
    if (fullText.startsWith("**")) {
      const titleEndIndex = fullText.indexOf("**", 2);
      if (titleEndIndex !== -1) {
        title = fullText.substring(2, titleEndIndex);
        content = fullText.substring(titleEndIndex + 2).trim();
      }
    }
    logger.debug(`[GeminiReasoningProcessor] Complete reasoning - Title: "${title}", Has content: ${content.length > 0}`);
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
      logger.debug("[GeminiReasoningProcessor] Sending tool call result");
      this.onMessage?.(toolResult);
    } else if (content.trim()) {
      const reasoningMessage = {
        type: "reasoning",
        message: content,
        id: randomUUID()
      };
      logger.debug("[GeminiReasoningProcessor] Sending reasoning message");
      this.onMessage?.(reasoningMessage);
    }
    this.resetState();
    return true;
  }
  /**
   * Abort the current reasoning section
   */
  abort() {
    logger.debug("[GeminiReasoningProcessor] Abort called");
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
      logger.debug(`[GeminiReasoningProcessor] Sending tool call result with status: ${status}`);
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

class GeminiDiffProcessor {
  previousDiffs = /* @__PURE__ */ new Map();
  // Track diffs per file path
  onMessage = null;
  constructor(onMessage) {
    this.onMessage = onMessage || null;
  }
  /**
   * Process an fs-edit event and check if it contains diff information
   */
  processFsEdit(path, description, diff) {
    logger.debug(`[GeminiDiffProcessor] Processing fs-edit for path: ${path}`);
    if (diff) {
      this.processDiff(path, diff, description);
    } else {
      const simpleDiff = `File edited: ${path}${description ? ` - ${description}` : ""}`;
      this.processDiff(path, simpleDiff, description);
    }
  }
  /**
   * Process a tool result that may contain diff information
   */
  processToolResult(toolName, result, callId) {
    if (result && typeof result === "object") {
      const diff = result.diff || result.unified_diff || result.patch;
      const path = result.path || result.file;
      if (diff && path) {
        logger.debug(`[GeminiDiffProcessor] Found diff in tool result: ${toolName} (${callId})`);
        this.processDiff(path, diff, result.description);
      } else if (result.changes && typeof result.changes === "object") {
        for (const [filePath, change] of Object.entries(result.changes)) {
          const changeDiff = change.diff || change.unified_diff || JSON.stringify(change);
          this.processDiff(filePath, changeDiff, change.description);
        }
      }
    }
  }
  /**
   * Process a unified diff and check if it has changed from the previous value
   */
  processDiff(path, unifiedDiff, description) {
    const previousDiff = this.previousDiffs.get(path);
    if (previousDiff !== unifiedDiff) {
      logger.debug(`[GeminiDiffProcessor] Unified diff changed for ${path}, sending GeminiDiff tool call`);
      const callId = randomUUID();
      const toolCall = {
        type: "tool-call",
        name: "GeminiDiff",
        callId,
        input: {
          unified_diff: unifiedDiff,
          path,
          description
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
    this.previousDiffs.set(path, unifiedDiff);
    logger.debug(`[GeminiDiffProcessor] Updated stored diff for ${path}`);
  }
  /**
   * Reset the processor state (called on task_complete or turn_aborted)
   */
  reset() {
    logger.debug("[GeminiDiffProcessor] Resetting diff state");
    this.previousDiffs.clear();
  }
  /**
   * Set the message callback for sending messages directly
   */
  setMessageCallback(callback) {
    this.onMessage = callback;
  }
  /**
   * Get the current diff value for a specific path
   */
  getCurrentDiff(path) {
    return this.previousDiffs.get(path) || null;
  }
  /**
   * Get all tracked diffs
   */
  getAllDiffs() {
    return new Map(this.previousDiffs);
  }
}

function hasIncompleteOptions(text) {
  const hasOpeningTag = /<options>/i.test(text);
  const hasClosingTag = /<\/options>/i.test(text);
  return hasOpeningTag && !hasClosingTag;
}
function parseOptionsFromText(text) {
  const optionsRegex = /<options>\s*([\s\S]*?)\s*<\/options>/i;
  const match = text.match(optionsRegex);
  if (!match) {
    return { text: text.trim(), options: [] };
  }
  const optionsBlock = match[1];
  const optionRegex = /<option>(.*?)<\/option>/gi;
  const options = [];
  let optionMatch;
  while ((optionMatch = optionRegex.exec(optionsBlock)) !== null) {
    const optionText = optionMatch[1].trim();
    if (optionText) {
      options.push(optionText);
    }
  }
  const textWithoutOptions = text.replace(optionsRegex, "").trim();
  return { text: textWithoutOptions, options };
}
function formatOptionsXml(options) {
  if (options.length === 0) {
    return "";
  }
  return "\n<options>\n" + options.map((opt) => `    <option>${opt}</option>`).join("\n") + "\n</options>";
}

async function runGemini(opts) {
  const sessionTag = randomUUID();
  const api = await ApiClient.create(opts.credentials);
  const settings = await readSettings();
  const machineId = settings?.machineId;
  if (!machineId) {
    console.error(`[START] No machine ID found in settings, which is unexpected since authAndSetupMachineIfNeeded should have created it. Please report this issue on https://github.com/slopus/happy-cli/issues`);
    process.exit(1);
  }
  logger.debug(`Using machineId: ${machineId}`);
  await api.getOrCreateMachine({
    machineId,
    metadata: initialMachineMetadata
  });
  let cloudToken = void 0;
  try {
    const vendorToken = await api.getVendorToken("gemini");
    if (vendorToken?.oauth?.access_token) {
      cloudToken = vendorToken.oauth.access_token;
      logger.debug("[Gemini] Using OAuth token from Happy cloud");
    }
  } catch (error) {
    logger.debug("[Gemini] Failed to fetch cloud token:", error);
  }
  const state = {
    controlledByUser: false
  };
  const metadata = {
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
    lifecycleState: "running",
    lifecycleStateSince: Date.now(),
    flavor: "gemini"
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
        updatePermissionMode(messagePermissionMode);
        logger.debug(`[Gemini] Permission mode updated from user message to: ${currentPermissionMode}`);
      } else {
        logger.debug(`[Gemini] Invalid permission mode received: ${message.meta.permissionMode}`);
      }
    } else {
      logger.debug(`[Gemini] User message received with no permission mode override, using current: ${currentPermissionMode ?? "default (effective)"}`);
    }
    if (currentPermissionMode === void 0) {
      currentPermissionMode = "default";
      updatePermissionMode("default");
    }
    let messageModel = currentModel;
    if (message.meta?.hasOwnProperty("model")) {
      if (message.meta.model === null) {
        messageModel = void 0;
        currentModel = void 0;
      } else if (message.meta.model) {
        messageModel = message.meta.model;
        currentModel = messageModel;
        updateDisplayedModel(messageModel, true);
        messageBuffer.addMessage(`Model changed to: ${messageModel}`, "system");
      }
    }
    const originalUserMessage = message.content.text;
    let fullPrompt = originalUserMessage;
    if (isFirstMessage && message.meta?.appendSystemPrompt) {
      fullPrompt = message.meta.appendSystemPrompt + "\n\n" + originalUserMessage + "\n\n" + CHANGE_TITLE_INSTRUCTION;
      isFirstMessage = false;
    }
    const mode = {
      permissionMode: messagePermissionMode || "default",
      model: messageModel,
      originalUserMessage
      // Store original message separately
    };
    messageQueue.push(fullPrompt, mode);
  });
  let thinking = false;
  session.keepAlive(thinking, "remote");
  const keepAliveInterval = setInterval(() => {
    session.keepAlive(thinking, "remote");
  }, 2e3);
  let isFirstMessage = true;
  const sendReady = () => {
    session.sendSessionEvent({ type: "ready" });
    try {
      api.push().sendToAllDevices(
        "It's ready!",
        "Gemini is waiting for your command",
        { sessionId: session.sessionId }
      );
    } catch (pushError) {
      logger.debug("[Gemini] Failed to send ready push", pushError);
    }
  };
  const emitReadyIfIdle = () => {
    if (shouldExit) {
      return false;
    }
    if (thinking) {
      return false;
    }
    if (isResponseInProgress) {
      return false;
    }
    if (messageQueue.size() > 0) {
      return false;
    }
    sendReady();
    return true;
  };
  let abortController = new AbortController();
  let shouldExit = false;
  let geminiBackend = null;
  let acpSessionId = null;
  let wasSessionCreated = false;
  async function handleAbort() {
    logger.debug("[Gemini] Abort requested - stopping current task");
    session.sendCodexMessage({
      type: "turn_aborted",
      id: randomUUID()
    });
    reasoningProcessor.abort();
    diffProcessor.reset();
    try {
      abortController.abort();
      messageQueue.reset();
      if (geminiBackend && acpSessionId) {
        await geminiBackend.cancel(acpSessionId);
      }
      logger.debug("[Gemini] Abort completed - session remains active");
    } catch (error) {
      logger.debug("[Gemini] Error during abort:", error);
    } finally {
      abortController = new AbortController();
    }
  }
  const handleKillSession = async () => {
    logger.debug("[Gemini] Kill session requested - terminating process");
    await handleAbort();
    logger.debug("[Gemini] Abort completed, proceeding with termination");
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
      if (geminiBackend) {
        await geminiBackend.dispose();
      }
      logger.debug("[Gemini] Session termination complete, exiting");
      process.exit(0);
    } catch (error) {
      logger.debug("[Gemini] Error during session termination:", error);
      process.exit(1);
    }
  };
  session.rpcHandlerManager.registerHandler("abort", handleAbort);
  registerKillSessionHandler(session.rpcHandlerManager, handleKillSession);
  const messageBuffer = new MessageBuffer();
  const hasTTY = process.stdout.isTTY && process.stdin.isTTY;
  let inkInstance = null;
  let displayedModel = getInitialGeminiModel();
  const localConfig = readGeminiLocalConfig();
  logger.debug(`[gemini] Initial model setup: env[GEMINI_MODEL_ENV]=${process.env[GEMINI_MODEL_ENV] || "not set"}, localConfig=${localConfig.model || "not set"}, displayedModel=${displayedModel}`);
  const updateDisplayedModel = (model, saveToConfig = false) => {
    if (model === void 0) {
      logger.debug(`[gemini] updateDisplayedModel called with undefined, skipping update`);
      return;
    }
    const oldModel = displayedModel;
    displayedModel = model;
    logger.debug(`[gemini] updateDisplayedModel called: oldModel=${oldModel}, newModel=${model}, saveToConfig=${saveToConfig}`);
    if (saveToConfig) {
      saveGeminiModelToConfig(model);
    }
    if (hasTTY && oldModel !== model) {
      logger.debug(`[gemini] Adding model update message to buffer: [MODEL:${model}]`);
      messageBuffer.addMessage(`[MODEL:${model}]`, "system");
    } else if (hasTTY) {
      logger.debug(`[gemini] Model unchanged, skipping update message`);
    }
  };
  if (hasTTY) {
    console.clear();
    const DisplayComponent = () => {
      const currentModelValue = displayedModel || "gemini-2.5-pro";
      return React.createElement(GeminiDisplay, {
        messageBuffer,
        logPath: process.env.DEBUG ? logger.getLogPath() : void 0,
        currentModel: currentModelValue,
        onExit: async () => {
          logger.debug("[gemini]: Exiting agent via Ctrl-C");
          shouldExit = true;
          await handleAbort();
        }
      });
    };
    inkInstance = render(React.createElement(DisplayComponent), {
      exitOnCtrlC: false,
      patchConsole: false
    });
    const initialModelName = displayedModel || "gemini-2.5-pro";
    logger.debug(`[gemini] Sending initial model to UI: ${initialModelName}`);
    messageBuffer.addMessage(`[MODEL:${initialModelName}]`, "system");
  }
  if (hasTTY) {
    process.stdin.resume();
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.setEncoding("utf8");
  }
  const happyServer = await startHappyServer(session);
  const bridgeCommand = join$1(projectPath(), "bin", "happy-mcp.mjs");
  const mcpServers = {
    happy: {
      command: bridgeCommand,
      args: ["--url", happyServer.url]
    }
  };
  const permissionHandler = new GeminiPermissionHandler(session);
  const reasoningProcessor = new GeminiReasoningProcessor((message) => {
    session.sendCodexMessage(message);
  });
  const diffProcessor = new GeminiDiffProcessor((message) => {
    session.sendCodexMessage(message);
  });
  const updatePermissionMode = (mode) => {
    permissionHandler.setPermissionMode(mode);
  };
  let accumulatedResponse = "";
  let isResponseInProgress = false;
  function setupGeminiMessageHandler(backend) {
    backend.onMessage((msg) => {
      switch (msg.type) {
        case "model-output":
          if (msg.textDelta) {
            if (!isResponseInProgress) {
              messageBuffer.removeLastMessage("system");
              messageBuffer.addMessage(msg.textDelta, "assistant");
              isResponseInProgress = true;
              logger.debug(`[gemini] Started new response, first chunk length: ${msg.textDelta.length}`);
            } else {
              messageBuffer.updateLastMessage(msg.textDelta, "assistant");
              logger.debug(`[gemini] Updated response, chunk length: ${msg.textDelta.length}, total accumulated: ${accumulatedResponse.length + msg.textDelta.length}`);
            }
            accumulatedResponse += msg.textDelta;
          }
          break;
        case "status":
          logger.debug(`[gemini] Status changed: ${msg.status}${msg.detail ? ` - ${msg.detail}` : ""}`);
          if (msg.status === "error") {
            logger.debug(`[gemini] \u26A0\uFE0F Error status received: ${msg.detail || "Unknown error"}`);
            session.sendCodexMessage({
              type: "turn_aborted",
              id: randomUUID()
            });
          }
          if (msg.status === "running") {
            thinking = true;
            session.keepAlive(thinking, "remote");
            session.sendCodexMessage({
              type: "task_started",
              id: randomUUID()
            });
            messageBuffer.addMessage("Thinking...", "system");
          } else if (msg.status === "idle" || msg.status === "stopped") {
            if (thinking) {
              thinking = false;
            }
            thinking = false;
            session.keepAlive(thinking, "remote");
            const reasoningCompleted = reasoningProcessor.complete();
            if (reasoningCompleted || isResponseInProgress) {
              session.sendCodexMessage({
                type: "task_complete",
                id: randomUUID()
              });
            }
            if (isResponseInProgress && accumulatedResponse.trim()) {
              const { text: messageText, options } = parseOptionsFromText(accumulatedResponse);
              let finalMessageText = messageText;
              if (options.length > 0) {
                const optionsXml = formatOptionsXml(options);
                finalMessageText = messageText + optionsXml;
                logger.debug(`[gemini] Found ${options.length} options in response:`, options);
                logger.debug(`[gemini] Keeping options in message text for mobile app parsing`);
              } else if (hasIncompleteOptions(accumulatedResponse)) {
                logger.debug(`[gemini] Warning: Incomplete options block detected but sending message anyway`);
              }
              const messageId = randomUUID();
              const messagePayload = {
                type: "message",
                message: finalMessageText,
                // Include options XML in text for mobile app
                id: messageId,
                ...options.length > 0 && { options }
              };
              logger.debug(`[gemini] Sending complete message to mobile (length: ${finalMessageText.length}): ${finalMessageText.substring(0, 100)}...`);
              logger.debug(`[gemini] Full message payload:`, JSON.stringify(messagePayload, null, 2));
              session.sendCodexMessage(messagePayload);
              accumulatedResponse = "";
              isResponseInProgress = false;
            }
          } else if (msg.status === "error") {
            thinking = false;
            session.keepAlive(thinking, "remote");
            accumulatedResponse = "";
            isResponseInProgress = false;
            const errorMessage = msg.detail || "Unknown error";
            messageBuffer.addMessage(`Error: ${errorMessage}`, "status");
            session.sendCodexMessage({
              type: "message",
              message: `Error: ${errorMessage}`,
              id: randomUUID()
            });
          }
          break;
        case "tool-call":
          const toolArgs = msg.args ? JSON.stringify(msg.args).substring(0, 100) : "";
          const isInvestigationTool = msg.toolName === "codebase_investigator" || typeof msg.toolName === "string" && msg.toolName.includes("investigator");
          logger.debug(`[gemini] \u{1F527} Tool call received: ${msg.toolName} (${msg.callId})${isInvestigationTool ? " [INVESTIGATION]" : ""}`);
          if (isInvestigationTool && msg.args && typeof msg.args === "object" && "objective" in msg.args) {
            logger.debug(`[gemini] \u{1F50D} Investigation objective: ${String(msg.args.objective).substring(0, 150)}...`);
          }
          messageBuffer.addMessage(`Executing: ${msg.toolName}${toolArgs ? ` ${toolArgs}${toolArgs.length >= 100 ? "..." : ""}` : ""}`, "tool");
          session.sendCodexMessage({
            type: "tool-call",
            name: msg.toolName,
            callId: msg.callId,
            input: msg.args,
            id: randomUUID()
          });
          break;
        case "tool-result":
          const isError = msg.result && typeof msg.result === "object" && "error" in msg.result;
          const resultText = typeof msg.result === "string" ? msg.result.substring(0, 200) : JSON.stringify(msg.result).substring(0, 200);
          const truncatedResult = resultText + (typeof msg.result === "string" && msg.result.length > 200 ? "..." : "");
          const resultSize = typeof msg.result === "string" ? msg.result.length : JSON.stringify(msg.result).length;
          logger.debug(`[gemini] ${isError ? "\u274C" : "\u2705"} Tool result received: ${msg.toolName} (${msg.callId}) - Size: ${resultSize} bytes${isError ? " [ERROR]" : ""}`);
          if (!isError) {
            diffProcessor.processToolResult(msg.toolName, msg.result, msg.callId);
          }
          if (isError) {
            const errorMsg = msg.result.error || "Tool call failed";
            logger.debug(`[gemini] \u274C Tool call error: ${errorMsg.substring(0, 300)}`);
            messageBuffer.addMessage(`Error: ${errorMsg}`, "status");
          } else {
            if (resultSize > 1e3) {
              logger.debug(`[gemini] \u2705 Large tool result (${resultSize} bytes) - first 200 chars: ${truncatedResult}`);
            }
            messageBuffer.addMessage(`Result: ${truncatedResult}`, "result");
          }
          session.sendCodexMessage({
            type: "tool-call-result",
            callId: msg.callId,
            output: msg.result,
            id: randomUUID()
          });
          break;
        case "fs-edit":
          messageBuffer.addMessage(`File edit: ${msg.description}`, "tool");
          diffProcessor.processFsEdit(msg.path || "", msg.description, msg.diff);
          session.sendCodexMessage({
            type: "file-edit",
            description: msg.description,
            diff: msg.diff,
            path: msg.path,
            id: randomUUID()
          });
          break;
        default:
          if (msg.type === "token-count") {
            session.sendCodexMessage({
              type: "token_count",
              ...msg,
              id: randomUUID()
            });
          }
          break;
        case "terminal-output":
          messageBuffer.addMessage(msg.data, "result");
          session.sendCodexMessage({
            type: "terminal-output",
            data: msg.data,
            id: randomUUID()
          });
          break;
        case "permission-request":
          session.sendCodexMessage({
            type: "permission-request",
            permissionId: msg.id,
            reason: msg.reason,
            payload: msg.payload,
            id: randomUUID()
          });
          break;
        case "exec-approval-request":
          const execApprovalMsg = msg;
          const callId = execApprovalMsg.call_id || execApprovalMsg.callId || randomUUID();
          const { call_id, type, ...inputs } = execApprovalMsg;
          logger.debug(`[gemini] Exec approval request received: ${callId}`);
          messageBuffer.addMessage(`Exec approval requested: ${callId}`, "tool");
          session.sendCodexMessage({
            type: "tool-call",
            name: "GeminiBash",
            // Similar to Codex's CodexBash
            callId,
            input: inputs,
            id: randomUUID()
          });
          break;
        case "patch-apply-begin":
          const patchBeginMsg = msg;
          const patchCallId = patchBeginMsg.call_id || patchBeginMsg.callId || randomUUID();
          const { call_id: patchCallIdVar, type: patchType, auto_approved, changes } = patchBeginMsg;
          const changeCount = changes ? Object.keys(changes).length : 0;
          const filesMsg = changeCount === 1 ? "1 file" : `${changeCount} files`;
          messageBuffer.addMessage(`Modifying ${filesMsg}...`, "tool");
          logger.debug(`[gemini] Patch apply begin: ${patchCallId}, files: ${changeCount}`);
          session.sendCodexMessage({
            type: "tool-call",
            name: "GeminiPatch",
            // Similar to Codex's CodexPatch
            callId: patchCallId,
            input: {
              auto_approved,
              changes
            },
            id: randomUUID()
          });
          break;
        case "patch-apply-end":
          const patchEndMsg = msg;
          const patchEndCallId = patchEndMsg.call_id || patchEndMsg.callId || randomUUID();
          const { call_id: patchEndCallIdVar, type: patchEndType, stdout, stderr, success } = patchEndMsg;
          if (success) {
            const message = stdout || "Files modified successfully";
            messageBuffer.addMessage(message.substring(0, 200), "result");
          } else {
            const errorMsg = stderr || "Failed to modify files";
            messageBuffer.addMessage(`Error: ${errorMsg.substring(0, 200)}`, "result");
          }
          logger.debug(`[gemini] Patch apply end: ${patchEndCallId}, success: ${success}`);
          session.sendCodexMessage({
            type: "tool-call-result",
            callId: patchEndCallId,
            output: {
              stdout,
              stderr,
              success
            },
            id: randomUUID()
          });
          break;
        case "event":
          if (msg.name === "thinking") {
            const thinkingPayload = msg.payload;
            const thinkingText = thinkingPayload && typeof thinkingPayload === "object" && "text" in thinkingPayload ? String(thinkingPayload.text || "") : "";
            if (thinkingText) {
              reasoningProcessor.processChunk(thinkingText);
              logger.debug(`[gemini] \u{1F4AD} Thinking chunk received: ${thinkingText.length} chars - Preview: ${thinkingText.substring(0, 100)}...`);
              if (!thinkingText.startsWith("**")) {
                const thinkingPreview = thinkingText.substring(0, 100);
                messageBuffer.updateLastMessage(`[Thinking] ${thinkingPreview}...`, "system");
              }
            }
            session.sendCodexMessage({
              type: "thinking",
              text: thinkingText,
              id: randomUUID()
            });
          }
          break;
      }
    });
  }
  let first = true;
  try {
    let currentModeHash = null;
    let pending = null;
    while (!shouldExit) {
      let message = pending;
      pending = null;
      if (!message) {
        logger.debug("[gemini] Main loop: waiting for messages from queue...");
        const waitSignal = abortController.signal;
        const batch = await messageQueue.waitForMessagesAndGetAsString(waitSignal);
        if (!batch) {
          if (waitSignal.aborted && !shouldExit) {
            logger.debug("[gemini] Main loop: wait aborted, continuing...");
            continue;
          }
          logger.debug("[gemini] Main loop: no batch received, breaking...");
          break;
        }
        logger.debug(`[gemini] Main loop: received message from queue (length: ${batch.message.length})`);
        message = batch;
      }
      if (!message) {
        break;
      }
      if (wasSessionCreated && currentModeHash && message.hash !== currentModeHash) {
        logger.debug("[Gemini] Mode changed \u2013 restarting Gemini session");
        messageBuffer.addMessage("\u2550".repeat(40), "status");
        messageBuffer.addMessage("Starting new Gemini session (mode changed)...", "status");
        permissionHandler.reset();
        reasoningProcessor.abort();
        if (geminiBackend) {
          await geminiBackend.dispose();
          geminiBackend = null;
        }
        const modelToUse = message.mode?.model === void 0 ? void 0 : message.mode.model || null;
        geminiBackend = createGeminiBackend({
          cwd: process.cwd(),
          mcpServers,
          permissionHandler,
          cloudToken,
          // Pass model from message - if undefined, will use local config/env/default
          // If explicitly null, will skip local config and use env/default
          model: modelToUse
        });
        setupGeminiMessageHandler(geminiBackend);
        const localConfigForModel = readGeminiLocalConfig();
        const actualModel = determineGeminiModel(modelToUse, localConfigForModel);
        logger.debug(`[gemini] Model change - modelToUse=${modelToUse}, actualModel=${actualModel}`);
        logger.debug("[gemini] Starting new ACP session with model:", actualModel);
        const { sessionId } = await geminiBackend.startSession();
        acpSessionId = sessionId;
        logger.debug(`[gemini] New ACP session started: ${acpSessionId}`);
        logger.debug(`[gemini] Calling updateDisplayedModel with: ${actualModel}`);
        updateDisplayedModel(actualModel, false);
        updatePermissionMode(message.mode.permissionMode);
        wasSessionCreated = true;
        currentModeHash = message.hash;
        first = false;
      }
      currentModeHash = message.hash;
      const userMessageToShow = message.mode?.originalUserMessage || message.message;
      messageBuffer.addMessage(userMessageToShow, "user");
      try {
        if (first || !wasSessionCreated) {
          if (!geminiBackend) {
            const modelToUse = message.mode?.model === void 0 ? void 0 : message.mode.model || null;
            geminiBackend = createGeminiBackend({
              cwd: process.cwd(),
              mcpServers,
              permissionHandler,
              cloudToken,
              // Pass model from message - if undefined, will use local config/env/default
              // If explicitly null, will skip local config and use env/default
              model: modelToUse
            });
            setupGeminiMessageHandler(geminiBackend);
            const localConfigForModel = readGeminiLocalConfig();
            const actualModel = determineGeminiModel(modelToUse, localConfigForModel);
            const modelSource = modelToUse !== void 0 ? "message" : process.env[GEMINI_MODEL_ENV] ? "env-var" : localConfigForModel.model ? "local-config" : "default";
            logger.debug(`[gemini] Backend created, model will be: ${actualModel} (from ${modelSource})`);
            logger.debug(`[gemini] Calling updateDisplayedModel with: ${actualModel}`);
            updateDisplayedModel(actualModel, false);
          }
          if (!acpSessionId) {
            logger.debug("[gemini] Starting ACP session...");
            updatePermissionMode(message.mode.permissionMode);
            const { sessionId } = await geminiBackend.startSession();
            acpSessionId = sessionId;
            logger.debug(`[gemini] ACP session started: ${acpSessionId}`);
            wasSessionCreated = true;
            currentModeHash = message.hash;
            logger.debug(`[gemini] Displaying model in UI: ${displayedModel || "gemini-2.5-pro"}, displayedModel: ${displayedModel}`);
          }
        }
        if (!acpSessionId) {
          throw new Error("ACP session not started");
        }
        accumulatedResponse = "";
        isResponseInProgress = false;
        if (!geminiBackend || !acpSessionId) {
          throw new Error("Gemini backend or session not initialized");
        }
        const promptToSend = message.message;
        logger.debug(`[gemini] Sending prompt to Gemini (length: ${promptToSend.length}): ${promptToSend.substring(0, 100)}...`);
        logger.debug(`[gemini] Full prompt: ${promptToSend}`);
        await geminiBackend.sendPrompt(acpSessionId, promptToSend);
        logger.debug("[gemini] Prompt sent successfully");
        if (first) {
          first = false;
        }
      } catch (error) {
        logger.debug("[gemini] Error in gemini session:", error);
        const isAbortError = error instanceof Error && error.name === "AbortError";
        if (isAbortError) {
          messageBuffer.addMessage("Aborted by user", "status");
          session.sendSessionEvent({ type: "message", message: "Aborted by user" });
        } else {
          let errorMsg = "Process error occurred";
          if (typeof error === "object" && error !== null) {
            const errObj = error;
            const errorDetails = errObj.data?.details || errObj.details || "";
            const errorCode = errObj.code || errObj.status || errObj.response?.status;
            const errorMessage = errObj.message || errObj.error?.message || "";
            const errorString = String(error);
            if (errorCode === 404 || errorDetails.includes("notFound") || errorDetails.includes("404") || errorMessage.includes("not found") || errorMessage.includes("404")) {
              const currentModel2 = displayedModel || "gemini-2.5-pro";
              errorMsg = `Model "${currentModel2}" not found. Available models: gemini-2.5-pro, gemini-2.5-flash, gemini-2.5-flash-lite`;
            } else if (errorCode === 429 || errorDetails.includes("429") || errorMessage.includes("429") || errorString.includes("429") || errorDetails.includes("rateLimitExceeded") || errorDetails.includes("RESOURCE_EXHAUSTED") || errorMessage.includes("Rate limit exceeded") || errorMessage.includes("Resource exhausted") || errorString.includes("rateLimitExceeded") || errorString.includes("RESOURCE_EXHAUSTED")) {
              errorMsg = "Gemini API rate limit exceeded. Please wait a moment and try again. The API will retry automatically.";
            } else if (errorDetails.includes("quota") || errorMessage.includes("quota") || errorString.includes("quota")) {
              errorMsg = "Gemini API daily quota exceeded. Please wait until quota resets or use a paid API key.";
            } else if (Object.keys(error).length === 0) {
              errorMsg = 'Failed to start Gemini. Is "gemini" CLI installed? Run: npm install -g @google/gemini-cli';
            } else if (errObj.message || errorMessage) {
              errorMsg = errorDetails || errorMessage || errObj.message;
            }
          } else if (error instanceof Error) {
            errorMsg = error.message;
          }
          messageBuffer.addMessage(errorMsg, "status");
          session.sendCodexMessage({
            type: "message",
            message: errorMsg,
            id: randomUUID()
          });
        }
      } finally {
        permissionHandler.reset();
        reasoningProcessor.abort();
        diffProcessor.reset();
        thinking = false;
        session.keepAlive(thinking, "remote");
        emitReadyIfIdle();
        logger.debug(`[gemini] Main loop: turn completed, continuing to next iteration (queue size: ${messageQueue.size()})`);
      }
    }
  } finally {
    logger.debug("[gemini]: Final cleanup start");
    try {
      session.sendSessionDeath();
      await session.flush();
      await session.close();
    } catch (e) {
      logger.debug("[gemini]: Error while closing session", e);
    }
    if (geminiBackend) {
      await geminiBackend.dispose();
    }
    happyServer.stop();
    if (process.stdin.isTTY) {
      try {
        process.stdin.setRawMode(false);
      } catch {
      }
    }
    if (hasTTY) {
      try {
        process.stdin.pause();
      } catch {
      }
    }
    clearInterval(keepAliveInterval);
    if (inkInstance) {
      inkInstance.unmount();
    }
    messageBuffer.clear();
    logger.debug("[gemini]: Final cleanup completed");
  }
}

export { runGemini };
