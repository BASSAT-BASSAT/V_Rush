import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { WorkspaceContext, type WorkspaceContextValue } from './workspace-context'

/**
 * Holds the images the user has uploaded so they survive in-app navigation
 * (e.g. Studio → Datasets → back to Studio). Kept in memory only — a browser
 * refresh/close still clears everything, which is the expected privacy
 * posture for a tool that works with user-supplied photos.
 */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [studioFile, setStudioFile] = useState<File | null>(null)
  const [matcherFileA, setMatcherFileA] = useState<File | null>(null)
  const [matcherFileB, setMatcherFileB] = useState<File | null>(null)

  const resetWorkspace = useCallback(() => {
    setStudioFile(null)
    setMatcherFileA(null)
    setMatcherFileB(null)
  }, [])

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      studioFile,
      setStudioFile,
      matcherFileA,
      setMatcherFileA,
      matcherFileB,
      setMatcherFileB,
      resetWorkspace,
    }),
    [studioFile, matcherFileA, matcherFileB, resetWorkspace],
  )

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}
