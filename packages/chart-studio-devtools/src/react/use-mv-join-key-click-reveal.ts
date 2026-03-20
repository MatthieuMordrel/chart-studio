import {useEffect, useState} from 'react'

/**
 * Tracks which materialized-view node had join/key overflow opened by clicking the canvas node body
 * (beyond the default join/key cap in `graph-field-visibility.ts`).
 *
 * **Invariant:** overflow is tied to graph selection. When the selected node id is no longer the
 * node that was click-revealed (pane, edge, another node, etc.), state resets to `null` so the MV
 * returns to the default capped join/key list.
 */
export function useMvJoinKeyClickRevealForSelection(selectedNodeId: string | null) {
  const [mvJoinKeyClickRevealNodeId, setMvJoinKeyClickRevealNodeId] = useState<string | null>(null)

  useEffect(() => {
    setMvJoinKeyClickRevealNodeId((previous) => {
      if (previous == null) {
        return null
      }

      if (selectedNodeId === previous) {
        return previous
      }

      return null
    })
  }, [selectedNodeId])

  return {mvJoinKeyClickRevealNodeId, setMvJoinKeyClickRevealNodeId}
}
