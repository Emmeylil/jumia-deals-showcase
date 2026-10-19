# Environment Variables and API Keys

**The mistake in one sentence:** a secret key ends up somewhere the public can read it (a browser bundle, a git commit, or an AI chat transcript) because it was treated like configuration instead of a credential.

---

## Two kinds of key

Every key you handle is one of two things, and almost everything below comes down to never confusing them.

- **Publishable / public keys** are designed to be seen. Stripe's `pk_...`, a Supabase anon key, a Google Maps browser key: anything you deliberately put in front-end code. They identify your project but can't do damage on their own, because the real permissions live behind server-side rules (Stripe's dashboard, Supabase Row Level Security). Shipping these to the browser is fine and expected.
- **Secret keys** are credentials. Stripe's `sk_...`, a Supabase service-role key, a database connection string, a Brevo or OpenAI API key. Anyone holding one can act as you: charge cards, read every row, send mail on your domain, spend your credits. These must never reach the browser, a public repo, or a chat log.

The test is simple. Ask: "if a stranger had this string, could they do something I'd have to clean up?" When the answer is yes, it's a secret. Treat the two categories differently at every step that follows.

## Where keys actually go

A key belongs in exactly one of three places depending on where the code runs, and never in the source you commit.

- **Locally, in a `.env` file.** One file at the project root, listed in `.gitignore` before you ever paste a real value. Commit a `.env.example` alongside it with the variable *names* and blank or dummy values, so a teammate (or your future self) knows what's needed without anything leaking.
- **In production, in the host's environment-variables panel.** Vercel, Netlify, Railway and the like each have an "Environment Variables" section in the project settings. You paste the value there once and the platform injects it at build and runtime. The value never sits in your repo.
- **On a VPS, as real environment variables.** Set them in your process manager (a systemd unit's `Environment=`, a pm2 ecosystem file, a Docker secret) or a `.env` file that lives on the server, outside the web root and outside git. Same rule as everywhere else: the running process can read it, a visitor to your site cannot.

## The prefix that makes a key public: `VITE_` and `NEXT_PUBLIC_`

This is the single most important thing to understand, and the one AI tools get wrong most often.

Front-end frameworks hide most environment variables from the browser on purpose. Only variables with a special prefix get bundled into the JavaScript that ships to the user:

- **Vite** exposes anything starting with `VITE_`.
- **Next.js** exposes anything starting with `NEXT_PUBLIC_`.

Adding that prefix is a deliberate instruction that means "bake this value into the public bundle." At build time the framework find-and-replaces `import.meta.env.VITE_FOO` (or `process.env.NEXT_PUBLIC_FOO`) with the literal string, so it ends up sitting in a `.js` file that anyone can open with View Source or DevTools. There is no un-shipping it.

The prefix is therefore safe for publishable keys and a disaster for secret ones. `VITE_STRIPE_PUBLISHABLE_KEY` is fine. `VITE_STRIPE_SECRET_KEY` hands your Stripe account to every visitor. The prefix doesn't create the danger, it just does exactly what it says on the tin. The danger is putting a secret behind a public prefix in the first place.

One Next.js wrinkle worth knowing: `NEXT_PUBLIC_` values are inlined at *build* time, so they're baked into the deployed output. Changing one means a full rebuild, not just an env-var edit, and the old value stays frozen in any bundle you already deployed.

### Check your own bundle

You can see exactly what you shipped. Build the app and grep the output for anything that looks like a secret:

```bash
# Vite
npm run build && grep -rE "sk_live|sk_test|service_role|-----BEGIN|xox[baprs]-" dist/

# Next.js
npm run build && grep -rE "sk_live|sk_test|service_role|-----BEGIN|xox[baprs]-" .next/

# Anything printed here is public. Rotate it, then move it server-side.
```

An empty result means no secret made it into the client. A match means that key is compromised the moment the build goes live. Rotate it and move the logic that uses it to the server.

## Vercel's "Sensitive" checkbox

Vercel (and a growing number of hosts) lets you mark an environment variable as **Sensitive** when you add it. A sensitive variable is write-only: the platform still uses it at build and runtime, but it will never show the value back to you in the dashboard, the CLI, or the API. Even you can't reveal it later, only overwrite it.

- **Turn it on for true secrets** you set once and never need to eyeball again: a Stripe secret key, a service-role key, an API token. The value is then safe from a shoulder-surfer, a screen-share, or a hijacked dashboard session, and you'd rotate it rather than read it anyway.
- **Leave it off for values you need to see or edit.** A comma-separated list of admin email addresses, a `FROM` address, a feature-flag string, anything you'll want to audit by eye or tweak later: sensitive mode just locks you out of your own config. You'll end up guessing what the current value is.

The deciding question is whether you'll ever need to *read the value back*. For a credential the answer is no, so mark it sensitive. For human-readable configuration the answer is yes, so leave it visible.

## Rotate keys deliberately

A key isn't a set-and-forget setting. It's a credential with a lifespan.

- **Rotate on exposure, immediately.** The moment a secret touches a public bundle, a commit, a log, a screenshot, or a chat transcript, treat it as burned. Generate a new one and update every place that reads it.
- **Revoke, don't just delete.** Removing a leaked key from your `.env` does nothing, because the leaked copy still works. You have to revoke or roll it in the provider's dashboard so the old value stops authenticating.
- **Rotate on a schedule too**, and whenever someone with access leaves the project. Quarterly is a reasonable default for high-value keys.
- **Prefer scoped, least-privilege keys.** Most providers let you mint a key with limited permissions or a limited resource scope: a read-only key, a key restricted to one bucket, a restricted Stripe key. A scoped key that leaks is a small fire. A root key that leaks is the whole building.

### Already committed a key to git?

This is the most common real leak, and the fix is not `git rm`.

1. **Rotate the key first.** Assume it's already scraped. Bots watch public GitHub for exactly this and act within minutes, so nothing else matters until the leaked value is dead.
2. Stop tracking the file (`git rm --cached .env`) and add it to `.gitignore`.
3. Know that the value is still in your git *history*. Purging it with `git filter-repo` or the BFG is worth doing, but it's secondary. The rotation in step 1 is what actually makes the leaked value harmless.
4. Turn on GitHub secret scanning and push protection so the next one gets caught before it ever lands.

## Keep AI agents away from your secrets

AI coding agents read files and print output. Left to their own devices, one will happily `cat .env` to "understand your config" and echo your live keys straight into the chat, which is now a leak into that transcript, its logs, and whatever telemetry or training pipeline sits behind it.

Guard against it in layers:

- **Ignore files.** Add `.env` and `.env.*` to `.gitignore`, and to any agent-specific ignore such as `.cursorignore` or `.aiexclude`. Many agents respect these and won't open the file at all.
- **State the rule in your project instructions.** A line in `CLAUDE.md`, `.cursorrules`, or your system prompt such as "Never read, print, echo, or paste the contents of `.env` or any secret. Refer to variables by name only." Most agents will follow it.
- **Reference by name, never by value.** When you need to discuss a key, say `STRIPE_SECRET_KEY`, not the value. Have the agent write `process.env.STRIPE_SECRET_KEY` in code, never the literal string.
- **Watch the debugging moments.** The classic slip is "why won't this connect?" followed by the agent dumping the whole environment to compare. If a real key surfaces that way, it's exposed. Rotate it.

### Rule to paste into your agent

```
Treat secrets as radioactive. Never read, cat, print, echo, log, or paste the
contents of .env, .env.*, or any file containing credentials. Never output the
literal value of an API key, token, password, connection string, or secret,
even while debugging. Refer to every secret by its variable NAME only (for
example STRIPE_SECRET_KEY), and in code always read it via process.env or
import.meta.env, never inline the value. If you think you need a secret's value
to proceed, stop and ask me instead of revealing it.
```

## Checklist

- [ ] Every key is classified: publishable (safe in the browser) or secret (server-only), and you know which is which.
- [ ] No secret key carries a `VITE_` or `NEXT_PUBLIC_` prefix. Only publishable and config values do.
- [ ] `.env` and `.env.*` are in `.gitignore`, and a keyless `.env.example` is committed in their place.
- [ ] Production secrets live in the host's environment-variables panel (or the VPS process environment), never in the repo.
- [ ] You've grepped a production build (`dist/` or `.next/`) and confirmed no secret shipped to the client.
- [ ] Vercel "Sensitive" is on for write-once credentials and off for values you'll need to read or edit.
- [ ] High-value keys are scoped to least privilege, and you have a rotation habit: on exposure, on offboarding, and on a schedule.
- [ ] `.env` is in your agent's ignore file, and your project instructions tell the AI never to read or print secrets.
- [ ] Any key that has ever touched a bundle, a commit, a log, or a chat has been rotated, not just deleted.

## Prompt your AI assistant

```
Audit this repository for leaked or mis-scoped secrets and environment
variables. Do not fix anything yet, just report findings with file and line.

1. Find any secret credential (API key, token, password, connection string,
   private key, service-role key) hardcoded as a literal in source instead of
   read from process.env / import.meta.env.
2. Find any secret value assigned to a variable with a VITE_ or NEXT_PUBLIC_
   prefix, or otherwise exposed to the client bundle. These are public. List
   each one and say what it grants.
3. Confirm .env and .env.* are in .gitignore. Scan the git history for any
   committed .env or hardcoded secret.
4. Check whether a keyless .env.example exists and matches the variables the
   code actually reads.
5. For each real secret you find exposed, describe the concrete blast radius
   (what a stranger holding it could do) and whether it needs rotating.

Do NOT print the actual value of any secret you find. Refer to each by its
variable name only.
```
