/* manage.js - Savannah's "Manage my art" page.
   Only her login can change anything: the database itself enforces that. */

const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const BUCKET = "artwork";
const MAX_PHOTO_SIDE = 1600;

let paintings = [];
let editing = null;      // the painting being edited, or null for a new one
let newPhoto = null;     // { blob, width, height } waiting to upload

const $ = function (id) { return document.getElementById(id); };

/* ---------- Small helpers ---------- */

function escapeHTML(value) {
    const div = document.createElement("div");
    div.textContent = String(value == null ? "" : value);
    return div.innerHTML;
}

function money(n) {
    return "$" + Number(n).toFixed(2);
}

function toast(message) {
    const t = $("toast");
    t.textContent = message;
    t.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { t.classList.remove("show"); }, 2800);
}

function showError(el, message) {
    el.textContent = message;
    el.hidden = !message;
}

function setBusy(button, busy, text) {
    if (busy) {
        button.dataset.text = button.textContent;
        button.textContent = text || "Saving…";
        button.disabled = true;
    } else {
        button.textContent = button.dataset.text || button.textContent;
        button.disabled = false;
    }
}

/* ---------- Sign in / out ---------- */

async function showRightView() {
    const { data } = await db.auth.getSession();
    const signedIn = !!data.session;
    $("loginView").hidden = signedIn;
    $("appView").hidden = !signedIn;
    if (signedIn) {
        loadPaintings();
        refreshOrderBadge();
    }
}

$("loginForm").addEventListener("submit", async function (event) {
    event.preventDefault();
    const button = $("loginButton");
    showError($("loginError"), "");
    setBusy(button, true, "Signing in…");
    const { error } = await db.auth.signInWithPassword({
        email: $("email").value.trim(),
        password: $("password").value
    });
    setBusy(button, false);
    if (error) {
        showError($("loginError"), "That email or password didn't work. Please try again.");
        return;
    }
    $("password").value = "";
    showRightView();
});

$("signOut").addEventListener("click", async function () {
    await db.auth.signOut();
    showRightView();
});

/* ---------- Tabs ---------- */

document.querySelectorAll(".tab").forEach(function (tab) {
    tab.addEventListener("click", function () {
        document.querySelectorAll(".tab").forEach(function (t) { t.classList.toggle("is-active", t === tab); });
        const which = tab.dataset.tab;
        $("paintingsView").hidden = which !== "paintings";
        $("editView").hidden = true;
        $("ordersView").hidden = which !== "orders";
        if (which === "orders") loadOrders();
        if (which === "paintings") loadPaintings();
    });
});

/* ---------- Paintings list ---------- */

async function loadPaintings() {
    $("paintingList").innerHTML = '<p class="hint">Loading…</p>';
    const { data, error } = await db
        .from("artworks")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

    if (error) {
        $("paintingList").innerHTML = '<p class="error">Couldn’t load your paintings. Check your internet and refresh.</p>';
        return;
    }
    paintings = data;
    renderList();
}

function summary(p) {
    const parts = [];
    const prints = (p.prints || []).length;
    if (prints) parts.push(prints + " print size" + (prints === 1 ? "" : "s"));
    if (p.original_available && p.original_price) parts.push("Original " + money(p.original_price));
    else parts.push("Original not for sale");
    return parts.join(" · ");
}

function renderList() {
    if (!paintings.length) {
        $("paintingList").innerHTML = '<p class="hint">No paintings yet. Tap "Add a painting" to start.</p>';
        return;
    }
    $("paintingList").innerHTML = paintings.map(function (p, i) {
        return (
            '<div class="painting-row">' +
                '<div class="thumb">' + (p.image ? '<img src="' + escapeHTML(p.image) + '" alt="">' : '') + '</div>' +
                '<div class="row-info">' +
                    '<strong>“' + escapeHTML(p.title) + '”</strong>' +
                    '<span>' + escapeHTML(summary(p)) + '</span>' +
                    (p.visible ? '' : '<span class="chip">Hidden from shop</span>') +
                '</div>' +
                '<div class="row-actions">' +
                    '<button type="button" class="icon-btn" data-move="-1" data-i="' + i + '" aria-label="Move up"' + (i === 0 ? " disabled" : "") + '>&uarr;</button>' +
                    '<button type="button" class="icon-btn" data-move="1" data-i="' + i + '" aria-label="Move down"' + (i === paintings.length - 1 ? " disabled" : "") + '>&darr;</button>' +
                    '<button type="button" class="btn btn-outline small" data-edit="' + i + '">Edit</button>' +
                '</div>' +
            '</div>'
        );
    }).join("");

    $("paintingList").querySelectorAll("[data-edit]").forEach(function (b) {
        b.addEventListener("click", function () { openEditor(paintings[Number(b.dataset.edit)]); });
    });
    $("paintingList").querySelectorAll("[data-move]").forEach(function (b) {
        b.addEventListener("click", function () { move(Number(b.dataset.i), Number(b.dataset.move)); });
    });
}

