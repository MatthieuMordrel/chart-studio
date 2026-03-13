import {spawnSync} from 'node:child_process'
import {existsSync, readFileSync, writeFileSync} from 'node:fs'
import {join, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'

type DependencyMap = Record<string, string>

type PackageManifest = {
  dependencies?: DependencyMap
  exports?: Record<string, string | {default?: string; import?: string; types?: string}>
  main?: string
  optionalDependencies?: DependencyMap
  peerDependencies?: DependencyMap
  publishConfig?: {access?: string}
  types?: string
}

type BumpLevel = 'major' | 'minor' | 'patch'

type ReleaseOptions = {
  bump?: BumpLevel
  dryRun: boolean
  provenance: boolean
  publish: boolean
  tag?: string
}

const packageRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))

/**
 * Validate, build, pack, and optionally publish the standalone package.
 */
function releasePackage() {
  const options = parseReleaseOptions(process.argv.slice(2))

  // Always validate first
  runCommand('bun', ['run', 'typecheck'])
  runCommand('bun', ['run', 'test'])
  runCommand('bun', ['run', 'build'])

  validatePackageManifest()
  runCommand('bun', ['pm', 'pack', '--dry-run'])

  // Bump after validation passes
  if (options.bump) {
    const nextVersion = bumpVersion(options.bump)

    if (!options.dryRun) {
      console.log('Pushing to remote...')
      runCommand('git', ['push'])
      runCommand('git', ['push', 'origin', `v${nextVersion}`])
      console.log(`Pushed v${nextVersion} — CI will publish to npm and create the GitHub release.`)
    } else {
      console.log(`Dry run: would push v${nextVersion} to remote.`)
    }
    return
  }

  if (!options.publish) {
    return
  }

  const manifest = readPackageManifest()
  const publishArgs = ['publish']
  if (manifest.publishConfig?.access) {
    publishArgs.push('--access', manifest.publishConfig.access)
  }
  if (options.tag) {
    publishArgs.push('--tag', options.tag)
  }
  if (options.provenance) {
    publishArgs.push('--provenance')
  }
  if (options.dryRun) {
    publishArgs.push('--dry-run')
  }

  // Use npm for publishing — required for OIDC trusted publishing and provenance
  runCommand('npm', publishArgs)
}

/**
 * Parse CLI arguments for the release flow.
 */
function parseReleaseOptions(args: string[]): ReleaseOptions {
  const options: ReleaseOptions = {
    dryRun: false,
    provenance: false,
    publish: false,
  }

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (!argument) {
      throw new Error('Missing release option.')
    }

    if (argument.startsWith('--bump=')) {
      options.bump = parseBumpLevel(argument.slice('--bump='.length))
      continue
    }
    if (argument === '--bump') {
      const nextArgument = args[index + 1]
      if (!nextArgument) {
        throw new Error('Missing value for `--bump`. Expected: patch, minor, or major.')
      }

      options.bump = parseBumpLevel(nextArgument)
      index += 1
      continue
    }
    if (argument === '--dry-run') {
      options.dryRun = true
      continue
    }
    if (argument === '--publish') {
      options.publish = true
      continue
    }
    if (argument === '--provenance') {
      options.provenance = true
      continue
    }
    if (argument.startsWith('--tag=')) {
      options.tag = argument.slice('--tag='.length)
      continue
    }
    if (argument === '--tag') {
      const nextArgument = args[index + 1]
      if (!nextArgument) {
        throw new Error('Missing value for `--tag`.')
      }

      options.tag = nextArgument
      index += 1
      continue
    }

    throw new Error(`Unknown release option: ${argument}`)
  }

  return options
}

/**
 * Run a child process in the package root and exit on failure.
 */
function runCommand(command: string, args: string[]) {
  const child = spawnSync(command, args, {
    cwd: packageRoot,
    env: process.env,
    stdio: 'inherit',
  })

  if (child.status !== 0) {
    process.exit(child.status ?? 1)
  }
}

/**
 * Read the package manifest from the repo root.
 */
