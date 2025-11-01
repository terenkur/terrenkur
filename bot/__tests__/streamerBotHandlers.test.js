'use strict';

describe('streamerBotHandlers', () => {
  const loadHandlers = () => {
    jest.resetModules();
    return require('../streamerBotHandlers');
  };

  const cleanupEnv = () => {
    const keys = [
      'SB_INTIM___DEFAULT',
      'SB_INTIM_NO_TAG_0',
      'SB_POCELUY_WITH_TAG_0',
      'SB_POCELUY___DEFAULT',
    ];
    for (const key of keys) {
      delete process.env[key];
    }
  };

  afterEach(() => {
    cleanupEnv();
    jest.resetModules();
  });

  test('uses the configured action for a specific intim type', async () => {
    process.env.SB_INTIM_NO_TAG_0 = ' 9f55dd5f-9b21-4d85-a8a9-4f9840ef4f01 ';
    const handlers = loadHandlers();
    const trigger = jest.fn().mockResolvedValue();
    const context = {
      trigger,
      triggerDefault: jest.fn().mockResolvedValue(),
    };

    await handlers.intim.intim_no_tag_0(context);

    expect(trigger).toHaveBeenCalledWith('9f55dd5f-9b21-4d85-a8a9-4f9840ef4f01');
    expect(context.triggerDefault).not.toHaveBeenCalled();
  });

  test('falls back to the group default when no specific action is provided', async () => {
    process.env.SB_INTIM___DEFAULT = ' 3e0d8ba5-4e02-4d8d-bca5-5f5b6cae0a84 ';
    const handlers = loadHandlers();
    const trigger = jest.fn().mockResolvedValue();
    const context = {
      trigger,
      triggerDefault: jest.fn().mockResolvedValue(),
    };

    await handlers.intim.intim_with_tag_100(context);

    expect(trigger).toHaveBeenCalledWith('3e0d8ba5-4e02-4d8d-bca5-5f5b6cae0a84');
    expect(context.triggerDefault).not.toHaveBeenCalled();
  });

  test('calls the integration default when no env overrides are set', async () => {
    const handlers = loadHandlers();
    const trigger = jest.fn().mockResolvedValue();
    const triggerDefault = jest.fn().mockResolvedValue();
    const context = { trigger, triggerDefault };

    await handlers.poceluy.poceluy_with_tag_0(context);

    expect(trigger).not.toHaveBeenCalled();
    expect(triggerDefault).toHaveBeenCalledTimes(1);
  });

  test('uses poceluy-specific overrides independently of intim ones', async () => {
    process.env.SB_INTIM_NO_TAG_0 = '7a04f4a0-3d03-4b35-9399-42e63b8017d1';
    process.env.SB_POCELUY_WITH_TAG_0 = '9d3f13e6-6578-45a2-8d54-995a9a0ce3f0';
    process.env.SB_POCELUY___DEFAULT = '7f1a2d63-0a3e-48ff-8d14-b37c0e36d4ef';

    const handlers = loadHandlers();
    const intimContext = {
      trigger: jest.fn().mockResolvedValue(),
      triggerDefault: jest.fn().mockResolvedValue(),
    };
    const poceluyContext = {
      trigger: jest.fn().mockResolvedValue(),
      triggerDefault: jest.fn().mockResolvedValue(),
    };

    await handlers.intim.intim_no_tag_0(intimContext);
    await handlers.poceluy.poceluy_with_tag_0(poceluyContext);
    await handlers.poceluy.poceluy_no_tag_69(poceluyContext);

    expect(intimContext.trigger).toHaveBeenCalledWith(
      '7a04f4a0-3d03-4b35-9399-42e63b8017d1'
    );
    expect(intimContext.triggerDefault).not.toHaveBeenCalled();
    expect(poceluyContext.trigger).toHaveBeenNthCalledWith(
      1,
      '9d3f13e6-6578-45a2-8d54-995a9a0ce3f0'
    );
    expect(poceluyContext.trigger).toHaveBeenNthCalledWith(
      2,
      '7f1a2d63-0a3e-48ff-8d14-b37c0e36d4ef'
    );
  });
});
