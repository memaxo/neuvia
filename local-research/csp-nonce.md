Querying Perplexity AI using sonar-reasoning-pro for: Next.js 15 Content Security Policy nonce configuration with Spline.design best practices
<think>
Okay, let's tackle this query about configuring a Content Security Policy (CSP) with nonces in Next.js 15, especially when using Spline.design. The user wants best practices, so I need to make sure the answer is accurate and up-to-date.

First, I'll look through the provided search results. Result [1] from DEV Community seems detailed, showing how to generate a nonce in middleware and apply it in the root layout. That's a good start. It mentions setting the nonce for Next.js scripts and Webpack, which is crucial.

Result [7] and [9] from Next.js docs are important because they provide official guidelines. They mention using middleware for nonce generation and applying headers. The example in [9] about reading the nonce in a Server Component using headers() might be relevant if Spline requires scripts to be included with a nonce.

Spline.design likely embeds 3D content using scripts or iframes. For third-party scripts, the CSP needs to allow their domains. The user needs to add Spline's domains to script-src and possibly other directives. But how does that interact with the nonce?

Looking at result [5], they talk about Strict CSP using 'strict-dynamic' which trusts scripts with a valid nonce. This might allow third-party scripts loaded by trusted scripts without explicitly listing all domains, but I need to confirm if Spline's scripts are compatible with that approach.

Result [8] discusses allowing inline styles, but since the focus is on scripts here, maybe that's less relevant. However, if Spline uses inline styles or scripts, we might need hashes or nonces for those as well.

The middleware example in [1] generates a nonce and sets it in headers. Then, in the root layout, they pass it to a Script component that sets __webpack_nonce__. This ensures Webpack-generated scripts have the nonce. For Spline, if they have their own scripts, those would need the nonce attribute as well.

Wait, but third-party scripts like Spline's might not be able to include the nonce unless they're loaded dynamically. So maybe adding their domain to script-src along with 'strict-dynamic'? Or perhaps using 'self' and the Spline domain in script-src.

Looking at result [3], they mention allowing specific domains in script-src. So combining 'self', 'nonce-${nonce}', 'strict-dynamic', and adding Spline's domain (like https://spline.design) to script-src.

Also, result [10] talks about using report-uri to monitor CSP violations, which could help in debugging if Spline's resources are being blocked.

Putting this together: The CSP middleware generates a nonce, sets it in headers, applies it to Next.js scripts and Webpack. Then, for Spline, include their script sources in the CSP directives. If Spline uses inline scripts or styles, we might need hashes or 'unsafe-inline', but that's less secure. Better to see if Spline can be loaded via a trusted domain or with a nonce.

Wait, but third-party scripts can't have the nonce unless it's provided in their script tag. If Spline is embedded via a script tag that we control, we can add the nonce. If it's loaded via their CDN, maybe we need to add their domain to script-src.

So steps would be:

1. Generate nonce in middleware.
2. Apply nonce to Next.js scripts and Webpack via root layout.
3. Add Spline's domains (e.g., https://*.spline.design) to script-src and other relevant directives.
4. Use 'strict-dynamic' to allow any scripts trusted by the nonce.
5. Test and monitor CSP violations.

Check result [7] again: Next.js docs show script-src with 'self', 'unsafe-eval', 'unsafe-inline', but with a nonce and 'strict-dynamic', those unsafe keywords might not be needed. The example in [1] uses 'strict-dynamic' which should override host-based allowlists.

So the CSP should look something like:

script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://spline.design;

But wait, 'strict-dynamic' allows any script that has a valid nonce, so adding the domain might not be necessary if Spline's script is loaded by a trusted script. However, if Spline's script is loaded directly via a script tag with the nonce, then including their domain isn't needed because the nonce allows it.

But if Spline's script is hosted on their domain and doesn't have a nonce attribute, then the domain needs to be added to script-src. Alternatively, if we can add the nonce to their script tag when including it.

For example, if embedding Spline via a script tag:

<Script src="https://spline.design/script.js" nonce={nonce} />

Then the CSP can have script-src 'self' 'nonce-${nonce}' 'strict-dynamic'; without needing the domain, since the nonce allows it.

But if Spline's script dynamically loads other resources from their domain without nonces, then those would be blocked unless their domain is added to script-src.

This is getting a bit complicated. Best practice would be to use 'strict-dynamic' along with the nonce and include necessary trusted domains. Also, testing with report-uri would help identify any missing sources.

In conclusion: Configure middleware to generate a nonce per request, apply it to Next.js internal scripts and Webpack via root layout. Include Spline's scripts with the same nonce if possible, or add their domains to the CSP directives as needed.
</think>

To configure a strict Content Security Policy (CSP) with nonces in Next.js 15 for Spline.design integration:

**Middleware Setup**
```typescript
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { randomUUID } from 'crypto'

export function middleware(request: NextRequest) {
  const nonce = Buffer.from(randomUUID()).toString('base64')
  const csp = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic' *.spline.design;
    style-src 'self' 'nonced-${nonce}';
    img-src *.spline.design;
    connect-src *.spline.design;
    object-src 'none';
    base-uri 'self';
  `.replace(/\s{2,}/g, ' ').trim()

  const response = NextResponse.next()
  response.headers.set('Content-Security-Policy', csp)
  response.headers.set('X-Nonce', nonce)
  
  return response
}
```

**Root Layout Configuration**
```tsx
// app/layout.tsx
import { headers } from 'next/headers'
import Script from 'next/script'

export default function RootLayout({ children }) {
  const nonce = headers().get('X-Nonce')

  return (
    <html>
      <body>
        <Script
          id="webpack-nonce"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{ __html: `__webpack_nonce__ = "${nonce}"` }}
          nonce={nonce}
        />
        {children}
        
        {/* Spline integration */}
        <Script 
          src="https://unpkg.com/@splinetool/runtime@1.x.x/runtime.js"
          strategy="afterInteractive"
          nonce={nonce}
        />
      </body>
    </html>
  )
}
```

Key considerations:
1. Added `*.spline.design` domains for script/content loading[1][9]
2. `strict-dynamic` maintains chain of trust for dynamically loaded scripts[5]
3. Nonces regenerate per-request for security[9]
4. Explicit resource allowances for Spline's CDN requirements[3][7]

Test with `Content-Security-Policy-Report-Only` first[6][10], then monitor browser console for blocked resources needing additional permissions[8].