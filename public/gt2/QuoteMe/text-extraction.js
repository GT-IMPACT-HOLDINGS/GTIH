// =============================================================
// QuoteMe v1 Text Extraction Module
// Handles .txt and .docx file extraction, text normalization, and sensitive pattern detection
// =============================================================

/**
 * Extract text from file (.txt or .docx)
 * @param {File} file - File object
 * @returns {Promise<string>} Extracted text
 */
export async function extractText(file) {
  const ext = file.name.toLowerCase().split('.').pop();
  let raw = '';

  if (ext === 'txt') {
    raw = await file.text();
  } else if (ext === 'docx') {
    if (typeof window === 'undefined' || !window.mammoth) {
      throw new Error('Mammoth.js is required for .docx files. Please include: <script src="https://unpkg.com/mammoth/mammoth.browser.min.js"></script>');
    }
    const arrayBuffer = await file.arrayBuffer();
    const res = await window.mammoth.extractRawText({ arrayBuffer });
    raw = res.value || '';
  } else {
    throw new Error('Unsupported file type. QuoteMe v1 supports .txt and .docx only.');
  }

  return normalizeText(raw);
}

/**
 * Normalize extracted text (clean whitespace, normalize line breaks)
 * @param {string} text - Raw text
 * @returns {string} Normalized text
 */
export function normalizeText(text) {
  if (!text) return '';
  
  // Normalize line breaks to \n
  let normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Remove excessive whitespace (3+ spaces become single space, except in code blocks)
  normalized = normalized.replace(/[ \t]{3,}/g, ' ');
  
  // Remove trailing whitespace from lines
  normalized = normalized.split('\n').map(line => line.trimEnd()).join('\n');
  
  // Remove excessive blank lines (3+ consecutive newlines become 2)
  normalized = normalized.replace(/\n{3,}/g, '\n\n');
  
  // Trim overall
  return normalized.trim();
}

/**
 * Scan text for sensitive patterns (API keys, SSN-like, credit cards)
 * @param {string} text - Text to scan
 * @returns {{ detected: boolean, categories: string[] }} Detection result
 */
export function scanSensitive(text) {
  if (!text) return { detected: false, categories: [] };
  
  const categories = [];
  
  // API key patterns (common formats)
  // OpenAI: sk-[a-zA-Z0-9]{32,}
  // Generic: [a-zA-Z0-9]{32,} (32+ alphanumeric chars)
  const apiKeyPatterns = [
    /sk-[a-zA-Z0-9]{32,}/i,
    /[a-zA-Z0-9]{40,}/, // Generic long alphanumeric (likely API key)
    /AIza[0-9A-Za-z_-]{35}/, // Google API key pattern
    /AKIA[0-9A-Z]{16}/, // AWS access key pattern
  ];
  
  // SSN-like patterns (XXX-XX-XXXX or XXXXXXXXX)
  const ssnPattern = /\b\d{3}-?\d{2}-?\d{4}\b/;
  
  // Credit card patterns (16 digits, possibly with spaces/dashes)
  const creditCardPattern = /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/;
  
  // Check patterns
  if (apiKeyPatterns.some(pattern => pattern.test(text))) {
    categories.push('api-key');
  }
  
  if (ssnPattern.test(text)) {
    categories.push('ssn-like');
  }
  
  if (creditCardPattern.test(text)) {
    categories.push('credit-card');
  }
  
  return {
    detected: categories.length > 0,
    categories
  };
}

