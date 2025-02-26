# Legacy Firecrawl Implementation

**DEPRECATED**: This Firecrawl implementation has been replaced with the Perplexity Deep Research API integration.

## Purpose

This directory contains the original Firecrawl implementation that has been preserved for backward compatibility. All new development should use the Perplexity Deep Research API integration found in `lib/services/research`.

## Migration Plan

This code is part of a planned migration from Firecrawl to Perplexity's Deep Research API. The migration includes:

1. Preserving the original Firecrawl code in this legacy directory
2. Implementing a new Perplexity client in `lib/services/research`
3. Updating all dependents to use the new implementation

## Timeline

This legacy code will be maintained for backward compatibility but is scheduled to be removed entirely once the migration is complete.

## New Implementation

For the new implementation, please refer to:
- `lib/services/research/perplexity-client.ts`
- `lib/services/research/perplexity-provider.ts`
- `lib/hooks/use-perplexity-research.ts` 