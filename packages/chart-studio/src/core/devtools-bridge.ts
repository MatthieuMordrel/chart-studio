import type {AnyDefinedDataModel} from './data-model.types.js'
import {getModelRuntimeMetadata} from './model-inference.js'
import type {MaterializedViewDefinition} from './materialized-view.types.js'

export type ChartStudioDevtoolsIssue = {
  id: string
  severity: 'warning' | 'error'
  scope: 'dataset' | 'relationship' | 'association' | 'materialized-view' | 'context'
  targetId: string
  message: string
}

export type ChartStudioDevtoolsContextSnapshot = {
  id: string
  label: string
  kind: 'chart' | 'dashboard'
  effectiveDatasets?: Record<string, readonly Record<string, unknown>[]>
  effectiveMaterializedViews?: Record<string, readonly Record<string, unknown>[]>
}

export type ChartStudioDevtoolsSnapshot = {
  id: string
  label: string
  model: AnyDefinedDataModel
  data: Record<string, readonly Record<string, unknown>[]>
  materializedViews?: Record<string, MaterializedViewDefinition<any, any, any, any>>
  contexts?: readonly ChartStudioDevtoolsContextSnapshot[]
  issues?: readonly ChartStudioDevtoolsIssue[]
  updatedAt: number
}

type MutableChartStudioDevtoolsSnapshot = Omit<ChartStudioDevtoolsSnapshot, 'id' | 'updatedAt'>

const snapshotListeners = new Set<() => void>()
const snapshotsById = new Map<string, ChartStudioDevtoolsSnapshot>()
let snapshotsVersion = 0
let cachedSnapshotVersion = -1
let cachedSnapshots: readonly ChartStudioDevtoolsSnapshot[] = []

function areSnapshotPartsEqual(
  previous: ChartStudioDevtoolsSnapshot | undefined,
  next: MutableChartStudioDevtoolsSnapshot,
): boolean {
  if (!previous) {
    return false
  }

  return previous.label === next.label
    && previous.model === next.model
    && previous.data === next.data
    && previous.materializedViews === next.materializedViews
    && previous.contexts === next.contexts
    && previous.issues === next.issues
}

function emitSnapshotChange(): void {
  snapshotsVersion += 1
  snapshotListeners.forEach((listener) => {
    listener()
  })
}

export function subscribeChartStudioDevtoolsSnapshots(
  listener: () => void,
): () => void {
  snapshotListeners.add(listener)

  return () => {
    snapshotListeners.delete(listener)
  }
}

export function getChartStudioDevtoolsSnapshots(): readonly ChartStudioDevtoolsSnapshot[] {
  if (cachedSnapshotVersion === snapshotsVersion) {
    return cachedSnapshots
  }

  cachedSnapshots = [...snapshotsById.values()].toSorted((left, right) =>
    left.updatedAt === right.updatedAt
      ? left.label.localeCompare(right.label)
      : right.updatedAt - left.updatedAt,
  )
  cachedSnapshotVersion = snapshotsVersion

  return cachedSnapshots
}

export function upsertChartStudioDevtoolsSnapshot(
  id: string,
  snapshot: MutableChartStudioDevtoolsSnapshot,
): void {
  const previous = snapshotsById.get(id)

  if (areSnapshotPartsEqual(previous, snapshot)) {
    return
  }

  snapshotsById.set(id, {
    ...snapshot,
    id,
    updatedAt: Date.now(),
  })
  emitSnapshotChange()
}

export function removeChartStudioDevtoolsSnapshot(
  id: string,
): void {
  if (!snapshotsById.delete(id)) {
    return
  }

  emitSnapshotChange()
}

export function getRegisteredMaterializedViews(
  model: AnyDefinedDataModel,
): Record<string, MaterializedViewDefinition<any, any, any, any>> {
  return Object.fromEntries(getModelRuntimeMetadata(model).materializedViews)
}
