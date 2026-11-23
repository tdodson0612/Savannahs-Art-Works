/* script.js - Savannah's Art Works shop
   Loads the paintings from the database, runs the cart and PayPal checkout,
   and the scrolling effects. Settings are in config.js.
   Savannah edits paintings at /manage.html - no code changes needed. */

const CART_KEY = "savannahCartV3";
const ART_CACHE_KEY = "savannahArtCache";
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let ARTWORK = [];        // filled from the database
let artworkReady = false;

/* ---------- Helpers ---------- */

function money(amount) {
    return "$" + Number(amount).toFixed(2);
}

function escapeHTML(value) {
    const div = document.createElement("div");
    div.textContent = String(value == null ? "" : value);
    return div.innerHTML;
}

function quoted(title) {
    return "“" + title + "”";
}

function findArtwork(id) {
    return ARTWORK.find(function (piece) {
        return piece.id === id;
    });
}

function findOption(piece, key) {
    return piece ? piece.options.find(function (o) { return o.key === key; }) : null;
}

/* What the option is called in the dropdown */
function optionMenuLabel(option) {
    if (option.kind === "original") {
        return "Original" + (option.size ? ", " + option.size : "") + " – " + money(option.price);
    }
    // "Stretched canvas, 18 x 24 in." reads fine on its own; others get "Print, ..."
    if (isCanvas(option)) return option.size + " – " + money(option.price);
    return "Print, " + option.size + " – " + money(option.price);
}

/* What it's called in the cart and on the PayPal receipt:
   "School of Rockfish" print - 8 x 10 in.   /   "School of Rockfish" original */
function lineName(piece, option) {
    if (option.kind === "original") {
        return quoted(piece.title) + " original" + (option.size ? " – " + option.size : "");
    }
    return quoted(piece.title) + " print – " + option.size;
}

/* ---------- Shipping ----------
   Once per order: $8 for prints, or $14 if there's any stretched canvas.
   Each original adds its own shipping (Savannah sets it per painting). */

function isCanvas(option) {
    return option.kind === "print" && /canvas/i.test(option.size || "");
}

function shippingFor(cart) {
    let hasPrint = false;
    let hasCanvas = false;
    let originals = 0;
    cart.forEach(function (line) {
        const option = findOption(findArtwork(line.id), line.opt);
        if (!option) return;
        if (option.kind === "original") originals += option.shipping || 0;
        else if (isCanvas(option)) hasCanvas = true;
        else hasPrint = true;
    });
    const printShipping = hasCanvas ? SHIPPING_CANVAS : (hasPrint ? SHIPPING_PRINTS : 0);
    return printShipping + originals;
}

/* ---------- Loading the paintings ---------- */

function imageURL(path) {
    if (!path) return "";
    return path;   // full links for uploaded photos, or assets/... for the originals
}

function normalize(rows) {
    return rows.map(function (row) {
        const options = (row.prints || []).map(function (p, i) {
            return { key: "p" + i, kind: "print", size: p.size, price: Number(p.price) };
        }).filter(function (o) { return o.size && o.price > 0; });

        if (row.original_available && Number(row.original_price) > 0) {
            options.push({
                key: "orig",
                kind: "original",
                size: row.original_size || "",
                price: Number(row.original_price),
                shipping: Number(row.original_shipping) || 0
            });
        }

        const img = imageURL(row.image);
        return {
            id: row.id,
            title: row.title,
            image: img,
            // the first three photos also have smaller .webp copies on the site
            webp: /^assets\/images\/.+\.jpg$/.test(img) ? img.replace(/\.jpg$/, ".webp") : "",
            width: row.image_width,
            height: row.image_height,
            options: options
        };
    }).filter(function (piece) {
        return piece.options.length > 0;
    });
}

