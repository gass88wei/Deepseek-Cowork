import { z } from 'zod';
import { EventEmitter } from 'node:events';
import { Socket } from 'socket.io-client';
import { ExpoPushMessage } from 'expo-server-sdk';

/**
 * Simplified schema that only validates fields actually used in the codebase
 * while preserving all other fields through passthrough()
 */

declare const UsageSchema: z.ZodObject<{
    input_tokens: z.ZodNumber;
    cache_creation_input_tokens: z.ZodOptional<z.ZodNumber>;
    cache_read_input_tokens: z.ZodOptional<z.ZodNumber>;
    output_tokens: z.ZodNumber;
    service_tier: z.ZodOptional<z.ZodString>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    input_tokens: z.ZodNumber;
    cache_creation_input_tokens: z.ZodOptional<z.ZodNumber>;
    cache_read_input_tokens: z.ZodOptional<z.ZodNumber>;
    output_tokens: z.ZodNumber;
    service_tier: z.ZodOptional<z.ZodString>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    input_tokens: z.ZodNumber;
    cache_creation_input_tokens: z.ZodOptional<z.ZodNumber>;
    cache_read_input_tokens: z.ZodOptional<z.ZodNumber>;
    output_tokens: z.ZodNumber;
    service_tier: z.ZodOptional<z.ZodString>;
}, z.ZodTypeAny, "passthrough">>;
declare const RawJSONLinesSchema: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
    type: z.ZodLiteral<"user">;
    isSidechain: z.ZodOptional<z.ZodBoolean>;
    isMeta: z.ZodOptional<z.ZodBoolean>;
    uuid: z.ZodString;
    message: z.ZodObject<{
        content: z.ZodUnion<[z.ZodString, z.ZodAny]>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        content: z.ZodUnion<[z.ZodString, z.ZodAny]>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        content: z.ZodUnion<[z.ZodString, z.ZodAny]>;
    }, z.ZodTypeAny, "passthrough">>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    type: z.ZodLiteral<"user">;
    isSidechain: z.ZodOptional<z.ZodBoolean>;
    isMeta: z.ZodOptional<z.ZodBoolean>;
    uuid: z.ZodString;
    message: z.ZodObject<{
        content: z.ZodUnion<[z.ZodString, z.ZodAny]>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        content: z.ZodUnion<[z.ZodString, z.ZodAny]>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        content: z.ZodUnion<[z.ZodString, z.ZodAny]>;
    }, z.ZodTypeAny, "passthrough">>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    type: z.ZodLiteral<"user">;
    isSidechain: z.ZodOptional<z.ZodBoolean>;
    isMeta: z.ZodOptional<z.ZodBoolean>;
    uuid: z.ZodString;
    message: z.ZodObject<{
        content: z.ZodUnion<[z.ZodString, z.ZodAny]>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        content: z.ZodUnion<[z.ZodString, z.ZodAny]>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        content: z.ZodUnion<[z.ZodString, z.ZodAny]>;
    }, z.ZodTypeAny, "passthrough">>;
}, z.ZodTypeAny, "passthrough">>, z.ZodObject<{
    uuid: z.ZodString;
    type: z.ZodLiteral<"assistant">;
    message: z.ZodOptional<z.ZodObject<{
        usage: z.ZodOptional<z.ZodObject<{
            input_tokens: z.ZodNumber;
            cache_creation_input_tokens: z.ZodOptional<z.ZodNumber>;
            cache_read_input_tokens: z.ZodOptional<z.ZodNumber>;
            output_tokens: z.ZodNumber;
            service_tier: z.ZodOptional<z.ZodString>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            input_tokens: z.ZodNumber;
            cache_creation_input_tokens: z.ZodOptional<z.ZodNumber>;
            cache_read_input_tokens: z.ZodOptional<z.ZodNumber>;
            output_tokens: z.ZodNumber;
            service_tier: z.ZodOptional<z.ZodString>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            input_tokens: z.ZodNumber;
            cache_creation_input_tokens: z.ZodOptional<z.ZodNumber>;
            cache_read_input_tokens: z.ZodOptional<z.ZodNumber>;
            output_tokens: z.ZodNumber;
            service_tier: z.ZodOptional<z.ZodString>;
        }, z.ZodTypeAny, "passthrough">>>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        usage: z.ZodOptional<z.ZodObject<{
            input_tokens: z.ZodNumber;
            cache_creation_input_tokens: z.ZodOptional<z.ZodNumber>;
            cache_read_input_tokens: z.ZodOptional<z.ZodNumber>;
            output_tokens: z.ZodNumber;
            service_tier: z.ZodOptional<z.ZodString>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            input_tokens: z.ZodNumber;
            cache_creation_input_tokens: z.ZodOptional<z.ZodNumber>;
            cache_read_input_tokens: z.ZodOptional<z.ZodNumber>;
            output_tokens: z.ZodNumber;
            service_tier: z.ZodOptional<z.ZodString>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            input_tokens: z.ZodNumber;
            cache_creation_input_tokens: z.ZodOptional<z.ZodNumber>;
            cache_read_input_tokens: z.ZodOptional<z.ZodNumber>;
            output_tokens: z.ZodNumber;
            service_tier: z.ZodOptional<z.ZodString>;
        }, z.ZodTypeAny, "passthrough">>>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        usage: z.ZodOptional<z.ZodObject<{
            input_tokens: z.ZodNumber;
            cache_creation_input_tokens: z.ZodOptional<z.ZodNumber>;
            cache_read_input_tokens: z.ZodOptional<z.ZodNumber>;
            output_tokens: z.ZodNumber;
            service_tier: z.ZodOptional<z.ZodString>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            input_tokens: z.ZodNumber;
            cache_creation_input_tokens: z.ZodOptional<z.ZodNumber>;
            cache_read_input_tokens: z.ZodOptional<z.ZodNumber>;
            output_tokens: z.ZodNumber;
            service_tier: z.ZodOptional<z.ZodString>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            input_tokens: z.ZodNumber;
            cache_creation_input_tokens: z.ZodOptional<z.ZodNumber>;
            cache_read_input_tokens: z.ZodOptional<z.ZodNumber>;
            output_tokens: z.ZodNumber;
            service_tier: z.ZodOptional<z.ZodString>;
        }, z.ZodTypeAny, "passthrough">>>;
    }, z.ZodTypeAny, "passthrough">>>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    uuid: z.ZodString;
    type: z.ZodLiteral<"assistant">;
    message: z.ZodOptional<z.ZodObject<{
        usage: z.ZodOptional<z.ZodObject<{
            input_tokens: z.ZodNumber;
            cache_creation_input_tokens: z.ZodOptional<z.ZodNumber>;
            cache_read_input_tokens: z.ZodOptional<z.ZodNumber>;
            output_tokens: z.ZodNumber;
            service_tier: z.ZodOptional<z.ZodString>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            input_tokens: z.ZodNumber;
            cache_creation_input_tokens: z.ZodOptional<z.ZodNumber>;
            cache_read_input_tokens: z.ZodOptional<z.ZodNumber>;
            output_tokens: z.ZodNumber;
            service_tier: z.ZodOptional<z.ZodString>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            input_tokens: z.ZodNumber;
            cache_creation_input_tokens: z.ZodOptional<z.ZodNumber>;
            cache_read_input_tokens: z.ZodOptional<z.ZodNumber>;
            output_tokens: z.ZodNumber;
            service_tier: z.ZodOptional<z.ZodString>;
        }, z.ZodTypeAny, "passthrough">>>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        usage: z.ZodOptional<z.ZodObject<{
            input_tokens: z.ZodNumber;
            cache_creation_input_tokens: z.ZodOptional<z.ZodNumber>;
            cache_read_input_tokens: z.ZodOptional<z.ZodNumber>;
            output_tokens: z.ZodNumber;
            service_tier: z.ZodOptional<z.ZodString>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            input_tokens: z.ZodNumber;
            cache_creation_input_tokens: z.ZodOptional<z.ZodNumber>;
            cache_read_input_tokens: z.ZodOptional<z.ZodNumber>;
            output_tokens: z.ZodNumber;
            service_tier: z.ZodOptional<z.ZodString>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            input_tokens: z.ZodNumber;
            cache_creation_input_tokens: z.ZodOptional<z.ZodNumber>;
            cache_read_input_tokens: z.ZodOptional<z.ZodNumber>;
            output_tokens: z.ZodNumber;
            service_tier: z.ZodOptional<z.ZodString>;
        }, z.ZodTypeAny, "passthrough">>>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        usage: z.ZodOptional<z.ZodObject<{
            input_tokens: z.ZodNumber;
            cache_creation_input_tokens: z.ZodOptional<z.ZodNumber>;
            cache_read_input_tokens: z.ZodOptional<z.ZodNumber>;
            output_tokens: z.ZodNumber;
            service_tier: z.ZodOptional<z.ZodString>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            input_tokens: z.ZodNumber;
            cache_creation_input_tokens: z.ZodOptional<z.ZodNumber>;
            cache_read_input_tokens: z.ZodOptional<z.ZodNumber>;
            output_tokens: z.ZodNumber;
            service_tier: z.ZodOptional<z.ZodString>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            input_tokens: z.ZodNumber;
            cache_creation_input_tokens: z.ZodOptional<z.ZodNumber>;
            cache_read_input_tokens: z.ZodOptional<z.ZodNumber>;
            output_tokens: z.ZodNumber;
            service_tier: z.ZodOptional<z.ZodString>;
        }, z.ZodTypeAny, "passthrough">>>;
    }, z.ZodTypeAny, "passthrough">>>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    uuid: z.ZodString;
    type: z.ZodLiteral<"assistant">;
    message: z.ZodOptional<z.ZodObject<{
        usage: z.ZodOptional<z.ZodObject<{
            input_tokens: z.ZodNumber;
            cache_creation_input_tokens: z.ZodOptional<z.ZodNumber>;
            cache_read_input_tokens: z.ZodOptional<z.ZodNumber>;
            output_tokens: z.ZodNumber;
            service_tier: z.ZodOptional<z.ZodString>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            input_tokens: z.ZodNumber;
            cache_creation_input_tokens: z.ZodOptional<z.ZodNumber>;
            cache_read_input_tokens: z.ZodOptional<z.ZodNumber>;
            output_tokens: z.ZodNumber;
            service_tier: z.ZodOptional<z.ZodString>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            input_tokens: z.ZodNumber;
            cache_creation_input_tokens: z.ZodOptional<z.ZodNumber>;
            cache_read_input_tokens: z.ZodOptional<z.ZodNumber>;
            output_tokens: z.ZodNumber;
            service_tier: z.ZodOptional<z.ZodString>;
        }, z.ZodTypeAny, "passthrough">>>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        usage: z.ZodOptional<z.ZodObject<{
            input_tokens: z.ZodNumber;
            cache_creation_input_tokens: z.ZodOptional<z.ZodNumber>;
            cache_read_input_tokens: z.ZodOptional<z.ZodNumber>;
            output_tokens: z.ZodNumber;
            service_tier: z.ZodOptional<z.ZodString>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            input_tokens: z.ZodNumber;
            cache_creation_input_tokens: z.ZodOptional<z.ZodNumber>;
            cache_read_input_tokens: z.ZodOptional<z.ZodNumber>;
            output_tokens: z.ZodNumber;
            service_tier: z.ZodOptional<z.ZodString>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            input_tokens: z.ZodNumber;
            cache_creation_input_tokens: z.ZodOptional<z.ZodNumber>;
            cache_read_input_tokens: z.ZodOptional<z.ZodNumber>;
            output_tokens: z.ZodNumber;
            service_tier: z.ZodOptional<z.ZodString>;
        }, z.ZodTypeAny, "passthrough">>>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        usage: z.ZodOptional<z.ZodObject<{
            input_tokens: z.ZodNumber;
            cache_creation_input_tokens: z.ZodOptional<z.ZodNumber>;
            cache_read_input_tokens: z.ZodOptional<z.ZodNumber>;
            output_tokens: z.ZodNumber;
            service_tier: z.ZodOptional<z.ZodString>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            input_tokens: z.ZodNumber;
            cache_creation_input_tokens: z.ZodOptional<z.ZodNumber>;
            cache_read_input_tokens: z.ZodOptional<z.ZodNumber>;
            output_tokens: z.ZodNumber;
            service_tier: z.ZodOptional<z.ZodString>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            input_tokens: z.ZodNumber;
            cache_creation_input_tokens: z.ZodOptional<z.ZodNumber>;
            cache_read_input_tokens: z.ZodOptional<z.ZodNumber>;
            output_tokens: z.ZodNumber;
            service_tier: z.ZodOptional<z.ZodString>;
        }, z.ZodTypeAny, "passthrough">>>;
    }, z.ZodTypeAny, "passthrough">>>;
}, z.ZodTypeAny, "passthrough">>, z.ZodObject<{
    type: z.ZodLiteral<"summary">;
    summary: z.ZodString;
    leafUuid: z.ZodString;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    type: z.ZodLiteral<"summary">;
    summary: z.ZodString;
    leafUuid: z.ZodString;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    type: z.ZodLiteral<"summary">;
    summary: z.ZodString;
    leafUuid: z.ZodString;
}, z.ZodTypeAny, "passthrough">>, z.ZodObject<{
    type: z.ZodLiteral<"system">;
    uuid: z.ZodString;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    type: z.ZodLiteral<"system">;
    uuid: z.ZodString;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    type: z.ZodLiteral<"system">;
    uuid: z.ZodString;
}, z.ZodTypeAny, "passthrough">>]>;
type RawJSONLines = z.infer<typeof RawJSONLinesSchema>;

