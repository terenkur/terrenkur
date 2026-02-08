const { getFetch } = require('../services/fetch');

const commandHandlers = new Map([
  ['!где', handleWhere],
  ['!когда', handleWhen],
  ['!что', handleWhat],
  ['!куда', handleWhereTo],
  ['!кто', handleWho],
  ['!clip', handleClip],
  ['!интим', handleIntim],
  ['!поцелуй', handlePoceluy],
]);

async function handleWhere({ message, tags, services }) {
  const subjectInput = message.trim().slice(4).trim();
  const subject = subjectInput || `@${tags.username}`;
  let location;
  try {
    location = await services.generateWhereLocation(subject);
  } catch (err) {
    console.error('!где command failed to generate location', err);
    location = services.pickFallbackLocation();
  }

  location = services.ensureDistinctWhereLocation(location);

  const resultMessage = `${subject} ${location}`.trim();

  try {
    await services.sendChatMessage('whereResult', {
      message: resultMessage,
      initiator: tags.username,
      type: 'where',
    });
  } catch (err) {
    console.error('!где command failed to send result', err);
  }
}

async function handleWhen({ message, tags, services }) {
  const command = '!когда';
  const subjectInput = message.trim().slice(command.length).trim();
  const subject = subjectInput || `@${tags.username}`;
  let time;
  try {
    time = await services.generateWhenTime(subject);
  } catch (err) {
    console.error('!когда command failed to generate time', err);
    time = services.pickFallbackWhenTime();
  }

  time = services.ensureDistinctWhenTime(time);

  const resultMessage = `${subject} ${time}`.trim();

  try {
    await services.sendChatMessage('whenResult', {
      message: resultMessage,
      initiator: tags.username,
      type: 'when',
    });
  } catch (err) {
    console.error('!когда command failed to send result', err);
  }
}

async function handleWhat({ message, tags, services }) {
  const command = '!что';
  const subjectInput = message.trim().slice(command.length).trim();
  const subject = subjectInput || `@${tags.username}`;
  let action;
  try {
    action = await services.generateWhatAction(subject);
  } catch (err) {
    console.error('!что command failed to generate activity', err);
    action = services.pickFallbackWhatAction();
  }

  action = services.ensureDistinctWhatAction(action);

  const resultMessage = `${subject} ${action}`.trim();

  try {
    await services.sendChatMessage('whatResult', {
      message: resultMessage,
      initiator: tags.username,
      type: 'what',
    });
  } catch (err) {
    console.error('!что command failed to send result', err);
  }
}

async function handleWhereTo({ message, tags, services }) {
  const command = '!куда';
  const subjectInput = message.trim().slice(command.length).trim();
  const subject = subjectInput || `@${tags.username}`;
  let destination;
  try {
    destination = await services.generateWhereToDestination(subject);
  } catch (err) {
    console.error('!куда command failed to generate direction', err);
    destination = services.pickFallbackWhereToDestination();
  }

  destination = services.ensureDistinctWhereToDestination(destination);

  const resultMessage = `${subject} ${destination}`.trim();

  try {
    await services.sendChatMessage('whereToResult', {
      message: resultMessage,
      initiator: tags.username,
      type: 'whereTo',
    });
  } catch (err) {
    console.error('!куда command failed to send result', err);
  }
}

async function handleWho({ message, tags, services }) {
  const command = '!кто';
  const subject = message.trim().slice(command.length).trim();
  let randomUsername = await services.fetchRandomChatterUsername();
  if (!randomUsername) {
    randomUsername = tags?.username || null;
  }

  const mention = randomUsername ? `@${randomUsername}` : null;
  const parts = [];
  if (subject) {
    parts.push(subject);
  }
  if (mention) {
    parts.push(mention);
  }

  const resultMessage = parts.join(' ').trim();
  if (!resultMessage) {
    return;
  }

  try {
    await services.sendChatMessage('whoResult', {
      message: resultMessage,
      initiator: tags.username,
      type: 'who',
    });
  } catch (err) {
    console.error('!кто command failed to send result', err);
  }
}

