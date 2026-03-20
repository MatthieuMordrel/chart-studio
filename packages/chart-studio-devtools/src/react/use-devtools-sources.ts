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

function useExternalSnapshotSources(
  props: ChartStudioDevtoolsProps,
): readonly ChartStudioDevtoolsSource[] {
  const readSnapshot = useEffectEvent(() => props.getSnapshot?.() ?? null)
  const [polledSnapshot, setPolledSnapshot] = useState(() => readSnapshot())

  useEffect(() => {
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
  }, [props.pollIntervalMs, props.subscribe, readSnapshot])

  return useMemo(() => {
    if (!polledSnapshot) {
      return []
    }

    return [{
      id: 'external-snapshot',
      label: 'Snapshot',
      snapshot: polledSnapshot,
    }]
  }, [polledSnapshot])
}

function useInternalStoreSources(): readonly ChartStudioDevtoolsSource[] {
  const snapshots = useSyncExternalStore(
    subscribeChartStudioDevtoolsSnapshots,
    getChartStudioDevtoolsSnapshots,
    getChartStudioDevtoolsSnapshots,
  )

  return useMemo(() =>
    snapshots.map((snapshot) => ({
      id: snapshot.id,
      label: snapshot.label,
      snapshot: {
        model: snapshot.model,
        data: snapshot.data,
        materializedViews: snapshot.materializedViews,
        contexts: snapshot.contexts,
        issues: snapshot.issues,
      },
    })) as unknown as ChartStudioDevtoolsSource[],
  [snapshots])
}

export function useDevtoolsSources(
  props: ChartStudioDevtoolsProps,
): readonly ChartStudioDevtoolsSource[] {
  if (props.getSnapshot) {
    return useExternalSnapshotSources(props)
  }

  return useInternalStoreSources()
}