/**
 * Common RPC types and interfaces for both session and machine clients
 */
/**
 * Generic RPC handler function type
 * @template TRequest - The request data type
 * @template TResponse - The response data type
 */
type RpcHandler<TRequest = any, TResponse = any> = (data: TRequest) => TResponse | Promise<TResponse>;
/**
 * RPC request data from server
 */
interface RpcRequest {
    method: string;
    params: string;
}
/**
 * Configuration for RPC handler manager
 */
interface RpcHandlerConfig {
    scopePrefix: string;
    encryptionKey: Uint8Array;
    encryptionVariant: 'legacy' | 'dataKey';
    logger?: (message: string, data?: any) => void;
}

/**
 * Generic RPC handler manager for session and machine clients
 * Manages RPC method registration, encryption/decryption, and handler execution
 */

declare class RpcHandlerManager {
    private handlers;
    private readonly scopePrefix;
    private readonly encryptionKey;
    private readonly encryptionVariant;
    private readonly logger;
    private socket;
    constructor(config: RpcHandlerConfig);
    /**
     * Register an RPC handler for a specific method
     * @param method - The method name (without prefix)
     * @param handler - The handler function
     */
    registerHandler<TRequest = any, TResponse = any>(method: string, handler: RpcHandler<TRequest, TResponse>): void;
    /**
     * Handle an incoming RPC request
     * @param request - The RPC request data
     * @param callback - The response callback
     */
    handleRequest(request: RpcRequest): Promise<any>;
    onSocketConnect(socket: Socket): void;
    onSocketDisconnect(): void;
    /**
     * Get the number of registered handlers
     */
    getHandlerCount(): number;
    /**
     * Check if a handler is registered
     * @param method - The method name (without prefix)
     */
    hasHandler(method: string): boolean;
    /**
     * Clear all handlers
     */
    clearHandlers(): void;
    /**
     * Get the prefixed method name
     * @param method - The method name
     */
    private getPrefixedMethod;
}

