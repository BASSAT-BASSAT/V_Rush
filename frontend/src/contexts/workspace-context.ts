import { createContext } from 'react'

export interface WorkspaceContextValue {
  /** Current image loaded in the Studio / Lab pipeline page. */
  studioFile: File | null
  setStudioFile: (file: File | null) => void

  /** Left slot (A) on the Matcher page. */
  matcherFileA: File | null
  setMatcherFileA: (file: File | null) => void

  /** Right slot (B) on the Matcher page. */
  matcherFileB: File | null
  setMatcherFileB: (file: File | null) => void

  /** Wipe every workspace file (used by “Clear” / sign-out, if needed). */
  resetWorkspace: () => void
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)
