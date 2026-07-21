# AI Stack Builder identity

The product mark is a model-generated, product-specific emblem. Its three interlocking architectural layers represent a composed technology stack, while the routed gold path and three crimson nodes represent the graph the product builds from a user prompt.

- `source/ai-stack-builder-generated-chroma.png` is the untouched built-in image-generation output.
- `master/ai-stack-builder-mark-alpha.png` is the true-RGBA cleaned master.
- `icons/ai-stack-builder-icon-{size}.png` are transparent any-purpose icons at 16, 32, 48, 180, 192, 512, and 1024 px.
- `icons/ai-stack-builder-icon-maskable-{size}.png` are opaque, mask-safe PWA icons.
- `icons/ai-stack-builder-icon-apple-180.png` and `icons/ai-stack-builder-icon-ios-1024.png` are opaque Apple deliverables.
- `src/app/favicon.ico`, `src/app/icon.png`, and `src/app/apple-icon.png` are framework-consumed derivatives.

Run `npm run brand:build` to regenerate the entire family and `npm run brand:check` to detect pixel drift, missing sizes, or broken alpha contracts.

The mark itself must not be recreated with SVG, CSS, canvas, or hand-coded paths. The asset builder only resizes and composites the generated raster master.
