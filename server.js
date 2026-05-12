const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = __dirname;
const API_KEYS = String(process.env.API_KEYS || "")
  .split(",")
  .map((key) => key.trim())
  .filter(Boolean);

const DATA_FILES = [
  "Proximate_Principles_and_Dietary_Fiber.json",
  "Water_Soluble_Vitamins.json",
  "Fat_Soluble_Vitamins.json",
  "Carotenoids.json",
  "Minerals_and_Trace_Elements.json",
  "Starch_and_Individual_Sugars.json",
  "Fatty_Acid_Profile.json",
  "Amino_Acid_Profile.json",
  "Organic_Acids.json",
  "Polyphenols.json",
  "Oligosaccharides_Phytosterols_Saponins_and_Phytates.json",
  "Fatty_Acid_Profile_of_Edible_Oils_and_Fats.json",
];

const FOOD_GROUPS = {
  A: "Cereals and Millets",
  B: "Grain Legumes",
  C: "Green Leafy Vegetables",
  D: "Other Vegetables",
  E: "Fruits",
  F: "Roots and Tubers",
  G: "Condiments and Spices",
  H: "Nuts and Oil Seeds",
  I: "Sugars",
  J: "Mushrooms",
  K: "Miscellaneous Foods",
  L: "Milk and Milk Products",
  M: "Egg and Egg Products",
  N: "Poultry",
  O: "Animal Meat",
  P: "Marine Fish",
  Q: "Marine Shellfish",
  R: "Marine Mollusks",
  S: "Fresh Water Fish and Shellfish",
  T: "Edible Oils and Fats",
};

function readJson(fileName) {
  const filePath = path.join(DATA_DIR, fileName);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function getNutrientUnit(nutrientKey) {
  if (nutrientKey.includes("%")) return "%";
  const unitMatch = nutrientKey.match(/\(([^()]*)\)[^()]*$/);
  return unitMatch ? unitMatch[1] : "value";
}

function loadData() {
  const foodsByCode = new Map();
  const nutrientKeys = new Set();

  for (const fileName of DATA_FILES) {
    const data = readJson(fileName);
    const rows = Array.isArray(data.Sheet1) ? data.Sheet1.filter(Boolean) : [];

    for (const row of rows) {
      const code = row["FOOD CODE"];
      if (!code) continue;

      const existing = foodsByCode.get(code) || {
        foodCode: code,
        foodName: row["FOOD NAME"] || "",
        foodGroupCode: code.slice(0, 1),
        foodGroup: FOOD_GROUPS[code.slice(0, 1)] || "Unknown",
        nutrients: {},
      };

      if (!existing.foodName && row["FOOD NAME"]) {
        existing.foodName = row["FOOD NAME"];
      }

      for (const [key, value] of Object.entries(row)) {
        if (key === "FOOD CODE" || key === "FOOD NAME") continue;
        existing.nutrients[key] = value;
        nutrientKeys.add(key);
      }

      foodsByCode.set(code, existing);
    }
  }

  const translations = readJson("Ifct_languages.json");
  if (Array.isArray(translations)) {
    for (const item of translations) {
      const food = foodsByCode.get(item.food_code);
      if (!food) continue;
      food.translations = item.translations || {};
    }
  }

  const nutrients = Array.from(nutrientKeys)
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({
      name,
      searchName: normalizeText(name.replace(/\([^()]*\)$/, "")),
      unit: getNutrientUnit(name),
    }));

  const foods = Array.from(foodsByCode.values()).sort((a, b) =>
    a.foodCode.localeCompare(b.foodCode)
  );

  return { foods, nutrients };
}

const db = loadData();

