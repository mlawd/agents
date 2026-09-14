#!/usr/bin/env node

import {
  chmodSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs"
import { spawnSync } from "node:child_process"
import { homedir } from "node:os"
import { basename, dirname, join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const xdgConfigHome = process.env.XDG_CONFIG_HOME || join(homedir(), ".config")
const opencodeDir = resolve(xdgConfigHome, "opencode")
const cliPath = join(opencodeDir, "cli.json")
const tuicrPath = join(repoRoot, "tui-plugins", "tuicr")
const legacyTuicrPath = join(opencodeDir, "tui-plugins", "tuicr")
const tuicrUrl = pathToFileURL(tuicrPath).href
const legacyTuicrUrl = pathToFileURL(legacyTuicrPath).href
const stowIgnore = "^(README\\.md|settings\\.json|scripts|tui-plugins)(/|$)"
const linkedResources = [
  "agents/wayfinder.md",
  "agents/warden.md",
  "skills/brainstorm/SKILL.md",
  "skills/comment-analyser/SKILL.md",
  "skills/orchestrate/SKILL.md",
]

function pathExists(path) {
  try {
    lstatSync(path)
    return true
  } catch (error) {
    if (error.code === "ENOENT") return false
    throw error
  }
}

function backupPath(path, stamp) {
  let candidate = `${path}.backup.${stamp}`
  let suffix = 1
  while (pathExists(candidate)) {
    candidate = `${path}.backup.${stamp}.${suffix}`
    suffix += 1
  }
  return candidate
}

function latestRootBackup(target) {
  const prefix = `${basename(target)}.backup.`
  const candidates = readdirSync(dirname(target))
    .filter((name) => name.startsWith(prefix))
    .map((name) => join(dirname(target), name))
    .filter((path) => pathExists(path) && lstatSync(path).isDirectory())
    .sort()
    .reverse()
  return candidates[0]
}

function ensureResourceRoot(name) {
  const target = join(opencodeDir, name)
  if (pathExists(target) && lstatSync(target).isSymbolicLink()) {
    const source = join(repoRoot, name)
    const linkedTarget = resolve(dirname(target), readlinkSync(target))
    if (linkedTarget !== resolve(source)) {
      throw new Error(`${target} is a symlink to an unexpected location; restore it before syncing`)
    }

    const backup = latestRootBackup(target)
    unlinkSync(target)
    if (backup) {
      renameSync(backup, target)
      console.log(`restored ${target} from ${backup}`)
    } else {
      mkdirSync(target)
      console.log(`recreated ${target}; no legacy backup was found`)
    }
  }
  mkdirSync(target, { recursive: true })
}

function isLinkedToSource(relativePath) {
  const source = join(repoRoot, relativePath)
  const target = join(opencodeDir, relativePath)
  if (!pathExists(target) || !lstatSync(target).isSymbolicLink()) return false
  return resolve(dirname(target), readlinkSync(target)) === resolve(source)
}

function backupConflicts(stamp) {
  for (const relativePath of linkedResources) {
    const source = join(repoRoot, relativePath)
    const target = join(opencodeDir, relativePath)

    if (!pathExists(source)) {
      throw new Error(`Missing repository resource: ${source}`)
    }
    if (isLinkedToSource(relativePath) || !pathExists(target)) continue

    const backup = backupPath(target, stamp)
    renameSync(target, backup)
    console.log(`backed up ${target} -> ${backup}`)
  }
}

function stowResources() {
  const result = spawnSync(
    "stow",
    [
      "--no-folding",
      "--dir",
      repoRoot,
      "--target",
      opencodeDir,
      `--ignore=${stowIgnore}`,
      ".",
    ],
    { stdio: "inherit" },
  )

  if (result.error) {
    throw new Error(`Unable to run GNU Stow: ${result.error.message}`)
  }
  if (result.status !== 0) {
    throw new Error(`GNU Stow exited with status ${result.status}`)
  }
}

function pluginValue(entry) {
  if (typeof entry === "string") return entry
  if (entry && typeof entry === "object" && typeof entry.package === "string") {
    return entry.package
  }
  return undefined
}

function isTuicrEntry(entry) {
  const value = pluginValue(entry)
  if (!value) return false
  if (value === tuicrUrl || value === legacyTuicrUrl || value === "tuicr") return true
  if (!value.startsWith("file:")) return false

  try {
    const path = resolve(fileURLToPath(value))
    return path === resolve(tuicrPath) || path === resolve(legacyTuicrPath)
  } catch {
    return false
  }
}

function updateCliConfig() {
  if (!pathExists(tuicrPath)) {
    throw new Error(`Missing repository plugin: ${tuicrPath}`)
  }

  mkdirSync(opencodeDir, { recursive: true })

  let config = {
    $schema: "https://opencode.ai/v2/cli.json",
    plugins: [],
  }
  let mode

  if (pathExists(cliPath)) {
    const stat = lstatSync(cliPath)
    mode = stat.mode & 0o777
    config = JSON.parse(readFileSync(cliPath, "utf8"))
    if (!config || typeof config !== "object" || Array.isArray(config)) {
      throw new Error(`${cliPath} must contain a JSON object`)
    }
    if (config.plugins === undefined) config.plugins = []
    if (!Array.isArray(config.plugins)) {
      throw new Error(`${cliPath}: plugins must be an array`)
    }
  }

  let found = false
  const plugins = []
  for (const entry of config.plugins) {
    if (!isTuicrEntry(entry)) {
      plugins.push(entry)
      continue
    }

    if (!found) {
      if (entry && typeof entry === "object" && !Array.isArray(entry)) {
        plugins.push({ ...entry, package: tuicrUrl })
      } else {
        plugins.push(tuicrUrl)
      }
      found = true
    }
  }

  if (!found) plugins.push(tuicrUrl)
  config.plugins = plugins

  const temporaryPath = `${cliPath}.tmp.${process.pid}`
  try {
    writeFileSync(temporaryPath, `${JSON.stringify(config, null, 2)}\n`, {
      mode: mode ?? 0o600,
    })
    if (mode !== undefined) chmodSync(temporaryPath, mode)
    renameSync(temporaryPath, cliPath)
  } catch (error) {
    if (pathExists(temporaryPath)) unlinkSync(temporaryPath)
    throw error
  }

  console.log(`configured ${cliPath} -> ${tuicrUrl}`)
}

if (resolve(repoRoot) === resolve(opencodeDir)) {
  throw new Error("The repository cannot be the OpenCode config directory")
}

const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14)
ensureResourceRoot("agents")
ensureResourceRoot("skills")
backupConflicts(stamp)
stowResources()
updateCliConfig()
