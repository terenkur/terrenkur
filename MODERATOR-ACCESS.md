# Moderator access

Visitors browse the site without accounts. Votes and requests are submitted through the bot. Staff sign in at `/moderator` with individual email/password accounts in Supabase Auth. No signup form is provided. The server validates each staff request with `auth.getUser` and requires both `app_metadata.provider = "email"` and `app_metadata.site_moderator = true`. Channel roles, old profile moderator flags and editable user metadata grant no staff access.

## Provisioning before production rollout

1. In Supabase Authentication, enable the Email provider and disable new user signups and anonymous sign-ins. Disable the Twitch sign-in provider. This does not disable the independent Twitch API integration used by the bot and channel widgets.
2. In Authentication → Users, create an email/password account for the intended moderator using a unique password. Do not commit or send the password through chat. If the email already belongs to an old OAuth account, do not automatically reuse or elevate it: migrate it deliberately or use a separate staff account.
3. Set `site_moderator: true` in the account's **app metadata**, preserving existing metadata. Do not use user metadata. The provider must be `email`. Use the Supabase server Admin API or the SQL below after verifying the account email. Replace the placeholder locally; never put a real email in the repository.

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
  || '{"site_moderator":true}'::jsonb
where lower(email) = lower('moderator@example.com')
  and raw_app_meta_data->>'provider' = 'email'
returning id;
```

4. Verify exactly one account was updated. Sign in on a preview, confirm `/api/me` succeeds and staff controls work. A wrong password, an unapproved email account and an old Twitch session must not grant access.
5. Deploy backend and frontend from the same commit. The frontend uses a separate staff storage key and removes old visitor credentials from local storage. Old callback/profile-binding/voting routes are removed. Historical votes and participant records remain intact.

To revoke staff access, remove `site_moderator` through the Admin API or set it to false in app metadata. The backend reads the current account on each privileged request; no database participant record can restore the revoked role. Reset staff passwords through Supabase administration. Supabase Auth enforces its configured login rate limits; do not disable them.

Integration credentials for channel data, rewards and the local bot remain separate. Removing website sign-in does not revoke previously exposed secrets; complete credential rotation independently.
