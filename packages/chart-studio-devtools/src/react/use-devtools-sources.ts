import {
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react'
import {
  getChartStudioDevtoolsSnapshots,
  subscribeChartStudioDevtoolsSnapshots,
} from '@matthieumordrel/chart-studio/_internal'
import type {
  ChartStudioDevtoolsProps,
  ChartStudioDevtoolsSource,
} from './types.js'

const EMPTY_SOURCES: readonly ChartStudioDevtoolsSource[] = []
const EMPTY_SNAPSHOTS = [] as const

function noopSubscribe(): () => void {
  return () => {}
}

function getEmptySnapshots() {
  return EMPTY_SNAPSHOTS
}

function useExternalSnapshotSources(
  props: ChartStudioDevtoolsProps,
): readonly ChartStudioDevtoolsSource[] {
  const externalMode = typeof props.getSnapshot === 'function'
  const readSnapshot = useEffectEvent(() => props.getSnapshot?.() ?? null)
  const [polledSnapshot, setPolledSnapshot] = useState<ChartStudioDevtoolsSource['snapshot'] | null>(
    () => props.getSnapshot?.() ?? null,
  )

  useEffect(() => {
    if (!externalMode) {
      setPolledSnapshot(null)
      return
    }

    setPolledSnapshot(readSnapshot())

    if (props.subscribe) {
      return props.subscribe(() => {
        setPolledSnapshot(readSnapshot())
      })
    }

    const intervalId = window.setInterval(() => {
      setPolledSnapshot(readSnapshot())
    }, props.pollIntervalMs ?? 750)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [externalMode, props.pollIntervalMs, props.subscribe, readSnapshot])

  return useMemo(() => {
    if (!polledSnapshot) {
      return EMPTY_SOURCES
    }

    return [{
      id: 'external-snapshot',
      label: 'Snapshot',
      snapshot: polledSnapshot,
    }]
  }, [polledSnapshot])
}

function useInternalStoreSources(enabled: boolean): readonly ChartStudioDevtoolsSource[] {
  const snapshots = useSyncExternalStore(
    enabled ? subscribeChartStudioDevtoolsSnapshots : noopSubscribe,
    enabled ? getChartStudioDevtoolsSnapshots : getEmptySnapshots,
    enabled ? getChartStudioDevtoolsSnapshots : getEmptySnapshots,
  )

  return useMemo(() => {
    if (snapshots.length === 0) {
      return EMPTY_SOURCES
    }

    return snapshots.map((snapshot) => ({
      id: snapshot.id,
      label: snapshot.label,
      snapshot: {
        model: snapshot.model,
        data: snapshot.data,
        materializedViews: snapshot.materializedViews,
        contexts: snapshot.contexts,
        issues: snapshot.issues,
      },
    }))
  }, [snapshots])
}

export function useDevtoolsSources(
  props: ChartStudioDevtoolsProps,
): readonly ChartStudioDevtoolsSource[] {
  const externalSources = useExternalSnapshotSources(props)
  const internalSources = useInternalStoreSources(!props.getSnapshot)

  return props.getSnapshot ? externalSources : internalSources
}
