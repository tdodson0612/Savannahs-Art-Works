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

    const ready = PAYPAL_EMAIL !== "";
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
   (PayPal account or card), then comes back to cart.html?paid=1.
   PayPal also tells the database about the sale (notify_url), which is
   how a sold original disappears from the menu by itself. */

function startPayPalCheckout() {
    const cart = getCart();
    if (cart.length === 0 || !artworkReady) return;

    const pageBase = window.location.href.split("?")[0].replace(/cart\.html$/, "");

    const fields = {
        cmd: "_cart",
        upload: "1",
        business: PAYPAL_EMAIL,
        currency_code: "USD",
        charset: "utf-8",
        no_shipping: "2",
        handling_cart: shippingFor(cart).toFixed(2),
        return: pageBase + "cart.html?paid=1",
        cancel_return: pageBase + "cart.html",
        notify_url: SUPABASE_URL + "/functions/v1/paypal-ipn"
    };

    cart.forEach(function (line, index) {
        const piece = findArtwork(line.id);
        const option = findOption(piece, line.opt);
        const n = index + 1;
        fields["item_name_" + n] = lineName(piece, option);
        fields["item_number_" + n] = piece.id + "|" + option.key;
        fields["amount_" + n] = option.price.toFixed(2);
        fields["quantity_" + n] = String(line.qty);
    });

    const form = document.createElement("form");
    form.method = "POST";
    form.action = "https://www.paypal.com/cgi-bin/webscr";
    form.acceptCharset = "UTF-8";

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

    const checkoutButton = document.getElementById("checkoutButton");
    if (checkoutButton) checkoutButton.addEventListener("click", startPayPalCheckout);

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