async function handleClip({ tags, user, services }) {
  if (!user) {
    return;
  }
  try {
    if (!services.config.twitchChannelId || !services.config.twitchClientId) {
      await services.sendChatMessage('clipError', {
        message: `@${tags.username}, не удалось создать клип.`,
        initiator: tags.username,
        type: 'error',
      });
      return;
    }
    const token = await services.getStreamerToken();
    if (!token) {
      await services.sendChatMessage('clipError', {
        message: `@${tags.username}, не удалось создать клип.`,
        initiator: tags.username,
        type: 'error',
      });
      return;
    }
    const url = new URL('https://api.twitch.tv/helix/clips');
    url.searchParams.set('broadcaster_id', services.config.twitchChannelId);
    const fetchImpl = await getFetch();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 10_000);
    let resp;
    try {
      resp = await fetchImpl(url.toString(), {
        method: 'POST',
        headers: {
          'Client-ID': services.config.twitchClientId,
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
    if (!resp.ok) {
      console.error('clip creation failed with status', resp.status);
      await services.sendChatMessage('clipError', {
        message: `@${tags.username}, не удалось создать клип.`,
        initiator: tags.username,
        type: 'error',
      });
      return;
    }
    const data = await resp.json();
    const clipId = data?.data?.[0]?.id;
    if (clipId) {
      await services.sendChatMessage('clipSuccess', {
        message: `@${tags.username}, клип создан: https://clips.twitch.tv/${clipId}`,
        initiator: tags.username,
        type: 'success',
      });
      await services.incrementUserStat(user.id, 'clips_created');
    } else {
      await services.sendChatMessage('clipError', {
        message: `@${tags.username}, не удалось создать клип.`,
        initiator: tags.username,
        type: 'error',
      });
    }
  } catch (err) {
    console.error('clip creation failed', err);
    await services.sendChatMessage('clipError', {
      message: `@${tags.username}, не удалось создать клип.`,
      initiator: tags.username,
      type: 'error',
    });
  }
}

async function handleIntim({ message, tags, user, services }) {
  if (!user) {
    return;
  }
  const args = message.trim().split(/\s+/).slice(1);
  const tagArg = args.find((a) => a.startsWith('@'));
  const hasTag = Boolean(tagArg);
  const normalizedTag = hasTag ? tagArg.replace(/^@/, '').toLowerCase() : null;
  const extraText = args.filter((a) => !a.startsWith('@')).join(' ');
  let partnerUser = null;
  let taggedUser = null;
  let chatters = [];

  const now = Date.now();
  const entry = services.lastCommandTimes.get(user.id) || {
    intim: 0,
    poceluy: 0,
  };
  if (now - entry.poceluy <= 60000) {
    await services.incrementUserStat(user.id, 'combo_commands');
  }
  entry.intim = now;
  services.lastCommandTimes.set(user.id, entry);

  try {
    const { data: chattersData, error } = await services.supabase
      .from('stream_chatters')
      .select('user_id, users ( username )');
    if (error) throw error;
    chatters = chattersData || [];
    if (!chatters || chatters.length === 0) {
      await services.sendChatMessage('intimNoParticipants', {
        message: `@${tags.username}, сейчас нет других участников.`,
        initiator: tags.username,
        type: 'no_participants',
      });
      return;
    }
    const random = chatters[Math.floor(Math.random() * chatters.length)];
    partnerUser = { id: random.user_id, username: random.users.username };
  } catch (err) {
    console.error('select random chatter failed', err);
    return;
  }

  if (normalizedTag) {
    try {
      const { data: tUser, error: tErr } = await services.supabase
        .from('users')
        .select('id, username')
        .eq('twitch_login', normalizedTag)
        .maybeSingle();
      if (tErr) throw tErr;
      taggedUser = tUser;
    } catch (err) {
      console.error('fetch tagged user failed', err);
    }
  }

  try {
    const { data: contexts, error: ctxErr } = await services.supabase
      .from('intim_contexts')
      .select('variant_one, variant_two');
    if (ctxErr || !contexts || contexts.length === 0) throw ctxErr;
    const context =
      contexts[Math.floor(Math.random() * contexts.length)] || {};
    const hadTag = hasTag;
    const tagMatchesPartner =
      Boolean(taggedUser) && taggedUser.id === partnerUser?.id;
    const targetName = normalizedTag || partnerUser?.username || '';
    const isSelfTarget = partnerUser?.id === user.id;
    const wasTagged = tagMatchesPartner;
    const variantOneRaw = await services.generateIntimVariantOne({
      fallback: context.variant_one || '',
      authorName: tags.username,
      partnerName: partnerUser.username,
      chatters,
      extraText,
      targetName,
      isSelf: isSelfTarget,
      wasTagged,
      hadTag,
    });
    let variantOne = variantOneRaw || context.variant_one || '';
    let variantTwo = context.variant_two || '';
    const excludeNames = new Set([
      tags.username.toLowerCase(),
      partnerUser.username.toLowerCase(),
    ]);
    variantOne = await services.applyRandomPlaceholders(
      variantOne,
      excludeNames
    );
    variantTwo = await services.applyRandomPlaceholders(
      variantTwo,
      excludeNames
    );
    const percent = Math.floor(Math.random() * 101);
    const isSelf = partnerUser.id === user.id;
    const partnerMatchesTag =
      Boolean(normalizedTag) &&
      normalizedTag === partnerUser.username.toLowerCase();
    const columnsBefore = [];
    let mainColumn = null;
    if (isSelf) {
      const col = `intim_self_${hasTag ? 'with_tag' : 'no_tag'}`;
      columnsBefore.push(col);
      mainColumn = col;
    }
    if (partnerMatchesTag) {
      columnsBefore.push('intim_tagged_equals_partner');
      columnsBefore.push('intim_tag_match_success');
      if (!mainColumn) mainColumn = 'intim_tagged_equals_partner';
      if (taggedUser) {
        await services.incrementUserStat(
          taggedUser.id,
          'intim_tagged_equals_partner'
        );
      }
    }
    if (columnsBefore.length) {
      await Promise.all(
        columnsBefore.map((col) => services.incrementUserStat(user.id, col))
      );
    }
    const percentSpecial = [0, 69, 100].includes(percent);
    const authorName = `@${tags.username}`;
    const partnerName = `@${partnerUser.username}`;
    if (percentSpecial) {
      const columns = [];
      const suffix = String(percent);
      const tagType = hasTag ? 'with_tag' : 'no_tag';
      const baseCol = `intim_${tagType}_${suffix}`;
      columns.push(baseCol);
      if (isSelf) {
        columns.push(`intim_self_${tagType}_${suffix}`);
      }
      if (partnerMatchesTag) {
        columns.push(`intim_tagged_equals_partner_${suffix}`);
        columns.push(`intim_tag_match_success_${suffix}`);
        if (taggedUser) {
          await services.incrementUserStat(
            taggedUser.id,
            `intim_tagged_equals_partner_${suffix}`
          );
        }
      }
      await Promise.all(
        columns.map((col) => services.incrementUserStat(user.id, col))
      );
      mainColumn = baseCol;
    }
    const text = hasTag
      ? `${percent}% шанс того, что ${authorName} ${variantTwo} ${tagArg} интимиться с ${partnerName} ${variantOne}`
      : `${percent}% шанс того, что у ${authorName} ${variantOne} будет интим с ${partnerName}`;
    const streamerBotType = mainColumn || 'обычные';
    await services.sendChatMessage('intimResult', {
      message: text,
      initiator: tags.username,
      target: partnerUser?.username ?? null,
      type: streamerBotType,
    });
    if (mainColumn) {
      await services.logEvent(text, null, null, null, mainColumn);
    }
    await services.streamerBot.triggerIntim({
      type: streamerBotType,
      initiator: tags.username,
      target: partnerUser?.username ?? null,
      message: text,
    });
  } catch (err) {
    console.error('intim command failed', err);
  }
}

async function handlePoceluy({ message, tags, user, services }) {
  if (!user) {
    return;
  }
  const args = message.trim().split(/\s+/).slice(1);
  const tagArg = args.find((a) => a.startsWith('@'));
  const hasTag = Boolean(tagArg);
  const normalizedTag = hasTag ? tagArg.replace(/^@/, '').toLowerCase() : null;
  const extraText = args.filter((a) => !a.startsWith('@')).join(' ');
  let partnerUser = null;
  let taggedUser = null;
  let chatters = [];

  const now = Date.now();
  const entry = services.lastCommandTimes.get(user.id) || {
    intim: 0,
    poceluy: 0,
  };
  if (now - entry.intim <= 60000) {
    await services.incrementUserStat(user.id, 'combo_commands');
  }
  entry.poceluy = now;
  services.lastCommandTimes.set(user.id, entry);

  try {
    const { data: chattersData, error } = await services.supabase
      .from('stream_chatters')
      .select('user_id, users ( username )');
    if (error) throw error;
    chatters = chattersData || [];
    if (!chatters || chatters.length === 0) {
      await services.sendChatMessage('poceluyNoParticipants', {
        message: `@${tags.username}, сейчас нет других участников.`,
        initiator: tags.username,
        type: 'no_participants',
      });
      return;
    }
    const random = chatters[Math.floor(Math.random() * chatters.length)];
    partnerUser = { id: random.user_id, username: random.users.username };
  } catch (err) {
    console.error('select random chatter failed', err);
    return;
  }

  if (normalizedTag) {
    try {
      const { data: tUser, error: tErr } = await services.supabase
        .from('users')
        .select('id, username')
        .eq('twitch_login', normalizedTag)
        .maybeSingle();
      if (tErr) throw tErr;
      taggedUser = tUser;
    } catch (err) {
      console.error('fetch tagged user failed', err);
    }
  }

  try {
    const { data: contexts, error: ctxErr } = await services.supabase
      .from('poceluy_contexts')
      .select('variant_two, variant_three, variant_four');
    if (ctxErr || !contexts || contexts.length === 0) throw ctxErr;
    const context =
      contexts[Math.floor(Math.random() * contexts.length)] || {};
    const hadTag = hasTag;
    const tagMatchesPartner =
      Boolean(taggedUser) && taggedUser.id === partnerUser?.id;
    const targetName = normalizedTag || partnerUser?.username || '';
    const isSelfTarget = partnerUser?.id === user.id;
    const wasTagged = tagMatchesPartner;
    const variantTwoRaw = await services.generatePoceluyVariantTwo({
      fallback: context.variant_two || '',
      authorName: tags.username,
      partnerName: partnerUser.username,
      chatters,
      extraText,
      targetName,
      isSelf: isSelfTarget,
      wasTagged,
      hadTag,
    });
    const variantThreeRaw = await services.generatePoceluyVariantThree({
      fallback: context.variant_three || '',
      authorName: tags.username,
      partnerName: partnerUser.username,
      chatters,
      extraText,
      targetName,
      isSelf: isSelfTarget,
      wasTagged,
      hadTag,
    });
    const variantFourRaw = await services.generatePoceluyVariantFour({
      fallback: context.variant_four || '',
      authorName: tags.username,
      partnerName: partnerUser.username,
      chatters,
      extraText,
      targetName,
      isSelf: isSelfTarget,
      wasTagged,
      hadTag,
    });
    let variantTwo = variantTwoRaw || context.variant_two || '';
    let variantThree = variantThreeRaw || context.variant_three || '';
    let variantFour = variantFourRaw || context.variant_four || '';
    const excludeNames = new Set([
      tags.username.toLowerCase(),
      partnerUser.username.toLowerCase(),
    ]);
    variantTwo = await services.applyRandomPlaceholders(
      variantTwo,
      excludeNames
    );
    variantThree = await services.applyRandomPlaceholders(
      variantThree,
      excludeNames
    );
    variantFour = await services.applyRandomPlaceholders(
      variantFour,
      excludeNames
    );
    const percent = Math.floor(Math.random() * 101);
    const isSelf = partnerUser.id === user.id;
    const partnerMatchesTag =
      Boolean(normalizedTag) &&
      normalizedTag === partnerUser.username.toLowerCase();
    const columnsBefore = [];
    let mainColumn = null;
    if (isSelf) {
      const col = `poceluy_self_${hasTag ? 'with_tag' : 'no_tag'}`;
      columnsBefore.push(col);
      mainColumn = col;
    }
    if (partnerMatchesTag) {
      columnsBefore.push('poceluy_tagged_equals_partner');
      columnsBefore.push('poceluy_tag_match_success');
      if (!mainColumn) mainColumn = 'poceluy_tagged_equals_partner';
      if (taggedUser) {
        await services.incrementUserStat(
          taggedUser.id,
          'poceluy_tagged_equals_partner'
        );
      }
    }
    if (columnsBefore.length) {
      await Promise.all(
        columnsBefore.map((col) => services.incrementUserStat(user.id, col))
      );
    }
    const percentSpecial = [0, 69, 100].includes(percent);
    const authorName = `@${tags.username}`;
    const partnerName = `@${partnerUser.username}`;
    if (percentSpecial) {
      const columns = [];
      const suffix = String(percent);
      const tagType = hasTag ? 'with_tag' : 'no_tag';
      const baseCol = `poceluy_${tagType}_${suffix}`;
      columns.push(baseCol);
      if (isSelf) {
        columns.push(`poceluy_self_${tagType}_${suffix}`);
      }
      if (partnerMatchesTag) {
        columns.push(`poceluy_tagged_equals_partner_${suffix}`);
        columns.push(`poceluy_tag_match_success_${suffix}`);
        if (taggedUser) {
          await services.incrementUserStat(
            taggedUser.id,
            `poceluy_tagged_equals_partner_${suffix}`
          );
        }
      }
      await Promise.all(
        columns.map((col) => services.incrementUserStat(user.id, col))
      );
      mainColumn = baseCol;
    }
    const makePhrase = (...parts) =>
      parts
        .flat()
        .map((part) => (typeof part === 'string' ? part.trim() : part))
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

    const cleanText = hasTag
      ? makePhrase(
          `${percent}% шанс того, что`,
          authorName,
          variantTwo,
          tagArg,
          'поцелует',
          variantFour,
          partnerName,
          variantThree
        )
      : makePhrase(
          `${percent}% шанс того, что`,
          'у',
          authorName,
          variantThree,
          'поцелует',
          variantFour,
          partnerName
        );
    const streamerBotType = mainColumn || 'обычные';
    await services.sendChatMessage('poceluyResult', {
      message: cleanText,
      initiator: tags.username,
      target: partnerUser?.username ?? null,
      type: streamerBotType,
    });
    if (mainColumn) {
      await services.logEvent(cleanText, null, null, null, mainColumn);
    }
    await services.streamerBot.triggerPoceluy({
      type: streamerBotType,
      initiator: tags.username,
      target: partnerUser?.username ?? null,
      message: cleanText,
    });
  } catch (err) {
    console.error('poceluy command failed', err);
  }
}

module.exports = {
  commandHandlers,
  handleWhere,
  handleWhen,
  handleWhat,
  handleWhereTo,
  handleWho,
  handleClip,
  handleIntim,
  handlePoceluy,
};
