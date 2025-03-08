// Re-export unified research hook for backward compatibility
import type { UseResearchOptions } from './use-research';
import { useResearch } from './use-research'

// Export type aliases for backward compatibility
export type UsePerplexityResearchOptions = UseResearchOptions
export type ResearchStatus = 'idle' | 'loading' | 'success' | 'error'

// Re-export the hook with the old name
export { useResearch as usePerplexityResearch }

// Default export for backward compatibility
export default useResearch