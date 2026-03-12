import {spawnSync} from 'node:child_process'
import {copyFileSync, mkdirSync, rmSync} from 'node:fs'
import {resolve} from 'node:path'
import {fileURLToPath} from 'node:url'

const packageRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const distDir = resolve(packageRoot, 'dist')
const uiThemeSource = resolve(packageRoot, 'src/ui/theme.css')
const uiThemeDestination = resolve(packageRoot, 'dist/ui/theme.css')

/**
 * Build the standalone package into `dist/`.
 */
function buildPackage() {
  rmSync(distDir, {recursive: true, force: true})

  const buildProcess = spawnSync('bunx', ['tsc', '-p', 'tsconfig.build.json'], {
    cwd: packageRoot,
    env: process.env,
    stdio: 'inherit',
  })

  if (buildProcess.status !== 0) {
    process.exit(buildProcess.status ?? 1)
  }

  mkdirSync(resolve(packageRoot, 'dist/ui'), {recursive: true})
  copyFileSync(uiThemeSource, uiThemeDestination)
}

buildPackage()
