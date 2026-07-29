const STORAGE_KEY = 'ocrowley-who-settings';

const els = {
  form: document.getElementById('who-form'),
  q: document.getElementById('q'),
  btnLookup: document.getElementById('btn-lookup'),
  viewSearch: document.getElementById('view-search'),
  viewResults: document.getElementById('view-results'),
  stats: document.getElementById('stats'),
  tools: document.getElementById('tools'),
  openNext: document.getElementById('open-next'),
  report: document.getElementById('report'),
  hits: document.getElementById('hits'),
  more: document.getElementById('more-links'),
  warning: document.getElementById('warning'),
  archiveMeta: document.getElementById('archive-meta'),
  btnBack: document.getElementById('btn-back'),
  btnPrint: document.getElementById('btn-print'),
  btnSettings: document.getElementById('btn-settings'),
  dialog: document.getElementById('settings-dialog'),
  settingsForm: document.getElementById('settings-form'),
  btnCloseSettings: document.getElementById('btn-close-settings'),
  settingsStatus: document.getElementById('settings-status'),
  setCase: document.getElementById('set-case'),
  setDeep: document.getElementById('set-deep'),
  setFull: document.getElementById('set-full'),
  setCli: document.getElementById('set-cli'),
  setHibp: document.getElementById('set-hibp'),
  setCh: document.getElementById('set-ch'),
  setSf: document.getElementById('set-sf'),
  setBb: document.getElementById('set-bb'),
  setSd: document.getElementById('set-sd'),
  setTimeout: document.getElementById('set-timeout'),
};

function loadLocalSettings() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveLocalSettings(partial) {
  const next = { ...loadLocalSettings(), ...partial };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

async function api(path, options = {}) {
  const local = loadLocalSettings();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (local.caseRef) headers['X-OCROWLEY-OSINT-CASE'] = local.caseRef;
  const res = await fetch(path, { ...options, headers });
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) {
    const msg = typeof data === 'object' && data?.error ? data.error : String(data);
    throw new Error(msg);
  }
  return data;
}

async function hydrateSettingsForm() {
  const local = loadLocalSettings();
  let remote = {};
  try {
    remote = await api('/api/settings');
  } catch {
    /* offline / first paint */
  }
  els.setCase.value = local.caseRef || remote.caseRef || '';
  els.setDeep.checked = local.deep ?? remote.deep ?? true;
  els.setFull.checked = local.full ?? remote.full ?? true;
  els.setCli.checked = Boolean(local.enableCliTools ?? remote.enableCliTools);
  els.setSf.value = local.spiderfootUrl || remote.spiderfootUrl || '';
  els.setBb.value = local.bigbrotherBridgeUrl || remote.bigbrotherBridgeUrl || '';
  els.setSd.value = local.spiderdashUrl || remote.spiderdashUrl || '';
  els.setTimeout.value = local.bridgeTimeoutMs || remote.bridgeTimeoutMs || 180000;
  els.setHibp.value = '';
  els.setCh.value = '';
  const ready = remote.toolsReady != null ? `${remote.toolsReady} live · ${remote.bridgesReady || 0} bridges` : '';
  els.settingsStatus.textContent = ready
    ? `Tools ready: ${ready}`
    : remote.caseRef
      ? `Case on server: ${remote.caseRef}`
      : 'No case on server yet';
}

