# LLM Usage Log — CS409 MP3 (APIed Piper)

**Tool:** Claude Code (desktop app), model Claude Opus 5.5 (Anthropic)
**Student:** Nan (nanh3@illinois.edu)

The course policy requires LLM chat logs to be submitted with the code. Below is a cleaned-up
record of every conversation I had with the LLM for this MP. Some of my prompts were written in
Chinese; they are translated into English here. One message contained a database password; it has
been removed, and the password was rotated afterwards.

---

## Session 1 — Nov 2, 2026 (evening)

### Prompt 1
> Help me finish this homework, make sure it meets all requirements. First explain this homework to me.

**What the LLM did**
- Read `README.md`, `FAQ.md` and the starter code, and explained the assignment: a REST API
  (Node + Express + Mongoose) for users and tasks, stored on MongoDB Atlas, deployed on Render,
  and graded by an autograder that calls the deployed URL.
- Wrote the implementation:
  - `models/user.js`, `models/task.js`: schemas with required fields, defaults,
    unique email, and an immutable, server-set `dateCreated`.
  - `routes/utils.js`: shared helpers for the `{ message, data }` response format, error handling
    that never leaks Mongoose/MongoDB messages, parsing of the `where`/`sort`/`select`/`skip`/
    `limit`/`count` query parameters (all applied through Mongoose query methods), and input
    validation.
  - `routes/users.js`, `routes/tasks.js`: all ten endpoints, with validation in the order the
    README requires (URL id → field format → referenced documents exist), no database writes on a
    failed request, and the two-way reference rules between `pendingTasks` and
    `assignedUser`/`assignedUserName`.
  - `routes/index.js`, `server.js`: mount the router once at `/api`, connect to MongoDB, return a
    JSON 404 for unknown endpoints and a JSON 400 for malformed request bodies.
- Started a temporary in-memory MongoDB outside the project and ran a 59-check test script
  against the server. All checks passed.

### Prompt 2
> Can you help me finish steps 1–5? (Atlas setup, `.env`, Node 24, commit, Render deploy)

**What the LLM did**
- Re-ran the tests on Node 24 LTS (all passed) and committed the code locally.
- Created `.env` from `.env.example` (it is git-ignored and never committed).
- Explained the Atlas and Render steps, which need my own accounts in a browser.

### Prompt 3
> Tell me what to do in Chinese; later, when summarizing the LLM log, reorganize it in English.

**What the LLM did**
- Re-explained the remaining manual steps (Atlas cluster, network access, connection string,
  Render web service, `submit.js`) in Chinese.

### Prompt 4
> *(I pasted my Atlas database username and password. Removed from this log.)*

**What the LLM did**
- Warned me that the password was now in a chat log that will be submitted, and recommended
  changing it in Atlas (Database Access → Edit Password) and not sending the new one.
- Explained that the full connection string (with the cluster host) is needed, not just the
  username and password.

---

## Session 2 — Nov 2, 2026 (night)

### Prompt 1
> Help me complete this assignment.

**What the LLM did**
- Checked the committed code against every rule in the README and FAQ.
- Wrote a larger end-to-end test script (238 checks) and ran it against the server on Node 24
  with a temporary in-memory MongoDB. It covers: response format; defaults; required-field,
  type, duplicate-email and id-format validation; the status-code order; `select` on `/:id`;
  `where`/`sort`/`select`/`skip`/`limit`/`count` and their combinations, including the default
  task limit of 100; every two-way reference case in the README table (moving, completing,
  un-completing, unassigning and renaming); failed requests not changing data; deletes; and a
  final pass that checks all users and tasks are consistent with each other. All 238 passed.
- Added `.nvmrc` (`24`) so that Render and `nvm` use Node 24 LTS.
- Wrote this log.

---

## What I did myself
- Created the MongoDB Atlas cluster, database user and network access rule, and put the
  connection string into `.env` and into Render's environment variables.
- Created my own GitHub repository from the template and pushed the code.
- Deployed the API on Render, set `API_URL` in `submit.js`, and ran `npm run submit`.
- Filled out the submission form.

## Sources
- MP3 `README.md` and `FAQ.md`
- Mongoose documentation (query methods `find`, `countDocuments`, `sort`, `select`, `skip`, `limit`)
- Express 5 documentation
