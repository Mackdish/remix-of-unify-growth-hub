# Finish Member Accounts and Portal

## Goal
Make adding a member complete reliably in one action, then ensure every linked member can sign in and see only their own contributions, fines, loans, due dates, penalties, and downloadable statement.

## Admin member activation
- Make “Add member” an all-or-nothing process: validate the member code and email first, create or invite the login, save the member, link the account, and assign the selected role.
- Check and report every save/link/role error instead of allowing a partially activated account to appear successful.
- Support the three existing choices clearly: emailed activation, temporary password, or record-only pending member.
- If an email is already registered, link it safely when appropriate or show a clear actionable message without leaving a duplicate member.
- Keep record-only members pending and allow admins to activate/link them later from the existing account controls.
- Refresh the member list immediately and show whether the member is active, pending, or needs account linking.

## Member finance access
- Load the signed-in member profile, transactions, and loan requests with explicit error handling so access failures are visible rather than appearing as empty data.
- Keep member data private through the existing user-linked access rules.
- Show contribution totals and monthly contribution history, fines/dues/penalties, current loan balance, repayments, loan status, and due dates.
- Keep the personal transaction history and branded PDF statement download available from the member dashboard.
- Ensure the loans page handles loading and unlinked-account states correctly and removes unsafe assumptions.

## Finish the previous control-panel work
- Add project create, edit, ordering, and delete controls to the admin control panel.
- Keep About, vision, mission, contact details, notices, gallery uploads, project images, and homepage background controls together in the control panel.
- Keep the public gallery limited to admin-uploaded photos.

## Verification
- Test adding a record-only member and an activated member without leaving duplicate or half-created records.
- Test member sign-in and confirm the dashboard shows only that member’s contributions, fines, loans, due dates, and statement download.
- Check the admin project controls and public page updates on desktop and mobile layouts.
- Run the relevant automated checks and inspect the live screens before marking the work complete.

## Technical details
- Harden the existing authenticated server function and preserve server-side admin verification.
- Continue using the existing `members`, `user_roles`, `transactions`, and `loan_requests` data with current row-level protections.
- Apply a database migration only if inspection reveals a missing constraint, permission, or policy; the pending-member status rule is already active.
