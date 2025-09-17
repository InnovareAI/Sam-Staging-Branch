#!/usr/bin/env node

/**
 * MCP Directory Monitor Agent
 * Enforces strict SAM AI project directory boundaries
 * Prevents cross-project contamination and deployment errors
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CRITICAL: SAM AI project boundaries
const ALLOWED_PROJECT_ROOT = "/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7";
const FORBIDDEN_PATHS = [
  "/Users/tvonlinz/Dev_Master/3cubed",
  "/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/../",
  "/Users/tvonlinz/package-lock.json" // Parent directory lockfile
];

class DirectoryMonitor {
  constructor() {
    this.violations = [];
    this.sessionActive = true;
  }

  /**
   * Validate if path is within SAM AI project boundaries
   */
  validatePath(targetPath) {
    try {
      const resolvedPath = path.resolve(targetPath);
      
      // Check if path is within allowed project root
      if (!resolvedPath.startsWith(ALLOWED_PROJECT_ROOT)) {
        return {
          valid: false,
          error: `🚨 CRITICAL VIOLATION: Path outside SAM AI project`,
          details: {
            attempted: resolvedPath,
            required: ALLOWED_PROJECT_ROOT,
            violation_type: "BOUNDARY_BREACH"
          }
        };
      }

      // Check against explicitly forbidden paths
      for (const forbidden of FORBIDDEN_PATHS) {
        if (resolvedPath.startsWith(forbidden)) {
          return {
            valid: false,
            error: `⛔ FORBIDDEN PATH: Access denied`,
            details: {
              attempted: resolvedPath,
              forbidden: forbidden,
              violation_type: "FORBIDDEN_ACCESS"
            }
          };
        }
      }

      return { valid: true, path: resolvedPath };
    } catch (error) {
      return {
        valid: false,
        error: `❌ PATH RESOLUTION ERROR: ${error.message}`,
        details: { violation_type: "INVALID_PATH" }
      };
    }
  }

  /**
   * Log violation and determine if session should terminate
   */
  recordViolation(violation) {
    this.violations.push({
      ...violation,
      timestamp: new Date().toISOString()
    });

    // Critical violations terminate session immediately
    if (violation.details?.violation_type === "BOUNDARY_BREACH") {
      this.sessionActive = false;
      return {
        terminate: true,
        message: "🔴 SESSION TERMINATED: Critical directory boundary violation detected"
      };
    }

    // Multiple violations trigger termination
    if (this.violations.length >= 3) {
      this.sessionActive = false;
      return {
        terminate: true,
        message: `🔴 SESSION TERMINATED: ${this.violations.length} violations detected`
      };
    }

    return {
      terminate: false,
      message: `🟠 WARNING: Violation ${this.violations.length}/3 recorded`
    };
  }

  /**
   * Get current session status and violation summary
   */
  getStatus() {
    return {
      session_active: this.sessionActive,
      current_directory: process.cwd(),
      allowed_root: ALLOWED_PROJECT_ROOT,
      violations_count: this.violations.length,
      recent_violations: this.violations.slice(-5),
      directory_valid: this.validatePath(process.cwd()).valid
    };
  }
}

// Initialize monitor
const monitor = new DirectoryMonitor();

// Create MCP server
const server = new Server(
  {
    name: "directory-monitor",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "validate_path",
        description: "Validate if a file path is within SAM AI project boundaries",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "File or directory path to validate"
            },
            operation: {
              type: "string", 
              description: "Operation type (read, write, execute, deploy)",
              enum: ["read", "write", "execute", "deploy"]
            }
          },
          required: ["path"]
        }
      },
      {
        name: "get_monitor_status",
        description: "Get current monitoring status and violation history",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "check_current_directory",
        description: "Verify current working directory is within project bounds",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "reset_violations",
        description: "Reset violation counter (use with caution)",
        inputSchema: {
          type: "object",
          properties: {
            confirm: {
              type: "boolean",
              description: "Confirm reset action"
            }
          },
          required: ["confirm"]
        }
      }
    ]
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "validate_path": {
      const { path: targetPath, operation = "read" } = args;
      const validation = monitor.validatePath(targetPath);

      if (!validation.valid) {
        const violation = {
          path: targetPath,
          operation,
          error: validation.error,
          details: validation.details
        };
        
        const response = monitor.recordViolation(violation);
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                valid: false,
                error: validation.error,
                violation_details: validation.details,
                session_status: response,
                recommendation: response.terminate 
                  ? "TERMINATE SESSION IMMEDIATELY"
                  : "STAY WITHIN SAM AI PROJECT BOUNDARIES"
              }, null, 2)
            }
          ]
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              valid: true,
              validated_path: validation.path,
              operation,
              status: "✅ Path within SAM AI project boundaries"
            }, null, 2)
          }
        ]
      };
    }

    case "get_monitor_status": {
      const status = monitor.getStatus();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(status, null, 2)
          }
        ]
      };
    }

    case "check_current_directory": {
      const currentDir = process.cwd();
      const validation = monitor.validatePath(currentDir);
      
      return {
        content: [
          {
            type: "text", 
            text: JSON.stringify({
              current_directory: currentDir,
              valid: validation.valid,
              status: validation.valid ? "✅ In SAM AI project" : "🚨 OUTSIDE PROJECT BOUNDARIES",
              error: validation.error || null
            }, null, 2)
          }
        ]
      };
    }

    case "reset_violations": {
      const { confirm } = args;
      if (!confirm) {
        throw new McpError(ErrorCode.InvalidParams, "Must confirm reset action");
      }
      
      monitor.violations = [];
      monitor.sessionActive = true;
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              status: "✅ Violations reset",
              message: "Monitor reset - stay within project boundaries"
            }, null, 2)
          }
        ]
      };
    }

    default:
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("🔒 Directory Monitor Agent: SAM AI project boundary enforcement active");
}

main().catch(console.error);