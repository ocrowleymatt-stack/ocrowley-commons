# @ocrowley/osint

## People — one call

```ts
import { who } from '@ocrowley/osint';

const r = await who('Jane Doe at Acme in Manchester');
console.log(r.text);  // printable report
console.log(r.next);  // best URL to open now
```

Also: `who('jane@acme.com')` · `who('@janedoe')` · `who('Jane Doe', { deep: true, case: 'CASE-42' })`

CLI:

```bash
npm run who -w @ocrowley/osint -- "Jane Doe at Acme in Manchester"
# or: ocrowley-who "Jane Doe" --deep
```

### What it does

Parses name / `at` / `in` / email / `@user` from one string, then in parallel:

1. Live-probes high-signal platforms (GET + soft-404)
2. Guesses work emails from employer → Gravatar (+ HIBP if keyed)
3. Companies House officers (if `COMPANIES_HOUSE_API_KEY`)
4. Wayback on confirmed profiles
5. Optional `deep: true` → Ahmia
6. Returns `next` + ranked follow-up links

Env: `OCROWLEY_OSINT_CASE`, `HIBP_API_KEY`, `COMPANIES_HOUSE_API_KEY`, `OCROWLEY_OSINT_DEEP=1`.

Lawful use only. Leads ≠ evidence.
