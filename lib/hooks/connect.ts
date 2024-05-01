import { addEdge, Connection, useReactFlow } from '@xyflow/react'
import { useCallback } from 'react'
import { Graph } from '../types'
import { useGraphApi } from '../context/GraphContext.tsx'

export function useSocketConnect() {
  const { setEdges, getEdges, getNodes } = useReactFlow<
    Graph.Node,
    Graph.Edge
  >()
  const api = useGraphApi()
  return useCallback(
    (params: Connection) => {
      if (params.target === null || params.source === null) {
        return
      }

      let isTargetArray = false

      const targetNode = getNodes().find((node) => node.id === params.target)!
      const targetInput = targetNode.data.internal.inputs.find(
        (input) => input.id === params.targetHandle,
      )

      // Check if the target input is an array type
      if (targetNode.type && targetInput?.name) {
        const nodeConfig = api.getState().config.getNodeConfig(targetNode.type)
        const inputConfig = nodeConfig.inputs?.find(
          (input) => input.name === targetInput.name,
        )
        isTargetArray = inputConfig?.isArray || false
      }

      // We remove all edges that have the same target and targetHandle
      // if the target handle is not an array type
      const edgesToRemove = isTargetArray
        ? []
        : getEdges().filter(
            (e) =>
              e.target === params.target &&
              e.targetHandle === params.targetHandle,
          )

      setEdges((edges) =>
        addEdge<Graph.Edge>(
          {
            target: params.target!,
            targetHandle: params.targetHandle,
            source: params.source!,
            sourceHandle: params.sourceHandle,
            type: 'default',
            data: {
              targetHandle: {
                name: targetInput!.name,
                valueType: targetInput!.valueType,
              },
            },
          },
          edges,
        ).filter((e) => !edgesToRemove.some((r) => r.id === e.id)),
      )
    },
    [getEdges, setEdges, api],
  )
}
