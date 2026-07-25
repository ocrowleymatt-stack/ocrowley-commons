import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

export function loadLiteraryRules(): string {
  try {
    return readFileSync(join(here, '..', 'RULES.md'), 'utf8');
  } catch {
    return LITERARY_RULES_SUMMARY;
  }
}

export const LITERARY_RULES_SUMMARY = `Literary Engine standing rules:
1. Identify the real dramatic engine.
2. Story first, style second.
3. Never overwrite.
4. Concrete before abstract.
5. Subtext over declaration.
6. Every scene must turn.
7. Characters want something immediately.
8. Villains are heroes of their own stories.
9. Dialogue carries conflict.
10. Avoid generic emotion labels.
11. Use escalation.
12. Preserve mystery.
13. Cut repeated motifs.
14. Make place a character.
15. First line creates tension.
16. Endings inevitable but surprising.
17. Darkness ≠ depth.
18. Protect reader trust.
19. Keep voice consistent.
20. Hook → pressure → wound → desire → obstacle → escalation → reversal → cost → image.
21. Clarity > tension > character truth > rhythm > beauty > cleverness.
22. Ban filler.
23. Cut aggressively (25–40%).
24. Clarify genre spine.
25. Fictionalise properly.
26. Avoid tone saturation.`;