declare class ApiSessionClient extends EventEmitter {
    private readonly token;
    readonly sessionId: string;
    private metadata;
    private metadataVersion;
    private agentState;
    private agentStateVersion;
    private socket;
    private pendingMessages;
    private pendingMessageCallback;
    readonly rpcHandlerManager: RpcHandlerManager;
    private agentStateLock;
    private metadataLock;
    private encryptionKey;
    private encryptionVariant;
    constructor(token: string, session: Session);
    onUserMessage(callback: (data: UserMessage) => void): void;
    /**
     * Send message to session
     * @param body - Message body (can be MessageContent or raw content for agent messages)
     */
    sendClaudeSessionMessage(body: RawJSONLines): void;
    sendCodexMessage(body: any): void;
    /**
     * Send a generic agent message to the session.
     * Works for any agent type (Gemini, Codex, Claude, etc.)
     *
     * @param agentType - The type of agent sending the message (e.g., 'gemini', 'codex', 'claude')
     * @param body - The message payload
     */
    sendAgentMessage(agentType: 'gemini' | 'codex' | 'claude' | 'opencode', body: any): void;
    sendSessionEvent(event: {
        type: 'switch';
        mode: 'local' | 'remote';
    } | {
        type: 'message';
        message: string;
    } | {
        type: 'permission-mode-changed';
        mode: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan';
    } | {
        type: 'ready';
    }, id?: string): void;
    /**
     * Send a ping message to keep the connection alive
     */
    keepAlive(thinking: boolean, mode: 'local' | 'remote'): void;
    /**
     * Send session death message
     */
    sendSessionDeath(): void;
    /**
     * Send usage data to the server
     */
    sendUsageData(usage: Usage): void;
    /**
     * Update session metadata
     * @param handler - Handler function that returns the updated metadata
     */
    updateMetadata(handler: (metadata: Metadata) => Metadata): void;
    /**
     * Update session agent state
     * @param handler - Handler function that returns the updated agent state
     */
    updateAgentState(handler: (metadata: AgentState) => AgentState): void;
    /**
     * Wait for socket buffer to flush
     */
    flush(): Promise<void>;
    close(): Promise<void>;
}