// Change the order paintings appear in on the shop.
async function move(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= paintings.length) return;
    const reordered = paintings.slice();
    const item = reordered.splice(index, 1)[0];
    reordered.splice(target, 0, item);
    paintings = reordered;
    renderList();
    const updates = reordered.map(function (p, i) {
        return db.from("artworks").update({ sort_order: (i + 1) * 10 }).eq("id", p.id);
    });
    const results = await Promise.all(updates);
    if (results.some(function (r) { return r.error; })) {
        toast("Couldn't save the new order. Please try again.");
        loadPaintings();
    }
}

/* ---------- Add / edit form ---------- */

$("addPainting").addEventListener("click", function () { openEditor(null); });
$("backToList").addEventListener("click", closeEditor);
$("cancelEdit").addEventListener("click", closeEditor);

function openEditor(painting) {
    editing = painting;
    newPhoto = null;
    $("paintingsView").hidden = true;
    $("editView").hidden = false;
    $("editHeading").textContent = painting ? "Edit “" + painting.title + "”" : "Add a painting";
    $("title").value = painting ? painting.title : "";
    $("visible").checked = painting ? painting.visible : true;
    $("originalAvailable").checked = painting ? painting.original_available : false;
    $("originalPrice").value = painting && painting.original_price ? painting.original_price : "";
    $("originalSize").value = painting && painting.original_size ? painting.original_size : "";
    $("originalFields").hidden = !$("originalAvailable").checked;
    $("deleteButton").hidden = !painting;
    resetDeleteButton();
    showError($("formError"), "");
    $("photoInput").value = "";

    setPreview(painting && painting.image ? painting.image : "");

    $("printRows").innerHTML = "";
    const prints = painting ? painting.prints || [] : [];
    if (prints.length) {
        prints.forEach(function (p) { addPrintRow(p.size, p.price); });
    } else if (!painting) {
        addPrintRow("8 x 10 in.", "");
    }
    window.scrollTo(0, 0);
}

function closeEditor() {
    $("editView").hidden = true;
    $("paintingsView").hidden = false;
    loadPaintings();
}

function setPreview(src) {
    $("photoPreview").hidden = !src;
    $("noPhoto").hidden = !!src;
    if (src) $("photoPreview").src = src;
    $("photoButtonText").textContent = src ? "Change photo" : "Choose a photo";
}

function addPrintRow(size, price) {
    const row = document.createElement("div");
    row.className = "print-row";
    row.innerHTML =
        '<div><label>Size</label><input type="text" class="print-size" placeholder="8 x 10 in." value="' + escapeHTML(size || "") + '"></div>' +
        '<div><label>Price ($)</label><input type="number" class="print-price" min="1" step="0.01" inputmode="decimal" placeholder="35" value="' + escapeHTML(price == null ? "" : price) + '"></div>' +
        '<button type="button" class="icon-btn remove-print" aria-label="Remove this print size">&times;</button>';
    row.querySelector(".remove-print").addEventListener("click", function () { row.remove(); });
    $("printRows").appendChild(row);
}

$("addPrint").addEventListener("click", function () { addPrintRow("", ""); });

$("originalAvailable").addEventListener("change", function () {
    $("originalFields").hidden = !this.checked;
});

/* Shrink the photo in the browser before uploading (faster site, less storage). */
$("photoInput").addEventListener("change", async function () {
    const file = this.files && this.files[0];
    if (!file) return;
    showError($("formError"), "");
    try {
        newPhoto = await resizePhoto(file);
        setPreview(URL.createObjectURL(newPhoto.blob));
    } catch (error) {
        newPhoto = null;
        showError($("formError"), "That photo couldn't be opened. Try a JPG or PNG, or take a screenshot of the photo and use that.");
    }
});