function readPackageManifest(): PackageManifest {
  const manifestPath = join(packageRoot, 'package.json')
  return JSON.parse(readFileSync(manifestPath, 'utf8')) as PackageManifest
}

/**
 * Validate package metadata and built export targets before packing.
 */
function validatePackageManifest() {
  const manifest = readPackageManifest()

  if (!manifest.main || !manifest.types || !manifest.exports) {
    throw new Error('package.json must define `main`, `types`, and `exports`.')
  }

  assertExportFilesExist(manifest)
  assertDependencyRangesArePublishSafe(manifest.dependencies)
  assertDependencyRangesArePublishSafe(manifest.peerDependencies)
  assertDependencyRangesArePublishSafe(manifest.optionalDependencies)
}

/**
 * Ensure every file referenced by the root manifest exists.
 */
function assertExportFilesExist(manifest: PackageManifest) {
  const manifestPaths = new Set<string>()

  manifestPaths.add(manifest.main ?? '')
  manifestPaths.add(manifest.types ?? '')

  for (const exportValue of Object.values(manifest.exports ?? {})) {
    if (typeof exportValue === 'string') {
      manifestPaths.add(exportValue)
      continue
    }

    if (exportValue.default) {
      manifestPaths.add(exportValue.default)
    }
    if (exportValue.import) {
      manifestPaths.add(exportValue.import)
    }
    if (exportValue.types) {
      manifestPaths.add(exportValue.types)
    }
  }

  for (const manifestPath of manifestPaths) {
    if (!manifestPath || manifestPath === './package.json') {
      continue
    }

    if (!existsSync(join(packageRoot, manifestPath.replace(/^\.\//, '')))) {
      throw new Error(`Missing publish artifact referenced by manifest: ${manifestPath}`)
    }
  }
}

/**
 * Reject dependency ranges that are unsafe for a published package.
 */
function assertDependencyRangesArePublishSafe(dependencyMap: DependencyMap | undefined) {
  for (const [dependencyName, versionRange] of Object.entries(dependencyMap ?? {})) {
    if (versionRange === '*') {
      throw new Error(`Unsafe publish range "*" detected for "${dependencyName}".`)
    }
    if (versionRange.startsWith('catalog:') || versionRange.startsWith('workspace:')) {
      throw new Error(
        `Workspace-only version "${versionRange}" detected for "${dependencyName}".`,
      )
    }
  }
}

/**
 * Validate and return a bump level from a CLI argument.
 */
function parseBumpLevel(value: string): BumpLevel {
  if (value !== 'patch' && value !== 'minor' && value !== 'major') {
    throw new Error(`Invalid bump level "${value}". Expected: patch, minor, or major.`)
  }
  return value
}

/**
 * Bump the version in package.json, commit, and create a git tag.
 * Returns the new version string.
 */
function bumpVersion(level: BumpLevel): string {
  const manifestPath = join(packageRoot, 'package.json')
  const raw = readFileSync(manifestPath, 'utf8')
  const manifest = JSON.parse(raw) as {version: string}

  const parts = manifest.version.split('.').map(Number)
  if (parts.length !== 3 || parts.some(Number.isNaN)) {
    throw new Error(`Cannot parse current version "${manifest.version}".`)
  }

  const [major, minor, patch] = parts as [number, number, number]
  const nextVersion =
    level === 'major'
      ? `${major + 1}.0.0`
      : level === 'minor'
        ? `${major}.${minor + 1}.0`
        : `${major}.${minor}.${patch + 1}`

  const updated = raw.replace(`"version": "${manifest.version}"`, `"version": "${nextVersion}"`)
  writeFileSync(manifestPath, updated)

  console.log(`Bumped version: ${manifest.version} → ${nextVersion}`)

  runCommand('git', ['add', 'package.json'])
  runCommand('git', ['commit', '-m', `release: v${nextVersion}`])
  runCommand('git', ['tag', `v${nextVersion}`])

  console.log(`Created tag: v${nextVersion}`)
  return nextVersion
}

releasePackage()
