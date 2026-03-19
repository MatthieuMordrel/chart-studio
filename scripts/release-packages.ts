import {existsSync, readFileSync, writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {
  readWorkspaceManifest,
  repoRoot,
  runCommand,
  workspacePackages,
  type PackageManifest,
} from './workspace-utils.js'

type DependencyMap = Record<string, string>

type BumpLevel = 'major' | 'minor' | 'patch'

type ReleaseOptions = {
  bump?: BumpLevel
  dryRun: boolean
  provenance: boolean
  publish: boolean
  tag?: string
}

type MutablePackageManifest = PackageManifest & {
  dependencies?: DependencyMap
}

function releasePackages() {
  const options = parseReleaseOptions(process.argv.slice(2))

  if (options.bump && !options.dryRun) {
    assertCleanWorktree()
  }

  runCommand('bun', ['run', 'typecheck'])
  runCommand('bun', ['run', 'test'])
  runCommand('bun', ['run', 'build'])

  validatePackageManifests()
  runCommand('bun', ['run', 'smoke:test'])

  for (const workspacePackage of workspacePackages) {
    runCommand('bun', ['pm', 'pack', '--dry-run'], {
      cwd: workspacePackage.dir,
    })
  }

  if (options.bump) {
    const nextVersion = bumpVersions(options.bump, {write: !options.dryRun})

    if (!options.dryRun) {
      runCommand('git', ['push'])
      runCommand('git', ['push', 'origin', `v${nextVersion}`])
      console.log(`Pushed v${nextVersion} — CI will publish both packages and create the GitHub release.`)
    } else {
      console.log(`Dry run: would bump both packages to v${nextVersion} and push the tag.`)
    }

    return
  }

  if (!options.publish) {
    return
  }

  for (const workspacePackage of workspacePackages) {
    const manifest = readWorkspaceManifest(workspacePackage)
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

    runCommand('npm', publishArgs, {
      cwd: workspacePackage.dir,
    })
  }
}

function parseReleaseOptions(args: string[]): ReleaseOptions {
  const options: ReleaseOptions = {
    dryRun: false,
    provenance: false,
    publish: false,
    tag: 'alpha',
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

function validatePackageManifests() {
  for (const workspacePackage of workspacePackages) {
    const manifest = readWorkspaceManifest(workspacePackage)

    if (!manifest.main || !manifest.types || !manifest.exports) {
      throw new Error(`${workspacePackage.name} must define \`main\`, \`types\`, and \`exports\`.`)
    }

    assertExportFilesExist(workspacePackage.dir, manifest)
    assertDependencyRangesArePublishSafe(manifest.dependencies)
    assertDependencyRangesArePublishSafe(manifest.peerDependencies)
    assertDependencyRangesArePublishSafe(manifest.optionalDependencies)
  }
}

function assertExportFilesExist(packageRoot: string, manifest: PackageManifest) {
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
      throw new Error(`Missing publish artifact referenced by manifest: ${manifest.name} -> ${manifestPath}`)
    }
  }
}

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

function parseBumpLevel(value: string): BumpLevel {
  if (value !== 'patch' && value !== 'minor' && value !== 'major') {
    throw new Error(`Invalid bump level "${value}". Expected: patch, minor, or major.`)
  }
  return value
}

function assertCleanWorktree() {
  const status = runCommand('git', ['status', '--short'], {
    encoding: 'utf8',
    stdio: 'pipe',
  })

  const output = status.stdout?.toString().trim()
  if (!output) {
    return
  }

  throw new Error(
    `Refusing to create a release from a dirty worktree. Commit or stash changes first.\n\n${output}`,
  )
}

function bumpVersions(level: BumpLevel, options: {write: boolean}): string {
  const manifests = workspacePackages.map(workspacePackage => ({
    workspacePackage,
    raw: readFileSync(workspacePackage.manifestPath, 'utf8'),
    manifest: readWorkspaceManifest(workspacePackage) as MutablePackageManifest,
  }))

  const currentVersion = manifests[0]?.manifest.version
  if (!currentVersion || manifests.some(entry => entry.manifest.version !== currentVersion)) {
    throw new Error('All publishable workspace packages must share the same version before a release.')
  }

  const parts = currentVersion.split('.').map(Number)
  if (parts.length !== 3 || parts.some(Number.isNaN)) {
    throw new Error(`Cannot parse current version "${currentVersion}".`)
  }

  const [major, minor, patch] = parts as [number, number, number]
  const nextVersion =
    level === 'major'
      ? `${major + 1}.0.0`
      : level === 'minor'
        ? `${major}.${minor + 1}.0`
        : `${major}.${minor}.${patch + 1}`

  if (!options.write) {
    return nextVersion
  }

  for (const entry of manifests) {
    entry.manifest.version = nextVersion

    if (entry.workspacePackage.id === 'ui' && entry.manifest.peerDependencies) {
      entry.manifest.peerDependencies['@matthieumordrel/chart-studio'] = nextVersion
    }

    writeFileSync(entry.workspacePackage.manifestPath, JSON.stringify(entry.manifest, null, 2) + '\n')
  }

  runCommand('bun', ['install'], {cwd: repoRoot})
  runCommand('git', [
    'add',
    'bun.lock',
    ...workspacePackages.map(workspacePackage =>
      workspacePackage.manifestPath.replace(`${repoRoot}/`, ''),
    ),
  ])
  runCommand('git', ['commit', '-m', `release: v${nextVersion}`])
  runCommand('git', ['tag', `v${nextVersion}`])

  return nextVersion
}

releasePackages()
