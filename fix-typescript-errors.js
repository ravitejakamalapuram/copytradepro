const fs = require('fs');
const path = require('path');

// Files to fix
const fixes = [
  // Remove unused React import from test files
  {
    file: 'frontend/src/components/__tests__/Badge.test.tsx',
    find: "import React from 'react';",
    replace: ""
  },
  {
    file: 'frontend/src/components/__tests__/OrderResultDisplay.test.tsx',
    find: "import React from 'react';",
    replace: ""
  },
  // Fix unused variables
  {
    file: 'frontend/src/components/__tests__/OrderResultDisplay.test.tsx',
    find: "getUserFriendlyError: vi.fn((error: string) => ({",
    replace: "getUserFriendlyError: vi.fn((_error: string) => ({"
  },
  // Fix unused imports
  {
    file: 'frontend/src/components/LivePriceTicker.tsx',
    find: "import { useResourceCleanup } from '../hooks/useResourceCleanup';",
    replace: "// import { useResourceCleanup } from '../hooks/useResourceCleanup';"
  },
  {
    file: 'frontend/src/pages/TradeSetup.tsx',
    find: "import { PageHeader, Grid, Stack, HStack, Flex } from '../components/ui/Layout';",
    replace: "import { Grid, Stack, HStack, Flex } from '../components/ui/Layout';"
  }
];

console.log('Applying TypeScript fixes...');

fixes.forEach(fix => {
  try {
    if (fs.existsSync(fix.file)) {
      let content = fs.readFileSync(fix.file, 'utf8');
      if (content.includes(fix.find)) {
        content = content.replace(fix.find, fix.replace);
        fs.writeFileSync(fix.file, content);
        console.log(`✅ Fixed: ${fix.file}`);
      }
    }
  } catch (error) {
    console.log(`❌ Error fixing ${fix.file}:`, error.message);
  }
});

console.log('TypeScript fixes applied!');