// api/proxy.js (Node serverless for Vercel)
// This is a single-file solution with NO external dependencies.
// This version FIXES the ".raw is not a function" crash.
const { Readable } = require('stream');

// A Set of headers that should NOT be forwarded from the target server back to the client.
// This is the key to fixing the "rubbish" output and security issues.
const RESPONSE_HEADERS_TO_STRIP = new Set([
    'content-encoding',       // CRITICAL: This fixes the garbled/rubbish text issue.
    'content-length',         // The length changes after decompression, so this must be removed.
    'content-security-policy',// Prevents the site from loading inside the proxy.
    'x-frame-options',        // Also prevents the site from being embedded.
    'strict-transport-security', // Can cause HTTPS issues in the proxy.
    'connection',             // Hop-by-hop header.
    'keep-alive',             // Hop-by-hop header.
    'transfer-encoding',      // Hop-by-hop header.
    'upgrade'                 // Hop-by-hop header.
]);

// In-memory storage for cookies to handle user logins and sessions.
const cookieJars = new Map();

module.exports = async (req, res) => {
    try {
        const urlParam = req.query.url;
        if (!urlParam) {
            return res.status(400).send('Error: The "url" query parameter is missing.');
        }

        // Add "https://" by default if no protocol is specified.
        const targetUrl = urlParam.includes('://') ? urlParam : `https://` + urlParam;
        const target = new URL(targetUrl);

        // --- Step 1: Prepare the request to the target server ---
        const outHeaders = {
            'host': target.hostname,
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
        };

        for (const [key, value] of Object.entries(req.headers)) {
            if (key.toLowerCase() !== 'host') {
                outHeaders[key] = value;
            }
        }
        
        const session = req.query.session || 'default';
        const cookieJar = cookieJars.get(session) || {};
        const cookieHeader = Object.values(cookieJar).join('; ');
        if (cookieHeader) {
            outHeaders['cookie'] = cookieHeader;
        }

        // --- Step 2: Make the request using Node's built-in fetch ---
        const upstreamResponse = await fetch(target.toString(), {
            method: req.method,
            headers: outHeaders,
            body: req.body,
            redirect: 'manual',
        });

        // --- Step 3: Handle the response ---

        // Handle redirects (e.g., HTTP 301, 302).
        if ([301, 302, 307, 308].includes(upstreamResponse.status)) {
            const location = upstreamResponse.headers.get('location');
            if (location) {
                const newProxyUrl = new URL(req.url, `https://${req.headers.host}`);
                newProxyUrl.searchParams.set('url', new URL(location, target.href).href);
                res.setHeader('location', newProxyUrl.toString());
                return res.status(upstreamResponse.status).send(`Redirecting to: ${location}`);
            }
        }

        // Capture and store any new cookies from the server.
        // THIS IS THE FIX: We iterate the headers to get cookies instead of using .raw()
        const setCookieHeaders = [];
        upstreamResponse.headers.forEach((value, key) => {
            if (key.toLowerCase() === 'set-cookie') {
                setCookieHeaders.push(value);
            }
        });
        
        if (setCookieHeaders.length > 0) {
            setCookieHeaders.forEach(cookieStr => {
                const [cookiePair] = cookieStr.split(';');
                const [cookieName] = cookiePair.split('=');
                if (cookieName) cookieJar[cookieName.trim()] = cookiePair.trim();
            });
            cookieJars.set(session, cookieJar);
        }

        // Copy headers from the server's response to our final response.
        upstreamResponse.headers.forEach((value, key) => {
            if (!RESPONSE_HEADERS_TO_STRIP.has(key.toLowerCase())) {
                res.setHeader(key, value);
            }
        });

        res.status(upstreamResponse.status);

        // Stream the response body directly to the client.
        if (upstreamResponse.body) {
            const bodyStream = Readable.fromWeb(upstreamResponse.body);
            bodyStream.pipe(res);
        } else {
            res.end();
        }

    } catch (err) {
        console.error('PROXY FATAL ERROR:', err);
        res.status(500).send(`Proxy Error: ${err.message}`);
    }
};
