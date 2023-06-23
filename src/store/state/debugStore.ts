import create from 'zustand'

type DebugStore = {
  debug: boolean
  setDebug: (debug: boolean) => void
}

export const useDebugStore = create<DebugStore>((set) => ({
  debug: false,
  setDebug: (debug: boolean) => set({ debug })
}))
