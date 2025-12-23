#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

// Get module name
const moduleName = process.argv[2];
if (!moduleName) {
  console.error("❌ Please provide a module name, e.g., npm run gen:module user");
  process.exit(1);
}

const capitalized = moduleName.charAt(0).toUpperCase() + moduleName.slice(1);

// Base paths
const rootDir = path.join(__dirname, "..");
const modulesDir = path.join(rootDir, "modules");
const moduleDir = path.join(modulesDir, moduleName);
const routesDir = path.join(moduleDir, "routes");
const servicesDir = path.join(moduleDir, "services");

// Ensure dirs exist
if (!fs.existsSync(modulesDir)) fs.mkdirSync(modulesDir);
if (!fs.existsSync(moduleDir)) fs.mkdirSync(moduleDir);
if (!fs.existsSync(routesDir)) fs.mkdirSync(routesDir);
if (!fs.existsSync(servicesDir)) fs.mkdirSync(servicesDir);

// Create route file
const routeFile = path.join(routesDir, `${moduleName}Routes.js`);
if (!fs.existsSync(routeFile)) {
  fs.writeFileSync(
    routeFile,
    `const express = require("express");
const router = express.Router();
const { get${capitalized} } = require("../services/${capitalized}Service");

router.get("/", get${capitalized});

module.exports = router;`
  );
  console.log(`✅ Created ${routeFile}`);
}

// Create service file
const serviceFile = path.join(servicesDir, `${capitalized}Service.js`);
if (!fs.existsSync(serviceFile)) {
  fs.writeFileSync(
    serviceFile,
    `const { PrismaClient } = require("../../../generated/prisma");
const prisma = new PrismaClient();
const apiResponse = require("../../../helpers/apiResponse");

async function get${capitalized}(req, res) {
  try {
    // Example: Fetch data from database
    // const ${moduleName}Data = await prisma.${moduleName}.findMany();
    res.json(apiResponse.response("SUCCESS", { data: "${capitalized} works!" }));
  } catch (error) {
    console.error(error);
    res.status(500).json(apiResponse.response("ERROR"));
  }
}

module.exports = { get${capitalized} };`
  );
  console.log(`✅ Created ${serviceFile}`);
}

// Update root routes/index.js
const routesIndex = path.join(rootDir, "routes", "index.js");
if (!fs.existsSync(path.dirname(routesIndex))) {
  fs.mkdirSync(path.dirname(routesIndex));
}
if (!fs.existsSync(routesIndex)) {
  fs.writeFileSync(routesIndex, `const express = require("express");\nconst router = express.Router();\n\nmodule.exports = router;`);
}

let content = fs.readFileSync(routesIndex, "utf8");
const importLine = `const ${moduleName}Routes = require("../modules/${moduleName}/routes/${moduleName}Routes");`;
const useLine = `router.use("/${moduleName}", ${moduleName}Routes);`;

if (!content.includes(importLine)) {
  content =
    content.replace("module.exports = router;", "") +
    `\n${importLine}\n${useLine}\n\nmodule.exports = router;`;
  fs.writeFileSync(routesIndex, content);
  console.log(`✅ Updated root routes/index.js with ${moduleName}`);
}
