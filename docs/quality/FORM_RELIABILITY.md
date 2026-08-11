# Form reliability standard

All Center Estates data-entry workflows must preserve entered data until the server confirms a successful mutation and must explain failures in user language.

## Implemented safeguards

- Native HTML forms are automatically saved per user, organization, route and form identity by `FormRecoveryProvider`.
- React-controlled Property Onboarding and Tenant Application cards use typed `useFormDraft` state persistence because they are not native `<form>` elements.
- Drafts are restored after navigation, refresh, transient network failure, server error or an expired access token.
- A successful form mutation clears the corresponding native-form draft. Controlled forms clear their draft only after their primary record is created.
- Access tokens are refreshed once automatically. A fully expired session redirects to login and returns to the previous route afterward.
- API validation, permission, server and network failures are normalized and shown through the global toast surface. Existing inline error banners remain for local context.
- Duplicate notifications are suppressed and at most four notifications are displayed.

## Security and browser limitations

- Passwords, authentication credentials, secrets, card/CVV-like fields and fields marked `data-no-draft="true"` are never persisted.
- Browser security prevents restoring file input contents. Other form data is retained, but users must reselect files after a reload.
- Drafts are scoped to the signed-in user and organization. Tenant applications add the active property to their scope.
- Drafts remain in the browser only; they are not shared between devices and are not treated as authoritative server records.

## Acceptance checklist for new forms

1. Give each native form a stable `data-draft-key` when more than one form can occupy the same route.
2. Give every input a stable `name`; mark sensitive or non-restorable values with `data-no-draft="true"`.
3. Do not close a modal or clear state until its API response succeeds.
4. Use `apiErrorMessage(response, fallback)` when an inline error needs the server's validation detail.
5. For controlled forms without a `<form>`, use `useFormDraft` and clear it only on confirmed success.
6. Confirm refresh/reopen restoration, clear-on-success, validation failure, 403, 500 and offline behavior in browser acceptance tests.
