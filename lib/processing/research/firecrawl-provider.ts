/**
 * Firecrawl Research Provider
 * 
 * Provides research functionality using the Firecrawl service.
 * Implements the document processing service's research capabilities
 * with Firecrawl as the backend.
 */

import type { ResearchResult, ResearchSource, ResearchOptions } from '../types/index';
import { deepResearch } from '@/lib/services/firecrawl/actions';
import type { SearchResult, ExtractResult } from '@/lib/services/firecrawl/types';

/**
 * Provides research functionality using the Firecrawl service
 */
export class FirecrawlResearchProvider {
  /**
   * Perform research using Firecrawl
   * @param query Research query
   * @param options Research options
   */
  async performResearch(
    query: string,
    options?: ResearchOptions
  ): Promise<ResearchResult> {
    // Track progress
    let currentProgress = 0;
    options?.onProgress?.(currentProgress);
    
    try {
      // Map options to Firecrawl options
      const firecrawlOptions = {
        maxResults: options?.sourcesLimit || 5,
        includeContent: options?.includeSourceContent || false,
        synthesize: true // Always generate a summary
      };
      
      // Progress: Started research
      currentProgress = 10;
      options?.onProgress?.(currentProgress);
      
      // Perform the research with Firecrawl
      const response = await deepResearch(query, firecrawlOptions);
      
      // Progress: Search completed
      currentProgress = 50;
      options?.onProgress?.(currentProgress);
      
      if (!response.success) {
        throw new Error(`Research failed: ${response.error}`);
      }
      
      // Progress: Data processing
      currentProgress = 70;
      options?.onProgress?.(currentProgress);
      
      // Map Firecrawl results to ResearchResult format
      const researchResult = this.mapToResearchResult(
        query,
        response.data?.results || [],
        response.data?.extractions || [],
        response.data?.summary,
        options
      );
      
      // Progress: Complete
      options?.onProgress?.(100);
      
      return researchResult;
    } catch (error) {
      // Log the error
      console.error('FirecrawlResearchProvider error:', error);
      
      // Return a minimal result with error information
      return {
        query,
        sources: [],
        summary: `Research failed: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date(),
        keyFindings: [`Error: ${error instanceof Error ? error.message : String(error)}`],
        confidence: 0,
      };
    }
  }
  
  /**
   * Map Firecrawl results to ResearchResult format
   */
  private mapToResearchResult(
    query: string,
    searchResults: SearchResult[],
    extractions: ExtractResult[],
    summary?: string,
    options?: ResearchOptions
  ): ResearchResult {
    // Convert search results to research sources
    const sources = searchResults.map((result, index) => {
      // Try to find matching extraction for this URL
      const matchingExtraction = extractions.find(e => e.url === result.url);
      
      // Create the research source
      const source: ResearchSource = {
        title: result.title,
        url: result.url,
        description: result.description || 'No description available',
        relevance: result.relevance || 0.7,
        citationIndex: index + 1,
        sourceType: 'web',
        content: options?.includeSourceContent ? 
          matchingExtraction?.data || result.description || 'No content available' 
          : undefined
      };
      
      return source;
    });
    
    // Extract key findings from extractions
    const keyFindings = this.extractKeyFindings(extractions);
    
    // Create the research result
    const result: ResearchResult = {
      query,
      sources,
      summary: summary || `Research results for query: ${query}`,
      timestamp: new Date(),
      confidence: sources.length > 0 ? 0.8 : 0.3, // Higher confidence if we have sources
      keyFindings,
    };
    
    return result;
  }
  
  /**
   * Extract key findings from extraction results
   */
  private extractKeyFindings(extractions: ExtractResult[]): string[] {
    const findings: string[] = [];
    
    // Extract key findings from each extraction
    extractions.forEach(extraction => {
      // Handle different data formats in the extraction
      if (typeof extraction.data === 'string') {
        // If it's a string, add as a single finding
        findings.push(extraction.data);
      } else if (Array.isArray(extraction.data)) {
        // If it's an array, add each item
        findings.push(...extraction.data.map(item => 
          typeof item === 'string' ? item : JSON.stringify(item)).filter(Boolean));
      } else if (typeof extraction.data === 'object' && extraction.data !== null) {
        // If it's an object, look for specific properties or convert to string
        const { keyFindings, findings: extractedFindings, summary, points } = extraction.data;
        
        if (Array.isArray(keyFindings)) {
          findings.push(...keyFindings);
        } else if (Array.isArray(extractedFindings)) {
          findings.push(...extractedFindings);
        } else if (Array.isArray(points)) {
          findings.push(...points);
        } else if (summary) {
          findings.push(summary);
        } else {
          // If no known structure, convert to string
          findings.push(JSON.stringify(extraction.data));
        }
      }
    });
    
    // Remove duplicates and empty strings
    return [...new Set(findings)].filter(Boolean);
  }
} 