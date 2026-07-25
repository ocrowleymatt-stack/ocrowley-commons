export const notificationModes = {
  quiet: {label:'Quiet', description:'Essential prompts only.'},
  balanced: {label:'Balanced', description:'Morning report and useful check-ins.'},
  active: {label:'Active', description:'More encouragement and routine prompts.'},
  navigatorPlus: {label:'Navigator+', description:'Full contextual guidance.'}
};

export const humourModes = {
  off:'Plain and factual',
  dry:'Dry British',
  mischief:'Light mischief',
  goblin:'Goblin comfort'
};

export function buildNotification({type='general', humour='dry', context={}} = {}){
  const templates = {
    morning: {
      off:'Morning report is ready.',
      dry:'Morning report ready. Tea remains strategically available.',
      mischief:'Morning report ready. The nervous system has submitted comments.',
      goblin:'Morning report ready. Status: alive, mysterious, acceptable.'
    },
    audioClear: {
      off:'No urgent audio findings.',
      dry:'No urgent audio findings. Several pigeons remain under review.',
      mischief:'No confirmed drama. Civilisation continues, regrettably.',
      goblin:'Threat level: administrative.'
    },
    review: {
      off:'Audio event logged for review.',
      dry:'Audio event logged. Evidence first, panic never.',
      mischief:'Something made a noise. We shall inspect it like adults with torches.',
      goblin:'Noise goblin captured for later review.'
    },
    activity: {
      off:'Activity opportunity detected.',
      dry:'Possible swimming opportunity. Your skeleton requests diplomacy.',
      mischief:'Pool nearby. Suspicious levels of buoyancy detected.',
      goblin:'Water rectangle detected. Floaty mission available.'
    },
    general: {
      off:'Navigator check-in.',
      dry:'Navigator check-in. Nothing needs solving instantly.',
      mischief:'Navigator check-in. The universe can wait five minutes.',
      goblin:'Small pause. Big survival. Acceptable human.'
    }
  };
  return templates[type]?.[humour] || templates.general.dry;
}

export function notificationRationale(type){
  const reasons = {
    morning:['scheduled morning report','overnight review enabled'],
    audioClear:['audio monitor active','no high-confidence finding'],
    review:['speech-like acoustic threshold crossed','review mode enabled'],
    activity:['activity prompt enabled','context suggests possible useful action'],
    general:['check-in schedule enabled']
  };
  return reasons[type] || reasons.general;
}
