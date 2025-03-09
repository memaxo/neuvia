import type { ResearchSource } from '@/lib/types/research'

/**
 * Utility class for parsing and extracting structured information from research text
 */
export class ResearchTextParser {
  /**
   * Extract differential diagnoses from text
   *
   * @param text Research text
   * @returns Array of differential diagnoses
   */
  static extractDifferentialDiagnoses(text: string): string[] {
    const diagnoses: string[] = []

    // Look for headers indicating conditions
    const conditionRegex =
      /(?:##?\s*|[*\d]+\.\s*)(?:Condition|Disorder|Diagnosis)[^\n]*?:\s*([^\n]+)/gi
    let conditionMatch

    while ((conditionMatch = conditionRegex.exec(text)) !== null) {
      if (conditionMatch[1]) {
        diagnoses.push(conditionMatch[1].trim())
      }
    }

    // Look for confidence ratings
    const confidenceRegex =
      /(?:##?\s*|[*\d]+\.\s*)Confidence[^\n]*?:\s*(\d+)%/gi
    const confidences: string[] = []
    let confidenceMatch

    while ((confidenceMatch = confidenceRegex.exec(text)) !== null) {
      if (confidenceMatch[1]) {
        confidences.push(`${confidenceMatch[1]}%`)
      }
    }

    // Combine conditions with confidences if available
    if (diagnoses.length > 0 && confidences.length === diagnoses.length) {
      return diagnoses.map(
        (diagnosis, index) => `${diagnosis} (${confidences[index]} confidence)`
      )
    }

    // Fall back to sections that might indicate diagnoses
    if (diagnoses.length === 0) {
      const sectionRegex = /##?\s*([^#\n]+?)(?:\n|$)/g
      let sectionMatch

      while ((sectionMatch = sectionRegex.exec(text)) !== null) {
        const sectionTitle = sectionMatch[1].trim()
        if (
          sectionTitle.includes('Diagnos') ||
          sectionTitle.includes('Condition') ||
          sectionTitle.includes('Disorder') ||
          sectionTitle.includes('Assessment')
        ) {
          diagnoses.push(sectionTitle)
        }
      }
    }

    return diagnoses.length > 0
      ? diagnoses
      : ResearchTextParser.extractKeyFindings(text)
  }

  /**
   * Extract a summary from research text
   *
   * @param text Research text
   * @returns Extracted summary
   */
  static extractSummary(text: string): string {
    // Look for a summary section
    const summaryRegex = /(?:^|\n)(?:##?\s*Summary\s*\n+|\*\*Summary\*\*\s*\n+)([^\n].*?)(?:\n+(?:##?|$))/s
    const summaryMatch = summaryRegex.exec(text)
    if (summaryMatch?.[1]) {
      return summaryMatch[1].trim()
    }

    // If no explicit summary section, use the first paragraph
    const firstParagraph = text.split(/\n\n+/)[0]
    if (firstParagraph && firstParagraph.length > 50 && typeof firstParagraph === 'string') {
      return firstParagraph.trim()
    }

    // If very short text, use it all
    if (text.length < 500) {
      return text.trim()
    }

    // Otherwise, use first 200 characters + "..."
    return `${text.substring(0, 200).trim()}...`
  }

  /**
   * Extract key findings from research text
   *
   * @param text Research text
   * @returns Array of key findings
   */
  static extractKeyFindings(text: string): string[] {
    const findings: string[] = []

    // Look for bullet points and numbered lists
    const bulletPoints = text.match(/(?:^|\n)[•*-]\s+([^\n]+)/g)
    if (bulletPoints) {
      bulletPoints.forEach((point) => {
        findings.push(point.replace(/^[•*-]\s+/, '').trim())
      })
    }

    // Look for numbered points
    const numberedPoints = text.match(/(?:^|\n)\d+\.\s+([^\n]+)/g)
    if (numberedPoints) {
      numberedPoints.forEach((point) => {
        findings.push(point.replace(/^\d+\.\s+/, '').trim())
      })
    }

    // Look for findings/key points section
    const findingsSectionRegex = /(?:##?\s*(?:Key\s*)?Findings|Observations|Results)\s*\n+([^#]+)/i
    const findingsSection = findingsSectionRegex.exec(text)
    if (findingsSection?.[1]) {
      const sectionPoints = findingsSection[1]
        .split(/\n+/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0)
      findings.push(...sectionPoints)
    }

    // If we found nothing or very little, extract first few sentences
    if (findings.length < 2) {
      const sentences = text.match(/[^.!?]+[.!?]+/g)
      if (sentences && Array.isArray(sentences) && sentences.length > 0) {
        const selectedSentences = sentences.slice(0, 3).map((s) => s.trim())
        findings.push(...selectedSentences)
      }
    }

    // Remove duplicates and limit length
    return [...new Set(findings)].slice(0, 5)
  }

  /**
   * Extract sources from text when metadata is not available
   *
   * @param text The research text
   * @returns Extracted sources
   */
  static extractSourcesFromText(text: string): ResearchSource[] {
    const sources: ResearchSource[] = []

    // Look for URLs in the text
    const urlRegex = /(https?:\/\/[^\s]+)/g
    const urlMatches = text.match(urlRegex)

    if (urlMatches) {
      urlMatches.forEach((url) => {
        sources.push({
          url,
          title: ResearchTextParser.getTitleFromUrl(url),
        })
      })
    }

    // Look for numbered references [1], [2], etc.
    const referenceRegex = /\[(\d+)\]\s*([^[\n]+)/g
    let match

    while ((match = referenceRegex.exec(text)) !== null) {
      const index = parseInt(match[1])
      const reference = match[2].trim()

      // Extract URL if present
      const urlMatch = reference.match(urlRegex)
      const url = urlMatch ? urlMatch[0] : 'undefined' // Default to string "undefined" instead of undefined

      sources.push({
        title: reference.replace(urlRegex, '').trim(),
        url,
        index,
      })
    }

    return sources
  }

  /**
   * Extract a title from a URL
   *
   * @param url The URL to extract a title from
   * @returns A simple title based on the URL
   */
  static getTitleFromUrl(url: string): string {
    try {
      const { hostname, pathname } = new URL(url)
      const parts = pathname.split('/').filter(Boolean)

      if (parts.length > 0) {
        // Convert the last path segment to a title (e.g., "how-to-research" -> "How To Research")
        const lastPart = parts[parts.length - 1]
          .replace(/[-_]/g, ' ')
          .replace(/\.html|\.php|\.asp/g, '')

        return lastPart.charAt(0).toUpperCase() + lastPart.slice(1)
      }

      // Fallback to the domain name
      return hostname.replace(/^www\./, '')
    } catch (_) {
      // Return original URL if we can't parse it
      return url
    }
  }
}