function showResults(data) {
  els.viewSearch.hidden = true;
  els.viewResults.hidden = false;
  els.btnPrint.hidden = false;
  els.viewResults.classList.remove('results');
  void els.viewResults.offsetWidth;
  els.viewResults.classList.add('results');

  const s = data.stats || {};
  els.stats.textContent = `${s.confirmed ?? 0} confirmed · ${s.likely ?? 0} likely · ${s.possible ?? 0} possible · ${s.checked ?? 0} checked`;
  const tools = data.toolsUsed || [];
  const rec = data.recursive;
  els.tools.textContent = tools.length
    ? `Tools · ${tools.slice(0, 18).join(', ')}${tools.length > 18 ? '…' : ''}${
        rec ? ` · score ${rec.score} · ${rec.sweeps} sweeps` : ''
      }`
    : '';
  els.openNext.href = data.next || '#';
  els.openNext.textContent = data.next ? 'Open next' : 'No next link';
  els.report.textContent = data.text || '';
  els.warning.textContent = data.warning || '';
  els.archiveMeta.textContent = data.archiveId ? `Archived as ${data.archiveId}` : '';

  els.hits.innerHTML = '';
  for (const hit of data.hits || []) {
    const row = document.createElement('article');
    row.className = 'hit';
    const conf = document.createElement('div');
    conf.className = `conf ${hit.confidence || ''}`;
    conf.textContent = hit.confidence || 'possible';
    row.appendChild(conf);
    if (hit.url) {
      const a = document.createElement('a');
      a.href = hit.url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = hit.title;
      row.appendChild(a);
    } else {
      const t = document.createElement('strong');
      t.textContent = hit.title;
      row.appendChild(t);
    }
    const detail = document.createElement('p');
    detail.textContent = hit.detail || '';
    row.appendChild(detail);
    els.hits.appendChild(row);
  }

  els.more.innerHTML = '';
  for (const link of (data.open || []).slice(0, 8)) {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = link.url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = `${link.engine}: ${link.label}`;
    li.appendChild(a);
    els.more.appendChild(li);
  }
}

function showSearch() {
  els.viewResults.hidden = true;
  els.viewSearch.hidden = false;
  els.btnPrint.hidden = true;
  els.q.focus();
}

els.form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const q = els.q.value.trim();
  if (!q) return;
  const local = loadLocalSettings();
  if (!local.caseRef) {
    els.dialog.showModal();
    els.settingsStatus.textContent = 'Set a case ref before looking anyone up.';
    return;
  }
  els.btnLookup.disabled = true;
  els.btnLookup.textContent = local.full === false ? 'Looking…' : 'Full scan…';
  try {
    const data = await api('/api/who', {
      method: 'POST',
      body: JSON.stringify({
        q,
        deep: local.deep !== false,
        full: local.full !== false,
        enableCliTools: Boolean(local.enableCliTools),
        case: local.caseRef,
      }),
    });
    showResults(data);
  } catch (err) {
    alert(err.message || String(err));
  } finally {
    els.btnLookup.disabled = false;
    els.btnLookup.textContent = 'Look up';
  }
});

els.btnBack.addEventListener('click', showSearch);
els.btnPrint.addEventListener('click', () => window.print());
els.btnSettings.addEventListener('click', async () => {
  await hydrateSettingsForm();
  els.dialog.showModal();
});
els.btnCloseSettings.addEventListener('click', () => els.dialog.close());

els.settingsForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    caseRef: els.setCase.value.trim(),
    deep: els.setDeep.checked,
    full: els.setFull.checked,
    enableCliTools: els.setCli.checked,
    spiderfootUrl: els.setSf.value.trim(),
    bigbrotherBridgeUrl: els.setBb.value.trim(),
    spiderdashUrl: els.setSd.value.trim(),
    bridgeTimeoutMs: Number(els.setTimeout.value || 180000),
  };
  if (els.setHibp.value.trim()) payload.hibpApiKey = els.setHibp.value.trim();
  if (els.setCh.value.trim()) payload.companiesHouseApiKey = els.setCh.value.trim();

  saveLocalSettings(payload);

  try {
    const remote = await api('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    els.settingsStatus.textContent = `Saved. Case ${remote.caseRef || payload.caseRef} · full=${remote.full}`;
    els.setHibp.value = '';
    els.setCh.value = '';
  } catch (err) {
    els.settingsStatus.textContent = err.message || String(err);
  }
});

// Defaults: full power on first visit
if (!localStorage.getItem(STORAGE_KEY)) {
  saveLocalSettings({ deep: true, full: true });
}

hydrateSettingsForm().catch(() => {});
