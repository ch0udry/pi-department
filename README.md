# pi-department

Create isolated Pi profile agents ("departments") from your main agent configuration.

## What it does

The `/department` command creates a new Pi profile agent with its own:

- **Config** — copied from your main `~/.pi/agent`
- **Auth** — symlinked by default (or isolated with `--isolated-auth`)
- **Sessions** — separate session history per department
- **Memory** — separate memory store per department
- **Extensions/Skills/Agents** — fresh directories for department-specific additions
- **Launcher** — a `~/.local/bin/pi-<name>` script so you can run it by just typing the name

## Installation

```bash
pi install git:github.com/<your-username>/pi-department
```

Then reload pi with `/reload`.

## Usage

```bash
# Create a dev department
/department dev

# Create a research department
/department research

# Create a department with isolated auth (no symlink to main auth)
/department sandbox --isolated-auth
```

After creation, just type the department name in your terminal:

```bash
pi-dev      # Launches the dev department
pi-research # Launches the research department
```

Or set the environment variable directly:

```bash
PI_CODING_AGENT_DIR="$HOME/.pi/profiles/pi-dev/.pi/agent" pi
```

## How it works

Each department lives at `~/.pi/profiles/pi-<name>/` and contains:

```
~/.pi/profiles/pi-<name>/
└── .pi/
    └── agent/
        ├── settings.json    # Copied from main agent
        ├── models.json      # Copied from main agent
        ├── orchestrator.json # Copied from main agent
        ├── auth.json        # Symlinked to main (or isolated)
        ├── extensions/      # Copied from main agent
        ├── skills/          # Copied from main agent
        ├── agents/          # Fresh
        ├── sessions/        # Fresh — separate session history
        ├── memory/          # Fresh — separate memory
        └── git/             # Fresh — separate git-based packages
```

The launcher script at `~/.local/bin/pi-<name>` sets `PI_CODING_AGENT_DIR` and runs `pi`.
