Shared agent resources

This repository contains the selected OpenCode agents, skills, and the `tuicr`
CLI plugin. It is intended to be cloned on each system that should share these
resources.

## OpenCode

From this checkout, run:

```bash
node scripts/sync-opencode.mjs
```

The command requires GNU Stow (`brew install stow` on macOS).

The sync command:

- keeps the OpenCode `agents/` and `skills/` directories in place;
- backs up conflicting selected resources with a timestamped suffix;
- symlinks the selected resource contents into those directories with GNU Stow;
- adds or updates the checkout's `tuicr` plugin path in the local
  `~/.config/opencode/cli.json` (or the `$XDG_CONFIG_HOME` equivalent).

It preserves unrelated CLI settings and plugin entries. Because only selected
resources are linked, system-specific agents and skills remain in place.
If an earlier version of this script created whole-root symlinks, rerunning the
command restores the latest timestamped root backups before creating the
content-level links.

To remove the Stow-created resource links later, run the inverse command from
this checkout:

```bash
stow -D --no-folding \
  --dir "$PWD" \
  --target "${XDG_CONFIG_HOME:-$HOME/.config}/opencode" \
  --ignore='^(README\.md|settings\.json|scripts|tui-plugins)(/|$)' \
  .
```

The repository does not contain machine-specific OpenCode settings. The `tuicr`
plugin is loaded directly from this checkout rather than copied into the global
OpenCode plugin directory.

## Pi and shared Agent Skills

```bash
stow -t ~/.pi/agent .
```

```bash
stow -t ~/.agents .
```
