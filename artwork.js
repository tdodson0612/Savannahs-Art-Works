/* artwork.js
   This is the only file you need to edit to change what's for sale.

   To add a piece: copy one { ... } block, paste it, and change the details.
   Each piece has a list of "options" (print sizes, canvas) with a price each.
   To stop selling a piece without deleting it: add  soldOut: true
   Photos go in assets/images/ (about 200 KB each, .jpg).
*/

/* Savannah's PayPal email (the one she logs in to PayPal with).
   Checkout stays turned off until this is filled in.
   [ASK SAVANNAH: which email is her PayPal account under?] */
const PAYPAL_EMAIL = "";

/* Shipping for the whole order, in dollars.
   Savannah said "$8 for shipping on all prints."
   [ASK SAVANNAH: is $8 per order or per print? Same for stretched canvas?] */
const SHIPPING_COST = 8;

const ARTWORK = [
    {
        id: "school-of-rockfish",
        title: "School of Rockfish",
        image: "assets/images/school-of-rockfish.jpg",
        options: [
            { label: "Fine print, 8 x 10 in.", price: 35 },
            { label: "Fine print, 16 x 20 in.", price: 60 },
            // [ASK SAVANNAH: what size is the stretched canvas?]
            { label: "Stretched canvas print", price: 149 }
        ]
    },
    {
        id: "emerald-ambush",
        title: "Emerald Ambush",
        image: "assets/images/emerald-ambush.jpg",
        options: [
            { label: "Print, 12 x 16 in.", price: 40 },
            { label: "Print, 18 x 24 in.", price: 60 },
            // [ASK SAVANNAH: what size is the stretched canvas?]
            { label: "Stretched canvas print", price: 120 }
        ]
    }
];
