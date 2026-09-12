# Secret Rotation Checklist

Remediation Plan item #6, second half. `.gitignore` for `.env` is done and
verified in code — this document tracks the part that isn't: actually
rotating credentials that may have leaked during local dev or demo sharing.
This can't be verified by reading the repo, so it's tracked here explicitly
instead of assumed.

Run through this once, now. Check off each box as you complete it, and note
the date — that record is the point of this file.

## 1. MongoDB Atlas

- [ ] Log into Atlas → Database Access → identify the current user/credential
      used in `MONGODB_URL`.
- [ ] Create a new database user with a freshly generated password (or
      rotate the existing user's password if Atlas supports in-place
      rotation on your tier).
- [ ] Update `MONGODB_URL` in every environment that uses it (local `.env`,
      Render/Azure production config) — **never** commit the new value.
- [ ] Confirm the app connects successfully with the new credential.
- [ ] Delete/disable the old database user so the old credential stops
      working.
- [ ] Date completed: __________

## 2. Azure Storage (enrollment photos)

- [ ] Azure Portal → Storage Account → Access keys → regenerate the key
      currently referenced by `AZURE_STORAGE_CONNECTION_STRING`.
- [ ] Update `AZURE_STORAGE_CONNECTION_STRING` in every environment.
- [ ] Confirm enrollment photo upload/read still works with the new key.
- [ ] Date completed: __________

## 3. API keys (`API_KEY_ADMIN` / `API_KEY_OPERATOR`)

These were introduced during the remediation work itself, so "may have
leaked during dev/demo sharing" applies to them too if they were ever pasted
into a chat, screenshot, or shared terminal.

- [ ] Generate new random values (e.g. `openssl rand -hex 32`) for both.
- [ ] Update the backend environment config.
- [ ] Distribute the new operator key to whoever runs the check-in desk
      through a private channel (not email/Slack in plaintext).
- [ ] Date completed: __________

## 4. After rotation

- [ ] Confirm no old value still appears in any `.env` file tracked by git
      history (`git log -p -- '*.env'` should show nothing, given `.gitignore`
      was added before any commit — if `.env` was ever committed prior to
      that, treat every credential in it as compromised regardless of this
      rotation, since git history retains it).
- [ ] Repeat this checklist on a recurring basis (e.g. every 90 days) rather
      than treating it as a one-time event — add a calendar reminder.
