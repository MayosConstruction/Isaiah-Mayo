# Every Door Direct Mail postcard

- `Mayos-EDDM-postcard-print.pdf`: print-ready, 2 pages (front and back), 9" × 6.25" with 0.125" bleed on every side (file size 9.25" × 6.5").
- `Mayos-postcard-FRONT.png` / `Mayos-postcard-BACK.png`: the same at 300 DPI.
- `postcard.html`: the design. Edit the text, then run `node marketing/render.js "$PWD/marketing"` to regenerate the files.

The back has the EDDM Retail postage indicia and "Local Postal Customer". Ask your printer to confirm it matches the current USPS EDDM requirements before printing.

# Business cards

- `Mayos-business-card-Isaiah-print.pdf` and `Mayos-business-card-Moss-print.pdf`: print-ready, 2 pages (front and back), 3.5" × 2" with 0.125" bleed (file size 3.75" × 2.25").
- `Mayos-business-card-FRONT.png`, `-BACK-Isaiah.png`, `-BACK-Moss.png`: the same at 300 DPI.
- `business-card.html`: the design. Edit the text, then run `node marketing/render-cards.js "$PWD/marketing"` to regenerate the files.
