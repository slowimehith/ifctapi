# NutriBolt IFCT API

Deployable API for IFCT nutrient data.

## Endpoints

```text
GET /api/health
GET /api/groups
GET /api/nutrients
GET /api/nutrients?search=protein
GET /api/foods
GET /api/foods/A001
GET /api/rank?nutrient=protein&order=top&limit=10
```

## API Key

Set this environment variable in Vercel:

```text
API_KEYS=your_secret_key
```

Call protected endpoints with:

```text
x-api-key: your_secret_key
```

Example:

```bash
curl "https://your-project.vercel.app/api/rank?nutrient=protein&limit=10" -H "x-api-key: your_secret_key"
```

See `API_README.md` for full usage and deployment notes.
