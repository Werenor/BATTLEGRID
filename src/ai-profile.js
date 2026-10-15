const {
  PLACEMENT_STYLE,
  SKILL,
  TARGETING_STYLE,
} = require('./constants');

const SKILL_RANK = Object.freeze({
  [SKILL.WEAK]: 1,
  [SKILL.COMPETENT]: 2,
  [SKILL.EXPERT]: 3,
});

const DEFAULT_AI_PROFILE = Object.freeze({
  placement: Object.freeze({
    skill: SKILL.COMPETENT,
    style: PLACEMENT_STYLE.RANDOM,
  }),
  targeting: Object.freeze({
    skill: SKILL.COMPETENT,
    style: TARGETING_STYLE.RANDOM,
  }),
});

function normalizeAiProfile(profile = {}) {
  return {
    placement: {
      skill: profile.placement?.skill || DEFAULT_AI_PROFILE.placement.skill,
      style: profile.placement?.style || DEFAULT_AI_PROFILE.placement.style,
    },
    targeting: {
      skill: profile.targeting?.skill || DEFAULT_AI_PROFILE.targeting.skill,
      style: profile.targeting?.style || DEFAULT_AI_PROFILE.targeting.style,
    },
  };
}

function randomConcreteStyle(styles, randomValue, rng) {
  if (randomValue !== 'random') return randomValue;
  const concrete = Object.values(styles).filter((value) => value !== 'random');
  return concrete[Math.floor(rng() * concrete.length)];
}

function resolveAiProfile(profile = {}, rng = Math.random) {
  const normalized = normalizeAiProfile(profile);
  return {
    placement: {
      skill: normalized.placement.skill,
      style: randomConcreteStyle(PLACEMENT_STYLE, normalized.placement.style, rng),
    },
    targeting: {
      skill: normalized.targeting.skill,
      style: randomConcreteStyle(TARGETING_STYLE, normalized.targeting.style, rng),
    },
  };
}

function validateAiProfile(profile) {
  const normalized = normalizeAiProfile(profile);
  const placementRank = SKILL_RANK[normalized.placement.skill];
  const targetingRank = SKILL_RANK[normalized.targeting.skill];
  if (!placementRank || !targetingRank) {
    return { ok: false, reason: 'unknown_skill' };
  }
  if (!Object.values(PLACEMENT_STYLE).includes(normalized.placement.style)) {
    return { ok: false, reason: 'unknown_placement_style' };
  }
  if (!Object.values(TARGETING_STYLE).includes(normalized.targeting.style)) {
    return { ok: false, reason: 'unknown_targeting_style' };
  }
  if (Math.abs(placementRank - targetingRank) > 1) {
    return { ok: false, reason: 'skill_gap_too_large' };
  }
  return { ok: true, profile: normalized };
}

module.exports = {
  DEFAULT_AI_PROFILE,
  SKILL_RANK,
  normalizeAiProfile,
  resolveAiProfile,
  validateAiProfile,
};
