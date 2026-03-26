# NYT Datelines

A fresh [Next.js](https://nextjs.org) app running on Node.js, set up to be easy to develop locally, push to GitHub, and deploy on Vercel.

## Getting Started

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

The main page lives in `src/app/page.tsx`.

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run generate:data
```

## Push to GitHub

Create an empty GitHub repository, then connect this local repo:

```bash
git remote add origin <your-github-repo-url>
git push -u origin main
```

## Deploy to Vercel

1. Push your code to GitHub.
2. In Vercel, choose **Add New Project**.
3. Import the GitHub repository.
4. Keep the default Next.js settings and deploy.

Every push to `main` can then trigger a fresh Vercel deployment automatically.

## Tech Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- ESLint

## Notes

- The project already includes a local Git repository.
- Vercel supports this stack out of the box, so no custom hosting config is required for the starter app.
- `npm run generate:data` reads `FINAL-dateline-set.csv`, generates app data in `src/data/dateline-data.json`, and writes the review list to `data/dateline-review.json`.
- If you want, the next step can be setting up your real homepage, routes, API endpoints, or database integration.
