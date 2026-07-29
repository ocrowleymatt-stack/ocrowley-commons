export interface PsychTechnique {
  id: string;
  name: string;
  description: string;
  whyItWorks: string;
  howToApply: string;
  bestFor: string[];          // narrative functions
  genres: string[];
  forbiddenMistake: string;
}

export const PSYCHOLOGY_LIBRARY: PsychTechnique[] = [
  {
    id: "zeigarnik",
    name: "Zeigarnik / Ovsiankina Effect",
    description: "End scenes with unresolved tasks, interrupted actions, or unanswered questions. The brain craves closure and will compel readers to continue.",
    whyItWorks: "Incomplete tasks create cognitive tension (Zeigarnik effect). The Ovsiankina effect means readers feel a psychological urge to see interrupted actions completed.",
    howToApply: "End every scene or chapter mid-action, mid-revelation, or with a question just posed. Never fully resolve the immediate tension — leave one thread dangling.",
    bestFor: ["setup", "escalation", "bridge", "plot_point_1", "midpoint"],
    genres: ["Thriller", "Mystery", "Crime", "Horror", "Romance"],
    forbiddenMistake: "Overusing cliffhangers at every scene end — readers habituate and the effect dies. Reserve for chapter ends and key turning points.",
  },
  {
    id: "curiosity_gap",
    name: "Curiosity Gap",
    description: "Pose a question or reveal partial information early, then delay the answer. The brain is wired to close informational loops.",
    whyItWorks: "Information gaps activate the anterior cingulate cortex — the same region involved in physical pain. Readers experience mild discomfort until the gap is closed.",
    howToApply: "Open scenes with a statement that implies a question ('She had not told him what she found'). Delay the answer by at least one scene. Never answer two questions without opening a new one.",
    bestFor: ["setup", "revelation", "plot_point_1", "dark_night"],
    genres: ["Thriller", "Mystery", "Literary Fiction", "Psychological Fiction"],
    forbiddenMistake: "Posing questions and never answering them. Readers feel cheated. Every gap must close — the question is when, not whether.",
  },
  {
    id: "transportation",
    name: "Narrative Transportation",
    description: "Immerse readers so completely in the story world that they lose awareness of their surroundings. Achieved through sensory specificity, character identification, and narrative momentum.",
    whyItWorks: "Transportation theory (Green & Brock, 2000) shows that transported readers are more persuaded by narrative arguments, more emotionally affected, and remember the story longer.",
    howToApply: "Use all five senses in scene-setting. Give characters specific, non-generic desires. Maintain consistent POV. Avoid anything that breaks the dream (anachronisms, POV slips, info-dumps).",
    bestFor: ["inciting_incident", "climax", "character_moment", "world_building"],
    genres: ["All genres"],
    forbiddenMistake: "Info-dumping backstory or world-building mid-scene. Transportation requires momentum — any pause to explain breaks the spell.",
  },
  {
    id: "wound_want_need",
    name: "Wound / Want / Need Framework",
    description: "Every protagonist has a wound (formative trauma), a want (conscious goal), and a need (unconscious truth they must accept). The story is the gap between want and need.",
    whyItWorks: "Readers identify with characters whose inner contradictions mirror their own. The want/need gap creates dramatic irony — we see what the character cannot — which generates both sympathy and tension.",
    howToApply: "Define the wound in backstory. Make the want explicit in Act 1. Keep the need hidden until the dark night of the soul. The climax is the moment the character chooses need over want (or refuses to, in tragedy).",
    bestFor: ["inciting_incident", "plot_point_1", "midpoint", "dark_night", "climax", "denouement"],
    genres: ["Literary Fiction", "Drama", "Thriller", "Romance", "Historical Fiction"],
    forbiddenMistake: "Making the want and need identical. If the character already knows what they need, there is no arc. The tension lives in the gap.",
  },
  {
    id: "contradiction_as_character",
    name: "Contradiction as Character",
    description: "Give characters opposing traits or desires that coexist in tension. A brave person who is terrified of intimacy. A villain who loves their child. Contradiction is the signature of a real person.",
    whyItWorks: "Human beings are inherently contradictory. Characters without contradiction feel like archetypes, not people. Contradiction triggers the reader's theory-of-mind system, creating the sense of a real inner life.",
    howToApply: "For every dominant trait, give the character a contradicting behaviour in at least one scene. Let the contradiction be unexplained — the reader will supply the psychology.",
    bestFor: ["character_moment", "revelation", "climax"],
    genres: ["Literary Fiction", "Crime", "Psychological Thriller", "Historical Fiction"],
    forbiddenMistake: "Explaining the contradiction. 'He was kind but also cruel because of his childhood' kills the mystery. Show the contradiction; never explain it.",
  },
  {
    id: "peak_end_rule",
    name: "Peak-End Rule",
    description: "Readers remember a scene primarily by its emotional peak and its final moment. Everything else fades. Design scenes so the peak is intentional and the ending resonates.",
    whyItWorks: "Kahneman's peak-end rule: memory of an experience is determined by the average of its most intense moment and its final moment, not its duration or average quality.",
    howToApply: "Identify the single most intense moment in each scene (the peak). Make it land hard — maximum specificity, minimum hedging. Then design the final line of the scene to resonate emotionally, not just advance plot.",
    bestFor: ["climax", "reversal", "revelation", "dark_night", "character_moment"],
    genres: ["All genres"],
    forbiddenMistake: "Burying the peak in the middle of a scene and ending on logistics. The last line of a scene is what the reader carries into the next one.",
  },
  {
    id: "iceberg_dialogue",
    name: "Iceberg Dialogue (Subtext)",
    description: "Characters never say exactly what they mean. The real conversation happens beneath the surface. What is not said is more powerful than what is.",
    whyItWorks: "Subtext engages the reader as an active participant — they must decode the real meaning. This creates intimacy (we know what the character won't say) and tension (we wait for the surface to crack).",
    howToApply: "Write the scene with characters saying exactly what they mean. Then rewrite it removing every direct statement of feeling or intent. Replace with action, deflection, or a change of subject. The subtext should be deducible but never stated.",
    bestFor: ["character_moment", "revelation", "escalation", "climax"],
    genres: ["Literary Fiction", "Crime", "Drama", "Thriller"],
    forbiddenMistake: "Having characters explain their subtext ('I'm not angry, I'm just disappointed'). If a character names their subtext, it becomes text — and the power evaporates.",
  },
  {
    id: "accordion_pacing",
    name: "Accordion Pacing",
    description: "Expand time during moments of maximum tension (slow it down with sensory detail and internal thought). Compress time during transitions and low-stakes scenes. The reader should feel the rhythm.",
    whyItWorks: "Pacing mimics physiological arousal. Short sentences and paragraphs accelerate reading, mimicking a racing heart. Long, complex sentences slow the reader, creating space for reflection or dread.",
    howToApply: "In high-tension scenes: short sentences, present-tense verbs, no subordinate clauses. In reflective scenes: longer sentences, past-tense, sensory detail. At the peak of a scene: one-sentence paragraphs. White space is pacing.",
    bestFor: ["climax", "dark_night", "escalation", "reversal"],
    genres: ["Thriller", "Horror", "Crime", "Action"],
    forbiddenMistake: "Monotonous pacing — maintaining the same sentence length and paragraph density throughout. Readers habituate and the sense of urgency dies.",
  },
  {
    id: "sensory_anchoring",
    name: "Sensory Anchoring",
    description: "Ground every scene in at least two non-visual senses. Smell and sound are the most under-used and most powerful for creating place-memory and emotional resonance.",
    whyItWorks: "Olfactory memory is processed by the limbic system, bypassing the cortex — smell triggers emotion and memory more directly than any other sense. Readers who smell a scene remember it.",
    howToApply: "For each scene, identify the dominant smell, the ambient sound, and one tactile sensation. Introduce them in the first paragraph. Return to them at the scene's emotional peak to anchor the memory.",
    bestFor: ["world_building", "character_moment", "inciting_incident", "climax"],
    genres: ["Literary Fiction", "Historical Fiction", "Crime", "Horror"],
    forbiddenMistake: "Listing sensory details as inventory ('The room smelled of coffee, wood polish, and old books'). Sensory details must be attached to character perception and emotion to work.",
  },
  {
    id: "ticking_clock",
    name: "Ticking Clock",
    description: "Introduce an explicit deadline or time pressure that the reader is always aware of. The clock creates urgency that persists even in quiet scenes.",
    whyItWorks: "Time pressure activates the same neural circuits as real-world threat. The reader experiences low-level stress that keeps them turning pages even when the scene itself is not action-driven.",
    howToApply: "Establish the deadline in Act 1. Remind the reader of it at the start of every chapter. Shorten it unexpectedly at the midpoint. Make it feel impossible at the dark night of the soul.",
    bestFor: ["plot_point_1", "midpoint", "escalation", "dark_night"],
    genres: ["Thriller", "Crime", "Horror", "Adventure"],
    forbiddenMistake: "Forgetting the clock. If the reader stops feeling the time pressure, the urgency dies. The clock must be referenced at least once per chapter.",
  },
  {
    id: "place_as_character",
    name: "Place as Character",
    description: "The setting should have agency — it should resist or assist the protagonist, reflect their inner state, and change as the story changes.",
    whyItWorks: "Pathetic fallacy and environmental psychology show that readers project emotional states onto described environments. A setting that mirrors the protagonist's psychology deepens immersion and emotional resonance.",
    howToApply: "At the start of each scene, ask: what does this place want? How does it feel about the protagonist? Let the description answer those questions. The setting should feel like it has a point of view.",
    bestFor: ["world_building", "character_moment", "dark_night", "climax"],
    genres: ["Literary Fiction", "Horror", "Historical Fiction", "Gothic"],
    forbiddenMistake: "Describing settings as neutral backdrops. Every setting choice is an emotional choice. A neutral setting is a missed opportunity.",
  },
  {
    id: "dramatic_irony",
    name: "Dramatic Irony",
    description: "The reader knows something the character does not. This gap between reader knowledge and character knowledge creates sustained tension and emotional investment.",
    whyItWorks: "Dramatic irony engages the reader's theory-of-mind system and creates anticipatory anxiety. We want to warn the character. This desire keeps us reading.",
    howToApply: "Reveal information to the reader before the protagonist has it. Then write scenes where the protagonist acts on their incomplete knowledge. The reader watches the gap between what is and what the character believes.",
    bestFor: ["setup", "escalation", "plot_point_1", "dark_night"],
    genres: ["Thriller", "Mystery", "Literary Fiction", "Tragedy"],
    forbiddenMistake: "Resolving dramatic irony too quickly. The tension lives in the gap. Once the character knows what the reader knows, the irony is gone — use this moment deliberately.",
  },
];

