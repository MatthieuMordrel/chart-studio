declare module 'elkjs/lib/elk.bundled.js' {
  export type ElkNode = {
    id: string
    width?: number
    height?: number
    x?: number
    y?: number
    layoutOptions?: Record<string, string>
    children?: ElkNode[]
    edges?: Array<{
      id: string
      sources: string[]
      targets: string[]
    }>
  }

  const ElkConstructor: {
    new(): {
      layout(graph: ElkNode): Promise<ElkNode>
    }
  }

  export default ElkConstructor
}
