import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

// Publish packages in dependency order:
// 1. Core (@txnlab/use-wallet)
// 2. Wallet adapters (packages/wallets/*)
// 3. Framework adapters (packages/frameworks/*)

const publishGroups = [
  {
    name: 'core',
    dirs: ['packages/core']
  },
  {
    name: 'wallet adapters',
    dirs: getSubpackageDirs('packages/wallets')
  },
  {
    name: 'framework adapters',
    dirs: getSubpackageDirs('packages/frameworks')
  }
]

function getSubpackageDirs(parentDir) {
  const fullPath = path.join(rootDir, parentDir)
  if (!fs.existsSync(fullPath)) return []
  return fs
    .readdirSync(fullPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(parentDir, entry.name))
    .filter((dir) => {
      const pkgPath = path.join(rootDir, dir, 'package.json')
      if (!fs.existsSync(pkgPath)) return false
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
      return !pkg.private
    })
}

// Determine npm dist-tag from version (pre-release versions use 'next')
const corePkgPath = path.join(rootDir, 'packages/core/package.json')
const corePkg = JSON.parse(fs.readFileSync(corePkgPath, 'utf-8'))
const isPrerelease = corePkg.version.includes('-')
const tag = isPrerelease ? 'next' : 'latest'

let hasErrors = false

for (const group of publishGroups) {
  console.log(`\nPublishing ${group.name}...`)

  for (const dir of group.dirs) {
    const pkgPath = path.join(rootDir, dir, 'package.json')
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))

    console.log(`  Publishing ${pkg.name}@${pkg.version}...`)

    try {
      execSync(`pnpm publish --no-git-checks --access public --provenance --tag ${tag}`, {
        cwd: path.join(rootDir, dir),
        stdio: 'pipe'
      })
      console.log(`  ✓ ${pkg.name} published successfully`)
    } catch (error) {
      const stderr = error.stderr?.toString() || ''
      if (
        stderr.includes('Cannot publish over the previously published versions') ||
        stderr.includes('You cannot publish over the previously published versions')
      ) {
        console.log(`  ✓ ${pkg.name}@${pkg.version} already published, skipping`)
      } else {
        console.error(`  ✗ Failed to publish ${pkg.name}: ${stderr || error.message}`)
        hasErrors = true
      }
    }
  }
}

if (hasErrors) {
  console.error('\nSome packages failed to publish. Check the output above.')
  process.exit(1)
}

console.log('\nAll packages published successfully.')
