/**
 * OCR Migration Script
 *
 * This script helps migrate documents processed with the old system to the new Gemini OCR system.
 * It can also be used for benchmarking and validating the OCR system on a set of test documents.
 */
import fs from 'fs';
import path from 'path';
import { DocumentExtractionService } from '@/lib/services/document/extraction-service';
import { GeminiOCRClient } from '@/lib/services/document/gemini-ocr-client';
import logger from '@/lib/logger';

// Set up the services
const extractionService = new DocumentExtractionService();
const geminiClient = new GeminiOCRClient();

/**
 * Run Gemini OCR on a directory of test documents
 */
async function processBatchDocuments() {
  const testFilesDir = path.join(process.cwd(), 'test-documents');
  
  if (!fs.existsSync(testFilesDir)) {
    console.error(`Test directory ${testFilesDir} does not exist.`);
    return;
  }
  
  // Get all PDF and image files
  const files = fs.readdirSync(testFilesDir)
    .filter(f => /\.(pdf|png|jpg|jpeg|docx|doc)$/i.test(f))
    .map(filename => {
      const filePath = path.join(testFilesDir, filename);
      const fileBuffer = fs.readFileSync(filePath);
      const fileBlob = new Blob([fileBuffer], {
        type: getContentType(filename)
      });
      return {
        name: filename,
        blob: fileBlob
      };
    });
  
  console.log(`Found ${files.length} test files.`);
  
  // Process each file with Gemini OCR
  for (const file of files) {
    console.log(`\nProcessing ${file.name}...`);
    
    try {
      // Process with Gemini OCR
      console.log('Running Gemini OCR...');
      const startTime = Date.now();
      const ocrResult = await extractionService.extractViaOCR(
        file.blob,
        getContentType(file.name),
        { extractTables: true, detectSections: true, preserveLayout: true }
      );
      const processingTime = Date.now() - startTime;
      
      // Show results
      console.log(`Processing time: ${processingTime}ms`);
      console.log(`Text length: ${ocrResult.text.length} characters`);
      console.log(`Pages: ${ocrResult.pages?.length || 0}`);
      console.log(`Sections detected: ${ocrResult.detectedSections?.length || 0}`);
      console.log(`Tables detected: ${ocrResult.tables?.length || 0}`);
      
      // Save results to output directory
      const outputDir = path.join(process.cwd(), 'ocr-results');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      // Save the OCR result
      const baseName = path.basename(file.name, path.extname(file.name));
      fs.writeFileSync(
        path.join(outputDir, `${baseName}-ocr.json`),
        JSON.stringify(ocrResult, null, 2)
      );
      
      // Save just the extracted text
      fs.writeFileSync(
        path.join(outputDir, `${baseName}-text.txt`),
        ocrResult.text
      );
      
      console.log(`Results saved to ${outputDir}`);
      
    } catch (error) {
      console.error(`Error processing ${file.name}:`, error);
    }
  }
}

/**
 * Benchmark OCR performance on a single document
 */
async function benchmarkOCR(filePath: string, iterations: number = 3) {
  if (!fs.existsSync(filePath)) {
    console.error(`File ${filePath} does not exist.`);
    return;
  }
  
  const fileName = path.basename(filePath);
  const fileBuffer = fs.readFileSync(filePath);
  const fileBlob = new Blob([fileBuffer], {
    type: getContentType(fileName)
  });
  
  console.log(`Benchmarking OCR on ${fileName} (${iterations} iterations)...`);
  
  const times: number[] = [];
  const results = [];
  
  for (let i = 0; i < iterations; i++) {
    console.log(`\nRunning iteration ${i + 1}/${iterations}...`);
    
    try {
      const startTime = Date.now();
      const ocrResult = await extractionService.extractViaOCR(
        fileBlob,
        getContentType(fileName),
        { extractTables: true, detectSections: true }
      );
      const processingTime = Date.now() - startTime;
      
      times.push(processingTime);
      results.push(ocrResult);
      
      console.log(`Iteration ${i + 1} processing time: ${processingTime}ms`);
    } catch (error) {
      console.error(`Error in iteration ${i + 1}:`, error);
    }
  }
  
  // Calculate stats
  if (times.length > 0) {
    const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    
    console.log('\nBenchmark results:');
    console.log(`Average processing time: ${avgTime.toFixed(2)}ms`);
    console.log(`Minimum processing time: ${minTime}ms`);
    console.log(`Maximum processing time: ${maxTime}ms`);
    
    // Save benchmark results
    const outputDir = path.join(process.cwd(), 'ocr-benchmark');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const baseName = path.basename(fileName, path.extname(fileName));
    fs.writeFileSync(
      path.join(outputDir, `${baseName}-benchmark.json`),
      JSON.stringify({
        fileName,
        times,
        avgTime,
        minTime,
        maxTime,
        bestResult: results[times.indexOf(minTime)]
      }, null, 2)
    );
    
    console.log(`Benchmark results saved to ${outputDir}`);
  }
}

/**
 * Get content type based on file extension
 */
function getContentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const contentTypes: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  };
  
  return contentTypes[ext] || 'application/octet-stream';
}

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length === 0) {
  // Default: process batch documents
  processBatchDocuments()
    .then(() => console.log('Document processing completed!'))
    .catch(err => console.error('Processing failed:', err));
} else if (args[0] === '--benchmark' && args[1]) {
  // Benchmark mode
  const iterations = args[2] ? parseInt(args[2]) : 3;
  benchmarkOCR(args[1], iterations)
    .then(() => console.log('Benchmark completed!'))
    .catch(err => console.error('Benchmark failed:', err));
} else {
  console.log('Usage:');
  console.log('  ts-node migrate-ocr.ts                   # Process all documents in test-documents folder');
  console.log('  ts-node migrate-ocr.ts --benchmark FILE [ITERATIONS]  # Benchmark OCR on a specific file');
}