/* script.js - Savannah's Art Works
   Cart, PayPal checkout, and the scrolling effects.
   You shouldn't need to edit this file. Artwork and settings are in artwork.js. */

const CART_KEY = "savannahCartV2";
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
    updateCartCount(true);
}

function updateCartCount(animate) {
    const count = getCart().reduce(function (total, line) {
        return total + line.qty;
    }, 0);
    document.querySelectorAll(".cart-count").forEach(function (element) {
        const changed = element.textContent !== String(count);
        element.textContent = count;
        if (animate && changed) {
            element.classList.remove("bump");
            void element.offsetWidth; // restart the animation
            element.classList.add("bump");
        }
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
    }, 2400);
}

/* ---------- Scroll reveals ----------
   Anything with class "reveal" fades and rises in when it scrolls into view. */

const revealObserver = "IntersectionObserver" in window
    ? new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            const el = entry.target;
            el.classList.add("is-visible");
            revealObserver.unobserve(el);
            // Once it has arrived, drop the delay so hover effects feel instant.
            setTimeout(function () {
                el.style.setProperty("--delay", "0s");
                el.style.transition = "opacity 0.9s var(--ease-out), transform 0.6s var(--ease-out)";
            }, 1400);
        });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" })
    : null;

function watchReveals(root) {
    (root || document).querySelectorAll(".reveal:not(.is-visible)").forEach(function (el) {
        if (revealObserver && !reduceMotion) {
            revealObserver.observe(el);
        } else {
            el.classList.add("is-visible");
        }
    });
}

/* ---------- Headline: words rise in one at a time ---------- */

function splitHeadline() {
    document.querySelectorAll(".split-words").forEach(function (heading) {
        const words = heading.textContent.trim().split(/\s+/);
        heading.setAttribute("aria-label", words.join(" "));
        heading.innerHTML = words.map(function (word, i) {
            return '<span class="word" aria-hidden="true"><span style="--delay:' + (0.1 + i * 0.12) + 's">' +
                escapeHTML(word) + '</span></span>';
        }).join(" ");
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                heading.classList.add("is-visible");
            });
        });
    });
}

/* ---------- Photos fade in once loaded (no pop-in) ---------- */

function whenLoaded(img) {
    function done() {
        img.classList.add("loaded");
        if (img.closest(".art-photo")) img.closest(".art-photo").classList.add("loaded");
    }
    if (img.complete && img.naturalWidth > 0) {
        done();
    } else {
        img.addEventListener("load", done, { once: true });
        img.addEventListener("error", done, { once: true });
    }
}

/* ---------- Home page: artwork grid ---------- */

function pictureHTML(piece, className) {
    const size = piece.width && piece.height
        ? ' width="' + piece.width + '" height="' + piece.height + '"'
        : "";
    const webp = piece.webp
        ? '<source srcset="' + escapeHTML(piece.webp) + '" type="image/webp">'
        : "";
    return '<picture>' + webp +
        '<img class="' + className + '" src="' + escapeHTML(piece.image) + '" alt="' + escapeHTML(piece.title) + '"' +
        size + ' loading="lazy" decoding="async">' +
        '</picture>';
}

function renderGallery() {
    const gallery = document.getElementById("gallery");
    if (!gallery) return;

    if (ARTWORK.length === 0) {
        gallery.innerHTML = '<p class="empty">New pieces coming soon.</p>';
        return;
    }

    gallery.innerHTML = ARTWORK.map(function (piece, index) {
        // Reserve the photo's exact shape before it loads, so nothing shifts.
        const ratio = piece.width && piece.height ? ' style="aspect-ratio:' + piece.width + ' / ' + piece.height + '"' : "";

        const photo = piece.image
            ? '<a href="' + escapeHTML(piece.image) + '" target="_blank" rel="noopener" aria-label="View ' + escapeHTML(piece.title) + ' larger">' +
                  pictureHTML(piece, "art-img") +
              '</a>'
            : '<div class="photo-placeholder">Photo coming soon</div>';

        const choices = piece.options.map(function (option, i) {
            return '<option value="' + i + '">' + escapeHTML(option.label) + ' &ndash; ' + money(option.price) + '</option>';
        }).join("");

        const fromPrice = Math.min.apply(null, piece.options.map(function (o) { return o.price; }));

        const buying = piece.soldOut
            ? '<span class="sold-label">Sold out</span>'
            : '<label class="option-label" for="opt-' + escapeHTML(piece.id) + '">Choose a size</label>' +
              '<select class="option-select" id="opt-' + escapeHTML(piece.id) + '">' + choices + '</select>' +
              '<button class="button add-button" type="button" data-id="' + escapeHTML(piece.id) + '">Add to cart</button>';

        return (
            '<article class="art-card reveal' + (piece.soldOut ? " is-sold" : "") + '" style="--delay:' + ((index % 3) * 0.12) + 's">' +
                '<div class="art-photo"' + ratio + '>' + photo + '</div>' +
                '<div class="art-info">' +
                    '<h2>' + escapeHTML(piece.title) + '</h2>' +
                    '<p class="art-price">From ' + money(fromPrice) + '</p>' +
                    buying +
                '</div>' +
            '</article>'
        );
    }).join("");

    gallery.querySelectorAll(".art-img").forEach(whenLoaded);
    watchReveals(gallery);

    gallery.querySelectorAll(".add-button").forEach(function (btn) {
        btn.addEventListener("click", function () {
            const id = btn.dataset.id;
            const opt = Number(document.getElementById("opt-" + id).value);
            const piece = findArtwork(id);
            addToCart(id, opt);
            showToast(piece.title + " (" + piece.options[opt].label + ") added to your cart");

            // Quick "Added ✓" confirmation on the button itself
            btn.textContent = "Added";
            btn.classList.add("added");
            clearTimeout(btn.resetTimer);
            btn.resetTimer = setTimeout(function () {
                btn.textContent = "Add to cart";
                btn.classList.remove("added");
            }, 1600);
        });
    });
}

