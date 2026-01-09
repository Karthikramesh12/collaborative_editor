#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

// Get model name and optional fields
const modelName = process.argv[2];
const fields = process.argv.slice(3);

if (!modelName) {
  console.error("❌ Please provide a model name, e.g., npm run gen:model Post title:String content:String");
  console.error("📋 Available field types: String, Int, Float, Boolean, DateTime, Json");
  console.error("📋 Optional modifiers: ? (optional), [] (array), @unique, @default()");
  console.error("📋 Example: npm run gen:model Post title:String content:String? published:Boolean@default(false) tags:String[]");
  process.exit(1);
}

const capitalized = modelName.charAt(0).toUpperCase() + modelName.slice(1);
const schemaPath = path.join(__dirname, "..", "prisma", "schema.prisma");

// Parse fields into proper Prisma format
function parseField(fieldStr) {
  const [nameType, ...modifiers] = fieldStr.split('@');
  const [name, type] = nameType.split(':');
  
  if (!name || !type) {
    console.error(`❌ Invalid field format: ${fieldStr}. Use format: fieldName:Type`);
    return null;
  }

  let prismaType = type;
  let fieldModifiers = [];

  // Handle optional fields (?)
  if (prismaType.endsWith('?')) {
    prismaType = prismaType.slice(0, -1);
    fieldModifiers.push('?');
  }

  // Handle array fields ([])
  if (prismaType.endsWith('[]')) {
    prismaType = prismaType.slice(0, -2) + '[]';
  }

  // Add modifiers back
  if (modifiers.length > 0) {
    fieldModifiers.push(`@${modifiers.join('@')}`);
  }

  return `  ${name.padEnd(12)} ${prismaType}${fieldModifiers.join(' ')}`;
}

// Generate default fields for the model
const defaultFields = [
  '  id          String   @id @default(cuid())',
  '  createdAt   DateTime @default(now())',
  '  updatedAt   DateTime @updatedAt'
];

// Parse custom fields
const customFields = fields
  .map(parseField)
  .filter(Boolean);

// Combine all fields
const allFields = [...defaultFields, ...customFields];

// Create the model definition
const modelDefinition = `
model ${capitalized} {
${allFields.join('\n')}
}`;

// Read current schema
let schemaContent = '';
if (fs.existsSync(schemaPath)) {
  schemaContent = fs.readFileSync(schemaPath, 'utf8');
} else {
  console.error("❌ schema.prisma not found");
  process.exit(1);
}

// Check if model already exists
if (schemaContent.includes(`model ${capitalized} {`)) {
  console.error(`❌ Model ${capitalized} already exists in schema.prisma`);
  process.exit(1);
}

// Add the new model to the end of the schema
const updatedSchema = schemaContent.trimEnd() + modelDefinition + '\n';

// Write back to schema
fs.writeFileSync(schemaPath, updatedSchema);

console.log(`✅ Added model ${capitalized} to schema.prisma`);
console.log(`📋 Model fields:`);
allFields.forEach(field => {
  console.log(`   ${field.trim()}`);
});
console.log(`\n🔄 Run 'npm run gen:migration add_${modelName.toLowerCase()}_table' to create migration`);
console.log(`🔄 Or run 'npx prisma db push' to push changes directly to database`);