function findNutrientKey(query) {
  const needle = normalizeText(query);
  if (!needle) return null;

  const exact = db.nutrients.find(
    (nutrient) =>
      normalizeText(nutrient.name) === needle || nutrient.searchName === needle
  );
  if (exact) return exact.name;

  const partial = db.nutrients.find(
    (nutrient) =>
      normalizeText(nutrient.name).includes(needle) ||
      nutrient.searchName.includes(needle)
  );

  return partial ? partial.name : null;
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(statusCode, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(body);
}

function getHeader(req, name) {
  const value = req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function isAuthorized(req, url) {
  if (API_KEYS.length === 0) return true;
  if (url.pathname === "/" || url.pathname === "/api" || url.pathname === "/api/health") {
    return true;
  }

  const providedKey =
    getHeader(req, "x-api-key") ||
    getHeader(req, "authorization")?.replace(/^Bearer\s+/i, "") ||
    url.searchParams.get("api_key");

  return API_KEYS.includes(String(providedKey || "").trim());
}

function parsePositiveInteger(value, fallback, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function compactFood(food) {
  return {
    foodCode: food.foodCode,
    foodName: food.foodName,
    foodGroupCode: food.foodGroupCode,
    foodGroup: food.foodGroup,
    translations: food.translations || {},
  };
}

function handleRank(url, res) {
  const nutrientQuery = url.searchParams.get("nutrient");
  const nutrientKey = findNutrientKey(nutrientQuery);
  if (!nutrientKey) {
    return sendJson(res, 404, {
      error: "Nutrient not found",
      message: "Use /api/nutrients to see available nutrient names.",
    });
  }

  const group = normalizeText(url.searchParams.get("group")).toUpperCase();
  const order = normalizeText(url.searchParams.get("order")) === "bottom" ? "bottom" : "top";
  const limit = parsePositiveInteger(url.searchParams.get("limit"), 10, 100);

  const results = db.foods
    .filter((food) => !group || food.foodGroupCode === group)
    .map((food) => ({
      ...compactFood(food),
      nutrient: nutrientKey,
      unit: getNutrientUnit(nutrientKey),
      value: Number.parseFloat(food.nutrients[nutrientKey]),
    }))
    .filter((food) => Number.isFinite(food.value))
    .sort((a, b) => (order === "top" ? b.value - a.value : a.value - b.value))
    .slice(0, limit);

  sendJson(res, 200, {
    nutrient: nutrientKey,
    unit: getNutrientUnit(nutrientKey),
    order,
    group: group || null,
    groupName: group ? FOOD_GROUPS[group] || "Unknown" : "All Food Groups",
    limit,
    count: results.length,
    results,
  });
}

function handleFoods(url, res) {
  const search = normalizeText(url.searchParams.get("search"));
  const group = normalizeText(url.searchParams.get("group")).toUpperCase();
  const limit = parsePositiveInteger(url.searchParams.get("limit"), 50, 500);

  const results = db.foods
    .filter((food) => !group || food.foodGroupCode === group)
    .filter((food) => {
      if (!search) return true;
      return (
        normalizeText(food.foodCode).includes(search) ||
        normalizeText(food.foodName).includes(search)
      );
    })
    .slice(0, limit)
    .map(compactFood);

  sendJson(res, 200, { count: results.length, results });
}

function handleFoodByCode(code, res) {
  const food = db.foods.find((item) => item.foodCode.toLowerCase() === code.toLowerCase());
  if (!food) return sendJson(res, 404, { error: "Food not found" });
  sendJson(res, 200, food);
}

function handleRequest(req, res) {
  if (req.method === "OPTIONS") return sendJson(res, 200, {});
  if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed" });

  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathName = decodeURIComponent(url.pathname);

  if (!isAuthorized(req, url)) {
    return sendJson(res, 401, {
      error: "Unauthorized",
      message: "Send your API key in the x-api-key header.",
    });
  }

  if (pathName === "/" || pathName === "/api") {
    return sendJson(res, 200, {
      name: "NutriBolt IFCT API",
      endpoints: [
        "/api/health",
        "/api/groups",
        "/api/nutrients",
        "/api/foods?search=rice&group=A&limit=20",
        "/api/foods/A001",
        "/api/rank?nutrient=protein&order=top&limit=10",
      ],
    });
  }

  if (pathName === "/api/health") {
    return sendJson(res, 200, {
      status: "ok",
      foods: db.foods.length,
      nutrients: db.nutrients.length,
    });
  }

  if (pathName === "/api/groups") {
    return sendJson(res, 200, FOOD_GROUPS);
  }

  if (pathName === "/api/nutrients") {
    const search = normalizeText(url.searchParams.get("search"));
    const nutrients = db.nutrients.filter((nutrient) => {
      if (!search) return true;
      return (
        normalizeText(nutrient.name).includes(search) ||
        nutrient.searchName.includes(search)
      );
    });
    return sendJson(res, 200, { count: nutrients.length, results: nutrients });
  }

  if (pathName === "/api/foods") {
    return handleFoods(url, res);
  }

  if (pathName.startsWith("/api/foods/")) {
    return handleFoodByCode(pathName.replace("/api/foods/", ""), res);
  }

  if (pathName === "/api/rank") {
    return handleRank(url, res);
  }

  sendJson(res, 404, { error: "Route not found" });
}

if (require.main === module) {
  http.createServer(handleRequest).listen(PORT, () => {
    console.log(`NutriBolt API running at http://localhost:${PORT}`);
    console.log(`Loaded ${db.foods.length} foods and ${db.nutrients.length} nutrients.`);
    if (API_KEYS.length > 0) {
      console.log(`API key auth enabled with ${API_KEYS.length} key(s).`);
    } else {
      console.log("API key auth disabled. Set API_KEYS to enable it.");
    }
  });
}

module.exports = handleRequest;
module.exports.handleRequest = handleRequest;
