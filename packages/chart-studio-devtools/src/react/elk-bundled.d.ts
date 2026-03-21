declare module 'elkjs/lib/elk.bundled.js' {
  export type ElkPoint = {
    x: number
    y: number
  }

  export type ElkEdgeSection = {
    startPoint?: ElkPoint
    endPoint?: ElkPoint
    bendPoints?: ElkPoint[]
  }

  export type ElkEdge = {
    id: string
    sources: string[]
    targets: string[]
    layoutOptions?: Record<string, string>
    sections?: ElkEdgeSection[]
  }

  export type ElkNode = {
    id: string
    width?: number
    height?: number
    x?: number
    y?: number
    layoutOptions?: Record<string, string>
    children?: ElkNode[]
    edges?: ElkEdge[]
  }

  const ElkConstructor: {
    new(): {
      layout(graph: ElkNode): Promise<ElkNode>
    }
  }

  export default ElkConstructor
}
