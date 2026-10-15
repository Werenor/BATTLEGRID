const era = require('#/era-electron');

const { validateAiProfile } = require('../src/ai-profile');
const {
  PLACEMENT_STYLE,
  SKILL,
  TARGETING_STYLE,
} = require('../src/constants');
const { createEraPage } = require('../src/era-page');

const SKILLS = [SKILL.WEAK, SKILL.COMPETENT, SKILL.EXPERT];
const TARGETING_STYLES = Object.values(TARGETING_STYLE);

const SKILL_LABELS = Object.freeze({
  [SKILL.WEAK]: '较弱',
  [SKILL.COMPETENT]: '熟练',
  [SKILL.EXPERT]: '高手',
});

const TARGETING_LABELS = Object.freeze({
  [TARGETING_STYLE.RANDOM]: '随机',
  [TARGETING_STYLE.OFFENSIVE]: '进攻',
  [TARGETING_STYLE.STRATEGIC]: '策略',
  [TARGETING_STYLE.INFORMATION]: '信息',
});

function cycle(values, current) {
  return values[(values.indexOf(current) + 1) % values.length];
}

function repairSkillGap(profile, changedSide) {
  const validation = validateAiProfile(profile);
  if (validation.ok || validation.reason !== 'skill_gap_too_large') return;
  if (changedSide === 'placement') profile.targeting.skill = SKILL.COMPETENT;
  else profile.placement.skill = SKILL.COMPETENT;
}

function configButton(content, accelerator) {
  return {
    accelerator,
    config: { align: 'center', buttonType: 'info', width: 12 },
    content,
    type: 'button',
  };
}

async function configureMatch(profile) {
  while (true) {
    await era.clear();
    era.drawLine({ content: 'BATTLEGRID' });
    era.print('四艘舰船，一片未知海域，一次一炮。', {
      align: 'center',
      fontSize: '1.15rem',
      isParagraph: true,
    });
    era.drawLine({ content: 'AI 配置' });
    era.printMultiColumns([
      configButton(`布局能力：${SKILL_LABELS[profile.placement.skill]}`, 101),
      {
        config: { align: 'center', color: '#8c8c8c', width: 12 },
        content: '布局偏好：隐藏',
        type: 'text',
      },
    ]);
    era.printMultiColumns([
      configButton(`攻击能力：${SKILL_LABELS[profile.targeting.skill]}`, 103),
      configButton(`攻击偏好：${TARGETING_LABELS[profile.targeting.style]}`, 104),
    ]);
    era.drawLine();
    era.printButton('开始对局', 1, {
      align: 'center',
      buttonType: 'primary',
    });
    era.printButton('退出游戏', 9, { align: 'right' });

    const input = Number(await era.input());
    if (input === 1) return true;
    if (input === 9) return false;
    if (input === 101) {
      profile.placement.skill = cycle(SKILLS, profile.placement.skill);
      repairSkillGap(profile, 'placement');
    } else if (input === 103) {
      profile.targeting.skill = cycle(SKILLS, profile.targeting.skill);
      repairSkillGap(profile, 'targeting');
    } else if (input === 104) {
      profile.targeting.style = cycle(TARGETING_STYLES, profile.targeting.style);
    }
  }
}

module.exports = async () => {
  era.setTitle('BATTLEGRID');
  const profile = {
    placement: { skill: SKILL.COMPETENT, style: PLACEMENT_STYLE.RANDOM },
    targeting: { skill: SKILL.COMPETENT, style: TARGETING_STYLE.RANDOM },
  };

  while (true) {
    const shouldStart = await configureMatch(profile);
    if (!shouldStart) {
      era.quit();
      return;
    }
    const pageBattlegrid = createEraPage(era, { aiProfile: profile });
    await pageBattlegrid();
  }
};
