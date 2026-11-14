# My Closet

**Open the app: https://alagilly.github.io/my-closet/**

A virtual closet you can add to your iPhone home screen. Add clothes with front and back photos, price, type, colour and style. Keep several closets, build outfits on a board, shuffle outfit ideas, plan outfits on a calendar, and see when you last wore something.

## Your data stays yours

- Everything you add is saved **on your own device** (in the browser's storage). Nothing is stored in this repo.
- The Calendar shows a 7-day forecast from [Open-Meteo](https://open-meteo.com) (free, no account). It uses the location on your GitHub profile if you have one, otherwise Toronto, and you can change it. Only the rounded location (about 1 km) is sent to Open-Meteo.
- Optional: tap the cloud badge in the top-right corner to back up and sync to **your own private GitHub repo** using a token that only you hold. Each person who uses the app connects their own repo.

## Install on iPhone

1. Open the site in Safari.
2. Tap Share → **Add to Home Screen**.

## Cut-out photos

Backgrounds are removed automatically on your device using the open RMBG-1.4 model (downloaded once, about 45 MB).

## Credits

- Blouses, Leggings, Rompers, Tights and Hair accessories icons are drawn for this app in the same line style.
- Icons from [Flaticon](https://www.flaticon.com), free with attribution, redrawn at one uniform (thin) line width:
  - Activewear: [Sportwear](https://www.flaticon.com/free-icon/sportwear_18842964) by Adury5711
  - Bags: [Handbag](https://www.flaticon.com/free-icon/handbag_9147365) by Aranagraphics
  - Accessories group: [Handbag](https://www.flaticon.com/free-icon/handbag_3345463) by juicy_fish
  - Footwear group: [Shoe](https://www.flaticon.com/free-icon/shoe_293145) by Magnific
  - Boots: [Boot](https://www.flaticon.com/free-icon/boot_8789844) by juicy_fish
  - Belts: [Belt](https://www.flaticon.com/free-icon/belt_5683319) by Hazicon
  - Blazers: [Jersey Blazer](https://www.flaticon.com/free-icon/jersey-blazer_88766) by Magnific
  - Bodysuits: [Underwear](https://www.flaticon.com/free-icon/underwear_13968001) by Nadiinko
  - Cardigans: [Fashion](https://www.flaticon.com/free-icon/fashion_13167322) by Chanut-is-Industries
  - Coats: [Coat](https://www.flaticon.com/free-icon/coat_2161184) by Smashicons
  - Dresses: [Dress](https://www.flaticon.com/free-icon/dress_3052777) by Pronicon
  - Shoes: [Running shoe](https://www.flaticon.com/free-icon/running-shoe_6456651) by Smashicons
  - Heels: [Shoes](https://www.flaticon.com/free-icon/shoes_6717443) by Vectors Tank (flipped)
  - Glasses: [Reading eyeglasses](https://www.flaticon.com/free-icon/reading-eyeglasses_27106) by Magnific
  - Hats: [Cap](https://www.flaticon.com/free-icon/cap_1974211) by Smashicons
  - Jackets: [Jacket](https://www.flaticon.com/free-icon/jacket_2806119) by Victoruler
  - Jackets group: [Jacket](https://www.flaticon.com/free-icon/jacket_5758286) by Ehtisham Abid
  - Jeans: [Jeans](https://www.flaticon.com/free-icon/jeans_492175) by Magnific
  - Jewelry: [Necklace](https://www.flaticon.com/free-icon/necklace_775385) by Smashicons
  - Jumpsuits: [Jumpsuit](https://www.flaticon.com/free-icon/jumpsuit_2290421) by photo3idea_studio
  - Overalls: [Overalls](https://www.flaticon.com/free-icon/overalls_3345721) by juicy_fish
  - Pants: [Jeans](https://www.flaticon.com/free-icon/jeans_2912587) by Magnific
  - Shorts: [Shorts](https://www.flaticon.com/free-icon/shorts_586444) by Magnific
  - Skirts: [Skirt](https://www.flaticon.com/free-icon/skirt_2161139) by Smashicons
  - Sweaters: [Sweater](https://www.flaticon.com/free-icon/sweater_88802) by Magnific
  - Hoodies: [Hoodie](https://www.flaticon.com/free-icon/hoodie_9431851) by juicy_fish
  - All: [App](https://www.flaticon.com/free-icon/app_13701579) by Erifqi Zetiawan
  - Tops group: [Upper garment](https://www.flaticon.com/free-icon/upper-garment_11179477) by Yuluck
  - Bottoms group: [Flare Pants](https://www.flaticon.com/free-icon/flare-pants_88772) by Magnific
  - Sweatpants: [Sports](https://www.flaticon.com/free-icon/sports_13945628) by Nadiinko
  - Crewnecks: [Shirt](https://www.flaticon.com/free-icon/shirt_10934966) by Ains
  - Bras: [Sport bra](https://www.flaticon.com/free-icon/sport-bra_18479314) by Irakun
  - Underwear: [Underwear](https://www.flaticon.com/free-icon/underwear_2348165) by Bartama Graphic
  - Full length group: [Dress](https://www.flaticon.com/free-icon/dress_2806167) by Victoruler
  - Long sleeves: [Shirt](https://www.flaticon.com/free-icon/shirt_17071121) by Nur syifa fauziah
  - Short sleeves: [T shirt](https://www.flaticon.com/free-icon/t-shirt_11205893) by JoeKanaka
  - Tank tops: [Tanktop](https://www.flaticon.com/free-icon/tanktop_5095867) by iconnut
  - Vests: [Waistcoat](https://www.flaticon.com/free-icon/waistcoat_4343241) by bqlqn
  - Other: [More](https://www.flaticon.com/free-icon/more_1477110) by Magnific
  - App icon: [Clothes hanger](https://www.flaticon.com/free-icon/clothes-hanger_3159614) by Magnific
- Background removal: [RMBG-1.4](https://huggingface.co/briaai/RMBG-1.4) by BRIA AI (free for non-commercial use), run with [Transformers.js](https://github.com/huggingface/transformers.js).
- Item recognition: [CLIP](https://huggingface.co/Xenova/clip-vit-base-patch32) (OpenAI, MIT License) via Transformers.js.

## Files

- `index.html`: page and styles
- `app.js`: app logic, on-device storage and GitHub sync
- `ml.js`: the on-device background-removal and recognition models
- `sw.js`: offline support
- `manifest.webmanifest` and `icon-*.png`: home-screen app settings