function loadArtwork() {
    // 1. Show the last copy right away (instant page), if this visitor has one.
    try {
        const cached = JSON.parse(localStorage.getItem(ART_CACHE_KEY));
        if (Array.isArray(cached) && cached.length) {
            ARTWORK = normalize(cached);
            artworkReady = true;
            refreshPage();
        }
    } catch (error) { /* no copy yet */ }

    // 2. Get the latest from the database.
    const url = SUPABASE_URL + "/rest/v1/artworks" +
        "?select=id,title,image,image_width,image_height,prints,original_available,original_price,original_size,original_shipping" +
        "&visible=eq.true&order=sort_order.asc,created_at.asc";

    fetch(url, { headers: { apikey: SUPABASE_KEY } })
        .then(function (response) {
            if (!response.ok) throw new Error("HTTP " + response.status);
            return response.json();
        })
        .then(function (rows) {
            try { localStorage.setItem(ART_CACHE_KEY, JSON.stringify(rows)); } catch (error) { /* fine */ }
            ARTWORK = normalize(rows);
            artworkReady = true;
            refreshPage();
        })
        .catch(function () {
            if (!artworkReady) {
                const gallery = document.getElementById("gallery");
                if (gallery) gallery.innerHTML = '<p class="load-error">The artwork couldn’t load right now. Please refresh the page in a minute.</p>';
                const items = document.getElementById("cartItems");
                if (items) items.innerHTML = '<p class="empty">Your cart couldn’t load right now. Please refresh the page in a minute.</p>';
            }
        });
}

function refreshPage() {
    renderGallery();
    renderCart(true);
    updateCartCount(false);
}

/* ---------- Cart storage (saved in the visitor's browser) ----------
   Each cart line is { id, opt, qty }:
   id = which painting, opt = "p0", "p1"... for prints or "orig" for the original. */

function readCart() {
    try {
        const lines = JSON.parse(localStorage.getItem(CART_KEY)) || [];
        return Array.isArray(lines) ? lines : [];
    } catch (error) {
        return [];
    }
}

function getCart() {
    const lines = readCart();
    if (!artworkReady) return lines;
    // Drop anything that's gone, sold, or no longer offered.
    return lines.filter(function (line) {
        return line.qty > 0 && findOption(findArtwork(line.id), line.opt);
    }).map(function (line) {
        return line.opt === "orig" ? { id: line.id, opt: line.opt, qty: 1 } : line;
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
            void element.offsetWidth;
            element.classList.add("bump");
        }
    });
}

/* Returns false if it couldn't be added (an original already in the cart). */
function addToCart(id, opt) {
    const cart = getCart();
    const existing = cart.find(function (line) {
        return line.id === id && line.opt === opt;
    });
    if (existing) {
        if (opt === "orig") return false;
        existing.qty += 1;
    } else {
        cart.push({ id: id, opt: opt, qty: 1 });
    }
    saveCart(cart);
    return true;
}

function showToast(message) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(function () {
        toast.classList.remove("show");
    }, 2600);
}

/* ---------- Scroll reveals ---------- */

const revealObserver = "IntersectionObserver" in window
    ? new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            const el = entry.target;
            el.classList.add("is-visible");
            revealObserver.unobserve(el);
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

/* ---------- Photos fade in once loaded ---------- */

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

function pictureHTML(piece) {
    const size = piece.width && piece.height
        ? ' width="' + piece.width + '" height="' + piece.height + '"'
        : "";
    const webp = piece.webp
        ? '<source srcset="' + escapeHTML(piece.webp) + '" type="image/webp">'
        : "";
    return '<picture>' + webp +
        '<img class="art-img" src="' + escapeHTML(piece.image) + '" alt="' + escapeHTML(piece.title) + '"' +
        size + ' loading="lazy" decoding="async">' +
        '</picture>';
}

