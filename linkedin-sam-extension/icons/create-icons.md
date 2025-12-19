# Extension Icon Placeholders

You need to create 3 icon sizes for the extension:

- `icon16.png` - 16x16px (toolbar icon)
- `icon48.png` - 48x48px (extension management)
- `icon128.png` - 128x128px (Chrome Web Store)

## Quick Option: Use This SVG

Create these using an online SVG to PNG converter like https://cloudconvert.com/svg-to-png

Save this as `sam-icon.svg`:

```svg
<svg width="128" height="128" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
  <!-- Gradient Background -->
  <defs>
    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#ec4899;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#8b5cf6;stop-opacity:1" />
    </linearGradient>
  </defs>

  <!-- Rounded Square Background -->
  <rect width="128" height="128" rx="24" fill="url(#gradient)"/>

  <!-- Chat Bubble Icon -->
  <path d="M84 44H44C38.48 44 34 48.48 34 54V74C34 79.52 38.48 84 44 84H54L64 94L74 84H84C89.52 84 94 79.52 94 74V54C94 48.48 89.52 44 84 44Z"
        fill="white"
        stroke="white"
        stroke-width="2"/>

  <!-- SAM Text -->
  <text x="64" y="72"
        font-family="Arial, sans-serif"
        font-size="24"
        font-weight="bold"
        fill="#ec4899"
        text-anchor="middle">SAM</text>
</svg>
```

Then convert to:
- 16x16 PNG
- 48x48 PNG
- 128x128 PNG

## Alternative: Use Free Design Tool

1. Go to https://www.canva.com
2. Create custom size (128x128)
3. Add gradient background (pink to purple)
4. Add chat bubble icon
5. Add "SAM" text
6. Export as PNG at 128x128, 48x48, and 16x16

## Or Use These Temporary Placeholders

For testing, you can use solid color squares:
- Background: Pink gradient (#ec4899 to #8b5cf6)
- Icon: White chat bubble
- Text: "SAM" in bold

The icons just need to be recognizable in the Chrome toolbar and extension management page.
