# Development Packages

This folder contains the broker packages for development and maintenance.

## 📁 Structure

```
dev-packages/
├── unified-broker/     # Core unified broker library
├── broker-shoonya/     # Shoonya broker plugin  
└── broker-fyers/       # Fyers broker plugin
```

## 🔄 Development Workflow

### 1. **Make Changes**
Edit the packages in this folder for bug fixes or new features.

### 2. **Test Locally (Optional)**
If you need to test changes before publishing:
```bash
# Temporarily link local packages
cd backend
npm install file:../dev-packages/unified-broker
npm install file:../dev-packages/broker-shoonya  
npm install file:../dev-packages/broker-fyers

# Test your changes
npm run dev

# Revert to published packages when done
npm install @copytrade/unified-broker@latest
npm install @copytrade/broker-shoonya@latest
npm install @copytrade/broker-fyers@latest
```

### 3. **Publish Updates**
When ready to release:
```bash
# Build and publish each package
cd dev-packages/unified-broker
npm version patch  # or minor/major
npm run build
npm publish

cd ../broker-shoonya  
npm version patch
npm run build
npm publish

cd ../broker-fyers
npm version patch
npm run build  
npm publish
```

### 4. **Update Application**
Update the main application to use new versions:
```bash
cd backend
npm install @copytrade/unified-broker@latest
npm install @copytrade/broker-shoonya@latest
npm install @copytrade/broker-fyers@latest
```

## ✅ Benefits

- **Clean separation** between development and production
- **No complex dev/prod configurations**
- **Easy to maintain** and publish updates
- **Simple workflow** for bug fixes and features
- **Production uses stable published packages**

## 📝 Notes

- The main application always uses published NPM packages
- Local testing is optional and temporary
- Each package has its own version and release cycle
- Changes are only deployed after publishing to NPM
