/* artwork.js
   This is the only file you need to edit to change what's for sale.

   To add a piece: copy one { ... } block, paste it, and change the details.
   Each piece has a list of "options" (print sizes, canvas) with a price each.
   To stop selling a piece without deleting it: add  soldOut: true
   Photos go in assets/images/ (about 200 KB each, .jpg).

   width and height are the photo's size in pixels. They let the page save
   the right amount of space so nothing jumps while photos load.
   To get them on your Mac:  sips -g pixelWidth -g pixelHeight PHOTO.jpg
   (webp is optional: a smaller copy of the photo. Leave it out if you don't have one.)
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
        webp: "assets/images/school-of-rockfish.webp",
        width: 1000,
        height: 1195,
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
        webp: "assets/images/emerald-ambush.webp",
        width: 970,
        height: 1300,
        options: [
            { label: "Print, 12 x 16 in.", price: 40 },
            { label: "Print, 18 x 24 in.", price: 60 },
            // [ASK SAVANNAH: what size is the stretched canvas?]
            { label: "Stretched canvas print", price: 120 }
        ]
    },
    {
        id: "the-boreal-shadow",
        title: "The Boreal Shadow",
        image: "assets/images/the-boreal-shadow.jpg",
        webp: "assets/images/the-boreal-shadow.webp",
        width: 1000,
        height: 1236,
        options: [
            { label: "Print, 8 x 10 in.", price: 35 }
        ]
    }
];
