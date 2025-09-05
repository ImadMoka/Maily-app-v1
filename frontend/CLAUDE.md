# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🎯 Startup Coding Principles

*EARLY-STAGE STARTUP RULES - FOLLOW THESE:*

1. *Prioritize simple, readable code with minimal abstraction* - avoid premature optimization. Strive for elegant, minimal solutions that reduce complexity. Focus on clear implementation that's easy to understand and iterate on as the product evolves.

2. *DO NOT preserve backward compatibility* unless the user specifically requests it. Move fast and break things that need breaking.

## Project Overview

Maily is an email management application built as a cross-platform mobile app using React Native and Expo. The frontend provides intuitive email handling with modern mobile UX patterns and cross-platform deployment capabilities.

## Development Commands

```bash
bun install       # Install dependencies
bun run start     # Development server with Expo
bun run android   # Run on Android device/emulator
bun run ios       # Run on iOS device/simulator
bun run web       # Run on web browser
```

*IMPORTANT:*

• Development server uses Expo CLI with hot reload and fast refresh
• Always use Bun instead of npm/yarn for package management
• All code must be TypeScript - no plain JavaScript files
• Cross-platform compatibility is essential - test on all platforms
• Uses Expo's new architecture for improved performance

## Architecture

*Frontend (React Native + Expo)*
• React Native with Expo SDK 53 and TypeScript strict mode
• File-based routing through `app/` directory structure
• Cross-platform deployment (iOS, Android, Web)
• Expo's registerRootComponent for application bootstrapping
• Modern React patterns with hooks and functional components

*Development Setup*
• Expo development server with hot module replacement
• TypeScript configuration extending Expo's base setup
• Bun as package manager and runtime for faster operations
• Platform-specific configurations in app.json

## Key Configuration Files

• `package.json` - Dependencies and Expo scripts
• `app.json` - Expo configuration with platform settings and bundle IDs
• `tsconfig.json` - TypeScript strict mode extending Expo base
• `index.ts` - Application entry point with registerRootComponent
• `bun.lock` - Dependency lockfile for consistent installations

## Development Notes

• All screens and components are in `app/` directory using Expo Router
• Entry point flows: `index.ts` → registers App component → `app/index.tsx`
• Bundle identifiers: `com.amin598.frontend` for both iOS and Android
• New architecture enabled for performance improvements
• Edge-to-edge display support on Android
• Adaptive icons and splash screens configured
• Uses file-based routing - no manual route configuration needed
• NEVER EVER COMMIT A CHANGE, PUSH OR EVEN STAGE CHANGES WHEN NOT SPECIFICALLY ASKED
- where is the the code-teacher-english agent?