# Repository Guidelines

## Project Structure & Module Organization
The Next.js app router lives in `app/`, with route handlers and server actions colocated by feature. Reusable UI primitives and shadcn-based components sit in `components/`, while shared utilities, Supabase clients, and domain helpers are in `lib/`. Static assets and icons belong in `public/`. SQL migrations live in `sql/`, and Supabase edge functions or configuration files reside under `supabase/`. Legacy Vite experiments are retained in `src-old-vite/` for reference only—avoid adding new code there.

## Repository Location
The canonical remote lives at `https://github.com/InnovareAI/Sam-New-Sep-7`; treat it as the source of truth for issues, pull requests, and release tags when coordinating with the broader InnovareAI team.

## Build, Test, and Development Commands
Install dependencies with `npm install`. Use `npm run dev` to launch the local Next.js server. Production builds run through `npm run build`; follow with `npm run start` to serve the optimized bundle. Run the lint suite via `npm run lint`. Integration checks are scripted as executable Node files—`npm run test:integration` exercises the backend flows, while `npm run test:email` walks through the email invite journey. Deployment helpers (`npm run deploy:staging`, `npm run deploy:production`) assume authenticated Netlify and Supabase credentials.

## Coding Style & Naming Conventions
All TypeScript/JavaScript code should pass the project ESLint rules (`eslint.config.js`) and Next.js defaults. Prefer functional React components with PascalCase filenames (e.g. `components/DemoModeToggle.tsx`). Hooks and helpers live in `lib/` and should follow camelCase. Apply Tailwind utility classes sparingly; group conditional styles with `clsx` or `tailwind-merge`. Keep environment-specific values in `.env.local` variants and never commit secrets.

## Testing Guidelines
Place black-box or workflow scripts alongside existing `test-*.js` runners in the repository root. Name new scripts after the scenario they validate (e.g. `test-invitation-workflow.js`). Run them with `node <script>` or add an npm alias mirroring `npm run test:integration` for repeatable execution. When contributing UI features, sanity-check interactions in `npm run dev` and add lightweight assertions where possible before handing off.

## Commit & Pull Request Guidelines
Follow the prevailing Conventional Commits style (`feat:`, `fix:`, `chore:`) to clarify intent; align multi-word scopes with hyphenated segments (e.g. `feat: add-team-dashboard`). Reference related issues in the body and note any environment or migration steps. Pull requests should include: a crisp summary, screenshots or recordings for UI changes, test evidence (`npm run lint`, relevant scripts), and rollback considerations when touching deployment utilities or database artifacts.

## Security & Configuration Tips
Configuration scripts in `scripts/deployment/` manipulate `.env.local`; ensure backups via `npm run backup:create` before modifying secrets. Keep Supabase service roles and Stripe keys in local env files, not in Git. When adding external integrations, document required environment variables in `README.md` and verify Netlify configuration mirrors local expectations.