function renderGallery() {
    const gallery = document.getElementById("gallery");
    if (!gallery || !artworkReady) return;

    if (ARTWORK.length === 0) {
        gallery.innerHTML = '<p class="load-error">New pieces coming soon.</p>';
        return;
    }

    // Remember which size each card had picked, so a refresh doesn't reset it.
    const picked = {};
    gallery.querySelectorAll(".option-select").forEach(function (sel) {
        picked[sel.dataset.id] = sel.value;
    });
    const firstRender = !gallery.querySelector(".art-card");

    gallery.innerHTML = ARTWORK.map(function (piece, index) {
        const ratio = piece.width && piece.height ? ' style="aspect-ratio:' + piece.width + ' / ' + piece.height + '"' : "";

        const photo = piece.image
            ? '<a href="' + escapeHTML(piece.image) + '" target="_blank" rel="noopener" aria-label="View ' + escapeHTML(piece.title) + ' larger">' +
                  pictureHTML(piece) +
              '</a>'
            : '<div class="photo-placeholder">Photo coming soon</div>';

        const choices = piece.options.map(function (option) {
            const sel = picked[piece.id] === option.key ? " selected" : "";
            return '<option value="' + option.key + '"' + sel + '>' + escapeHTML(optionMenuLabel(option)) + '</option>';
        }).join("");

        const fromPrice = Math.min.apply(null, piece.options.map(function (o) { return o.price; }));
        const hasOriginal = piece.options.some(function (o) { return o.kind === "original"; });
        const selectId = "opt-" + escapeHTML(piece.id);

        return (
            '<article class="art-card reveal' + (firstRender ? "" : " is-visible") + '" style="--delay:' + ((index % 3) * 0.12) + 's">' +
                '<div class="art-photo"' + ratio + '>' + photo + '</div>' +
                '<div class="art-info">' +
                    '<h2>' + escapeHTML(quoted(piece.title)) + '</h2>' +
                    '<p class="art-price">From ' + money(fromPrice) +
                        (hasOriginal ? ' <span class="original-badge">Original available</span>' : '') + '</p>' +
                    '<label class="option-label" for="' + selectId + '">Choose an option</label>' +
                    '<select class="option-select" id="' + selectId + '" data-id="' + escapeHTML(piece.id) + '">' + choices + '</select>' +
                    '<button class="button add-button" type="button" data-id="' + escapeHTML(piece.id) + '">Add to cart</button>' +
                '</div>' +
            '</article>'
        );
    }).join("");

    gallery.querySelectorAll(".art-img").forEach(whenLoaded);
    watchReveals(gallery);

    gallery.querySelectorAll(".add-button").forEach(function (btn) {
        btn.addEventListener("click", function () {
            const id = btn.dataset.id;
            const piece = findArtwork(id);
            const opt = gallery.querySelector('.option-select[data-id="' + id + '"]').value;
            const option = findOption(piece, opt);

            if (!addToCart(id, opt)) {
                showToast("The original is one of a kind, and it’s already in your cart.");
                return;
            }
            showToast(lineName(piece, option) + " added to your cart");

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

    if (!artworkReady) {
        itemsBox.innerHTML = '<p class="empty">Loading your cart…</p>';
        summary.hidden = true;
        return;
    }

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
        const option = findOption(piece, line.opt);
        const lineTotal = option.price * line.qty;
        subtotal += lineTotal;
        const thumb = piece.image ? '<img src="' + escapeHTML(piece.image) + '" alt="" decoding="async">' : '';

        const qty = option.kind === "original"
            ? '<span class="one-of-a-kind">One of a kind</span>'
            : '<button class="qty-button" type="button" data-index="' + index + '" data-change="-1" aria-label="One less">&minus;</button>' +
              '<span class="qty-number" aria-label="Quantity">' + line.qty + '</span>' +
              '<button class="qty-button" type="button" data-index="' + index + '" data-change="1" aria-label="One more">+</button>';

        return (
            '<div class="cart-item" style="animation-delay:' + (index * 0.08) + 's">' +
                '<div class="cart-thumb">' + thumb + '</div>' +
                '<div class="cart-item-info">' +
                    '<h2>' + escapeHTML(quoted(piece.title)) + '</h2>' +
                    '<p class="art-details">' + escapeHTML(lineName(piece, option).replace(quoted(piece.title) + " ", "")) +
                        ' &middot; ' + money(option.price) + (option.kind === "original" ? "" : " each") + '</p>' +
                    '<div class="qty">' + qty +
                        '<button class="remove-button" type="button" data-index="' + index + '">Remove</button>' +
                    '</div>' +
                '</div>' +
                '<div class="cart-item-price">' + money(lineTotal) + '</div>' +
            '</div>'
        );
    }).join("");

    const shipping = shippingFor(cart);
    document.getElementById("subtotal").textContent = money(subtotal);
    document.getElementById("shipping").textContent = money(shipping);
    document.getElementById("total").textContent = money(subtotal + shipping);
    const note = document.getElementById("shippingNote");
    if (note) note.textContent = SHIPPING_NOTE;
    summary.hidden = false;

    const payButton = document.getElementById("cardPay");
    if (payButton && !payButton.disabled) payButton.textContent = "Pay " + money(subtotal + shipping);
    setupCheckout();

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

/* ---------- Checkout (stays on this page) ----------
   Two ways to pay:
   1. PayPal button: PayPal opens a small window over this page.
   2. Card: shipping form + three PayPal-hosted boxes (number, expiration, code).
   Prices are never sent from here: the paypal-checkout function looks them up
   in the database, so nobody can change them. */

const CHECKOUT_URL = SUPABASE_URL + "/functions/v1/paypal-checkout";
const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];
let checkoutStarted = false;
let cardFields = null;
let paying = false;

function showCheckoutError(message) {
    const box = document.getElementById("checkoutError");
    if (!box) return;
    box.textContent = message || "";
    box.hidden = !message;
}

function cartForServer() {
    return getCart().map(function (line) {
        return { id: line.id, opt: line.opt, qty: line.qty };
    });
}

function readShipping() {
    const v = function (id) { return document.getElementById(id).value.trim(); };
    return {
        name: v("shipName"), email: v("shipEmail"), line1: v("shipLine1"), line2: v("shipLine2"),
        city: v("shipCity"), state: v("shipState"), zip: v("shipZip")
    };
}

// Check the shipping form before asking PayPal for anything.
function shippingProblem(s) {
    if (!s.name || !s.line1 || !s.city) return "Please fill in your name and full shipping address.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email)) return "Please enter a valid email address.";
    if (!s.state) return "Please choose your state.";
    if (!/^\d{5}(-\d{4})?$/.test(s.zip)) return "Please enter a valid 5-digit ZIP code.";
    return "";
}

function callCheckout(body) {
    return fetch(CHECKOUT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY },
        body: JSON.stringify(body)
    }).then(function (res) {
        return res.json().catch(function () { return { error: "Something went wrong. You have not been charged." }; });
    });
}

