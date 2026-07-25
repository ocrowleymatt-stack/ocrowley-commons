export function buildRealityCheckResponse({question='', latestFrame=null, sleepContext=null}={}){
  const speechProbability = Number(latestFrame?.speechProbability || 0);
  const detected = speechProbability >= 55;
  const evidenceLine = detected
    ? `The device detected a speech-like acoustic pattern at ${speechProbability}% probability.`
    : `The device has not detected a strong external speech pattern in the current check.`;
  return {
    title:'Evidence-first check',
    question,
    evidence:evidenceLine,
    interpretation:'This is not a diagnosis and it is not proof either way. It is one piece of external acoustic evidence to review calmly.',
    nextSteps:[
      'Review the raw clip if one was recorded.',
      'Compare any enhanced preview with the raw audio.',
      'Check sleep, stress and background noise as possible explanations.',
      'Ask a trusted person or clinician for support if distress is rising.'
    ],
    calmLine:'Nothing needs solving instantly. Evidence first. Tea remains available.'
  };
}
