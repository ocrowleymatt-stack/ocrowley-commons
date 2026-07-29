# Publishing / deploying ocrowley-commons

## WHO product (recommended next)

Private people-OSINT deploy is documented in [DEPLOY_WHO.md](DEPLOY_WHO.md).

```bash
cp deploy/who/.env.example deploy/who/.env
# set OCROWLEY_OSINT_CASE (+ optional API keys)
docker compose -f deploy/who/docker-compose.yml --env-file deploy/who/.env up -d --build
bash packages/osint/scripts/who-smoke.sh
```

Branch: `cursor/ocrowley-commons-f5e3` · PR: https://github.com/ocrowleymatt-stack/ocrowley-commons/pull/1

## Library publish (packages)

```bash
npm install
npm run build
npm test
pip install -e python/ocrowley_osint
pytest python/tests -q
```

Packages stay private workspace versions (`0.1.0`) until you choose an npm/PyPI publish path.
