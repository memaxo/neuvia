import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const report = await request.json()
    
    // Log CSP violations in development
    if (process.env.NODE_ENV === 'development') {
      console.warn('CSP Violation:', {
        'blocked-uri': report['csp-report']['blocked-uri'],
        'violated-directive': report['csp-report']['violated-directive'],
        'source-file': report['csp-report']['source-file'],
      })
    }

    // In production, you might want to send this to your logging service
    // await logService.log('csp-violation', report)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error processing CSP report:', error)
    return NextResponse.json({ error: 'Failed to process CSP report' }, { status: 500 })
  }
} 