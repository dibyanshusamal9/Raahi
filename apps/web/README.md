# RAAHI — Officer dashboard

Next.js 14 (App Router) + Tailwind. Officers sign in with the officer access
code, then see calls, skills and job openings by district and keep job
openings up to date.

## Pages

    /signin                     sign in (name + officer access code)
    /                           overview: demand vs supply, maps, charts
    /districts, /districts/[id] every district, and one district in detail
    /jobs                       add, edit and delete job openings
    /beneficiaries              callers on record (with delete)
    /recommendations/[id]       why a caller got their suggestions

Data comes from the voice API's `/admin/*` and `/officer/*` endpoints.

## Run

    pnpm install
    cp .env.example .env.local
    pnpm dev