// ─── Genre DNA ────────────────────────────────────────────────────────────────

export function selectPsychTechniques(
  narrativeFunction: string,
  genre: string,
  maxTechniques = 3,
): PsychTechnique[] {
  const normalizedGenre = genre.toLowerCase();

  // Score each technique by relevance
  const scored = PSYCHOLOGY_LIBRARY.map(t => {
    let score = 0;
    if (t.bestFor.includes(narrativeFunction as string)) score += 3;
    if (t.genres.some(g => g.toLowerCase() === "all genres" || normalizedGenre.includes(g.toLowerCase()))) score += 2;
    if (t.bestFor.length <= 4) score += 1; // prefer specific techniques
    return { t, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxTechniques)
    .map(s => s.t);
}

/**
 * Build a compact psychology techniques prompt fragment for injection into scene write prompts.
 */
export function getPsychTechniquesPrompt(narrativeFunction: string, genre: string): string {
  const techniques = selectPsychTechniques(narrativeFunction, genre, 3);
  if (techniques.length === 0) return "";
  return `
=== PSYCHOLOGICAL CRAFT TECHNIQUES (apply these in this scene) ===
${techniques.map((t, i) => `${i+1}. ${t.name}: ${t.howToApply}\n   AVOID: ${t.forbiddenMistake}`).join("\n")}
`.trim();
}

// ─── Research Library ─────────────────────────────────────────────────────────


export const ANTI_PATTERN_SYSTEM_PROMPT = `
=== WRITING QUALITY STANDARDS (non-negotiable) ===

REPETITION RULES:
- Never repeat a word, phrase, image, or idea that appeared in the previous 500 words unless for deliberate stylistic effect
- Never describe the same character action twice in different words in the same scene
- Never restate what the reader already knows — trust the reader
- If you find yourself writing "again", "once more", "as before" — stop and cut

OVER-DESCRIPTION RULES:
- One precise detail is worth ten vague ones. Choose the detail that does the most work.
- Never describe a character's appearance unless it serves the scene's emotional purpose
- Never describe a setting for more than three sentences unless the setting IS the scene
- Never use an adverb when a stronger verb is available
- Never use two adjectives when one will do

SHOW DON'T TELL:
- Never name an emotion directly — show the physical, behavioural, or cognitive manifestation
- "She was angry" → show what anger looks like in this specific character's body
- "He was afraid" → show the specific texture of this character's fear

SENTENCE VARIETY:
- Vary sentence length deliberately. Short sentences create urgency. Longer sentences slow the reader and allow reflection.
- Never write three sentences of the same length in a row
- The most important sentence in any paragraph should be the shortest

DIALOGUE:
- Every line of dialogue must do at least two things: advance plot OR reveal character AND carry subtext
- No dialogue tag other than "said" unless the manner of speaking is essential information
- Never use dialogue to convey information the characters already know ("As you know, Bob...")
`.trim();


// ─── Craft Library ────────────────────────────────────────────────────────────

export interface CraftEntry {
  id: string;
  name: string;
  category: string;
  description: string;
  application: string;
  forbiddenMistake: string;
  genres: string[];
  usefulness: number;
}

export const CRAFT_LIBRARY: CraftEntry[] = [
  // ── Narrative Structure ──
  {
    id: "three_act_structure",
    name: "Three-Act Structure",
    category: "narrative_structure",
    description: "The foundational story architecture: Setup (Act 1, ~25%), Confrontation (Act 2, ~50%), Resolution (Act 3, ~25%). Act 1 ends with the inciting incident and lock-in; Act 2 ends with the dark night of the soul; Act 3 delivers the climax and resolution.",
    application: "Map your story beats before writing. Act 1 must establish the protagonist's ordinary world, introduce the central question, and end with a point of no return. The midpoint of Act 2 must raise the stakes irreversibly. Act 3 must answer the central question established in Act 1.",
    forbiddenMistake: "A sagging middle — Act 2 without a clear midpoint reversal. The midpoint must change the protagonist's goal or raise the stakes so dramatically that the story cannot return to its Act 1 state.",
    genres: ["all"],
    usefulness: 5,
  },
  {
    id: "save_the_cat_beats",
    name: "Save the Cat Beat Sheet",
    category: "narrative_structure",
    description: "Blake Snyder's 15-beat story structure: Opening Image, Theme Stated, Set-Up, Catalyst, Debate, Break into Two, B Story, Fun and Games, Midpoint, Bad Guys Close In, All Is Lost, Dark Night of the Soul, Break into Three, Finale, Final Image.",
    application: "Use as a diagnostic tool when a story feels structurally loose. Each beat has a target page/word-count position. The 'All Is Lost' beat (75%) must be the protagonist's lowest point. The Final Image must mirror and contrast the Opening Image to show transformation.",
    forbiddenMistake: "Treating the beat sheet as a rigid formula rather than a diagnostic. Stories that hit every beat mechanically feel predictable. Use it to identify what's missing, not to fill in boxes.",
    genres: ["Thriller", "Romance", "Action", "Comedy", "Drama"],
    usefulness: 5,
  },
  {
    id: "heros_journey",
    name: "The Hero's Journey",
    category: "narrative_structure",
    description: "Joseph Campbell's monomyth: Ordinary World → Call to Adventure → Refusal → Meeting the Mentor → Crossing the Threshold → Tests/Allies/Enemies → Approach to the Inmost Cave → Ordeal → Reward → The Road Back → Resurrection → Return with the Elixir.",
    application: "Most useful for fantasy, adventure, and coming-of-age stories. The 'Ordeal' (the central death-and-rebirth moment) must be a genuine transformation — the hero who returns is not the same person who left. The 'Elixir' must benefit the ordinary world, not just the hero.",
    forbiddenMistake: "Conflating the Hero's Journey with the Three-Act Structure. They are different frameworks. The Journey is about transformation and mythic resonance; the Three-Act is about dramatic tension and resolution.",
    genres: ["Fantasy", "Adventure", "Sci-Fi", "Literary Fiction", "Coming-of-Age"],
    usefulness: 4,
  },
  {
    id: "fichtean_curve",
    name: "Fichtean Curve",
    category: "narrative_structure",
    description: "A structure that begins in medias res with an immediate crisis, then escalates through a series of crises of increasing intensity, each one raising the stakes before the climax and resolution. There is no traditional 'setup' phase.",
    application: "Ideal for short stories and thrillers. Begin at the moment of first crisis, not before. Each subsequent crisis must be more threatening than the last. The reader learns backstory through action, not exposition.",
    forbiddenMistake: "Mistaking a series of random events for a Fichtean escalation. Each crisis must causally connect to the next and must raise the central stakes. Random bad things happening is not escalation.",
    genres: ["Thriller", "Horror", "Crime", "Short Fiction"],
    usefulness: 4,
  },
  {
    id: "kishōtenketsu",
    name: "Kishōtenketsu (Four-Act Structure)",
    category: "narrative_structure",
    description: "Japanese/Chinese four-act structure without Western-style conflict: Ki (introduction), Shō (development), Ten (twist — an unexpected element that recontextualises everything), Ketsu (reconciliation). Conflict is not the engine; surprise and recontextualisation are.",
    application: "Use when writing literary fiction, character studies, or cross-cultural narratives where Western conflict-driven structure feels imposed. The 'Ten' twist must be genuinely surprising but, in retrospect, inevitable. The 'Ketsu' must show how the twist changes the meaning of everything that came before.",
    forbiddenMistake: "Adding Western conflict to a Kishōtenketsu structure. The power of this form is its refusal of conflict as the primary driver. Adding a villain or antagonist undermines the form.",
    genres: ["Literary Fiction", "Magical Realism", "Cross-Cultural Fiction", "Short Fiction"],
    usefulness: 3,
  },
  // ── Character Construction ──
  {
    id: "wound_want_need_craft",
    name: "Wound / Want / Need Framework",
    category: "character_construction",
    description: "Every compelling protagonist has three layers: the Wound (a past trauma that shapes their worldview), the Want (the conscious external goal they pursue), and the Need (the internal truth they must accept to grow). The Want and Need must be in conflict.",
    application: "Establish all three before writing. The Want drives the plot; the Need drives the character arc. The story is resolved when the protagonist either accepts the Need (positive arc) or rejects it (negative arc). The Wound must be revealed gradually through behaviour, not exposition.",
    forbiddenMistake: "Making the Want and Need the same thing. If the protagonist wants what they need, there is no arc. The tension between Want and Need is the engine of character transformation.",
    genres: ["all"],
    usefulness: 5,
  },
  {
    id: "character_arc_types",
    name: "Character Arc Types",
    category: "character_construction",
    description: "Three primary arc types: Positive Change Arc (protagonist overcomes their misbelief and grows), Negative Change Arc (protagonist succumbs to their misbelief and falls), Flat Arc (protagonist's truth is correct and they change the world around them rather than themselves).",
    application: "Choose the arc type before writing. Positive arcs require a misbelief that is genuinely limiting. Negative arcs require the reader to understand why the protagonist's flaw is seductive. Flat arcs require the protagonist to be tested by a world that challenges their truth.",
    forbiddenMistake: "Writing a positive arc where the protagonist's misbelief is never genuinely tempting. If the reader never understands why the protagonist holds their false belief, the arc has no emotional weight.",
    genres: ["all"],
    usefulness: 5,
  },
  {
    id: "the_ghost",
    name: "The Ghost (Character Backstory)",
    category: "character_construction",
    description: "The Ghost is the specific past event that haunts the protagonist and created their Wound. It is not the same as backstory — it is the single most formative trauma that explains why the protagonist behaves as they do in the present story.",
    application: "Identify the Ghost before writing. It should be specific, not general. The Ghost should surface in the story at the moment of greatest pressure.",
    forbiddenMistake: "Revealing the Ghost too early through direct exposition. The Ghost should be felt before it is explained. The reader should sense the wound in the protagonist's behaviour before they understand its source.",
    genres: ["all"],
    usefulness: 4,
  },
  {
    id: "the_mask",
    name: "The Mask (Character Persona)",
    category: "character_construction",
    description: "The Mask is the persona the protagonist presents to the world to protect their Wound. It is the gap between who they appear to be and who they are. The story strips away the Mask to reveal the true self.",
    application: "Define the Mask explicitly: what does the protagonist want others to think of them? How does this persona protect them from their Wound? The Mask should be convincing enough that other characters believe it. The story's climax should require the protagonist to drop the Mask.",
    forbiddenMistake: "Making the Mask obviously false from the start. If the reader can see through the Mask immediately, there is no dramatic irony and no revelation when it falls.",
    genres: ["all"],
    usefulness: 4,
  },
  // ── Scene Construction ──
  {
    id: "scene_sequel_structure",
    name: "Scene / Sequel Structure",
    category: "scene_construction",
    description: "Every unit of fiction alternates between Scenes (Goal → Conflict → Disaster) and Sequels (Reaction → Dilemma → Decision). Scenes advance the plot; Sequels process the emotional fallout and set up the next goal.",
    application: "Every scene must have a clear goal for the POV character. The conflict must prevent the goal from being achieved easily. The disaster must be a genuine setback. The sequel must show the emotional cost before the character decides on a new goal.",
    forbiddenMistake: "Skipping the Sequel. When scenes follow each other without emotional processing, the story feels mechanical and the reader cannot connect with the character's inner life.",
    genres: ["all"],
    usefulness: 5,
  },
  {
    id: "mru",
    name: "Motivation-Reaction Unit (MRU)",
    category: "scene_construction",
    description: "The smallest unit of fiction: Motivation (external stimulus) followed by Reaction (internal feeling → reflex action → rational action → speech). The order is fixed: stimulus always precedes response; internal response always precedes external action.",
    application: "Check every action-reaction sequence. The reader must see the cause before the effect. Internal feelings must precede physical reactions. Characters must feel before they act, not the reverse.",
    forbiddenMistake: "Reversed MRU order: character acts before the reader sees the stimulus, or speaks before they feel. This creates a sense of unreality and disconnects the reader from the character's experience.",
    genres: ["all"],
    usefulness: 5,
  },
  {
    id: "scene_goals",
    name: "Scene Goals and Disasters",
    category: "scene_construction",
    description: "Every scene must end in one of three ways: Yes (goal achieved — rare, creates complication), No (goal failed — most common), or Yes But / No And (partial success with new complication, or failure with additional problem). Pure 'Yes' endings kill momentum.",
    application: "Before writing each scene, define: What does the POV character want? What stands in their way? How does the scene end? If the scene ends with a pure 'Yes', add a complication. If the scene ends with nothing, cut it.",
    forbiddenMistake: "Scenes that end with 'nothing happened'. Every scene must change the story's situation. If the protagonist is in the same position at the end of a scene as at the beginning, the scene is not earning its place.",
    genres: ["all"],
    usefulness: 5,
  },
  // ── Prose Craft ──
  {
    id: "show_dont_tell",
    name: "Show Don't Tell (and When to Tell)",
    category: "prose_craft",
    description: "Showing means rendering experience through specific sensory detail, action, and dialogue so the reader draws their own conclusions. Telling means summarising or stating conclusions directly. Both are valid — show emotional and dramatic moments, tell transitional and expository ones.",
    application: "Show: character emotions at dramatic peaks, character relationships, theme. Tell: time passing, backstory that is not dramatically active, minor events. The test: if a moment is important enough to slow down for, show it. If it is scaffolding, tell it efficiently.",
    forbiddenMistake: "Showing everything. Showing a character brushing their teeth in real-time is not craft — it is self-indulgence. Telling has a legitimate role in pacing and efficiency.",
    genres: ["all"],
    usefulness: 5,
  },
  {
    id: "free_indirect_discourse",
    name: "Free Indirect Discourse",
    category: "prose_craft",
    description: "A narrative technique that blends third-person narration with the character's inner voice without attribution tags. The narrator adopts the character's vocabulary, syntax, and perspective without 'she thought' or 'he felt'.",
    application: "Use to create deep intimacy in close third-person narration. The character's voice should be distinguishable from the narrator's. Use for emotional peaks and moments of self-deception.",
    forbiddenMistake: "Inconsistent register. If the narrator's voice and the character's voice are indistinguishable throughout, free indirect discourse loses its power.",
    genres: ["Literary Fiction", "Historical Fiction", "Crime", "Thriller"],
    usefulness: 4,
  },
  {
    id: "filtering",
    name: "Filtering (and How to Remove It)",
    category: "prose_craft",
    description: "Filtering is the use of perception verbs ('she saw', 'he heard', 'she noticed', 'he felt') that place a layer of distance between the reader and the experience. Removing filters brings the reader directly into the character's perception.",
    application: "Search for: saw, heard, noticed, felt, thought, wondered, realised, smelled, tasted. In most cases, remove the filter and render the perception directly. 'She saw the door was open' → 'The door was open.'",
    forbiddenMistake: "Removing all filters. Filters are sometimes the right tool — particularly for unreliable narrators, moments of dissociation, or when the character's act of perceiving is itself significant.",
    genres: ["all"],
    usefulness: 5,
  },
  {
    id: "iceberg_principle",
    name: "The Iceberg Principle",
    category: "prose_craft",
    description: "Hemingway's theory: the dignity of movement of an iceberg is due to only one-eighth of it being above water. The writer knows everything; the reader sees only the surface. The submerged seven-eighths gives the visible eighth its weight.",
    application: "Know your characters' full history, motivation, and psychology — then leave most of it out. The reader should sense the depth without being told about it. Subtext is the iceberg below the waterline.",
    forbiddenMistake: "Explaining the subtext. If a scene has emotional power, do not follow it with a paragraph explaining what it meant. Trust the reader.",
    genres: ["Literary Fiction", "Crime", "Thriller", "Historical Fiction"],
    usefulness: 5,
  },
  {
    id: "interiority",
    name: "Interiority",
    category: "prose_craft",
    description: "Interiority is the rendering of a character's inner life — thoughts, feelings, memories, sensory perceptions, desires — in real time, as the story unfolds. It is the primary advantage of prose fiction over film.",
    application: "Interiority should be specific, not generic. 'She was scared' is not interiority. 'Her mouth tasted of copper and she could not remember deciding to back against the wall' is. Interiority must be grounded in the body and the specific situation.",
    forbiddenMistake: "Generic emotional labels ('she felt sad', 'he was angry'). Emotional labels tell the reader what to feel rather than creating the conditions for the reader to feel it.",
    genres: ["all"],
    usefulness: 5,
  },
  // ── Dialogue Craft ──
  {
    id: "dialogue_subtext",
    name: "Dialogue Subtext",
    category: "dialogue_craft",
    description: "Characters rarely say what they mean directly. Subtext is the gap between what is said and what is meant. The most powerful dialogue operates on at least two levels simultaneously: the surface conversation and the real conversation underneath.",
    application: "For each dialogue exchange, ask: what does each character actually want? What are they afraid to say directly? The dialogue should approach the real conversation without quite reaching it.",
    forbiddenMistake: "On-the-nose dialogue — characters saying exactly what they mean and feel. 'I'm angry because you left me' has no subtext. 'I see you've redecorated' has all of it.",
    genres: ["all"],
    usefulness: 5,
  },
  {
    id: "said_attribution",
    name: "Said vs Attribution Tags",
    category: "dialogue_craft",
    description: "'Said' is invisible to the reader. Adverb-laden attribution tags ('she said angrily', 'he replied sarcastically') are visible and intrusive. The action beat is more powerful than any attribution tag.",
    application: "Default to 'said' and 'asked'. Use action beats instead of adverb tags. Reserve non-said tags (whispered, shouted) for genuine vocal register changes.",
    forbiddenMistake: "Using attribution tags to compensate for flat dialogue. If the dialogue needs 'she said sarcastically' to convey sarcasm, the dialogue is not doing its job.",
    genres: ["all"],
    usefulness: 5,
  },
  {
    id: "dialogue_as_conflict",
    name: "Dialogue as Conflict",
    category: "dialogue_craft",
    description: "Every dialogue exchange should have competing agendas. Each character wants something different from the conversation. The dialogue is a negotiation, a battle, or a dance — not an information exchange.",
    application: "Before writing dialogue, define each character's goal for the scene. What do they want the other person to do, believe, or feel? The dialogue should enact the conflict between these goals.",
    forbiddenMistake: "Dialogue as exposition delivery. Characters explaining the plot to each other ('As you know, Bob...') is not dialogue — it is author intrusion wearing a costume.",
    genres: ["all"],
    usefulness: 5,
  },
  // ── Point of View ──
  {
    id: "deep_pov",
    name: "Deep Point of View",
    category: "point_of_view",
    description: "Deep POV removes all distance between the reader and the character's experience. No narrator intrusion, no filtering, no authorial commentary. The reader lives inside the character's skull.",
    application: "Remove: filter words (saw, heard, felt), attribution tags where possible, adverbs, and any sentence that could only be written by an omniscient narrator. Every sentence should be something the POV character could think or perceive.",
    forbiddenMistake: "Deep POV without a distinctive character voice. Deep POV is not just removing filters — it requires the character's specific vocabulary, syntax, and worldview to permeate the prose.",
    genres: ["Romance", "Thriller", "Crime", "Literary Fiction"],
    usefulness: 5,
  },
  {
    id: "head_hopping",
    name: "Head-Hopping (and How to Avoid It)",
    category: "point_of_view",
    description: "Head-hopping is switching POV character within a scene without a clear break. It destroys reader immersion and prevents deep emotional engagement with any single character.",
    application: "Commit to one POV per scene. If you need another character's perspective, use a scene break (***) or a new chapter. The POV character can only know what they can directly perceive, infer, or have been told.",
    forbiddenMistake: "Omniscient narration mistaken for head-hopping. True omniscient narration has a consistent, authoritative narrative voice that stands above all characters.",
    genres: ["all"],
    usefulness: 5,
  },
  {
    id: "unreliable_narrator",
    name: "Unreliable Narrator",
    category: "point_of_view",
    description: "An unreliable narrator presents a distorted version of events — through self-deception, limited knowledge, psychological instability, or deliberate deception. The gap between what the narrator tells us and what is actually happening is the story's engine.",
    application: "Establish the unreliability early through small, deniable inconsistencies. The reader should be able to re-read the opening and see the clues they missed. The revelation of unreliability should recontextualise everything that came before.",
    forbiddenMistake: "Unreliability without internal logic. The narrator's distortions must be consistent with their psychology. Random inconsistencies are not unreliability — they are authorial error.",
    genres: ["Literary Fiction", "Thriller", "Mystery", "Horror", "Crime"],
    usefulness: 4,
  },
  // ── Pacing and Tension ──
  {
    id: "micro_tension",
    name: "Micro-Tension",
    category: "pacing_tension",
    description: "Micro-tension is the low-level unease that keeps readers engaged even in quiet scenes. It is created through: unanswered questions, character conflict, subtext, physical discomfort, dread, and the sense that something is about to go wrong.",
    application: "Every scene, even expository ones, should have at least one source of micro-tension. Ask: what does the reader not yet know? What does the character fear? What is the unspoken conflict?",
    forbiddenMistake: "Confusing micro-tension with macro-tension. Macro-tension is the story's central question. Micro-tension is the sentence-level unease that keeps the reader reading even when the macro-tension is temporarily resolved.",
    genres: ["all"],
    usefulness: 5,
  },
  {
    id: "chapter_hooks",
    name: "Chapter Hooks and Cliffhangers",
    category: "pacing_tension",
    description: "Every chapter should end with a hook that compels the reader to start the next chapter. Hooks can be: an unanswered question, a revelation, a threat, a decision point, or an ironic juxtaposition.",
    application: "Write the last sentence of each chapter first. It should create a question the reader cannot leave unanswered. Avoid ending chapters on resolution — end on complication, revelation, or threat.",
    forbiddenMistake: "Ending every chapter on a cliffhanger. Relentless cliffhangers exhaust readers. Vary the type of hook.",
    genres: ["all"],
    usefulness: 5,
  },
  {
    id: "white_space_pacing",
    name: "White Space and Pacing",
    category: "pacing_tension",
    description: "Paragraph length and white space are pacing tools. Short paragraphs and sentences accelerate pace; long ones slow it. Scene breaks create breathing room. The visual rhythm of a page signals its emotional rhythm.",
    application: "At action peaks: one-sentence paragraphs, short declarative sentences. In reflective passages: longer, more complex sentences. Use scene breaks (***) to signal time jumps and emotional transitions.",
    forbiddenMistake: "Uniform paragraph length throughout. Monotonous visual rhythm creates monotonous emotional rhythm.",
    genres: ["all"],
    usefulness: 4,
  },
  // ── Publishing Standards ──
  {
    id: "word_count_targets",
    name: "Word Count Targets by Genre",
    category: "publishing_standards",
    description: "Industry standard word counts: Literary Fiction 70,000–100,000; Commercial Fiction 80,000–100,000; Thriller/Crime 70,000–90,000; Romance 50,000–100,000; Fantasy/Sci-Fi 90,000–120,000 (debut); YA 50,000–80,000; Middle Grade 20,000–50,000; Novella 20,000–40,000.",
    application: "Set your target word count before writing. Significantly over or under these ranges will disadvantage a debut submission. Literary fiction has more flexibility; genre fiction less.",
    forbiddenMistake: "Padding to reach word count or cutting to fit. If a story is complete at 60,000 words, it should not be padded to 80,000.",
    genres: ["all"],
    usefulness: 4,
  },
  {
    id: "chapter_length_norms",
    name: "Chapter Length Norms",
    category: "publishing_standards",
    description: "No fixed rule, but industry norms: commercial fiction 2,000–5,000 words per chapter; literary fiction 1,000–8,000; thrillers often 1,000–3,000 (short chapters increase pace); YA 1,500–3,000.",
    application: "Establish a chapter length range early and maintain it. Wildly inconsistent chapter lengths disrupt reader rhythm. Short chapters signal pace; long chapters signal depth.",
    forbiddenMistake: "Chapters that end at arbitrary points. A chapter break should coincide with a dramatic beat.",
    genres: ["all"],
    usefulness: 4,
  },
  {
    id: "submission_formatting",
    name: "Manuscript Submission Formatting",
    category: "publishing_standards",
    description: "Standard manuscript format: 12pt Times New Roman or Courier, double-spaced, 1-inch margins, header with author name/title/page number, scene breaks marked with ###, chapter titles centred.",
    application: "Format your manuscript to standard before submission. Agents and editors read hundreds of manuscripts — non-standard formatting signals inexperience.",
    forbiddenMistake: "Submitting with decorative fonts, coloured text, or unconventional formatting.",
    genres: ["all"],
    usefulness: 3,
  },
  // ── Common Craft Mistakes ──
  {
    id: "passive_voice",
    name: "Passive Voice Overuse",
    category: "common_mistakes",
    description: "Passive voice ('The door was opened by John') removes agency and creates distance. Active voice ('John opened the door') is more immediate and energetic. Passive voice is appropriate when the actor is unknown, unimportant, or deliberately withheld.",
    application: "Search for 'was [verb]ed by' constructions and convert to active where possible. Exception: use passive deliberately when the actor should be withheld.",
    forbiddenMistake: "Eliminating all passive voice. Passive voice is a legitimate tool when used deliberately.",
    genres: ["all"],
    usefulness: 4,
  },
  {
    id: "adverb_overuse",
    name: "Adverb Overuse",
    category: "common_mistakes",
    description: "Adverbs modifying verbs ('she said quietly', 'he ran quickly') are usually a sign that the verb is not doing its job. A stronger verb eliminates the need for the adverb.",
    application: "Search for '-ly' adverbs modifying verbs. For each one, ask: is there a stronger verb that makes the adverb redundant? Reserve adverbs for genuine modification that cannot be achieved with a single verb.",
    forbiddenMistake: "Eliminating all adverbs. Some adverbs are irreplaceable ('she almost smiled', 'he barely moved').",
    genres: ["all"],
    usefulness: 4,
  },
  {
    id: "purple_prose",
    name: "Purple Prose",
    category: "common_mistakes",
    description: "Purple prose is overwritten, ornate language that draws attention to itself at the expense of the story. Signs: excessive adjectives, strained metaphors, overwrought emotion, sentences that require re-reading to parse.",
    application: "Read your prose aloud. If you stumble, the sentence is too complex. The test: does this sentence serve the story, or does it serve the author's ego?",
    forbiddenMistake: "Confusing purple prose with literary prose. Literary prose can be complex and dense — but it is always in service of meaning.",
    genres: ["all"],
    usefulness: 4,
  },
  {
    id: "on_the_nose_dialogue",
    name: "On-the-Nose Dialogue",
    category: "common_mistakes",
    description: "On-the-nose dialogue is when characters say exactly what they mean and feel, with no subtext. It is the most common dialogue error in early drafts.",
    application: "For each emotionally significant dialogue exchange, ask: would a real person say this directly? If not, find the oblique approach. Characters should talk around what they mean, not at it.",
    forbiddenMistake: "Removing all directness. Some characters are direct by nature, and some moments require directness. The mistake is default directness, not directness itself.",
    genres: ["all"],
    usefulness: 5,
  },
];

// ─── Accuracy Library ─────────────────────────────────────────────────────────

export interface AccuracyEntry {
  id: string;
  name: string;
  category: string;
  description: string;
  checkList: string[];
  commonErrors: string[];
  genres: string[];
  usefulness: number;
}

export const ACCURACY_LIBRARY: AccuracyEntry[] = [
  // ── Historical Accuracy ──
  {
    id: "anachronism_detection",
    name: "Anachronism Detection",
    category: "historical_accuracy",
    description: "Anachronisms are objects, words, concepts, or behaviours placed in a historical period before they existed. They destroy reader immersion and signal authorial carelessness.",
    checkList: [
      "Check all technology references against invention dates",
      "Check idioms and slang — most modern idioms are 20th century or later",
      "Check social attitudes — characters should reflect their era's norms unless their deviation is the point",
      "Check food, medicine, and transport against period availability",
      "Check titles of address, social hierarchies, and legal frameworks",
    ],
    commonErrors: [
      "Characters using 'okay' before the 1830s",
      "Victorian characters using electric light before 1879",
      "Medieval characters with modern psychological self-awareness",
      "18th-century characters with 20th-century attitudes to race and gender without narrative acknowledgement",
    ],
    genres: ["Historical Fiction", "Historical Thriller", "Historical Romance"],
    usefulness: 5,
  },
  {
    id: "period_language",
    name: "Period-Appropriate Language",
    category: "historical_accuracy",
    description: "Language evolves. Words, idioms, and grammatical constructions that feel natural today may not have existed in the period being written. Period language does not mean writing in archaic English — it means avoiding modern idioms and anachronistic vocabulary.",
    checkList: [
      "Use the Oxford English Dictionary to check the first recorded use of key words",
      "Avoid modern idioms ('at the end of the day', 'going forward', 'touch base')",
      "Check that titles of address are correct for the period and class",
      "Avoid modern psychological vocabulary in pre-20th century settings ('trauma', 'closure', 'boundaries')",
      "Check that profanity is period-appropriate",
    ],
    commonErrors: [
      "Victorian characters saying 'okay' (not common until 20th century)",
      "Medieval characters using 'sir' as a general honorific (it was a specific knightly title)",
      "Pre-20th century characters discussing their 'mental health'",
    ],
    genres: ["Historical Fiction", "Historical Thriller", "Historical Romance"],
    usefulness: 5,
  },
  {
    id: "social_hierarchy_accuracy",
    name: "Social Hierarchy and Class Accuracy",
    category: "historical_accuracy",
    description: "Historical societies had rigid social hierarchies with specific rules about address, behaviour, and interaction between classes. Violating these without narrative purpose signals historical ignorance.",
    checkList: [
      "Verify correct forms of address for all ranks and titles",
      "Check rules of precedence for the period",
      "Verify what interactions between classes were and were not possible",
      "Check inheritance laws and property rights for the period",
      "Verify women's legal status and rights for the period and jurisdiction",
    ],
    commonErrors: [
      "Victorian servants addressing employers by first name",
      "Medieval peasants speaking to nobility without appropriate deference",
      "Regency women owning property independently before the Married Women's Property Act (1882)",
      "Incorrect use of 'Lord', 'Lady', 'Sir', 'Dame'",
    ],
    genres: ["Historical Fiction", "Historical Romance", "Historical Thriller"],
    usefulness: 4,
  },
  {
    id: "medicine_history",
    name: "Historical Medical Accuracy",
    category: "historical_accuracy",
    description: "Medical knowledge and practice has changed dramatically across history. Characters should only have access to treatments, diagnoses, and medical understanding available in their period.",
    checkList: [
      "Verify that diagnoses and treatments existed in the period",
      "Check germ theory — not accepted until 1860s-1880s; before this, miasma theory dominated",
      "Verify anaesthesia availability — ether first used 1846, chloroform 1847",
      "Check antiseptic practice — Lister's antiseptic method 1867",
      "Verify that specific drugs and medicines existed in the period",
    ],
    commonErrors: [
      "Pre-1846 surgery performed painlessly",
      "Pre-1880s doctors diagnosing bacterial infections",
      "Victorian characters receiving antibiotics",
      "Medieval healers with modern anatomical knowledge",
    ],
    genres: ["Historical Fiction", "Historical Thriller", "Historical Romance"],
    usefulness: 4,
  },
  // ── Cultural Accuracy ──
  {
    id: "cultural_representation",
    name: "Cultural Representation Framework",
    category: "cultural_accuracy",
    description: "Authentic cultural representation requires research, sensitivity, and an awareness of the difference between insider and outsider perspectives. Writing cultures other than your own carries specific responsibilities.",
    checkList: [
      "Research primary sources from within the culture being represented",
      "Distinguish between diaspora experience and homeland experience",
      "Avoid reducing a culture to its food, clothing, or religious practices",
      "Check that cultural practices described are specific to the time, place, and class being written",
      "Consider sensitivity readers from the culture being represented",
      "Avoid the 'magical minority' trope",
    ],
    commonErrors: [
      "Treating a culture as monolithic",
      "Conflating nationality with ethnicity",
      "Using a character's cultural background as their only defining characteristic",
      "Describing cultural practices as exotic from an outsider perspective without acknowledging the perspective",
    ],
    genres: ["all"],
    usefulness: 5,
  },
  {
    id: "avoiding_stereotypes",
    name: "Avoiding Harmful Stereotypes",
    category: "cultural_accuracy",
    description: "Stereotypes reduce complex human beings to a single characteristic. They are not only harmful but also bad craft — they signal lazy characterisation. Every character, regardless of background, should be a fully realised individual.",
    checkList: [
      "Check that characters from marginalised groups have goals, flaws, and inner lives unrelated to their marginalisation",
      "Avoid the 'magical negro' trope",
      "Avoid the 'strong female character' trap — strength is not a personality",
      "Check that LGBTQ+ characters are not defined solely by their sexuality or gender identity",
      "Avoid the 'model minority' stereotype for Asian characters",
      "Check that disabled characters have agency",
    ],
    commonErrors: [
      "The wise elderly Asian mentor",
      "The sassy Black best friend",
      "The tragic gay character who dies",
      "The disabled character who exists to inspire the able-bodied protagonist",
    ],
    genres: ["all"],
    usefulness: 5,
  },
  {
    id: "religious_accuracy",
    name: "Religious and Spiritual Accuracy",
    category: "cultural_accuracy",
    description: "Religious practices, beliefs, and hierarchies vary enormously across traditions, sects, time periods, and geographies. Inaccurate religious representation can be deeply offensive and signals authorial carelessness.",
    checkList: [
      "Research the specific sect or tradition being represented, not just the broad religion",
      "Verify religious practices against the specific time period and geography",
      "Check titles and hierarchies within the religious tradition",
      "Verify that theological positions attributed to characters are consistent with their tradition",
      "Consider sensitivity readers from the tradition being represented",
    ],
    commonErrors: [
      "Treating all Muslims as Arab (most Muslims are not Arab)",
      "Conflating Catholic and Protestant practices",
      "Depicting medieval Christianity without acknowledging its diversity of practice",
      "Treating indigenous spiritual practices as interchangeable",
    ],
    genres: ["Historical Fiction", "Literary Fiction", "Thriller", "Fantasy"],
    usefulness: 4,
  },
  // ── Technical Accuracy ──
  {
    id: "police_procedure_uk",
    name: "UK Police Procedure",
    category: "technical_accuracy",
    description: "UK police procedure differs significantly from US procedure and from fictional depictions. Key differences: UK police are not routinely armed; PACE governs arrest and detention; caution wording is specific; rank structure differs from US.",
    checkList: [
      "UK caution: 'You do not have to say anything. But it may harm your defence if you do not mention when questioned something which you later rely on in court. Anything you do say may be given in evidence.'",
      "UK police ranks: Constable, Sergeant, Inspector, Chief Inspector, Superintendent, Chief Superintendent, Commander/ACC, DCC, Chief Constable",
      "Armed response units are specialist — most UK officers do not carry firearms",
      "PACE limits detention without charge to 24 hours (extendable to 36 with superintendent, 96 with magistrate)",
      "UK police do not 'read Miranda rights'",
      "CPS (Crown Prosecution Service) decides whether to charge, not the police",
    ],
    commonErrors: [
      "UK detectives carrying guns as standard",
      "Using US Miranda rights in UK settings",
      "Incorrect rank titles or chains of command",
      "Police charging suspects (in the UK, CPS charges)",
      "Detention periods that exceed PACE limits without authorisation",
    ],
    genres: ["Crime", "Thriller", "Mystery"],
    usefulness: 5,
  },
  {
    id: "police_procedure_us",
    name: "US Police Procedure",
    category: "technical_accuracy",
    description: "US police procedure varies by state and jurisdiction. Key elements: Miranda rights, chain of custody for evidence, warrant requirements, DA vs police charging decisions, federal vs state jurisdiction.",
    checkList: [
      "Miranda warning must be given before custodial interrogation, not at arrest",
      "Warrant required for most searches (exceptions: plain view, exigent circumstances, consent)",
      "DA or prosecutor decides charges, not police",
      "Federal crimes investigated by FBI, DEA, ATF etc. — not local police",
      "Chain of custody for evidence must be documented and unbroken",
    ],
    commonErrors: [
      "Police reading Miranda rights at arrest (only required before custodial interrogation)",
      "Police deciding whether to charge (DA decides)",
      "Local police investigating federal crimes",
      "Evidence admitted without chain of custody",
    ],
    genres: ["Crime", "Thriller", "Mystery"],
    usefulness: 5,
  },
  {
    id: "legal_procedure_uk",
    name: "UK Legal Procedure",
    category: "technical_accuracy",
    description: "UK legal procedure (England and Wales) differs from US and from fictional depictions. Key elements: adversarial system, Crown Court vs Magistrates Court, barrister vs solicitor distinction.",
    checkList: [
      "Solicitors advise clients and prepare cases; barristers argue in court — they are different professions",
      "Magistrates Court handles summary offences; Crown Court handles indictable offences with jury",
      "Verdict: 'guilty' or 'not guilty' (not 'innocent')",
      "Prosecution is 'the Crown' (R v Defendant), not 'the State'",
      "Judges in Crown Court: 'Your Honour' (circuit judges) or 'My Lord/My Lady' (High Court)",
      "UK does not have a 'District Attorney'",
    ],
    commonErrors: [
      "Solicitors arguing in Crown Court (barristers do this)",
      "Verdict of 'innocent' (UK verdict is 'not guilty')",
      "American-style plea bargaining (rare and informal in UK)",
      "Incorrect forms of address for judges",
    ],
    genres: ["Crime", "Thriller", "Legal Drama"],
    usefulness: 5,
  },
  {
    id: "medical_accuracy_modern",
    name: "Modern Medical Accuracy",
    category: "technical_accuracy",
    description: "Modern medical procedures, terminology, and timelines are frequently misrepresented in fiction. Key areas: trauma response, drug effects, coma and recovery, forensic pathology.",
    checkList: [
      "Gunshot wounds: most are not immediately fatal; shock and blood loss are the primary killers",
      "Coma: patients do not wake from coma fully alert and functional — recovery is gradual",
      "CPR: survival rates are much lower than depicted in fiction (10-15% outside hospital)",
      "Drug effects: verify onset time, duration, and symptoms for any drug depicted",
      "Forensic pathology: time of death estimates have significant margins of error",
    ],
    commonErrors: [
      "Characters waking from coma with immediate full function",
      "CPR reliably reviving characters",
      "Instant knockout from a single blow to the head",
      "Poisons working in seconds when they take hours",
      "Forensic pathologists determining exact time of death",
    ],
    genres: ["Thriller", "Crime", "Medical Drama", "Horror"],
    usefulness: 5,
  },
  {
    id: "weapons_accuracy",
    name: "Weapons and Combat Accuracy",
    category: "technical_accuracy",
    description: "Weapons and combat are among the most frequently misrepresented elements in fiction. Key areas: firearms mechanics, medieval combat, knife wounds, and the physical reality of violence.",
    checkList: [
      "Firearms: verify magazine capacity, reload time, sound (suppressors reduce but do not eliminate sound), and recoil",
      "Medieval weapons: swords were not primarily thrusting weapons; armour was highly effective",
      "Knife wounds: most are not immediately incapacitating; adrenaline allows continued action",
      "Fistfights: a single punch rarely renders someone unconscious",
      "Verify that weapons depicted existed in the period and location",
    ],
    commonErrors: [
      "Suppressors making firearms completely silent",
      "Infinite ammunition without reloading",
      "Single punches causing instant unconsciousness",
      "Medieval knights unable to move in armour (they were highly mobile)",
      "Knife wounds causing instant death",
    ],
    genres: ["Thriller", "Crime", "Historical Fiction", "Action", "Fantasy"],
    usefulness: 4,
  },
  {
    id: "forensic_accuracy",
    name: "Forensic Science Accuracy",
    category: "technical_accuracy",
    description: "Forensic science as depicted in fiction (the 'CSI effect') bears little resemblance to real forensic practice. Key areas: DNA analysis timelines, fingerprint reliability, digital forensics.",
    checkList: [
      "DNA analysis: routine results take days to weeks, not hours",
      "Fingerprints: only 10-20% of crime scenes yield usable prints; AFIS matching is probabilistic",
      "Digital forensics: recovering deleted data is possible but time-consuming; encryption is a genuine barrier",
      "Forensic evidence is probabilistic, not definitive",
      "Chain of custody must be maintained for evidence to be admissible",
    ],
    commonErrors: [
      "DNA results in hours",
      "Perfect fingerprint matches from partial prints",
      "Forensic analysts also investigating crimes (different roles)",
      "Digital forensics recovering data instantly",
      "Forensic evidence presented as absolute proof",
    ],
    genres: ["Crime", "Thriller", "Mystery"],
    usefulness: 5,
  },
  {
    id: "military_accuracy",
    name: "Military Accuracy",
    category: "technical_accuracy",
    description: "Military rank, procedure, and culture are frequently misrepresented. Key areas: rank structure, chain of command, military justice, and the culture of different branches and nations.",
    checkList: [
      "Verify rank structure for the specific branch, nation, and era",
      "Officers are addressed by rank, not 'sir' alone (in most militaries)",
      "Chain of command is rigid — soldiers do not take orders from outside their chain",
      "Military justice (court martial) is separate from civilian justice",
      "Verify that equipment and tactics are appropriate for the period and theatre",
    ],
    commonErrors: [
      "Mixing rank structures from different nations",
      "Soldiers disobeying orders without consequence",
      "Incorrect saluting protocols",
      "Modern military equipment in historical settings",
    ],
    genres: ["Military Fiction", "Thriller", "Historical Fiction", "Action"],
    usefulness: 4,
  },
];

/**
 * Seed the craft library into the research_library table.
 * Only seeds if the category does not already exist.
 */
