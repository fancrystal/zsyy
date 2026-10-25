# Phone Account and Test Team Implementation Plan

**Goal:** Replace login/registration account names with mainland China mobile numbers, require a display username, allow six-character passwords, and create the approved six-user invitation team.

**Architecture:** The backend registration schema validates a unique 11-digit mobile number stored in the existing `users.username` column and a required display username stored in `users.nickname`. H5 labels and validation mirror the API. A production-safe seed command registers users only through the existing invite flow and is idempotent by phone number.

**Tech Stack:** Express, Zod, Vue 3, Vitest, Node test runner, MySQL.

## Tasks

### Task 1: Backend contract and tests
- [ ] Add a failing API test that proves `123456` plus a valid phone and required display username can register.
- [ ] Add failing API tests rejecting non-mobile accounts and missing display usernames.
- [ ] Change registration validation to require `^1[3-9]\\d{9}$`, six-to-72 character passwords, and required username.
- [ ] Run backend integration tests.

### Task 2: H5 registration and login
- [ ] Add a failing UI test for phone labels, phone input mode, required display username, and six-character password hint.
- [ ] Update the authentication form labels, input attributes, local validation, and registration payload.
- [ ] Run UI tests and production builds.

### Task 3: Production release and approved test team
- [ ] Build and upload a new isolated release; atomically update zsyy source/static symlinks and restart only `zsyy-api`.
- [ ] Verify public health and login/register form assets.
- [ ] Create the six users through invitation registration, preserving the approved 1→2,3; 2→4,5; 3→6 relationship.
- [ ] Verify account count, fixed parent links, zero voucher balances, and login with each approved phone/password.

