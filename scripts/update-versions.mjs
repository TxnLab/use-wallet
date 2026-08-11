import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

const version = process.argv[2]
if (!version) {
  console.error('Usage: node scripts/update-versions.mjs <version>')
  process.exit(1)
}

console.log(`Updating all package versions to ${version}`)

// Read pnpm workspace config to discover packages
const workspaceFile = path.join(rootDir, 'pnpm-workspace.yaml')
const workspaceContent = fs.readFileSync(workspaceFile, 'utf-8')

// Parse workspace patterns (simple yaml parsing for "  - pattern" lines)
const patterns = workspaceContent
  .split('\n')
  .filter((line) => line.match(/^\s+-\s+/))
  .map((line) => line.replace(/^\s+-\s+/, '').trim())

// Resolve glob patterns to package directories
function resolvePattern(pattern) {
  const parts = pattern.split('/')
  let dirs = [rootDir]

  for (const part of parts) {
    const nextDirs = []
    for (const dir of dirs) {
      if (part === '**') {
        // Recursively find all subdirectories
        const subdirs = getSubdirs(dir)
        nextDirs.push(dir, ...subdirs)
      } else if (part === '*') {
        // All immediate subdirectories
        if (fs.existsSync(dir)) {
          const entries = fs.readdirSync(dir, { withFileTypes: true })
          for (const entry of entries) {
            if (entry.isDirectory() && !entry.name.startsWith('.')) {
              nextDirs.push(path.join(dir, entry.name))
            }
          }
        }
      } else {
        const next = path.join(dir, part)
        if (fs.existsSync(next)) {
          nextDirs.push(next)
        }
      }
    }
    dirs = nextDirs
  }

  return dirs
}

function getSubdirs(dir) {
  const result = []
  if (!fs.existsSync(dir)) return result
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
      const subdir = path.join(dir, entry.name)
      result.push(subdir, ...getSubdirs(subdir))
    }
  }
  return result
}

// Collect all publishable package.json paths
const packageJsonPaths = []
const packageNames = new Set()

for (const pattern of patterns) {
  const dirs = resolvePattern(pattern)
  for (const dir of dirs) {
    const pkgPath = path.join(dir, 'package.json')
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
      if (!pkg.private) {
        packageJsonPaths.push(pkgPath)
        packageNames.add(pkg.name)
      }
    }
  }
}

console.log(`Found ${packageJsonPaths.length} publishable packages`)

// Update version field only (workspace:* references are resolved by pnpm publish)
for (const pkgPath of packageJsonPaths) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
  pkg.version = version

  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
  console.log(`  Updated ${pkg.name} → ${version}`)
}

console.log('Done.')
