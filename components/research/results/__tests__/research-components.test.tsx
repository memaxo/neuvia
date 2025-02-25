import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SearchResults } from '../search-results';
import { ExtractResults } from '../extract-results';
import { ScrapeResults } from '../scrape-results';
import { FirecrawlResearchPanel } from '../../firecrawl-research-panel';
import * as hooks from '@/lib/services/firecrawl/hooks';

// Mock the hooks
jest.mock('@/lib/services/firecrawl/hooks', () => ({
  useFirecrawlSearch: jest.fn(),
  useFirecrawlExtract: jest.fn(),
  useFirecrawlScrape: jest.fn(),
}));

// Mock the toast component
jest.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

describe('Research Components', () => {
  // Default mock implementations
  const mockSearchHook = {
    results: [],
    isLoading: false,
    isError: false,
    error: null,
    performSearch: jest.fn().mockResolvedValue({ success: true, data: [] }),
    clearResults: jest.fn(),
  };

  const mockExtractHook = {
    results: [],
    isLoading: false,
    isError: false,
    error: null,
    performExtraction: jest.fn().mockResolvedValue({ success: true, data: [] }),
    clearResults: jest.fn(),
  };

  const mockScrapeHook = {
    result: null,
    isLoading: false,
    isError: false,
    error: null,
    performScrape: jest.fn().mockResolvedValue({ success: true, data: {} }),
    clearResult: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (hooks.useFirecrawlSearch as jest.Mock).mockReturnValue(mockSearchHook);
    (hooks.useFirecrawlExtract as jest.Mock).mockReturnValue(mockExtractHook);
    (hooks.useFirecrawlScrape as jest.Mock).mockReturnValue(mockScrapeHook);
  });

  describe('SearchResults', () => {
    it('renders in idle state', () => {
      render(<SearchResults />);
      
      expect(screen.getByPlaceholderText(/search for information/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
    });

    it('shows loading state during search', () => {
      (hooks.useFirecrawlSearch as jest.Mock).mockReturnValue({
        ...mockSearchHook,
        isLoading: true,
      });
      
      render(<SearchResults />);
      
      expect(screen.getByText(/searching/i)).toBeInTheDocument();
    });

    it('shows results when available', () => {
      const mockResults = [
        { title: 'Test Result', url: 'https://example.com', description: 'Test description' },
      ];
      
      (hooks.useFirecrawlSearch as jest.Mock).mockReturnValue({
        ...mockSearchHook,
        results: mockResults,
      });
      
      render(<SearchResults />);
      
      expect(screen.getByText('Test Result')).toBeInTheDocument();
      expect(screen.getByText('Test description')).toBeInTheDocument();
    });

    it('handles search submission', async () => {
      const mockPerformSearch = jest.fn().mockResolvedValue({ success: true, data: [] });
      (hooks.useFirecrawlSearch as jest.Mock).mockReturnValue({
        ...mockSearchHook,
        performSearch: mockPerformSearch,
      });
      
      render(<SearchResults initialQuery="test query" />);
      
      fireEvent.submit(screen.getByRole('button', { name: /search/i }));
      
      await waitFor(() => {
        expect(mockPerformSearch).toHaveBeenCalledWith("test query");
      });
    });
  });

  describe('ExtractResults', () => {
    it('renders in idle state', () => {
      render(<ExtractResults />);
      
      expect(screen.getByText(/urls to extract from/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/example.com/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add url/i })).toBeInTheDocument();
    });

    it('allows adding and removing URLs', () => {
      render(<ExtractResults />);
      
      // Add URL
      const input = screen.getByPlaceholderText(/example.com/i);
      fireEvent.change(input, { target: { value: 'https://example.com' } });
      fireEvent.click(screen.getByRole('button', { name: /add url/i }));
      
      expect(screen.getByText(/example.com/i)).toBeInTheDocument();
      
      // Remove URL
      fireEvent.click(screen.getByRole('button', { name: /×/i }));
      
      expect(screen.queryByText(/example.com/i)).not.toBeInTheDocument();
    });

    it('shows loading state during extraction', () => {
      (hooks.useFirecrawlExtract as jest.Mock).mockReturnValue({
        ...mockExtractHook,
        isLoading: true,
      });
      
      render(<ExtractResults urls={['https://example.com']} initialPrompt="Extract info" />);
      
      expect(screen.getByText(/extracting/i)).toBeInTheDocument();
    });

    it('handles extraction submission', async () => {
      const mockPerformExtraction = jest.fn().mockResolvedValue({ success: true, data: [] });
      (hooks.useFirecrawlExtract as jest.Mock).mockReturnValue({
        ...mockExtractHook,
        performExtraction: mockPerformExtraction,
      });
      
      render(
        <ExtractResults 
          urls={['https://example.com']} 
          initialPrompt="Extract info" 
        />
      );
      
      fireEvent.click(screen.getByRole('button', { name: /extract information/i }));
      
      await waitFor(() => {
        expect(mockPerformExtraction).toHaveBeenCalledWith(
          ['https://example.com'], 
          "Extract info"
        );
      });
    });
  });

  describe('ScrapeResults', () => {
    it('renders in idle state', () => {
      render(<ScrapeResults />);
      
      expect(screen.getByPlaceholderText(/example.com/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /scrape/i })).toBeInTheDocument();
    });

    it('shows loading state during scraping', () => {
      (hooks.useFirecrawlScrape as jest.Mock).mockReturnValue({
        ...mockScrapeHook,
        isLoading: true,
      });
      
      render(<ScrapeResults />);
      
      expect(screen.getByText(/scraping/i)).toBeInTheDocument();
    });

    it('shows results when available', () => {
      const mockResult = {
        url: 'https://example.com',
        title: 'Test Page',
        data: 'Test content',
        metadata: {
          description: 'Test description',
        }
      };
      
      (hooks.useFirecrawlScrape as jest.Mock).mockReturnValue({
        ...mockScrapeHook,
        result: mockResult,
      });
      
      render(<ScrapeResults />);
      
      expect(screen.getByText('Test Page')).toBeInTheDocument();
      expect(screen.getByText(/test content/i)).toBeInTheDocument();
    });

    it('handles scrape submission', async () => {
      const mockPerformScrape = jest.fn().mockResolvedValue({ success: true, data: {} });
      (hooks.useFirecrawlScrape as jest.Mock).mockReturnValue({
        ...mockScrapeHook,
        performScrape: mockPerformScrape,
      });
      
      render(<ScrapeResults initialUrl="https://example.com" />);
      
      fireEvent.submit(screen.getByRole('form'));
      
      await waitFor(() => {
        expect(mockPerformScrape).toHaveBeenCalledWith(
          'https://example.com',
          { includeMetadata: true }
        );
      });
    });
  });

  describe('FirecrawlResearchPanel', () => {
    it('renders all tabs', () => {
      render(<FirecrawlResearchPanel />);
      
      expect(screen.getByRole('tab', { name: /search/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /extract/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /scrape/i })).toBeInTheDocument();
    });

    it('starts with search tab active by default', () => {
      render(<FirecrawlResearchPanel />);
      
      const searchTab = screen.getByRole('tab', { name: /search/i });
      expect(searchTab).toHaveAttribute('aria-selected', 'true');
    });

    it('can start with a different initial tab', () => {
      render(<FirecrawlResearchPanel initialTab="extract" />);
      
      const extractTab = screen.getByRole('tab', { name: /extract/i });
      expect(extractTab).toHaveAttribute('aria-selected', 'true');
    });

    it('changes tab content when clicking tabs', () => {
      render(<FirecrawlResearchPanel />);
      
      // Click on extract tab
      fireEvent.click(screen.getByRole('tab', { name: /extract/i }));
      expect(screen.getByText(/urls to extract from/i)).toBeInTheDocument();
      
      // Click on scrape tab
      fireEvent.click(screen.getByRole('tab', { name: /scrape/i }));
      expect(screen.getAllByPlaceholderText(/example.com/i)[0]).toBeInTheDocument();
    });
  });
}); 