import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { execSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
  cpSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const PI_AGENT_DIR = join(homedir(), ".pi", "agent");
const PROFILES_DIR = join(homedir(), ".pi", "profiles");
const LOCAL_BIN = join(homedir(), ".local", "bin");

function log(msg: string) {
  process.stdout.write(msg + "\n");
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand("department", {
    description:
      "Create a new Pi profile agent (department) from the current agent config. " +
      "Usage: /department <name> [--isolated-auth]",
    handler: async (args: string, ctx) => {
      const parts = args.trim().split(/\s+/);
      const name = parts.find((p) => !p.startsWith("--")) ?? "";
      const isolatedAuth = parts.includes("--isolated-auth");

      if (!name) {
        const usage =
          "Usage: /department <name> [--isolated-auth]\n" +
          "  <name>            Department name (e.g., 'dev' → creates 'pi-dev')\n" +
          "  --isolated-auth  Don't symlink auth; create an isolated auth file";
        if (ctx.hasUI) ctx.ui.notify(usage, "error");
        else log(usage);
        return;
      }

      if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
        const msg = `Invalid department name "${name}". Use only letters, numbers, hyphens, and underscores.`;
        if (ctx.hasUI) ctx.ui.notify(msg, "error");
        else log(msg);
        return;
      }

      const agentName = `pi-${name}`;
      const profileDir = join(PROFILES_DIR, agentName);
      const agentDir = join(profileDir, ".pi", "agent");
      const binPath = join(LOCAL_BIN, agentName);

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
          log(`Department "${agentName}" already exists.`);
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

      // 2. Copy only skills/ and models.json from the main agent
      const skillsSrc = join(PI_AGENT_DIR, "skills");
      if (existsSync(skillsSrc)) {
        cpSync(skillsSrc, join(agentDir, "skills"), { recursive: true, force: true });
      }

      const modelsSrc = join(PI_AGENT_DIR, "models.json");
      if (existsSync(modelsSrc)) {
        writeFileSync(join(agentDir, "models.json"), readFileSync(modelsSrc));
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

      // 4. Create empty subdirectories for everything else
      for (const sub of ["extensions", "skills", "agents", "sessions", "memory", "git"]) {
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
        `    • models.json`,
        `    • skills/`,
        ``,
        `  Created fresh for this department:`,
        `    • settings.json  (pi generates a default one on first run)`,
        `    • extensions/`,
        `    • agents/`,
        `    • sessions/`,
        `    • memory/`,
        `    • git/`,
        ``,
      ].join("\n");

      notify(summary);
    },
  });
}
