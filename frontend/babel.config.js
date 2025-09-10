// 🔧 ROADMAP #7: BABEL CONFIGURATION - TypeScript Decorators Support
// This file enables WatermelonDB's @field, @date, @readonly decorators
// Key concept: Without this, the database model decorators won't work

module.exports = function(api) {
  api.cache(true);  // Cache Babel transforms for faster builds
  
  return {
    // 📦 EXPO PRESET: Standard Expo Babel configuration
    presets: ['babel-preset-expo'],
    
    // 🏷️ PLUGINS: Additional Babel transformations
    plugins: [
      // 🎯 DECORATOR SUPPORT: Enables @field, @date, @readonly syntax
      // This is REQUIRED for WatermelonDB models to work properly
      ["@babel/plugin-proposal-decorators", { "legacy": true }]
    ]
  };
};

// 💡 WHY THIS MATTERS:
// WatermelonDB uses decorators like @field('text') to map model properties 
// to database columns. Without this Babel plugin, you'd get syntax errors.
// The "legacy" option uses the older decorator proposal for compatibility.