# ARCA x Porta: Auth Callback & Server-to-Server Guide

This short guide shows how to configure the Porta redirect URL for ARCA and how to implement the callback and server-to-server calls safely.

## Redirect URL to configure in Porta

Add the callback route(s) to your Porta App in the Admin UI under Apps:
- Production: `https://arca-alpha.vercel.app/auth/callback/porta`
- Local: `http://localhost:3000/auth/callback/porta`

Add Allowed Origins accordingly:
- `https://arca-alpha.vercel.app`
- `http://localhost:3000`

## Frontend (Next.js) callback example

```tsx
// pages/auth/callback/porta.tsx (Next.js Pages)
// or app/auth/callback/porta/page.tsx (App Router)
import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function PortaCallback() {
  const router = useRouter();

  useEffect(() => {
    const { code, state, error } = router.query;
    if (error) {
      // Show error UI or route elsewhere
      return;
    }
    if (code) {
      fetch('/api/porta/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, state }),
      })
        .then(res => res.json())
        .then(() => router.replace('/'))
        .catch(() => {/* surface error */});
    }
  }, [router]);

  return <div>Connecting to Porta…</div>;
}
```

## Backend exchange endpoint example

Never expose the Porta app secret to the browser. Keep it only on the server.

```ts
// pages/api/porta/exchange.ts
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { code, state } = req.body || {};
  if (!code) return res.status(400).json({ error: 'Missing code' });

  const portaBase = process.env.PORTA_BASE_URL || 'https://porta-gateway.vercel.app';
  const appName = process.env.PORTA_APP_NAME!;
  const appSecret = process.env.PORTA_APP_SECRET!; // store securely (Vercel env)

  const resp = await fetch(`${portaBase}/api/oauth/exchange`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Server-to-server only
      'x-porta-app-name': appName,
      'x-porta-app-secret': appSecret,
    },
    body: JSON.stringify({ code, state }),
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    return res.status(400).json({ error: data?.error || 'Exchange failed' });
  }

  // Persist ARCA session (cookie/db) as needed here
  return res.status(200).json({ success: true });
}
```

## Server-to-server headers

From ARCA server to Porta (examples):
- `x-porta-app-name: <your app_name>`
- `x-porta-app-secret: <your app_secret>`
- `Content-Type: application/json`

These must never be sent from the browser.

## Getting the app secret

In Porta Admin UI -> Apps:
- Click "Copy Secret" to retrieve via `POST /api/admin/apps?action=get_secret&app_name=...`.
- Store it in ARCA server env: `PORTA_APP_SECRET`.

## Notes

- Rotate secrets in Porta Admin UI when compromised or as routine maintenance; update ARCA env accordingly.
- Keep your redirect URLs and allowed origins in sync across environments.
