function createSubmysterygiftHandler({ userService } = {}) {
  if (!userService) {
    throw new Error('Submysterygift handler requires user service');
  }

  return async function handleSubmysterygift(
    _channel,
    username,
    numberOfSubs,
    _methods,
    tags
  ) {
    try {
      const gifter = await userService.findOrCreateUser({ ...tags, username });
      await userService.incrementUserStat(
        gifter.id,
        'total_subs_gifted',
        Number(numberOfSubs) || 0
      );
    } catch (err) {
      console.error('submysterygift stat update failed', err);
    }
  };
}

module.exports = {
  createSubmysterygiftHandler,
};
