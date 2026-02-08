function createJoinHandler({ userService, streamState } = {}) {
  if (!userService) {
    throw new Error('Join handler requires user service');
  }
  if (!streamState) {
    throw new Error('Join handler requires stream state');
  }

  return async function handleJoin(_channel, username, self) {
    if (self) return;
    try {
      const user = await userService.findOrCreateUser({ username });
      await userService.updateSubMonths(username);
      if (!streamState.joinedThisStream.has(user.id)) {
        streamState.joinedThisStream.add(user.id);
        await userService.incrementUserStat(user.id, 'total_streams_watched');
      }
    } catch (err) {
      console.error('join handler failed', err);
    }
  };
}

module.exports = {
  createJoinHandler,
};
