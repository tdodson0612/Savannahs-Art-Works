/* script.js - cart and PayPal checkout for Savannah's Art Works.
   You shouldn't need to edit this file. Artwork and settings are in artwork.js. */

const CART_KEY = "savannahCart";

/* ---------- Helpers ---------- */

function money(amount) {
    return "$" + amount.toFixed(2);
}

function escapeHTML(value) {
    const div = document.createElement("div");
    div.textContent = String(value);
    return div.innerHTML;
}

function findArtwork(id) {
    return ARTWORK.find(function (piece) {
        return piece.id === id;
    });
}

/* ---------- Cart storage (saved in the visitor's browser) ----------
   The cart is a list of artwork ids. Each piece is one of a kind,
   so there are no quantities. */

function getCart() {
    let ids = [];
    try {
        ids = JSON.parse(localStorage.getItem(CART_KEY)) || [];
    } catch (error) {
        ids = [];
    }
    // Drop anything that's been removed from the list or marked sold.
    return ids.filter(function (id) {
        const piece = findArtwork(id);
        return piece && !piece.sold;
    });
}

function saveCart(ids) {
    try {
        localStorage.setItem(CART_KEY, JSON.stringify(ids));
    } catch (error) {
        // Private browsing can block storage; the page still works.
    }
    updateCartCount();
}

function updateCartCount() {
    const count = getCart().length;
    document.querySelectorAll(".cart-count").forEach(function (element) {
        element.textContent = count;
    });
}

function showToast(message) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(function () {
        toast.classList.remove("show");
    }, 2200);
}

/* ---------- Home page: artwork grid ---------- */

function renderGallery() {
    const gallery = document.getElementById("gallery");
    if (!gallery) return;

    if (ARTWORK.length === 0) {
        gallery.innerHTML = '<p class="empty">New pieces coming soon.</p>';
        return;
    }

    const cart = getCart();

    gallery.innerHTML = ARTWORK.map(function (piece) {
        const photo = piece.image
            ? '<img src="' + escapeHTML(piece.image) + '" alt="' + escapeHTML(piece.title) + '" loading="lazy">'
            : '<div class="photo-placeholder">Photo coming soon</div>';

        let button;
        if (piece.sold) {
            button = '<span class="sold-label">Sold</span>';
        } else if (cart.includes(piece.id)) {
            button = '<a href="cart.html" class="button button-outline">In cart, view cart</a>';
        } else {
            button = '<button class="button add-button" type="button" data-id="' + escapeHTML(piece.id) + '">Add to cart</button>';
        }

        return (
            '<article class="art-card' + (piece.sold ? " is-sold" : "") + '">' +
                '<div class="art-photo">' + photo + '</div>' +
                '<div class="art-info">' +
                    '<h2>' + escapeHTML(piece.title) + '</h2>' +
                    '<p class="art-details">' + escapeHTML(piece.size) + ' &middot; ' + escapeHTML(piece.medium) + '</p>' +
                    '<p class="art-price">' + money(piece.price) + '</p>' +
                    button +
                '</div>' +
            '</article>'
        );
    }).join("");

    gallery.querySelectorAll(".add-button").forEach(function (btn) {
        btn.addEventListener("click", function () {
            const cart = getCart();
            const id = btn.dataset.id;
            if (!cart.includes(id)) cart.push(id);
            saveCart(cart);
            showToast(findArtwork(id).title + " added to your cart");
            renderGallery();
        });
    });
}

/* ---------- Cart page ---------- */

function renderCart() {
    const itemsBox = document.getElementById("cartItems");
    if (!itemsBox) return;

    const summary = document.getElementById("cartSummary");
    const cart = getCart();

    if (cart.length === 0) {
        itemsBox.innerHTML = '<p class="empty">Your cart is empty.</p>';
        summary.hidden = true;
        return;
    }

    let subtotal = 0;

    itemsBox.innerHTML = cart.map(function (id) {
        const piece = findArtwork(id);
        subtotal += piece.price;
        const thumb = piece.image
            ? '<img src="' + escapeHTML(piece.image) + '" alt="">'
            : '<div class="photo-placeholder small"></div>';
        return (
            '<div class="cart-item">' +
                '<div class="cart-thumb">' + thumb + '</div>' +
                '<div class="cart-item-info">' +
                    '<h2>' + escapeHTML(piece.title) + '</h2>' +
                    '<p class="art-details">' + escapeHTML(piece.size) + ' &middot; ' + escapeHTML(piece.medium) + '</p>' +
                    '<button class="remove-button" type="button" data-id="' + escapeHTML(id) + '">Remove</button>' +
                '</div>' +
                '<div class="cart-item-price">' + money(piece.price) + '</div>' +
            '</div>'
        );
    }).join("");

    const shippingKnown = typeof SHIPPING_COST === "number";
    document.getElementById("subtotal").textContent = money(subtotal);
    document.getElementById("shipping").textContent = shippingKnown ? money(SHIPPING_COST) : "[ASK SAVANNAH]";
    document.getElementById("total").textContent = money(subtotal + (shippingKnown ? SHIPPING_COST : 0));
    summary.hidden = false;

    const ready = PAYPAL_EMAIL !== "" && shippingKnown;
    document.getElementById("checkoutButton").disabled = !ready;
    document.getElementById("checkoutNotice").hidden = ready;

    itemsBox.querySelectorAll(".remove-button").forEach(function (btn) {
        btn.addEventListener("click", function () {
            saveCart(getCart().filter(function (id) {
                return id !== btn.dataset.id;
            }));
            renderCart();
        });
    });
}

/* ---------- PayPal checkout ----------
   Sends the cart to PayPal's checkout page. The buyer pays there
   (PayPal account or card), then comes back to cart.html?paid=1 */

function startPayPalCheckout() {
    const cart = getCart();
    if (cart.length === 0) return;

    const pageBase = window.location.href.split("?")[0].replace(/cart\.html$/, "");

    const fields = {
        cmd: "_cart",
        upload: "1",
        business: PAYPAL_EMAIL,
        currency_code: "USD",
        no_shipping: "2",               // buyer must enter a shipping address
        handling_cart: SHIPPING_COST.toFixed(2),
        return: pageBase + "cart.html?paid=1",
        cancel_return: pageBase + "cart.html"
    };

    cart.forEach(function (id, index) {
        const piece = findArtwork(id);
        const n = index + 1;
        fields["item_name_" + n] = piece.title + " (" + piece.size + ")";
        fields["amount_" + n] = piece.price.toFixed(2);
        fields["quantity_" + n] = "1";
    });

    const form = document.createElement("form");
    form.method = "POST";
    form.action = "https://www.paypal.com/cgi-bin/webscr";

    Object.keys(fields).forEach(function (name) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = fields[name];
        form.appendChild(input);
    });

    document.body.appendChild(form);
    form.submit();
}

/* ---------- Start ---------- */

document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("#currentYear").forEach(function (element) {
        element.textContent = new Date().getFullYear();
    });

    // Back from PayPal after paying: empty the cart and say thanks.
    if (new URLSearchParams(window.location.search).get("paid") === "1") {
        saveCart([]);
        const thanks = document.getElementById("thankYou");
        if (thanks) thanks.hidden = false;
    }

    const checkoutButton = document.getElementById("checkoutButton");
    if (checkoutButton) checkoutButton.addEventListener("click", startPayPalCheckout);

    updateCartCount();
    renderGallery();
    renderCart();
});
