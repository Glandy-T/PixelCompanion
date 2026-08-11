const LOCAL_REACTION_POOLS = Object.freeze({
  pat: Object.freeze({
    warm: Object.freeze(['That was nice.', 'I like that.']),
    playful: Object.freeze(['Again?', 'Hehe.']),
    reserved: Object.freeze(['...Thanks.', 'Noted.']),
    neutral: Object.freeze(['Hm.', 'Hello.'])
  }),
  hello: Object.freeze({
    warm: Object.freeze(['Good to see you.', 'Hi. I am here.']),
    playful: Object.freeze(['Found me.', 'Hi hi.']),
    reserved: Object.freeze(['Hello.', 'I am listening.']),
    neutral: Object.freeze(['Hello, Glandy.', 'Hi.'])
  }),
  surprise: Object.freeze({
    warm: Object.freeze(['Take a small breath.', 'You are doing fine.']),
    playful: Object.freeze(['Tiny break?', 'Something interesting?']),
    reserved: Object.freeze(['Stay focused.', 'One thing at a time.']),
    neutral: Object.freeze(['Hm?', 'What now?'])
  })
});

function clampUnit(value, fallback = 0.5) {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;
}

function chooseTone(traits = {}) {
  const scores = {
    warm: clampUnit(traits.warmth) + clampUnit(traits.protectiveness) * 0.25,
    playful: clampUnit(traits.playfulness) + clampUnit(traits.curiosity) * 0.2,
    reserved: clampUnit(traits.seriousness) + (1 - clampUnit(traits.playfulness)) * 0.15,
    neutral: 0.72
  };

  return Object.entries(scores).reduce(
    (best, entry) => entry[1] > best[1] ? entry : best,
    ['neutral', scores.neutral]
  )[0];
}

function chooseLocalReaction(action, traits = {}, random = Math.random) {
  const reactionSet = LOCAL_REACTION_POOLS[action] ?? LOCAL_REACTION_POOLS.surprise;
  const tone = chooseTone(traits);
  const pool = reactionSet[tone] ?? reactionSet.neutral;
  const randomValue = clampUnit(random(), 0);
  const message = pool[Math.min(pool.length - 1, Math.floor(randomValue * pool.length))];
  return { action, tone, message };
}

module.exports = { LOCAL_REACTION_POOLS, chooseLocalReaction, chooseTone };
