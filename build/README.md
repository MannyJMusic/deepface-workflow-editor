# DeepFaceLab Workflow Editor Build Assets

This directory contains build assets for electron-builder packaging.

## Required Files

- `icon.icns` - macOS app icon (512x512)
- `icon.ico` - Windows app icon (256x256) 
- `icon.png` - Linux app icon (512x512)
- `dmg-background.png` - macOS DMG background image
- `entitlements.mac.plist` - macOS entitlements file

## Icon Creation

For now, we'll use placeholder icons. In production, you should create proper icons:

1. Design a 512x512 icon with the DeepFaceLab Workflow Editor branding
2. Convert to required formats:
   - macOS: Use `iconutil` to create .icns from .iconset
   - Windows: Use online converter or ImageMagick for .ico
   - Linux: Use .png format

## DMG Background

Create a 540x380 background image for the macOS DMG installer.
