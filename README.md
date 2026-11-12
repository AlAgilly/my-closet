# My Closet

**Open the app: https://alagilly.github.io/my-closet/**

A virtual closet you can add to your iPhone home screen. Add clothes with front and back photos, price, type, colour and style. Keep several closets, build outfits on a board, shuffle outfit ideas, plan outfits on a calendar, and see when you last wore something.

## Your data stays yours

- Everything you add is saved **on your own device** (in the browser's storage). Nothing is stored in this repo.
- Optional: tap the dot in the top-right corner to back up and sync to **your own private GitHub repo** using a token that only you hold. Each person who uses the app connects their own repo.

## Install on iPhone

1. Open the site in Safari.
2. Tap Share → **Add to Home Screen**.

## Cut-out photos

"Remove background" runs on your device using the open RMBG-1.4 model (downloaded once, about 45 MB). You can also touch and hold a piece of clothing in the iPhone Photos app, tap Share → Save Image, and choose that cut-out picture.

## Credits

- Clothing type icons: [IconPark](https://github.com/bytedance/IconPark) by ByteDance (Apache License 2.0) and [Phosphor Icons](https://github.com/phosphor-icons/core) (MIT License), with line weights adjusted. The tank top icon is the owner's own drawing.
- Background removal: [RMBG-1.4](https://huggingface.co/briaai/RMBG-1.4) by BRIA AI (free for non-commercial use), run with [Transformers.js](https://github.com/huggingface/transformers.js).
- Item recognition: [CLIP](https://huggingface.co/Xenova/clip-vit-base-patch32) (OpenAI, MIT License) via Transformers.js.

## Files

- `index.html`: page and styles
- `app.js`: app logic, on-device storage and GitHub sync
- `sw.js`: offline support
- `manifest.webmanifest` and `icon-*.png`: home-screen app settings