/* ---------- Cart page ---------- */

function renderCart(animateIn) {
    const itemsBox = document.getElementById("cartItems");
    if (!itemsBox) return;

    const summary = document.getElementById("cartSummary");
    const cart = getCart();

    itemsBox.classList.toggle("no-anim", !animateIn);

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
            ? '<img src="' + escapeHTML(piece.image) + '" alt="" decoding="async">'
            : '';
        return (
            '<div class="cart-item" style="animation-delay:' + (index * 0.08) + 's">' +
                '<div class="cart-thumb">' + thumb + '</div>' +
                '<div class="cart-item-info">' +
                    '<h2>' + escapeHTML(piece.title) + '</h2>' +
                    '<p class="art-details">' + escapeHTML(option.label) + ' &middot; ' + money(option.price) + ' each</p>' +
                    '<div class="qty">' +
                        '<button class="qty-button" type="button" data-index="' + index + '" data-change="-1" aria-label="One less ' + escapeHTML(piece.title) + '">&minus;</button>' +
                        '<span class="qty-number" aria-label="Quantity">' + line.qty + '</span>' +
                        '<button class="qty-button" type="button" data-index="' + index + '" data-change="1" aria-label="One more ' + escapeHTML(piece.title) + '">+</button>' +
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
            if (line.qty <= 0) {
                removeLine(btn, Number(btn.dataset.index));
                return;
            }
            saveCart(lines);
            renderCart(false);
        });
    });

    itemsBox.querySelectorAll(".remove-button").forEach(function (btn) {
        btn.addEventListener("click", function () {
            removeLine(btn, Number(btn.dataset.index));
        });
    });
}

// Slide the row out, then update the cart.
function removeLine(btn, index) {
    const row = btn.closest(".cart-item");
    const finish = function () {
        const lines = getCart();
        lines.splice(index, 1);
        saveCart(lines);
        renderCart(false);
    };
    if (reduceMotion || !row) {
        finish();
        return;
    }
    row.classList.add("leaving");
    setTimeout(finish, 340);
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

/* ---------- Background photo + header, driven by scroll ----------
   The photo slides up as you scroll: at the top you see the trees,
   at the bottom of the page you've reached the water.
   The header tucks away when scrolling down and comes back when scrolling up. */

function setupScrollEffects() {
    const bgImg = document.getElementById("bgImage");
    const header = document.getElementById("siteHeader");
    let lastY = window.scrollY;
    let ticking = false;

    if (bgImg) whenLoaded(bgImg);

    function update() {
        ticking = false;
        const y = window.scrollY;
        const viewH = window.innerHeight;

        if (bgImg && !reduceMotion) {
            const travel = Math.max(0, bgImg.offsetHeight - viewH);
            const maxScroll = document.documentElement.scrollHeight - viewH;
            const progress = maxScroll > 0 ? Math.min(1, Math.max(0, y / maxScroll)) : 0;
            bgImg.style.transform = "translate3d(0," + (-travel * progress).toFixed(1) + "px,0)";
        }

        if (header) {
            header.classList.toggle("is-scrolled", y > 24);
            if (Math.abs(y - lastY) > 4) {
                const goingDown = y > lastY;
                header.classList.toggle("is-hidden", goingDown && y > 220);
                lastY = y;
            }
        }
    }

    function requestUpdate() {
        if (!ticking) {
            ticking = true;
            requestAnimationFrame(update);
        }
    }

    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    if (bgImg) bgImg.addEventListener("load", requestUpdate);

    // Show the header again when someone tabs into it with the keyboard.
    if (header) {
        header.addEventListener("focusin", function () {
            header.classList.remove("is-hidden");
        });
    }

    update();
}

/* ---------- Smooth, weighted scrolling (Lenis) ----------
   Only for mouse wheels and trackpads; phones keep their normal scrolling.
   Turned off for people who ask their device for reduced motion. */

function setupSmoothScroll() {
    if (reduceMotion || typeof Lenis === "undefined") return;
    window.lenis = new Lenis({
        autoRaf: true,
        lerp: 0.09,
        smoothWheel: true
    });
}

/* ---------- Start ---------- */

function start() {
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

    updateCartCount(false);
    splitHeadline();
    renderGallery();
    renderCart(true);
    watchReveals(document);
    setupScrollEffects();
    setupSmoothScroll();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
} else {
    start();
}
