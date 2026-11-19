/* config.js - site settings.
   Paintings, photos and prices are no longer in a file:
   Savannah manages them herself at /manage.html */

/* Supabase project (these two are public by design; safe to be here). */
const SUPABASE_URL = "https://fvpabbsulpwhioqbwqrq.supabase.co";
const SUPABASE_KEY = "sb_publishable_ZCZmRm7vMsPEQcKg8CP2IQ_mfcsGAat";

/* Where PayPal sends the money. */
const PAYPAL_EMAIL = "savannahdodsonart@gmail.com";

/* Shipping for the whole order, in dollars.
   Savannah said "$8 for shipping on all prints."
   [ASK SAVANNAH: is $8 per order or per print? Same for stretched canvas and originals?] */
const SHIPPING_COST = 8;
