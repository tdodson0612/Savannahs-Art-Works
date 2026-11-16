/* script.js - cart and PayPal checkout for Savannah's Art Works.
   You shouldn't need to edit this file. Artwork and settings are in artwork.js. */

const CART_KEY = "savannahCartV2";

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
   Each cart line is { id, opt, qty }:
   id  = which artwork, opt = which option (0, 1, 2...), qty = how many. */

function getCart() {
    let lines = [];
    try {
        lines = JSON.parse(localStorage.getItem(CART_KEY)) || [];
    } catch (error) {
        lines = [];
    }
    // Drop anything that's been removed from the list or sold out.
    return lines.filter(function (line) {
        const piece = findArtwork(line.id);
        return piece && !piece.soldOut && piece.options[line.opt] && line.qty > 0;
    });
}

function saveCart(lines) {
    try {
        localStorage.setItem(CART_KEY, JSON.stringify(lines));
    } catch (error) {
        // Private browsing can block storage; the page still works.
    }
    updateCartCount();
}

function updateCartCount() {
    const count = getCart().reduce(function (total, line) {
        return total + line.qty;
    }, 0);
    document.querySelectorAll(".cart-count").forEach(function (element) {
        element.textContent = count;
    });
}

function addToCart(id, opt) {
    const cart = getCart();
    const existing = cart.find(function (line) {
        return line.id === id && line.opt === opt;
    });
    if (existing) {
        existing.qty += 1;
    } else {
        cart.push({ id: id, opt: opt, qty: 1 });
    }
    saveCart(cart);
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

    gallery.innerHTML = ARTWORK.map(function (piece) {
        const photo = piece.image
            ? '<a href="' + escapeHTML(piece.image) + '" target="_blank" rel="noopener" title="View larger">' +
                  '<img src="' + escapeHTML(piece.image) + '" alt="' + escapeHTML(piece.title) + '" loading="lazy">' +
              '</a>'
            : '<div class="photo-placeholder">Photo coming soon</div>';

        const choices = piece.options.map(function (option, index) {
            return '<option value="' + index + '">' + escapeHTML(option.label) + ' &ndash; ' + money(option.price) + '</option>';
        }).join("");

        const fromPrice = Math.min.apply(null, piece.options.map(function (o) { return o.price; }));

        const buying = piece.soldOut
            ? '<span class="sold-label">Sold out</span>'
            : '<label class="option-label" for="opt-' + escapeHTML(piece.id) + '">Choose a size</label>' +
              '<select class="option-select" id="opt-' + escapeHTML(piece.id) + '">' + choices + '</select>' +
              '<button class="button add-button" type="button" data-id="' + escapeHTML(piece.id) + '">Add to cart</button>';

        return (
            '<article class="art-card' + (piece.soldOut ? " is-sold" : "") + '">' +
                '<div class="art-photo">' + photo + '</div>' +
                '<div class="art-info">' +
                    '<h2>' + escapeHTML(piece.title) + '</h2>' +
                    '<p class="art-price">From ' + money(fromPrice) + '</p>' +
                    buying +
                '</div>' +
            '</article>'
        );
    }).join("");

    gallery.querySelectorAll(".add-button").forEach(function (btn) {
        btn.addEventListener("click", function () {
            const id = btn.dataset.id;
            const opt = Number(document.getElementById("opt-" + id).value);
            const piece = findArtwork(id);
            addToCart(id, opt);
            showToast(piece.title + " (" + piece.options[opt].label + ") added to your cart");
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

    itemsBox.innerHTML = cart.map(function (line, index) {
        const piece = findArtwork(line.id);
        const option = piece.options[line.opt];
        const lineTotal = option.price * line.qty;
        subtotal += lineTotal;
        const thumb = piece.image
            ? '<img src="' + escapeHTML(piece.image) + '" alt="">'
            : '<div class="photo-placeholder small"></div>';
        return (
            '<div class="cart-item">' +
                '<div class="cart-thumb">' + thumb + '</div>' +
                '<div class="cart-item-info">' +
                    '<h2>' + escapeHTML(piece.title) + '</h2>' +
                    '<p class="art-details">' + escapeHTML(option.label) + ' &middot; ' + money(option.price) + ' each</p>' +
                    '<div class="qty">' +
                        '<button class="qty-button" type="button" data-index="' + index + '" data-change="-1" aria-label="One less">&minus;</button>' +
                        '<span class="qty-number">' + line.qty + '</span>' +
                        '<button class="qty-button" type="button" data-index="' + index + '" data-change="1" aria-label="One more">+</button>' +
                        '<button class="remove-button" type="button" data-index="' + index + '">Remove</button>' +
                    '</div>' +
                '</div>' +
                '<div class="cart-item-price">' + money(lineTotal) + '</div>' +
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

    itemsBox.querySelectorAll(".qty-button").forEach(function (btn) {
        btn.addEventListener("click", function () {
            const lines = getCart();
            const line = lines[Number(btn.dataset.index)];
            line.qty += Number(btn.dataset.change);
            saveCart(lines.filter(function (l) { return l.qty > 0; }));
            renderCart();
        });
    });

    itemsBox.querySelectorAll(".remove-button").forEach(function (btn) {
        btn.addEventListener("click", function () {
            const lines = getCart();
            lines.splice(Number(btn.dataset.index), 1);
            saveCart(lines);
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

    cart.forEach(function (line, index) {
        const piece = findArtwork(line.id);
        const option = piece.options[line.opt];
        const n = index + 1;
        fields["item_name_" + n] = piece.title + " - " + option.label;
        fields["amount_" + n] = option.price.toFixed(2);
        fields["quantity_" + n] = String(line.qty);
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
