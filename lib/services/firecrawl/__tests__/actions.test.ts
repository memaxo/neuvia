/**
 * Tests for Firecrawl actions
 */
import { search, extract, scrape, deepResearch } from '../actions';
import * as client from '../client';

// Mock the client module
jest.mock('../client', () => ({
  getFirecrawlClient: jest.fn(),
  logFirecrawlError: jest.fn(),
  createFirecrawlLoader: jest.fn()
}));

describe('Firecrawl Actions', () => {
  // Mock Firecrawl client
  const mockSearch = jest.fn();
  const mockExtract = jest.fn();
  const mockScrape = jest.fn();
  const mockClient = { search: mockSearch, extract: mockExtract, scrape: mockScrape };
  
  // Mock loader
  const mockLoader = { load: jest.fn() };
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup mock returns
    (client.getFirecrawlClient as jest.Mock).mockReturnValue(mockClient);
    (client.createFirecrawlLoader as jest.Mock).mockReturnValue(mockLoader);
    
    // Default mock implementations
    mockSearch.mockResolvedValue({ 
      results: [{ title: 'Test Result', url: 'https://example.com', snippet: 'Test snippet' }] 
    });
    mockExtract.mockResolvedValue({ 
      results: [{ url: 'https://example.com', content: 'Extracted content' }] 
    });
    mockScrape.mockResolvedValue({ 
      content: 'Scraped content', 
      url: 'https://example.com',
      title: 'Page Title'
    });
    mockLoader.load.mockResolvedValue('Loaded content');
  });
  
  describe('search', () => {
    it('should return search results successfully', async () => {
      const response = await search('test query');
      
      expect(response.success).toBe(true);
      expect(response.data?.length).toBe(1);
      expect(response.data?.[0].title).toBe('Test Result');
      expect(mockSearch).toHaveBeenCalledWith('test query', expect.any(Object));
    });
    
    it('should handle search errors', async () => {
      mockSearch.mockRejectedValueOnce(new Error('Search failed'));
      
      const response = await search('test query');
      
      expect(response.success).toBe(false);
      expect(response.error).toContain('Search failed');
      expect(client.logFirecrawlError).toHaveBeenCalled();
    });
    
    it('should retry failed requests', async () => {
      // Fail once, then succeed
      mockSearch
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValueOnce({ 
          results: [{ title: 'Test Result', url: 'https://example.com', snippet: 'Test snippet' }] 
        });
      
      const response = await search('test query');
      
      expect(response.success).toBe(true);
      expect(mockSearch).toHaveBeenCalledTimes(2);
    });
  });
  
  describe('extract', () => {
    it('should extract content from URLs successfully', async () => {
      const response = await extract(
        ['https://example.com'], 
        'Extract information'
      );
      
      expect(response.success).toBe(true);
      expect(response.data?.length).toBe(1);
      expect(response.data?.[0].content).toBe('Extracted content');
      expect(mockExtract).toHaveBeenCalledWith(
        ['https://example.com'], 
        expect.objectContaining({ prompt: 'Extract information' })
      );
    });
    
    it('should handle extraction errors', async () => {
      mockExtract.mockRejectedValueOnce(new Error('Extraction failed'));
      
      const response = await extract(['https://example.com'], 'Extract information');
      
      expect(response.success).toBe(false);
      expect(response.error).toContain('Extraction failed');
      expect(client.logFirecrawlError).toHaveBeenCalled();
    });
  });
  
  describe('scrape', () => {
    it('should scrape content from a URL successfully', async () => {
      const response = await scrape('https://example.com');
      
      expect(response.success).toBe(true);
      expect(response.data?.content).toBe('Scraped content');
      expect(mockScrape).toHaveBeenCalledWith('https://example.com', expect.any(Object));
    });
    
    it('should handle scraping errors', async () => {
      mockScrape.mockRejectedValueOnce(new Error('Scrape failed'));
      
      const response = await scrape('https://example.com');
      
      expect(response.success).toBe(false);
      expect(response.error).toContain('Scrape failed');
      expect(client.logFirecrawlError).toHaveBeenCalled();
    });
  });
  
  describe('deepResearch', () => {
    it('should perform research with search and extraction', async () => {
      const response = await deepResearch('research query');
      
      expect(response.success).toBe(true);
      expect(response.data?.results).toBeDefined();
      expect(response.data?.extractions).toBeDefined();
      expect(mockSearch).toHaveBeenCalled();
      expect(mockExtract).toHaveBeenCalled();
    });
    
    it('should handle search errors during research', async () => {
      mockSearch.mockRejectedValueOnce(new Error('Search failed'));
      
      const response = await deepResearch('research query');
      
      expect(response.success).toBe(false);
      expect(response.error).toContain('Search failed');
    });
    
    it('should handle extraction errors during research', async () => {
      mockSearch.mockResolvedValueOnce({ 
        results: [{ title: 'Test Result', url: 'https://example.com', snippet: 'Test snippet' }] 
      });
      mockExtract.mockRejectedValueOnce(new Error('Extraction failed'));
      
      const response = await deepResearch('research query');
      
      expect(response.success).toBe(false);
      expect(response.error).toContain('Extraction failed');
    });
  });
}); 