function createOrder(method) {
    showCheckoutError("");
    const body = { action: "create", method: method, cart: cartForServer() };
    if (method === "card") body.shipping = readShipping();
    return callCheckout(body).then(function (data) {
        if (!data.id) {
            showCheckoutError(data.error || "Checkout couldn't start. Please try again.");
            throw new Error(data.error || "create failed");
        }
        return data.id;
    });
}

function captureOrder(orderID) {
    return callCheckout({ action: "capture", orderID: orderID }).then(function (data) {
        if (!data.ok) {
            showCheckoutError(data.error || "The payment didn't go through. You have not been charged.");
            setPaying(false);
            return;
        }
        // Paid! Empty the cart and say thank you.
        try { localStorage.setItem(CART_KEY, "[]"); } catch (error) { /* fine */ }
        updateCartCount(true);
        document.getElementById("cartItems").innerHTML = "";
        document.getElementById("cartSummary").hidden = true;
        const thanks = document.getElementById("thankYou");
        thanks.hidden = false;
        const who = document.getElementById("thankYouEmail");
        if (who) who.textContent = data.email || "";
        const wrap = document.getElementById("thankYouEmailWrap");
        if (wrap) wrap.hidden = !data.email;
        window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
        loadArtwork(); // a sold original disappears from the menu right away
    });
}

function setPaying(on) {
    paying = on;
    const button = document.getElementById("cardPay");
    if (!button) return;
    button.disabled = on;
    if (on) {
        button.textContent = "Processing…";
    } else {
        const cart = getCart();
        const total = cart.reduce(function (s, l) { return s + findOption(findArtwork(l.id), l.opt).price * l.qty; }, 0) + shippingFor(cart);
        button.textContent = "Pay " + money(total);
    }
}

