# NutriBolt IFCT API

This API wraps the existing IFCT JSON files so other projects can call HTTP endpoints instead of copying all the JSON files.

You can run it locally for development, or deploy it to a hosting provider so you and your friends can call it from anywhere.

## What You Need For A Real Public API

1. This API code.
2. A hosting platform, for example Vercel, Render, Railway, Fly.io, or a VPS.
3. An API key stored as an environment variable named `API_KEYS`.
4. A public URL, for example `https://nutribolt-api.vercel.app`.
5. Optional later: a custom domain, database, rate limits, logs, and paid plans.

## Start

```bash
npm start
```

Default URL:

```text
http://localhost:3000
```

Use another port:

```bash
$env:PORT=4000; npm start
```

## API Keys

Locally, the API is open unless `API_KEYS` is set.

Generate a strong key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Start with one key:

```bash
$env:API_KEYS="paste_generated_key_here"; npm start
```

Start with multiple keys:

```bash
$env:API_KEYS="key_for_me,key_for_friend"; npm start
```

Call protected endpoints using the `x-api-key` header:

```bash
curl "http://localhost:3000/api/rank?nutrient=protein&limit=5" -H "x-api-key: paste_generated_key_here"
```

JavaScript:

```js
const response = await fetch("https://your-api-url.com/api/rank?nutrient=protein&limit=10", {
  headers: {
    "x-api-key": "your_api_key"
  }
});

const data = await response.json();
console.log(data.results);
```

Do not put a private API key directly inside public frontend code. If the key is inside browser JavaScript, users can see it. For personal tools this may be acceptable, but for a serious product use your own backend to call this API.

## Deploy On Vercel

This project includes `api/index.js` and `vercel.json`, so it is ready for Vercel serverless hosting.

Steps:

1. Create a GitHub repository and push this folder.
2. Go to Vercel and import the repository.
3. Add an environment variable:

```text
API_KEYS=your_generated_key
```

4. Deploy.
5. Your API will be available at your Vercel URL.

Example:

```bash
curl "https://your-project.vercel.app/api/health"
curl "https://your-project.vercel.app/api/rank?nutrient=iron&order=top&limit=10" -H "x-api-key: your_generated_key"
```

## Deploy On Render Or Railway

Use these settings:

```text
Build command: npm install
Start command: npm start
Environment variable: API_KEYS=your_generated_key
```

After deploy, call:

```text
https://your-public-url/api/rank?nutrient=protein&order=top&limit=10
```

## Deploy On Netlify

This project includes `netlify/functions/api.js` and `netlify.toml`, so it can run on Netlify Functions.

Steps:

1. Upload this folder to Netlify, or connect it through GitHub.
2. In Netlify site settings, add an environment variable:

```text
API_KEYS=your_generated_key
```

3. Deploy.
4. Your API will be available at your Netlify URL.

Example:

```bash
curl "https://your-site.netlify.app/api/health"
curl "https://your-site.netlify.app/api/rank?nutrient=protein&limit=10" -H "x-api-key: your_generated_key"
```

## Endpoints

### Health

```text
GET /api/health
```

Returns the number of loaded foods and nutrients.

### Food Groups

```text
GET /api/groups
```

Returns IFCT food group code labels.

### Nutrients

```text
GET /api/nutrients
GET /api/nutrients?search=protein
```

Returns available nutrient keys and units.

### Foods

```text
GET /api/foods
GET /api/foods?search=rice
GET /api/foods?group=A
GET /api/foods?search=rice&group=A&limit=20
```

Returns food records without the full nutrient object.

### Single Food

```text
GET /api/foods/A001
```

Returns one food with all nutrients and translations.

### Rank Foods By Nutrient

```text
GET /api/rank?nutrient=protein&order=top&limit=10
GET /api/rank?nutrient=iron&order=bottom&limit=10
GET /api/rank?nutrient=calcium&group=L&order=top&limit=5
```

Query params:

- `nutrient`: required. Partial names work, for example `protein`, `iron`, `carbohydrate`.
- `order`: `top` or `bottom`. Defaults to `top`.
- `limit`: number of foods to return. Defaults to `10`, maximum `100`.
- `group`: optional IFCT food group code, for example `A`, `B`, `L`, `T`.

## JavaScript Example

```js
const response = await fetch("http://localhost:3000/api/rank?nutrient=protein&order=top&limit=10", {
  headers: {
    "x-api-key": "your_api_key_if_enabled"
  }
});
const data = await response.json();
console.log(data.results);
```
