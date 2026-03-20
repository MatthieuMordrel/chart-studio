import {runCommand, workspacePackages} from './workspace-utils.js'

for (const workspacePackage of workspacePackages) {
  runCommand('bun', ['run', 'typecheck'], {
    cwd: workspacePackage.dir,
  })
}
