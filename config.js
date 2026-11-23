/* config.js - site settings.
   Paintings, photos and prices are not in a file:
   Savannah manages them herself at /manage.html */

/* Supabase project (these two are public by design; safe to be here). */
const SUPABASE_URL = "https://fvpabbsulpwhioqbwqrq.supabase.co";
const SUPABASE_KEY = "sb_publishable_ZCZmRm7vMsPEQcKg8CP2IQ_mfcsGAat";

/* Where PayPal sends the money. */
const PAYPAL_EMAIL = "savannahdodsonart@gmail.com";

/* Savannah's PayPal app (public ID, safe here). The matching SECRET lives only in
   Supabase > Edge Functions > Secrets, never in the website. */
const PAYPAL_CLIENT_ID = "BAAL0A9aKcyMYnnwY1ZdiEeNg0QGxjHjNl_W_905gtq4eJB3jM0iRXa31Eutd1ERkpKYXl8tfhwRF3G0mw";

/* Shipping (from Savannah, Nov 23 2026). Charged once per order, no matter how many:
   - prints only: $8
   - any stretched canvas in the order: $14 (instead of $8)
   - originals: each original adds its own shipping, which Savannah sets per painting
   A print counts as canvas when its size includes the word "canvas".
   If you change these, change them in the paypal-ipn function too. */
const SHIPPING_PRINTS = 8;
const SHIPPING_CANVAS = 14;

/* Shown in the cart. */
const SHIPPING_NOTE = "Ships within the US only. Orders usually ship in 1–2 weeks.";
