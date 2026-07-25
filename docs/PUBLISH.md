# Publishing ocrowley-commons

This environment had no GitHub credentials, so push/PR could not be completed
automatically. The library is fully committed locally on branch
`cursor/ocrowley-commons-f5e3`.

## Option A — new dedicated repo (preferred)

```bash
cd ocrowley-commons
gh auth login
gh repo create ocrowleymatt-stack/ocrowley-commons --public --source=. --remote=origin
git push -u origin cursor/ocrowley-commons-f5e3
gh pr create --base main --head cursor/ocrowley-commons-f5e3 \
  --title "feat: ocrowley-commons shared library foundation" \
  --body "Extracts the highest-value reusable modules from Caspa, Shakespeare-, Life-os, and craigs-navigator. See docs/EXTRACTION_MAP.md and docs/ARCHITECTURE.md."
```

Or from the git bundle artifact:

```bash
git clone ocrowley-commons-cursor-ocrowley-commons-f5e3.bundle ocrowley-commons
cd ocrowley-commons
git checkout cursor/ocrowley-commons-f5e3
# then create remote + push as above
```

## Option B — land under Caspa first

A Caspa working tree already has commit content under `ocrowley-commons/` on
branch `cursor/ocrowley-commons-f5e3` (local only). After `gh auth login`:

```bash
cd /path/to/Caspa
git push -u origin cursor/ocrowley-commons-f5e3
gh pr create --base main --title "feat: add ocrowley-commons shared library foundation"
```

Later split into a dedicated repo when ready.
