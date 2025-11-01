'use strict';

const readEnv = (key) => {
  const value = process.env[key];
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
};

module.exports = {
  intim: {
    __default__: readEnv('SB_INTIM___DEFAULT'),
    intim_no_tag_0: readEnv('SB_INTIM_NO_TAG_0'),
    intim_no_tag_69: readEnv('SB_INTIM_NO_TAG_69'),
    intim_no_tag_100: readEnv('SB_INTIM_NO_TAG_100'),
    intim_with_tag_0: readEnv('SB_INTIM_WITH_TAG_0'),
    intim_with_tag_69: readEnv('SB_INTIM_WITH_TAG_69'),
    intim_with_tag_100: readEnv('SB_INTIM_WITH_TAG_100'),
    intim_self_no_tag: readEnv('SB_INTIM_SELF_NO_TAG'),
    intim_self_no_tag_0: readEnv('SB_INTIM_SELF_NO_TAG_0'),
    intim_self_no_tag_69: readEnv('SB_INTIM_SELF_NO_TAG_69'),
    intim_self_no_tag_100: readEnv('SB_INTIM_SELF_NO_TAG_100'),
    intim_self_with_tag: readEnv('SB_INTIM_SELF_WITH_TAG'),
    intim_self_with_tag_0: readEnv('SB_INTIM_SELF_WITH_TAG_0'),
    intim_self_with_tag_69: readEnv('SB_INTIM_SELF_WITH_TAG_69'),
    intim_self_with_tag_100: readEnv('SB_INTIM_SELF_WITH_TAG_100'),
    intim_tagged_equals_partner: readEnv('SB_INTIM_TAGGED_EQUALS_PARTNER'),
    intim_tagged_equals_partner_0: readEnv('SB_INTIM_TAGGED_EQUALS_PARTNER_0'),
    intim_tagged_equals_partner_69: readEnv('SB_INTIM_TAGGED_EQUALS_PARTNER_69'),
    intim_tagged_equals_partner_100: readEnv('SB_INTIM_TAGGED_EQUALS_PARTNER_100'),
    intim_tag_match_success: readEnv('SB_INTIM_TAG_MATCH_SUCCESS'),
    intim_tag_match_success_0: readEnv('SB_INTIM_TAG_MATCH_SUCCESS_0'),
    intim_tag_match_success_69: readEnv('SB_INTIM_TAG_MATCH_SUCCESS_69'),
    intim_tag_match_success_100: readEnv('SB_INTIM_TAG_MATCH_SUCCESS_100'),
  },
  poceluy: {
    __default__: readEnv('SB_POCELUY___DEFAULT'),
    poceluy_no_tag_0: readEnv('SB_POCELUY_NO_TAG_0'),
    poceluy_no_tag_69: readEnv('SB_POCELUY_NO_TAG_69'),
    poceluy_no_tag_100: readEnv('SB_POCELUY_NO_TAG_100'),
    poceluy_with_tag_0: readEnv('SB_POCELUY_WITH_TAG_0'),
    poceluy_with_tag_69: readEnv('SB_POCELUY_WITH_TAG_69'),
    poceluy_with_tag_100: readEnv('SB_POCELUY_WITH_TAG_100'),
    poceluy_self_no_tag: readEnv('SB_POCELUY_SELF_NO_TAG'),
    poceluy_self_no_tag_0: readEnv('SB_POCELUY_SELF_NO_TAG_0'),
    poceluy_self_no_tag_69: readEnv('SB_POCELUY_SELF_NO_TAG_69'),
    poceluy_self_no_tag_100: readEnv('SB_POCELUY_SELF_NO_TAG_100'),
    poceluy_self_with_tag: readEnv('SB_POCELUY_SELF_WITH_TAG'),
    poceluy_self_with_tag_0: readEnv('SB_POCELUY_SELF_WITH_TAG_0'),
    poceluy_self_with_tag_69: readEnv('SB_POCELUY_SELF_WITH_TAG_69'),
    poceluy_self_with_tag_100: readEnv('SB_POCELUY_SELF_WITH_TAG_100'),
    poceluy_tagged_equals_partner: readEnv('SB_POCELUY_TAGGED_EQUALS_PARTNER'),
    poceluy_tagged_equals_partner_0: readEnv('SB_POCELUY_TAGGED_EQUALS_PARTNER_0'),
    poceluy_tagged_equals_partner_69: readEnv('SB_POCELUY_TAGGED_EQUALS_PARTNER_69'),
    poceluy_tagged_equals_partner_100: readEnv('SB_POCELUY_TAGGED_EQUALS_PARTNER_100'),
    poceluy_tag_match_success: readEnv('SB_POCELUY_TAG_MATCH_SUCCESS'),
    poceluy_tag_match_success_0: readEnv('SB_POCELUY_TAG_MATCH_SUCCESS_0'),
    poceluy_tag_match_success_69: readEnv('SB_POCELUY_TAG_MATCH_SUCCESS_69'),
    poceluy_tag_match_success_100: readEnv('SB_POCELUY_TAG_MATCH_SUCCESS_100'),
  },
};
