# Use Node.js 20 base image
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment to production
ENV NEXT_TELEMETRY_DISABLED 1
ENV NODE_ENV production

# Set dummy env vars for build (required by Next.js build)
ENV UNIPILE_DSN=dummy
ENV UNIPILE_API_KEY=dummy
ENV DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy
ENV OPENAI_API_KEY=sk-dummy
ENV OPENROUTER_API_KEY=sk-dummy
ENV N8N_API_KEY=dummy
ENV STRIPE_SECRET_KEY=sk_test_dummy
ENV ANTHROPIC_API_KEY=sk-ant-dummy
ENV GEMINI_API_KEY=dummy
ENV POSTMARK_SERVER_TOKEN=dummy
ENV ACTIVECAMPAIGN_API_KEY=dummy

# Build Next.js
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs

EXPOSE 8080

ENV PORT 8080
ENV HOSTNAME "0.0.0.0"

# Run the Next.js standalone server
CMD ["node", "server.js"]
