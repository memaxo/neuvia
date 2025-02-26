/**
 * Tests for Firecrawl hooks
 */
import { renderHook, act } from '@testing-library/react-hooks';
import * as actions from '../actions';
import { 
  useFirecrawlSearch, 
  useFirecrawlExtract, 
  useFirecrawlScrape,
  useFirecrawlResearch
} from '../hooks';

// Mock the actions
jest.mock('../actions', () => ({
  search: jest.fn(),
  extract: jest.fn(),
  scrape: jest.fn(),
  deepResearch: jest.fn()
}));

describe('Firecrawl Hooks', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('useFirecrawlSearch', () => {
    beforeEach(() => {
      // Setup default mock responses
      (actions.search as jest.Mock).mockResolvedValue({
        success: true,
        data: [
          {
            title: 'Test Search Result',
            url: 'https://example.com',
            snippet: 'This is a test search result'
          }
        ]
      });
    });
    
    it('should start in idle state', () => {
      const { result } = renderHook(() => useFirecrawlSearch());
      
      expect(result.current.status).toBe('idle');
      expect(result.current.isLoading).toBe(false);
      expect(result.current.results).toEqual([]);
      expect(result.current.error).toBeNull();
    });
    
    it('should perform search and update state', async () => {
      const { result, waitForNextUpdate } = renderHook(() => useFirecrawlSearch());
      
      act(() => {
        result.current.performSearch('test query');
      });
      
      expect(result.current.isLoading).toBe(true);
      expect(result.current.status).toBe('loading');
      
      await waitForNextUpdate();
      
      expect(result.current.isLoading).toBe(false);
      expect(result.current.status).toBe('success');
      expect(result.current.results).toHaveLength(1);
      expect(result.current.results[0].title).toBe('Test Search Result');
      expect(result.current.query).toBe('test query');
      expect(result.current.history).toHaveLength(1);
      expect(actions.search).toHaveBeenCalledWith('test query', undefined);
    });
    
    it('should handle search errors', async () => {
      (actions.search as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Search failed'
      });
      
      const { result, waitForNextUpdate } = renderHook(() => useFirecrawlSearch());
      
      act(() => {
        result.current.performSearch('test query');
      });
      
      await waitForNextUpdate();
      
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isError).toBe(true);
      expect(result.current.status).toBe('error');
      expect(result.current.error).toBe('Search failed');
      expect(result.current.results).toEqual([]);
    });
    
    it('should clear results', async () => {
      const { result, waitForNextUpdate } = renderHook(() => useFirecrawlSearch());
      
      act(() => {
        result.current.performSearch('test query');
      });
      
      await waitForNextUpdate();
      
      expect(result.current.results).toHaveLength(1);
      
      act(() => {
        result.current.clearResults();
      });
      
      expect(result.current.results).toEqual([]);
      expect(result.current.status).toBe('idle');
      expect(result.current.query).toBe('');
    });
    
    it('should maintain history of searches', async () => {
      const { result, waitForNextUpdate } = renderHook(() => useFirecrawlSearch());
      
      // First search
      act(() => {
        result.current.performSearch('query 1');
      });
      
      await waitForNextUpdate();
      
      // Second search
      act(() => {
        result.current.performSearch('query 2');
      });
      
      await waitForNextUpdate();
      
      expect(result.current.history).toHaveLength(2);
      expect(result.current.history[0].params.query).toBe('query 2');
      expect(result.current.history[1].params.query).toBe('query 1');
      
      // Clear history
      act(() => {
        result.current.clearHistory();
      });
      
      expect(result.current.history).toEqual([]);
    });
  });
  
  describe('useFirecrawlExtract', () => {
    beforeEach(() => {
      // Setup default mock responses
      (actions.extract as jest.Mock).mockResolvedValue({
        success: true,
        data: [
          {
            url: 'https://example.com',
            content: 'Extracted content from the website'
          }
        ]
      });
    });
    
    it('should start in idle state', () => {
      const { result } = renderHook(() => useFirecrawlExtract());
      
      expect(result.current.status).toBe('idle');
      expect(result.current.isLoading).toBe(false);
      expect(result.current.results).toEqual([]);
      expect(result.current.error).toBeNull();
    });
    
    it('should perform extraction and update state', async () => {
      const { result, waitForNextUpdate } = renderHook(() => useFirecrawlExtract());
      
      act(() => {
        result.current.performExtraction(['https://example.com'], 'Extract information');
      });
      
      expect(result.current.isLoading).toBe(true);
      expect(result.current.status).toBe('loading');
      
      await waitForNextUpdate();
      
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.status).toBe('success');
      expect(result.current.results).toHaveLength(1);
      expect(result.current.results[0].content).toBe('Extracted content from the website');
      expect(result.current.urls).toEqual(['https://example.com']);
      expect(result.current.prompt).toBe('Extract information');
    });
    
    it('should handle extraction errors', async () => {
      (actions.extract as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Extraction failed'
      });
      
      const { result, waitForNextUpdate } = renderHook(() => useFirecrawlExtract());
      
      act(() => {
        result.current.performExtraction(['https://example.com'], 'Extract information');
      });
      
      await waitForNextUpdate();
      
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isError).toBe(true);
      expect(result.current.status).toBe('error');
      expect(result.current.error).toBe('Extraction failed');
      expect(result.current.results).toEqual([]);
    });
  });
  
  describe('useFirecrawlScrape', () => {
    beforeEach(() => {
      // Setup default mock responses
      (actions.scrape as jest.Mock).mockResolvedValue({
        success: true,
        data: {
          url: 'https://example.com',
          title: 'Example Website',
          content: 'Scraped content from the website'
        }
      });
    });
    
    it('should start in idle state', () => {
      const { result } = renderHook(() => useFirecrawlScrape());
      
      expect(result.current.status).toBe('idle');
      expect(result.current.isLoading).toBe(false);
      expect(result.current.result).toBeNull();
      expect(result.current.error).toBeNull();
    });
    
    it('should perform scraping and update state', async () => {
      const { result, waitForNextUpdate } = renderHook(() => useFirecrawlScrape());
      
      act(() => {
        result.current.performScrape('https://example.com');
      });
      
      expect(result.current.isLoading).toBe(true);
      expect(result.current.status).toBe('loading');
      
      await waitForNextUpdate();
      
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.status).toBe('success');
      expect(result.current.result?.content).toBe('Scraped content from the website');
      expect(result.current.url).toBe('https://example.com');
    });
    
    it('should handle scraping errors', async () => {
      (actions.scrape as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Scraping failed'
      });
      
      const { result, waitForNextUpdate } = renderHook(() => useFirecrawlScrape());
      
      act(() => {
        result.current.performScrape('https://example.com');
      });
      
      await waitForNextUpdate();
      
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isError).toBe(true);
      expect(result.current.status).toBe('error');
      expect(result.current.error).toBe('Scraping failed');
      expect(result.current.result).toBeNull();
    });
    
    it('should validate URLs', async () => {
      const { result } = renderHook(() => useFirecrawlScrape());
      
      let response;
      act(() => {
        response = result.current.performScrape('invalid-url');
      });
      
      expect(result.current.isError).toBe(true);
      expect(result.current.error).toBe('Invalid URL format');
      expect(actions.scrape).not.toHaveBeenCalled();
    });
  });
  
  describe('useFirecrawlResearch', () => {
    beforeEach(() => {
      // Setup default mock responses
      (actions.deepResearch as jest.Mock).mockResolvedValue({
        success: true,
        data: {
          query: 'research query',
          results: [{ title: 'Result', url: 'https://example.com', snippet: 'Snippet' }],
          extractions: [{ url: 'https://example.com', content: 'Extracted content' }],
          summary: 'Research summary'
        }
      });
    });
    
    it('should start in idle state', () => {
      const { result } = renderHook(() => useFirecrawlResearch());
      
      expect(result.current.status).toBe('idle');
      expect(result.current.isLoading).toBe(false);
      expect(result.current.results).toBeNull();
      expect(result.current.error).toBeNull();
    });
    
    it('should perform research and update state', async () => {
      const { result, waitForNextUpdate } = renderHook(() => useFirecrawlResearch());
      
      act(() => {
        result.current.performResearch('research query');
      });
      
      expect(result.current.isLoading).toBe(true);
      expect(result.current.status).toBe('loading');
      
      await waitForNextUpdate();
      
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.status).toBe('success');
      expect(result.current.results?.summary).toBe('Research summary');
      expect(result.current.query).toBe('research query');
    });
    
    it('should handle research errors', async () => {
      (actions.deepResearch as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Research failed'
      });
      
      const { result, waitForNextUpdate } = renderHook(() => useFirecrawlResearch());
      
      act(() => {
        result.current.performResearch('research query');
      });
      
      await waitForNextUpdate();
      
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isError).toBe(true);
      expect(result.current.status).toBe('error');
      expect(result.current.error).toBe('Research failed');
      expect(result.current.results).toBeNull();
    });
  });
}); 