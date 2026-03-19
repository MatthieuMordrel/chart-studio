import {runCommand, workspacePackages} from './workspace-utils.js'

for (const workspacePackage of workspacePackages) {
  runCommand('bun', ['run', 'build'], {
    cwd: workspacePackage.dir,
  })
}
