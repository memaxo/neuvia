/**
 * Integration tests and usage examples for Firecrawl
 * 
 * Note: These tests demonstrate usage patterns but are commented out
 * because they require actual API access. They can be run manually
 * by uncommenting them and providing necessary API keys.
 * 
 * During Phase 3, these will be refactored into proper integration tests
 * with appropriate mocking and CI setup.
 */

/*
import { search, extract, scrape, deepResearch } from '../actions';
import { 
  useFirecrawlSearch, 
  useFirecrawlExtract, 
  useFirecrawlScrape, 
  useFirecrawlResearch 
} from '../hooks';

// Example 1: Basic search with Firecrawl
const exampleSearch = async () => {
  console.log('Example 1: Basic search with Firecrawl');
  
  try {
    // Perform a search
    const response = await search('climate change recent research', { maxResults: 5 });
    
    if (response.success) {
      console.log(`Found ${response.data?.length} results:`);
      response.data?.forEach((result, i) => {
        console.log(`${i + 1}. ${result.title}`);
        console.log(`   URL: ${result.url}`);
        console.log(`   Snippet: ${result.snippet?.substring(0, 100)}...`);
        console.log('-----');
      });
    } else {
      console.error(`Search failed: ${response.error}`);
    }
  } catch (err) {
    console.error('Error in search example:', err);
  }
};

// Example 2: Extract information from URLs
const exampleExtract = async () => {
  console.log('Example 2: Extract information from URLs');
  
  try {
    // First search for some results
    const searchResponse = await search('climate change recent research', { maxResults: 3 });
    
    if (!searchResponse.success || !searchResponse.data?.length) {
      console.error('No search results found for extraction');
      return;
    }
    
    // Extract URLs from search results
    const urls = searchResponse.data.map(result => result.url);
    
    // Extract information using a specific prompt
    const extractResponse = await extract(
      urls,
      'Extract key findings about climate change from the text. Include statistics and dates when available.',
      { includeSourceContent: true }
    );
    
    if (extractResponse.success) {
      console.log(`Extracted information from ${extractResponse.data?.length} URLs:`);
      extractResponse.data?.forEach((result, i) => {
        console.log(`${i + 1}. From ${result.url}:`);
        console.log(`   Content: ${result.content}`);
        console.log('-----');
      });
    } else {
      console.error(`Extraction failed: ${extractResponse.error}`);
    }
  } catch (err) {
    console.error('Error in extract example:', err);
  }
};

// Example 3: Scrape a specific URL
const exampleScrape = async () => {
  console.log('Example 3: Scrape a specific URL');
  
  try {
    // Scrape a specific URL
    const response = await scrape('https://www.nasa.gov/climate-change/');
    
    if (response.success && response.data) {
      console.log(`Scraped: ${response.data.title}`);
      console.log(`URL: ${response.data.url}`);
      console.log(`Content length: ${response.data.content.length} characters`);
      console.log(`First 150 characters: ${response.data.content.substring(0, 150)}...`);
    } else {
      console.error(`Scraping failed: ${response.error}`);
    }
  } catch (err) {
    console.error('Error in scrape example:', err);
  }
};

// Example 4: Deep research
const exampleDeepResearch = async () => {
  console.log('Example 4: Deep research with Firecrawl');
  
  try {
    // Perform deep research
    const response = await deepResearch(
      'What are the latest advancements in fusion energy research?',
      { 
        maxResults: 5,
        includeContent: true,
        synthesize: true
      }
    );
    
    if (response.success && response.data) {
      console.log('Deep Research Results:');
      console.log(`Query: ${response.data.query}`);
      console.log(`Found ${response.data.results.length} search results`);
      console.log(`Extracted information from ${response.data.extractions.length} sources`);
      
      if (response.data.summary) {
        console.log('\nResearch Summary:');
        console.log(response.data.summary);
      }
      
      console.log('\nSources:');
      response.data.results.forEach((result, i) => {
        console.log(`${i + 1}. ${result.title} - ${result.url}`);
      });
    } else {
      console.error(`Deep research failed: ${response.error}`);
    }
  } catch (err) {
    console.error('Error in deep research example:', err);
  }
};

// Example 5: React component using hooks
// This is a pseudocode example that shows how to use the hooks in a React component
/*
import React from 'react';

const FirecrawlSearchComponent = () => {
  const { 
    performSearch, 
    results, 
    isLoading, 
    error, 
    clearResults 
  } = useFirecrawlSearch();
  
  const handleSearch = async () => {
    const query = 'climate change solutions';
    await performSearch(query, { maxResults: 10 });
  };
  
  return (
    <div>
      <h2>Firecrawl Search</h2>
      <button onClick={handleSearch} disabled={isLoading}>
        {isLoading ? 'Searching...' : 'Search'}
      </button>
      {error && <div className="error">{error}</div>}
      <button onClick={clearResults}>Clear Results</button>
      
      {results.length > 0 && (
        <div>
          <h3>Results</h3>
          <ul>
            {results.map((result, index) => (
              <li key={index}>
                <h4>{result.title}</h4>
                <a href={result.url} target="_blank" rel="noopener noreferrer">
                  {result.url}
                </a>
                <p>{result.snippet}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// Usage of Extract hook
const FirecrawlExtractComponent = () => {
  const { 
    performExtraction, 
    results, 
    isLoading, 
    error 
  } = useFirecrawlExtract();
  
  const handleExtract = async () => {
    const urls = [
      'https://example.com/article1',
      'https://example.com/article2'
    ];
    const prompt = 'Extract key findings and data about climate change';
    await performExtraction(urls, prompt);
  };
  
  return (
    <div>
      <h2>Firecrawl Extraction</h2>
      <button onClick={handleExtract} disabled={isLoading}>
        {isLoading ? 'Extracting...' : 'Extract'}
      </button>
      {error && <div className="error">{error}</div>}
      
      {results.length > 0 && (
        <div>
          <h3>Extracted Content</h3>
          {results.map((result, index) => (
            <div key={index}>
              <h4>From: {result.url}</h4>
              <div>{result.content}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
*/

// Run examples (commented out for actual testing)
/*
(async () => {
  // await exampleSearch();
  // console.log('\n---------------\n');
  // await exampleExtract();
  // console.log('\n---------------\n');
  // await exampleScrape();
  // console.log('\n---------------\n');
  // await exampleDeepResearch();
})();
*/
*/ 