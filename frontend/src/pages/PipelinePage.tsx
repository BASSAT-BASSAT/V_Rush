/**
 * Legacy export — studio UI lives in `PipelineWorkspaceLayout`, which stays mounted
 * across `/studio` and `/lab` so state persists when switching labs.
 */
export { PipelineWorkspaceLayout as PipelinePage } from './PipelineWorkspaceLayout'