async function resizePhoto(file) {
    let source;
    try {
        source = await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch (error) {
        source = await new Promise(function (resolve, reject) {
            const img = new Image();
            img.onload = function () { resolve(img); };
            img.onerror = reject;
            img.src = URL.createObjectURL(file);
        });
    }
    const w = source.width;
    const h = source.height;
    const scale = Math.min(1, MAX_PHOTO_SIDE / Math.max(w, h));
    const width = Math.round(w * scale);
    const height = Math.round(h * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d").drawImage(source, 0, 0, width, height);
    const blob = await new Promise(function (resolve) { canvas.toBlob(resolve, "image/jpeg", 0.85); });
    if (!blob) throw new Error("no blob");
    return { blob: blob, width: width, height: height };
}

function slugify(text) {
    return String(text).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "painting";
}

function isUploaded(url) {
    return typeof url === "string" && url.indexOf("/storage/v1/object/public/" + BUCKET + "/") !== -1;
}

function storagePath(url) {
    return url.split("/storage/v1/object/public/" + BUCKET + "/")[1];
}

/* Save */
$("editForm").addEventListener("submit", async function (event) {
    event.preventDefault();
    showError($("formError"), "");

    const title = $("title").value.trim().replace(/^["“”]+|["“”]+$/g, "");
    if (!title) return showError($("formError"), "Please give the painting a name.");

    const prints = [];
    let printProblem = false;
    $("printRows").querySelectorAll(".print-row").forEach(function (row) {
        const size = row.querySelector(".print-size").value.trim();
        const priceText = row.querySelector(".print-price").value.trim();
        if (!size && !priceText) return; // empty row, skip it
        const price = Number(priceText);
        if (!size || !(price > 0)) printProblem = true;
        else prints.push({ size: size, price: Math.round(price * 100) / 100 });
    });
    if (printProblem) return showError($("formError"), "Each print size needs both a size and a price.");

    const originalAvailable = $("originalAvailable").checked;
    const originalPrice = Number($("originalPrice").value);
    if (originalAvailable && !(originalPrice > 0)) {
        return showError($("formError"), "Please add a price for the original, or uncheck “The original is available.”");
    }
    if (!prints.length && !originalAvailable && $("visible").checked) {
        return showError($("formError"), "Add at least one print size or the original, so people have something to buy.");
    }
    if (!newPhoto && !(editing && editing.image)) {
        return showError($("formError"), "Please add a photo of the painting.");
    }

    const button = $("saveButton");
    setBusy(button, true, newPhoto ? "Uploading photo…" : "Saving…");

    const record = {
        title: title,
        prints: prints,
        original_available: originalAvailable,
        original_price: originalAvailable ? Math.round(originalPrice * 100) / 100 : (editing ? editing.original_price : null),
        original_size: $("originalSize").value.trim() || null,
        visible: $("visible").checked,
        updated_at: new Date().toISOString()
    };

    // Upload the new photo first.
    let oldPhoto = null;
    if (newPhoto) {
        const path = Date.now() + "-" + slugify(title) + ".jpg";
        const upload = await db.storage.from(BUCKET).upload(path, newPhoto.blob, {
            contentType: "image/jpeg",
            cacheControl: "31536000"
        });
        if (upload.error) {
            setBusy(button, false);
            return showError($("formError"), "The photo didn't upload. Check your internet and try again.");
        }
        record.image = db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
        record.image_width = newPhoto.width;
        record.image_height = newPhoto.height;
        if (editing && isUploaded(editing.image)) oldPhoto = storagePath(editing.image);
    }

    let result;
    if (editing) {
        result = await db.from("artworks").update(record).eq("id", editing.id).select();
    } else {
        const last = paintings.length ? paintings[paintings.length - 1].sort_order || 0 : 0;
        record.sort_order = last + 10;
        result = await db.from("artworks").insert(record).select();
    }

    setBusy(button, false);

    if (result.error || !result.data || !result.data.length) {
        return showError($("formError"), "That didn't save. Please try again. If it keeps happening, sign out and back in.");
    }

    // Tidy up: remove the replaced photo from storage.
    if (oldPhoto) db.storage.from(BUCKET).remove([oldPhoto]);

    toast(record.visible ? "Saved! It's on your shop now." : "Saved. It's hidden from your shop.");
    closeEditor();
});

/* Delete (tap twice so it can't happen by accident) */
function resetDeleteButton() {
    const b = $("deleteButton");
    b.textContent = "Delete this painting";
    b.dataset.armed = "";
}

$("deleteButton").addEventListener("click", async function () {
    const b = this;
    if (!b.dataset.armed) {
        b.dataset.armed = "1";
        b.textContent = "Tap again to delete for good";
        setTimeout(resetDeleteButton, 4000);
        return;
    }
    setBusy(b, true, "Deleting…");
    const { error } = await db.from("artworks").delete().eq("id", editing.id);
    setBusy(b, false);
    if (error) {
        resetDeleteButton();
        return showError($("formError"), "Couldn't delete it. Please try again.");
    }
    if (isUploaded(editing.image)) db.storage.from(BUCKET).remove([storagePath(editing.image)]);
    toast("Deleted.");
    closeEditor();
});

/* ---------- Orders ---------- */

let orders = [];

function needsShipping(o) {
    return !o.shipped && o.payment_status === "Completed";
}

// The little number on the Orders tab = orders paid but not shipped yet.
function updateOrderBadge() {
    const count = orders.filter(needsShipping).length;
    const tab = document.querySelector('.tab[data-tab="orders"]');
    tab.innerHTML = "Orders" + (count ? ' <span class="badge">' + count + ' to ship</span>' : "");
}

async function refreshOrderBadge() {
    const { data } = await db.from("orders").select("id,shipped,payment_status").limit(500);
    if (data) {
        orders = data;
        updateOrderBadge();
    }
}

async function loadOrders() {
    $("orderList").innerHTML = '<p class="hint">Loading…</p>';
    const { data, error } = await db.from("orders").select("*").order("created_at", { ascending: false }).limit(200);
    if (error) {
        $("orderList").innerHTML = '<p class="error">Couldn’t load orders. Please refresh.</p>';
        return;
    }
    orders = data;
    updateOrderBadge();
    renderOrders();
}

function renderOrders() {
    if (!orders.length) {
        $("orderList").innerHTML = '<p class="hint">No orders yet.</p>';
        return;
    }

    // Orders that still need shipping go first.
    const sorted = orders.slice().sort(function (a, b) {
        const aw = needsShipping(a) ? 0 : 1;
        const bw = needsShipping(b) ? 0 : 1;
        if (aw !== bw) return aw - bw;
        return new Date(b.created_at) - new Date(a.created_at);
    });

    $("orderList").innerHTML = sorted.map(function (o) {
        const items = (o.items || []).map(function (it) {
            return '<li>' + escapeHTML(it.name) + (it.qty > 1 ? " × " + it.qty : "") + '</li>';
        }).join("");

        const warnings = [];
        if (o.payment_status && o.payment_status !== "Completed") {
            warnings.push(o.payment_status === "Refunded" || o.payment_status === "Reversed"
                ? "This order was " + o.payment_status.toLowerCase() + ". Don’t ship it."
                : "PayPal says this payment is “" + o.payment_status + "”. Wait until it shows Completed in PayPal before shipping.");
        }
        if (o.price_check && o.price_check !== "ok") {
            warnings.push("Check this one in PayPal before shipping: " + o.price_check);
        }

        const address = o.ship_address
            ? '<div class="ship-to"><span class="label">Ship to</span>' +
                  '<p>' + escapeHTML(o.ship_name || "") + '</p>' +
                  '<p>' + escapeHTML(o.ship_address).replace(/\n/g, "<br>") + '</p>' +
              '</div>'
            : '<p class="hint">No shipping address was sent. Check this order in PayPal.</p>';

        const status = o.shipped
            ? '<span class="chip shipped">Shipped' + (o.shipped_at ? " " + new Date(o.shipped_at).toLocaleDateString() : "") + '</span>'
            : (needsShipping(o) ? '<span class="chip to-ship">To ship</span>' : "");

        const button = o.payment_status === "Completed"
            ? '<button type="button" class="btn ' + (o.shipped ? "btn-outline" : "btn-primary") + ' small ship-toggle" data-id="' + o.id + '">' +
                  (o.shipped ? "Undo “shipped”" : "Mark as shipped") + '</button>'
            : "";

        return (
            '<div class="order' + (o.shipped ? " is-shipped" : "") + '">' +
                '<div class="order-top"><strong>' + money(o.gross || 0) + '</strong>' + status +
                '<span class="order-date">' + new Date(o.created_at).toLocaleString() + '</span></div>' +
                '<ul>' + items + '</ul>' +
                address +
                '<p class="buyer">' + escapeHTML(o.payer_name || "") + (o.payer_email ? ' · <a href="mailto:' + escapeHTML(o.payer_email) + '">' + escapeHTML(o.payer_email) + '</a>' : "") + '</p>' +
                warnings.map(function (w) { return '<p class="warn">' + escapeHTML(w) + '</p>'; }).join("") +
                button +
            '</div>'
        );
    }).join("");

    $("orderList").querySelectorAll(".ship-toggle").forEach(function (b) {
        b.addEventListener("click", function () { toggleShipped(Number(b.dataset.id), b); });
    });
}

async function toggleShipped(id, button) {
    const order = orders.find(function (o) { return o.id === id; });
    if (!order) return;
    const shipped = !order.shipped;
    setBusy(button, true, "Saving…");
    const { error } = await db.from("orders")
        .update({ shipped: shipped, shipped_at: shipped ? new Date().toISOString() : null })
        .eq("id", id);
    if (error) {
        setBusy(button, false);
        toast("Couldn't save that. Please try again.");
        return;
    }
    order.shipped = shipped;
    order.shipped_at = shipped ? new Date().toISOString() : null;
    toast(shipped ? "Marked as shipped." : "Moved back to “to ship.”");
    updateOrderBadge();
    renderOrders();
}

/* ---------- Start ---------- */

db.auth.onAuthStateChange(function (event) {
    if (event === "SIGNED_OUT") {
        $("loginView").hidden = false;
        $("appView").hidden = true;
    }
});

showRightView();
