import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { execSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  symlinkSync,
  writeFileSync,
  cpSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const PI_AGENT_DIR = join(homedir(), ".pi", "agent");
const PROFILES_DIR = join(homedir(), ".pi", "profiles");
const LOCAL_BIN = join(homedir(), ".local", "bin");

/**
 * Items to skip when copying from the source agent directory.
 * These are either large runtime caches, session-specific data,
 * or things we recreate fresh for each department.
 */
const SKIP_ENTRIES = new Set([
  "sessions",
  "memory",
  "projects-memory",
  ".extmgr-cache",
  "bin",
  "git",
  "skills",
  "agents",
  "context-prune",
  "pi-crash.log",
  ".vstack-update-cache.json",
]);

function log(msg: string) {
  // Fallback output for non-interactive modes
  process.stdout.write(msg + "\n");
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand("department", {
    description:
      "Create a new Pi profile agent (department) from the current agent config. " +
      "Usage: /department <name> [--isolated-auth]",
    handler: async (args: string, ctx) => {
      // Parse args: extract name and flags
      const parts = args.trim().split(/\s+/);
      const name = parts.find((p) => !p.startsWith("--")) ?? "";
      const isolatedAuth = parts.includes("--isolated-auth");

      if (!name) {
        const usage =
          "Usage: /department <name> [--isolated-auth]\n" +
          "  <name>            Department name (e.g., 'dev' → creates 'pi-dev')\n" +
          "  --isolated-auth  Don't symlink auth; create an isolated auth file";
        if (ctx.hasUI) {
          ctx.ui.notify(usage, "error");
        } else {
          log(usage);
        }
        return;
      }

      // Validate name: alphanumeric, hyphens, underscores only
      if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
        const msg = `Invalid department name "${name}". Use only letters, numbers, hyphens, and underscores.`;
        if (ctx.hasUI) {
          ctx.ui.notify(msg, "error");
        } else {
          log(msg);
        }
        return;
      }

      const agentName = `pi-${name}`;
      const profileDir = join(PROFILES_DIR, agentName);
      const agentDir = join(profileDir, ".pi", "agent");
      const binPath = join(LOCAL_BIN, agentName);

      // Check if already exists
      if (existsSync(profileDir)) {
        if (ctx.hasUI) {
          const ok = await ctx.ui.confirm(
            "Overwrite?",
            `Department "${agentName}" already exists at ${profileDir}. Overwrite?`,
          );
          if (!ok) {
            ctx.ui.notify("Cancelled.", "info");
            return;
          }
        } else {
          log(`Department "${agentName}" already exists. Use --force to overwrite.`);
          return;
        }
      }

      const notify = (msg: string) => {
        if (ctx.hasUI) ctx.ui.notify(msg, "info");
        else log(msg);
      };

      notify(`Creating department "${agentName}"...`);

      // 1. Create the profile directory structure
      mkdirSync(agentDir, { recursive: true });

      // 2. Copy config/resources from ~/.pi/agent (top-level files only)
      const sourceEntries = readdirSync(PI_AGENT_DIR);
      for (const entry of sourceEntries) {
        const srcPath = join(PI_AGENT_DIR, entry);
        const dstPath = join(agentDir, entry);

        if (SKIP_ENTRIES.has(entry)) continue;
        if (entry === "auth.json") continue; // handled separately

        if (statSync(srcPath).isDirectory()) {
          cpSync(srcPath, dstPath, { recursive: true, force: true });
        } else {
          writeFileSync(dstPath, readFileSync(srcPath));
        }
      }

      // 3. Handle auth
      if (isolatedAuth) {
        writeFileSync(join(agentDir, "auth.json"), "{}");
      } else {
        const sourceAuth = join(PI_AGENT_DIR, "auth.json");
        if (existsSync(sourceAuth)) {
          symlinkSync(sourceAuth, join(agentDir, "auth.json"));
        }
      }

      // 4. Create empty subdirectories for department-specific data
      for (const sub of ["skills", "agents", "sessions", "memory", "git"]) {
        mkdirSync(join(agentDir, sub), { recursive: true });
      }

      // 5. Create the launcher script
      const launcherContent = `#!/usr/bin/env bash
# Pi department: ${agentName}
# Created by /department ${name}
export PI_CODING_AGENT_DIR="${agentDir}"
exec pi "$@"
`;
      writeFileSync(binPath, launcherContent, { mode: 0o755 });

      // 6. Verify the launcher works
      let verified = false;
      let verifyMsg = "";
      try {
        const result = execSync(`${binPath} --version`, {
          timeout: 10000,
          encoding: "utf-8",
        });
        verified = true;
        verifyMsg = result.trim();
      } catch (e: unknown) {
        const err = e as Error;
        verifyMsg = `Warning: ${err.message}`;
      }

      // 7. Summary
      const summary = [
        `━━━ Department Created: ${agentName} ━━━`,
        ``,
        `  Profile root:  ${profileDir}`,
        `  Agent config:  ${agentDir}`,
        `  Launcher:      ${binPath}`,
        `  Auth:          ${isolatedAuth ? "Isolated (new empty auth.json)" : "Symlinked to main agent"}`,
        ``,
        `  To use, just type:  ${agentName}`,
        `  Or set:            PI_CODING_AGENT_DIR="${agentDir}" pi`,
        ``,
        `  ${verified ? "✓ Verified: pi " + verifyMsg : "⚠ " + verifyMsg}`,
        ``,
        `  Copied from main agent:`,
        `    • settings.json, models.json, orchestrator.json`,
        `    • extensions/`,
        `    • skills/`,
        ``,
        `  Created fresh for this department:`,
        `    • agents/      (add department-specific agents here)`,
        `    • sessions/    (separate session history)`,
        `    • memory/      (separate memory store)`,
        ``,
      ].join("\n");

      notify(summary);
    },
  });
}
