# pi-department

Create isolated Pi profile agents ("departments") from your main agent configuration.

## What it does

The `/department` command creates a new Pi profile agent with its own:

- **models.json** — copied from your main agent
- **skills/** — copied from your main agent
- **Auth** — symlinked by default (or isolated with `--isolated-auth`)
- **Everything else** — starts fresh (separate sessions, memory, extensions, agents, git packages)
- **Launcher** — a `~/.local/bin/pi-<name>` script so you can run it by just typing the name

## Installation

```bash
pi install git:github.com/ch0udry/pi-department
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

## How it works

Each department lives at `~/.pi/profiles/pi-<name>/` and starts clean:

```
~/.pi/profiles/pi-<name>/
└── .pi/
    └── agent/
        ├── models.json      # Copied from main agent
        ├── auth.json        # Symlinked to main (or isolated)
        ├── skills/          # Copied from main agent
        ├── extensions/      # Fresh
        ├── agents/          # Fresh
        ├── sessions/        # Fresh — separate session history
        ├── memory/          # Fresh — separate memory
        └── git/             # Fresh — separate git-based packages
```

The launcher script at `~/.local/bin/pi-<name>` sets `PI_CODING_AGENT_DIR` and runs `pi`.
