# LLM Usage Log — CS409 MP3 (APIed Piper)

**Tool:** Claude Code (desktop app), model Claude Opus 5.5 (Anthropic)
**Student:** Nan (nanh3@illinois.edu)

The course policy requires LLM chat logs to be submitted with the code. Below is a cleaned-up
record of every conversation I had with the LLM for this MP. Some of my prompts were written in
Chinese; they are translated into English here. One message contained a database password; it has
been removed from this log.

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

### Prompt 2
> Do it for me. (the remaining setup and deployment steps)

**What the LLM did** (in my own Chrome, where I was already signed in)
- Pointed the local `origin` at my new GitHub repository and pushed the code (`.env` is not in
  the repository).
- Read the cluster address from the Atlas "Connect" dialog and wrote the connection string into
  `.env` with a `<db_password>` placeholder.
- Filled in the Render web service form: deploy from my public GitHub repository, build command
  `npm install`, start command `npm start`, free instance type, and an environment variable named
  `MONGODB_URI`.
- It did not enter any password. It wrote a small script that asked me for the password in my own
  terminal and put it into `.env`; I pasted the connection string into Render myself.

### Prompt 3
> Everything is done, check what else is left.

**What the LLM did**
- Checked that the local server can connect to Atlas and that the Render deployment is live.
- Set `API_URL` in `submit.js` and ran the autograder: 90/100. The only failures were that
  `DELETE /users/:id` and `DELETE /tasks/:id` must respond `204` with an empty body (they returned
  `200` with the deleted document).
- Changed both endpoints to `204` with an empty body, re-ran the local tests (all passed),
  pushed, and redeployed on Render.
- Re-ran the autograder: **100/100**. Checked that the autograder's test data was deleted
  afterwards.

---

## What I did myself
- Created the MongoDB Atlas cluster and database user, added the `0.0.0.0/0` network access rule,
  and entered the database password into `.env` and into Render's `MONGODB_URI`.
- Created my GitHub repository and signed in to Render; clicked "Deploy web service".
- Filled out the submission form.

## Sources
- MP3 `README.md` and `FAQ.md`
- Mongoose documentation (query methods `find`, `countDocuments`, `sort`, `select`, `skip`, `limit`)
- Express 5 documentation
