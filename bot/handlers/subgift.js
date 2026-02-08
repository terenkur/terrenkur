function createSubgiftHandler({ loggingService, userService } = {}) {
  if (!loggingService || !userService) {
    throw new Error('Subgift handler requires logging and user services');
  }

  return async function handleSubgift(
    _channel,
    username,
    _streakMonths,
    recipient,
    _methods,
    tags
  ) {
    await loggingService.logEvent(`Gift sub: ${username} -> ${recipient}`);
    try {
      const gifter = await userService.findOrCreateUser({ ...tags, username });
      const receiver = await userService.findOrCreateUser({ username: recipient });
      await userService.incrementUserStat(gifter.id, 'total_subs_gifted');
      await userService.incrementUserStat(receiver.id, 'total_subs_received');
    } catch (err) {
      console.error('subgift stat update failed', err);
    }
  };
}

module.exports = {
  createSubgiftHandler,
};