function loadPayPalSdk() {
    if (window.paypal) return Promise.resolve(window.paypal);
    return new Promise(function (resolve, reject) {
        const script = document.createElement("script");
        script.src = "https://www.paypal.com/sdk/js?client-id=" + encodeURIComponent(PAYPAL_CLIENT_ID) +
            "&currency=USD&intent=capture&components=buttons,card-fields&disable-funding=paylater,venmo,card";
        script.setAttribute("data-page-type", "checkout");
        script.onload = function () { resolve(window.paypal); };
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

function setupCheckout() {
    if (checkoutStarted || !document.getElementById("payArea")) return;
    checkoutStarted = true;

    const stateSelect = document.getElementById("shipState");
    stateSelect.innerHTML = '<option value="">State</option>' + US_STATES.map(function (s) {
        return '<option value="' + s + '">' + s + '</option>';
    }).join("");

    loadPayPalSdk().then(function (paypal) {
        document.getElementById("payLoading").hidden = true;

        // 1. PayPal button
        paypal.Buttons({
            fundingSource: paypal.FUNDING.PAYPAL,
            style: { layout: "vertical", color: "gold", shape: "rect", label: "paypal", height: 48 },
            createOrder: function () { return createOrder("paypal"); },
            onApprove: function (data) { return captureOrder(data.orderID); },
            onShippingAddressChange: function (data, actions) {
                // US shipping only
                if (data.shippingAddress && data.shippingAddress.countryCode !== "US") {
                    return actions.reject(data.errors.COUNTRY_ERROR);
                }
            },
            onCancel: function () { showCheckoutError(""); },
            onError: function () {
                if (!document.getElementById("checkoutError").textContent) {
                    showCheckoutError("PayPal had a problem. You have not been charged. Please try again.");
                }
            }
        }).render("#paypalButton");

        // 2. Card boxes (hosted by PayPal inside her page)
        cardFields = paypal.CardFields({
            createOrder: function () { return createOrder("card"); },
            onApprove: function (data) { return captureOrder(data.orderID); },
            onError: function () {
                setPaying(false);
                if (!document.getElementById("checkoutError").textContent) {
                    showCheckoutError("Your card couldn't be processed. You have not been charged. Please check the details and try again.");
                }
            },
            style: {
                "input": { "font-size": "16px", "font-family": "Montserrat, Arial, sans-serif", "color": "#292721", "padding": "12px" },
                ".invalid": { "color": "#a23b2a" }
            }
        });

        if (cardFields.isEligible()) {
            cardFields.NumberField({ placeholder: "1234 1234 1234 1234" }).render("#cardNumber");
            cardFields.ExpiryField({ placeholder: "MM / YY" }).render("#cardExpiry");
            cardFields.CVVField({ placeholder: "123" }).render("#cardCvv");
            document.getElementById("payDivider").hidden = false;
            document.getElementById("cardToggle").hidden = false;
        }
    }).catch(function () {
        document.getElementById("payLoading").textContent = "Checkout couldn’t load. Please refresh the page.";
    });

    document.getElementById("cardToggle").addEventListener("click", function () {
        const form = document.getElementById("cardForm");
        form.hidden = !form.hidden;
        this.setAttribute("aria-expanded", String(!form.hidden));
        this.classList.toggle("is-open", !form.hidden);
        if (!form.hidden) document.getElementById("shipName").focus();
    });

    document.getElementById("cardForm").addEventListener("submit", function (event) {
        event.preventDefault();
        if (paying || !cardFields) return;
        showCheckoutError("");
        const problem = shippingProblem(readShipping());
        if (problem) {
            showCheckoutError(problem);
            return;
        }
        cardFields.getState().then(function (state) {
            const f = state.fields || {};
            const bad = ["cardNumberField", "cardExpiryField", "cardCvvField"].filter(function (k) {
                return f[k] && !f[k].isValid;
            });
            if (bad.length) {
                showCheckoutError("Please check your card number, expiration date and security code.");
                return;
            }
            setPaying(true);
            cardFields.submit().catch(function () {
                setPaying(false);
                if (!document.getElementById("checkoutError").textContent) {
                    showCheckoutError("Your card couldn't be processed. You have not been charged. Please try again.");
                }
            });
        });
    });
}

/* ---------- Background photo + header, driven by scroll ---------- */

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

    if (header) {
        header.addEventListener("focusin", function () {
            header.classList.remove("is-hidden");
        });
    }

    update();
}

/* ---------- Smooth, weighted scrolling (Lenis) ---------- */

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

    if (new URLSearchParams(window.location.search).get("paid") === "1") {
        try { localStorage.setItem(CART_KEY, "[]"); } catch (error) { /* fine */ }
        const thanks = document.getElementById("thankYou");
        if (thanks) thanks.hidden = false;
    }


    // Skeleton cards while the paintings load
    const gallery = document.getElementById("gallery");
    if (gallery && !gallery.children.length) {
        gallery.innerHTML = '<div class="art-card skeleton"></div><div class="art-card skeleton"></div><div class="art-card skeleton"></div>';
    }

    updateCartCount(false);
    splitHeadline();
    renderCart(true);
    watchReveals(document);
    setupScrollEffects();
    setupSmoothScroll();
    loadArtwork();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
} else {
    start();
}