type PermissionMode = 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan';

/**
 * Usage data type from Claude
 */
type Usage = z.infer<typeof UsageSchema>;
/**
 * Session information
 */
type Session = {
    id: string;
    seq: number;
    encryptionKey: Uint8Array;
    encryptionVariant: 'legacy' | 'dataKey';
    metadata: Metadata;
    metadataVersion: number;
    agentState: AgentState | null;
    agentStateVersion: number;
};
/**
 * Machine metadata - static information (rarely changes)
 */
declare const MachineMetadataSchema: z.ZodObject<{
    host: z.ZodString;
    platform: z.ZodString;
    happyCliVersion: z.ZodString;
    homeDir: z.ZodString;
    happyHomeDir: z.ZodString;
    happyLibDir: z.ZodString;
}, "strip", z.ZodTypeAny, {
    host: string;
    platform: string;
    happyCliVersion: string;
    homeDir: string;
    happyHomeDir: string;
    happyLibDir: string;
}, {
    host: string;
    platform: string;
    happyCliVersion: string;
    homeDir: string;
    happyHomeDir: string;
    happyLibDir: string;
}>;
type MachineMetadata = z.infer<typeof MachineMetadataSchema>;
/**
 * Daemon state - dynamic runtime information (frequently updated)
 */
declare const DaemonStateSchema: z.ZodObject<{
    status: z.ZodUnion<[z.ZodEnum<["running", "shutting-down"]>, z.ZodString]>;
    pid: z.ZodOptional<z.ZodNumber>;
    httpPort: z.ZodOptional<z.ZodNumber>;
    startedAt: z.ZodOptional<z.ZodNumber>;
    shutdownRequestedAt: z.ZodOptional<z.ZodNumber>;
    shutdownSource: z.ZodOptional<z.ZodUnion<[z.ZodEnum<["mobile-app", "cli", "os-signal", "unknown"]>, z.ZodString]>>;
}, "strip", z.ZodTypeAny, {
    status: string;
    pid?: number | undefined;
    httpPort?: number | undefined;
    startedAt?: number | undefined;
    shutdownRequestedAt?: number | undefined;
    shutdownSource?: string | undefined;
}, {
    status: string;
    pid?: number | undefined;
    httpPort?: number | undefined;
    startedAt?: number | undefined;
    shutdownRequestedAt?: number | undefined;
    shutdownSource?: string | undefined;
}>;
type DaemonState = z.infer<typeof DaemonStateSchema>;
type Machine = {
    id: string;
    encryptionKey: Uint8Array;
    encryptionVariant: 'legacy' | 'dataKey';
    metadata: MachineMetadata;
    metadataVersion: number;
    daemonState: DaemonState | null;
    daemonStateVersion: number;
};
declare const UserMessageSchema: z.ZodObject<{
    role: z.ZodLiteral<"user">;
    content: z.ZodObject<{
        type: z.ZodLiteral<"text">;
        text: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type: "text";
        text: string;
    }, {
        type: "text";
        text: string;
    }>;
    localKey: z.ZodOptional<z.ZodString>;
    meta: z.ZodOptional<z.ZodObject<{
        sentFrom: z.ZodOptional<z.ZodString>;
        permissionMode: z.ZodOptional<z.ZodString>;
        model: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        fallbackModel: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        customSystemPrompt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        appendSystemPrompt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        allowedTools: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString, "many">>>;
        disallowedTools: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString, "many">>>;
    }, "strip", z.ZodTypeAny, {
        sentFrom?: string | undefined;
        permissionMode?: string | undefined;
        model?: string | null | undefined;
        fallbackModel?: string | null | undefined;
        customSystemPrompt?: string | null | undefined;
        appendSystemPrompt?: string | null | undefined;
        allowedTools?: string[] | null | undefined;
        disallowedTools?: string[] | null | undefined;
    }, {
        sentFrom?: string | undefined;
        permissionMode?: string | undefined;
        model?: string | null | undefined;
        fallbackModel?: string | null | undefined;
        customSystemPrompt?: string | null | undefined;
        appendSystemPrompt?: string | null | undefined;
        allowedTools?: string[] | null | undefined;
        disallowedTools?: string[] | null | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    content: {
        type: "text";
        text: string;
    };
    role: "user";
    localKey?: string | undefined;
    meta?: {
        sentFrom?: string | undefined;
        permissionMode?: string | undefined;
        model?: string | null | undefined;
        fallbackModel?: string | null | undefined;
        customSystemPrompt?: string | null | undefined;
        appendSystemPrompt?: string | null | undefined;
        allowedTools?: string[] | null | undefined;
        disallowedTools?: string[] | null | undefined;
    } | undefined;
}, {
    content: {
        type: "text";
        text: string;
    };
    role: "user";
    localKey?: string | undefined;
    meta?: {
        sentFrom?: string | undefined;
        permissionMode?: string | undefined;
        model?: string | null | undefined;
        fallbackModel?: string | null | undefined;
        customSystemPrompt?: string | null | undefined;
        appendSystemPrompt?: string | null | undefined;
        allowedTools?: string[] | null | undefined;
        disallowedTools?: string[] | null | undefined;
    } | undefined;
}>;
type UserMessage = z.infer<typeof UserMessageSchema>;
type Metadata = {
    path: string;
    host: string;
    version?: string;
    name?: string;
    os?: string;
    summary?: {
        text: string;
        updatedAt: number;
    };
    machineId?: string;
    claudeSessionId?: string;
    tools?: string[];
    slashCommands?: string[];
    homeDir: string;
    happyHomeDir: string;
    happyLibDir: string;
    happyToolsDir: string;
    startedFromDaemon?: boolean;
    hostPid?: number;
    startedBy?: 'daemon' | 'terminal';
    lifecycleState?: 'running' | 'archiveRequested' | 'archived' | string;
    lifecycleStateSince?: number;
    archivedBy?: string;
    archiveReason?: string;
    flavor?: string;
};
type AgentState = {
    controlledByUser?: boolean | null | undefined;
    requests?: {
        [id: string]: {
            tool: string;
            arguments: any;
            createdAt: number;
        };
    };
    completedRequests?: {
        [id: string]: {
            tool: string;
            arguments: any;
            createdAt: number;
            completedAt: number;
            status: 'canceled' | 'denied' | 'approved';
            reason?: string;
            mode?: PermissionMode;
            decision?: 'approved' | 'approved_for_session' | 'denied' | 'abort';
            allowTools?: string[];
        };
    };
};

interface SpawnSessionOptions {
    machineId?: string;
    directory: string;
    sessionId?: string;
    approvedNewDirectoryCreation?: boolean;
    agent?: 'claude' | 'codex' | 'gemini';
    token?: string;
}
type SpawnSessionResult = {
    type: 'success';
    sessionId: string;
} | {
    type: 'requestToApproveDirectoryCreation';
    directory: string;
} | {
    type: 'error';
    errorMessage: string;
};

/**
 * WebSocket client for machine/daemon communication with Happy server
 * Similar to ApiSessionClient but for machine-scoped connections
 */

type MachineRpcHandlers = {
    spawnSession: (options: SpawnSessionOptions) => Promise<SpawnSessionResult>;
    stopSession: (sessionId: string) => boolean;
    requestShutdown: () => void;
};
declare class ApiMachineClient {
    private token;
    private machine;
    private socket;
    private keepAliveInterval;
    private rpcHandlerManager;
    constructor(token: string, machine: Machine);
    setRPCHandlers({ spawnSession, stopSession, requestShutdown }: MachineRpcHandlers): void;
    /**
     * Update machine metadata
     * Currently unused, changes from the mobile client are more likely
     * for example to set a custom name.
     */
    updateMachineMetadata(handler: (metadata: MachineMetadata | null) => MachineMetadata): Promise<void>;
    /**
     * Update daemon state (runtime info) - similar to session updateAgentState
     * Simplified without lock - relies on backoff for retry
     */
    updateDaemonState(handler: (state: DaemonState | null) => DaemonState): Promise<void>;
    connect(): void;
    private startKeepAlive;
    private stopKeepAlive;
    shutdown(): void;
}

interface PushToken {
    id: string;
    token: string;
    createdAt: number;
    updatedAt: number;
}
declare class PushNotificationClient {
    private readonly token;
    private readonly baseUrl;
    private readonly expo;
    constructor(token: string, baseUrl?: string);
    /**
     * Fetch all push tokens for the authenticated user
     */
    fetchPushTokens(): Promise<PushToken[]>;
    /**
     * Send push notification via Expo Push API with retry
     * @param messages - Array of push messages to send
     */
    sendPushNotifications(messages: ExpoPushMessage[]): Promise<void>;
    /**
     * Send a push notification to all registered devices for the user
     * @param title - Notification title
     * @param body - Notification body
     * @param data - Additional data to send with the notification
     */
    sendToAllDevices(title: string, body: string, data?: Record<string, any>): void;
}

/**
 * Minimal persistence functions for happy CLI
 *
 * Handles settings and private key storage in ~/.happy/ or local .happy/
 */

type Credentials = {
    token: string;
    encryption: {
        type: 'legacy';
        secret: Uint8Array;
    } | {
        type: 'dataKey';
        publicKey: Uint8Array;
        machineKey: Uint8Array;
    };
};

declare class ApiClient {
    static create(credential: Credentials): Promise<ApiClient>;
    private readonly credential;
    private readonly pushClient;
    private constructor();
    /**
     * Create a new session or load existing one with the given tag
     */
    getOrCreateSession(opts: {
        tag: string;
        metadata: Metadata;
        state: AgentState | null;
    }): Promise<Session>;
    /**
     * Register or update machine with the server
     * Returns the current machine state from the server with decrypted metadata and daemonState
     */
    getOrCreateMachine(opts: {
        machineId: string;
        metadata: MachineMetadata;
        daemonState?: DaemonState;
    }): Promise<Machine>;
    sessionSyncClient(session: Session): ApiSessionClient;
    machineSyncClient(machine: Machine): ApiMachineClient;
    push(): PushNotificationClient;
    /**
     * Register a vendor API token with the server
     * The token is sent as a JSON string - server handles encryption
     */
    registerVendorToken(vendor: 'openai' | 'anthropic' | 'gemini', apiKey: any): Promise<void>;
    /**
     * Get vendor API token from the server
     * Returns the token if it exists, null otherwise
     */
    getVendorToken(vendor: 'openai' | 'anthropic' | 'gemini'): Promise<any | null>;
}

/**
 * Design decisions:
 * - Logging should be done only through file for debugging, otherwise we might disturb the claude session when in interactive mode
 * - Use info for logs that are useful to the user - this is our UI
 * - File output location: ~/.handy/logs/<date time in local timezone>.log
 */
declare class Logger {
    readonly logFilePath: string;
    private dangerouslyUnencryptedServerLoggingUrl;
    constructor(logFilePath?: string);
    localTimezoneTimestamp(): string;
    debug(message: string, ...args: unknown[]): void;
    debugLargeJson(message: string, object: unknown, maxStringLength?: number, maxArrayLength?: number): void;
    info(message: string, ...args: unknown[]): void;
    infoDeveloper(message: string, ...args: unknown[]): void;
    warn(message: string, ...args: unknown[]): void;
    getLogPath(): string;
    private logToConsole;
    private sendToRemoteServer;
    private logToFile;
}
declare let logger: Logger;

/**
 * Global configuration for happy CLI
 *
 * Centralizes all configuration including environment variables and paths
 * Environment files should be loaded using Node's --env-file flag
 */
declare class Configuration {
    readonly serverUrl: string;
    readonly webappUrl: string;
    readonly isDaemonProcess: boolean;
    readonly happyHomeDir: string;
    readonly logsDir: string;
    readonly settingsFile: string;
    readonly privateKeyFile: string;
    readonly daemonStateFile: string;
    readonly daemonLockFile: string;
    readonly currentCliVersion: string;
    readonly isExperimentalEnabled: boolean;
    readonly disableCaffeinate: boolean;
    readonly apiKey: string | null;
    constructor();
}
declare const configuration: Configuration;

export { ApiClient, ApiSessionClient, RawJSONLinesSchema, configuration, logger };
export type { RawJSONLines };
