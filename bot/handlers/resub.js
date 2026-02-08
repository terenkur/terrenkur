function createResubHandler({ loggingService, userService } = {}) {
  if (!loggingService || !userService) {
    throw new Error('Resub handler requires logging and user services');
  }

  return async function handleResub(_channel, username, _months, msg, tags) {
    await loggingService.logEvent(`Re-sub: ${username}` + (msg ? ` - ${msg}` : ''));
    await userService.updateSubMonths(username, tags);
    try {
      const user = await userService.findOrCreateUser({ ...tags, username });
      await userService.incrementUserStat(user.id, 'total_subs_received');
    } catch (err) {
      console.error('resub stat update failed', err);
    }
  };
}

module.exports = {
  createResubHandler,
};
