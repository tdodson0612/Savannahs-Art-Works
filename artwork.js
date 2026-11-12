/* artwork.js
   This is the only file you need to edit to change what's for sale.

   To add a piece: copy one { ... } block, paste it, and change the details.
   To mark a piece sold: change  sold: false  to  sold: true
   Photos go in assets/images/ (about 200 KB each, .jpg or .webp).
*/

/* Savannah's PayPal email (the one she logs in to PayPal with).
   Checkout stays turned off until this is filled in.
   [ASK SAVANNAH: which email is her PayPal account under?] */
const PAYPAL_EMAIL = "";

/* Flat shipping charge for the whole order, in dollars (for example 25).
   Leave as null until Savannah decides.
   [ASK SAVANNAH: how much for shipping?] */
const SHIPPING_COST = null;

/* The artwork list.
   THESE THREE ARE SAMPLES so the cart can be tested.
   Replace them with Savannah's real pieces. */
const ARTWORK = [
    {
        id: "sample-1",
        title: "Sample Piece 1",
        size: "[ASK SAVANNAH]",
        medium: "[ASK SAVANNAH]",
        price: 100,
        image: "",
        sold: false
    },
    {
        id: "sample-2",
        title: "Sample Piece 2",
        size: "[ASK SAVANNAH]",
        medium: "[ASK SAVANNAH]",
        price: 150,
        image: "",
        sold: false
    },
    {
        id: "sample-3",
        title: "Sample Piece 3",
        size: "[ASK SAVANNAH]",
        medium: "[ASK SAVANNAH]",
        price: 200,
        image: "",
        sold: true
    }
];

/* Example of a real entry, once she sends details:
    {
        id: "blue-heron",                       (short, unique, no spaces)
        title: "Blue Heron",
        size: "16 x 20 in.",
        medium: "Charcoal on paper",
        price: 180,
        image: "assets/images/blue-heron.jpg",
        sold: false
    },
*/
