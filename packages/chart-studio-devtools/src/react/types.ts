import type {MaterializedViewDefinition} from '@matthieumordrel/chart-studio'
import type {
  ChartStudioDevtoolsContextSnapshot,
  ChartStudioDevtoolsIssue,
  ChartStudioDevtoolsSnapshot,
} from '@matthieumordrel/chart-studio/_internal'

export type AnyMaterializedView = MaterializedViewDefinition<any, any, any, any>
export type DevtoolsRow = Record<string, unknown>

/**
 * Minimal chart-builder surface used by devtools (dataset `.chart(...)` chains before `.build()`).
 */
export type AnyDatasetChartBuilder = {
  chartType(define: (builder: any) => any): AnyDatasetChartBuilder
  build(): unknown
}

export type AnyDatasetDefinition = {
  key?: readonly string[]
  columns?: Record<string, unknown>
  chart(id?: string): AnyDatasetChartBuilder
}

export type DevtoolsRelationship = {
  id: string
  from: {
    dataset: string
    key: string
  }
  to: {
    dataset: string
    column: string
  }
}

export type DevtoolsAssociation = {
  id: string
  from: {
    dataset: string
    key: string
  }
  to: {
    dataset: string
    key: string
  }
  edge:
    | {
        kind: 'explicit'
        data: readonly Record<string, unknown>[]
        columns: {
          from: string
          to: string
        }
      }
    | {
        kind: 'derived'
        deriveFrom: {
          dataset: string
          values: (row: unknown) => readonly unknown[] | null | undefined
        }
      }
}

export type DevtoolsAttribute = {
  id: string
  source: {
    dataset: string
    key: string
    label: string
  }
  targets: ReadonlyArray<
    | {
        dataset: string
        column: string
        via: string
      }
    | {
        dataset: string
        through: string
        mode: 'exists'
      }
  >
}

export type AnyDevtoolsModel = {
  datasets: Record<string, AnyDatasetDefinition>
  relationships: Record<string, DevtoolsRelationship>
  associations: Record<string, DevtoolsAssociation>
  attributes: Record<string, DevtoolsAttribute>
}

type DevtoolsSnapshotModel = AnyDevtoolsModel | ChartStudioDevtoolsSnapshot['model']

export type ChartStudioDevtoolsInputSnapshot = {
  model: DevtoolsSnapshotModel
  data: Record<string, readonly DevtoolsRow[]>
  materializedViews?: Record<string, AnyMaterializedView>
  contexts?: readonly ChartStudioDevtoolsContextSnapshot[]
  issues?: readonly ChartStudioDevtoolsIssue[]
}

export type ChartStudioDevtoolsSource = {
  id: string
  label: string
  snapshot: ChartStudioDevtoolsInputSnapshot
}

export type ChartStudioDevtoolsProps = {
  getSnapshot?: () => ChartStudioDevtoolsInputSnapshot | null
  subscribe?: (listener: () => void) => (() => void)
  defaultOpen?: boolean
  pollIntervalMs?: number
}

/** Materialized-view column projected from another dataset via a join / traversal step. */
export type DatasetFieldJoinProjection = {
  /** Target dataset id whose columns were merged into this view. */
  targetDataset: string
  /** Relationship or association id used to reach {@link targetDataset}. */
  via: string
  /** Materialization step alias (e.g. manager, capability). */
  alias: string
  stepKind: 'join' | 'through-relationship' | 'through-association'
}

export type DatasetFieldVm = {
  id: string
  label: string
  type: string
  formatHint: string | null
  inferenceHint: string | null
  /** Short human summary when the column is declared as `kind: 'derived'`. */
  derivedSummary: string | null
  isPrimaryKey: boolean
  isForeignKey: boolean
  isAssociationField: boolean
  isDerived: boolean
  /** Set for columns introduced by a materialized view join / expansion step. */
  joinProjection: DatasetFieldJoinProjection | null
  /**
   * Materialized views only: base grain dataset for columns carried from the `from(...)` dataset
   * (not join-projected, not derived). Explains why e.g. `id` matches `projectPlans.id`.
   */
  mvBaseDatasetId: string | null
  trueLabel?: string
  falseLabel?: string
  sourceHandleId: string
  targetHandleId: string
}

export type NormalizedNodeVm = {
  id: string
  kind: 'dataset' | 'materialized-view'
  label: string
  datasetId: string
  rowCount: number
  estimatedBytes: number
  attributeIds: readonly string[]
  rawRows: readonly DevtoolsRow[]
  fields: readonly DatasetFieldVm[]
  definition: AnyDatasetDefinition | AnyMaterializedView
}

export type RelationshipEdgeVm = {
  id: string
  kind: 'relationship'
  label: string
  sourceNodeId: string
  targetNodeId: string
  sourceHandleId: string
  targetHandleId: string
  inferred: boolean
  fromDatasetId: string
  toDatasetId: string
  fromFieldId: string
  toFieldId: string
}

export type AssociationPreviewPair = {
  from: string
  to: string
  raw?: Record<string, unknown>
}

export type AssociationEdgeVm = {
  id: string
  kind: 'association'
  label: string
  sourceNodeId: string
  targetNodeId: string
  sourceHandleId: string
  targetHandleId: string
  fromDatasetId: string
  toDatasetId: string
  fromFieldId: string
  toFieldId: string
  backing: 'explicit' | 'derived'
  derivedFromDatasetId?: string
  previewPairs: readonly AssociationPreviewPair[]
  edgeRows?: readonly Record<string, unknown>[]
}

export type MaterializationEdgeVm = {
  id: string
  kind: 'materialization'
  label: string
  sourceNodeId: string
  targetNodeId: string
  sourceHandleId: string
  targetHandleId: string
  viewId: string
  projectedFieldIds: readonly string[]
  materializationKind: 'base' | 'join' | 'through-relationship' | 'through-association'
}

export type NormalizedEdgeVm =
  | RelationshipEdgeVm
  | AssociationEdgeVm
  | MaterializationEdgeVm

export type AttributeVm = {
  id: string
  sourceDatasetId: string
  sourceKeyId: string
  labelColumnId: string
  targetDatasetIds: readonly string[]
  relationshipTargetIds: readonly string[]
  associationTargetIds: readonly string[]
}

export type SearchItemVm = {
  id: string
  kind: 'dataset' | 'materialized-view' | 'relationship' | 'association' | 'attribute' | 'column'
  label: string
  description: string
  nodeId?: string
  edgeId?: string
  fieldId?: string
}

export type NormalizedSourceVm = {
  id: string
  label: string
  snapshot: ChartStudioDevtoolsInputSnapshot
  nodes: readonly NormalizedNodeVm[]
  edges: readonly NormalizedEdgeVm[]
  attributes: readonly AttributeVm[]
  contexts: readonly ChartStudioDevtoolsContextSnapshot[]
  issues: readonly ChartStudioDevtoolsIssue[]
  searchItems: readonly SearchItemVm[]
  nodeMap: ReadonlyMap<string, NormalizedNodeVm>
  edgeMap: ReadonlyMap<string, NormalizedEdgeVm>
  attributeMap: ReadonlyMap<string, AttributeVm>
}
