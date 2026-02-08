function createSubscriptionHandler({ loggingService, userService } = {}) {
  if (!loggingService || !userService) {
    throw new Error('Subscription handler requires logging and user services');
  }

  return async function handleSubscription(_channel, username, _methods, msg, tags) {
    await loggingService.logEvent(`New sub: ${username}` + (msg ? ` - ${msg}` : ''));
    await userService.updateSubMonths(username, tags);
    try {
      const user = await userService.findOrCreateUser({ ...tags, username });
      await userService.incrementUserStat(user.id, 'total_subs_received');
    } catch (err) {
      console.error('subscription stat update failed', err);
    }
  };
}

module.exports = {
  createSubscriptionHandler,
};
