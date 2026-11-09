/* script.js */

document.addEventListener("DOMContentLoaded", function () {

```
/* ==========================================
   CURRENT YEAR
   ========================================== */

const yearElements = document.querySelectorAll("#currentYear");

yearElements.forEach(function (element) {
    element.textContent = new Date().getFullYear();
});


/* ==========================================
   MOBILE MENU
   ========================================== */

const mobileMenuButton = document.getElementById("mobileMenuButton");
const mobileNavigation = document.getElementById("mobileNavigation");

if (mobileMenuButton && mobileNavigation) {

    mobileMenuButton.addEventListener("click", function () {

        mobileNavigation.classList.toggle("open");
        mobileMenuButton.classList.toggle("open");

    });

}


/* ==========================================
   SEARCH OVERLAY
   ========================================== */

const searchButton = document.getElementById("searchButton");
const searchOverlay = document.getElementById("searchOverlay");
const searchClose = document.getElementById("searchClose");
const siteSearch = document.getElementById("siteSearch");
const performSearch = document.getElementById("performSearch");

function openSearch() {

    if (!searchOverlay) {
        return;
    }

    searchOverlay.classList.add("open");

    if (siteSearch) {
        setTimeout(function () {
            siteSearch.focus();
        }, 100);
    }

}

function closeSearch() {

    if (!searchOverlay) {
        return;
    }

    searchOverlay.classList.remove("open");

}

function performSiteSearch() {

    if (!siteSearch) {
        return;
    }

    const searchTerm = siteSearch.value.trim();

    if (searchTerm === "") {
        return;
    }

    window.location.href =
        "shop.html?search=" +
        encodeURIComponent(searchTerm);

}

if (searchButton) {
    searchButton.addEventListener("click", openSearch);
}

if (searchClose) {
    searchClose.addEventListener("click", closeSearch);
}

if (searchOverlay) {

    searchOverlay.addEventListener("click", function (event) {

        if (event.target === searchOverlay) {
            closeSearch();
        }

    });

}

if (performSearch) {
    performSearch.addEventListener("click", performSiteSearch);
}

if (siteSearch) {

    siteSearch.addEventListener("keydown", function (event) {

        if (event.key === "Enter") {
            performSiteSearch();
        }

    });

}

document.addEventListener("keydown", function (event) {

    if (event.key === "Escape") {
        closeSearch();
    }

});


/* ==========================================
   CART
   ========================================== */

const CART_KEY = "savannahArtWorksCart";

function getCart() {

    try {

        const storedCart = localStorage.getItem(CART_KEY);

        if (!storedCart) {
            return [];
        }

        return JSON.parse(storedCart);

    } catch (error) {

        console.error("Could not read cart.", error);
        return [];

    }

}

function saveCart(cart) {

    localStorage.setItem(CART_KEY, JSON.stringify(cart));

    updateCartCount();

}

function updateCartCount() {

    const cart = getCart();

    let totalItems = 0;

    cart.forEach(function (item) {
        totalItems += item.quantity;
    });

    const cartCounts = document.querySelectorAll(".cart-count");

    cartCounts.forEach(function (element) {
        element.textContent = totalItems;
    });

}

function addToCart(productId, productName, productPrice) {

    const cart = getCart();

    const existingProduct = cart.find(function (item) {
        return item.id === productId;
    });

    if (existingProduct) {

        existingProduct.quantity += 1;

    } else {

        cart.push({
            id: productId,
            name: productName,
            price: Number(productPrice),
            quantity: 1
        });

    }

    saveCart(cart);

    showTemporaryMessage(
        productName + " was added to your cart."
    );

}


function removeFromCart(productId) {

    let cart = getCart();

    cart = cart.filter(function (item) {
        return item.id !== productId;
    });

    saveCart(cart);

    renderCart();

}


function changeCartQuantity(productId, amount) {

    const cart = getCart();

    const product = cart.find(function (item) {
        return item.id === productId;
    });

    if (!product) {
        return;
    }

    product.quantity += amount;

    if (product.quantity <= 0) {

        removeFromCart(productId);
        return;

    }

    saveCart(cart);

    renderCart();

}


const addToCartButtons =
    document.querySelectorAll(".add-to-cart-button");

addToCartButtons.forEach(function (button) {

    button.addEventListener("click", function () {

        const productId = button.dataset.productId;
        const productName = button.dataset.productName;
        const productPrice = button.dataset.productPrice;

        addToCart(
            productId,
            productName,
            productPrice
        );

    });

});


/* ==========================================
   RENDER CART
   ========================================== */

const cartContents = document.getElementById("cartContents");

function renderCart() {

    if (!cartContents) {
        return;
    }

    const cart = getCart();

    if (cart.length === 0) {

        cartContents.innerHTML = `
            <div class="empty-cart">
                <p class="eyebrow">YOUR CART IS EMPTY</p>

                <h2>Nothing here yet.</h2>

                <p>
                    Browse the collection and find something
                    beautiful to bring home.
                </p>

                <a href="shop.html" class="button button-dark">
                    Browse Artwork
                </a>
            </div>
        `;

        return;
    }


    let subtotal = 0;

    cart.forEach(function (item) {

        subtotal += item.price * item.quantity;

    });


    const shipping = subtotal >= 500 ? 0 : 25;
    const total = subtotal + shipping;


    let itemsHTML = "";


    cart.forEach(function (item) {

        const itemTotal = item.price * item.quantity;

        itemsHTML += `
            <div class="cart-item">

                <div class="cart-item-art">
                    <div class="placeholder-art art-mountain">
                        <span>Artwork</span>
                    </div>
                </div>

                <div class="cart-item-information">

                    <p class="product-artist">
                        Savannah
                    </p>

                    <h3>
                        ${escapeHTML(item.name)}
                    </h3>

                    <p class="cart-item-price">
                        $${item.price.toFixed(2)}
                    </p>

                    <div class="cart-item-controls">

                        <div class="quantity-controls">

                            <button
                                class="quantity-button"
                                data-cart-minus="${escapeHTML(item.id)}"
                                aria-label="Decrease quantity"
                            >
                                −
                            </button>

                            <span>
                                ${item.quantity}
                            </span>

                            <button
                                class="quantity-button"
                                data-cart-plus="${escapeHTML(item.id)}"
                                aria-label="Increase quantity"
                            >
                                +
                            </button>

                        </div>

                        <button
                            class="remove-cart-item"
                            data-cart-remove="${escapeHTML(item.id)}"
                        >
                            Remove
                        </button>

                    </div>

                </div>

                <div class="cart-item-total">
                    $${itemTotal.toFixed(2)}
                </div>

            </div>
        `;

    });


    cartContents.innerHTML = `

        <div class="cart-layout">

            <div class="cart-items">

                <div class="cart-items-heading">

                    <p class="eyebrow">
                        YOUR ARTWORK
                    </p>

                    <h2>
                        ${cart.length}
                        ${cart.length === 1 ? "item" : "items"}
                    </h2>

                </div>

                ${itemsHTML}

            </div>


            <aside class="cart-summary">

                <p class="eyebrow">
                    ORDER SUMMARY
                </p>

                <h2>
                    Your order
                </h2>

                <div class="summary-row">
                    <span>Subtotal</span>
                    <strong>
                        $${subtotal.toFixed(2)}
                    </strong>
                </div>

                <div class="summary-row">
                    <span>Shipping</span>
                    <strong>
                        ${shipping === 0 ? "FREE" : "$25.00"}
                    </strong>
                </div>

                <div class="summary-total">
                    <span>Total</span>
                    <strong>
                        $${total.toFixed(2)}
                    </strong>
                </div>

                <button
                    class="button button-dark full-width"
                    id="checkoutButton"
                >
                    Continue to Checkout
                </button>

                <a
                    href="shop.html"
                    class="continue-shopping"
                >
                    ← Continue Shopping
                </a>

            </aside>

        </div>
    `;


    const plusButtons =
        document.querySelectorAll("[data-cart-plus]");

    plusButtons.forEach(function (button) {

        button.addEventListener("click", function () {

            changeCartQuantity(
                button.dataset.cartPlus,
                1
            );

        });

    });


    const minusButtons =
        document.querySelectorAll("[data-cart-minus]");

    minusButtons.forEach(function (button) {

        button.addEventListener("click", function () {

            changeCartQuantity(
                button.dataset.cartMinus,
                -1
            );

        });

    });


    const removeButtons =
        document.querySelectorAll("[data-cart-remove]");

    removeButtons.forEach(function (button) {

        button.addEventListener("click", function () {

            removeFromCart(
                button.dataset.cartRemove
            );

        });

    });


    const checkoutButton =
        document.getElementById("checkoutButton");

    if (checkoutButton) {

        checkoutButton.addEventListener("click", function () {

            window.location.href = "checkout.html";

        });

    }

}


/* ==========================================
   SHOP FILTERING
   ========================================== */

const categoryFilter =
    document.getElementById("categoryFilter");

const shopProducts =
    document.querySelectorAll(".shop-product");

const shopResultCount =
    document.getElementById("shopResultCount");

const emptySearchState =
    document.getElementById("emptySearchState");

const clearShopFilters =
    document.getElementById("clearShopFilters");


function filterShopProducts() {

    if (!shopProducts.length) {
        return;
    }

    const selectedCategory =
        categoryFilter
            ? categoryFilter.value
            : "all";

    const urlParams =
        new URLSearchParams(window.location.search);

    const searchTerm =
        (urlParams.get("search") || "")
            .toLowerCase()
            .trim();

    let visibleCount = 0;


    shopProducts.forEach(function (product) {

        const productName =
            (product.dataset.name || "")
                .toLowerCase();

        const productCategory =
            (product.dataset.category || "")
                .toLowerCase();

        const categoryMatches =
            selectedCategory === "all" ||
            productCategory.includes(selectedCategory);

        const searchMatches =
            searchTerm === "" ||
            productName.includes(searchTerm) ||
            productCategory.includes(searchTerm);


        if (categoryMatches && searchMatches) {

            product.style.display = "";

            visibleCount += 1;

        } else {

            product.style.display = "none";

        }

    });


    if (shopResultCount) {

        if (searchTerm !== "") {

            shopResultCount.textContent =
                "Search results for “" +
                searchTerm +
                "” — " +
                visibleCount +
                " found";

        } else {

            shopResultCount.textContent =
                "Showing " +
                visibleCount +
                " artwork" +
                (visibleCount === 1 ? "" : "s");

        }

    }


    if (emptySearchState) {

        emptySearchState.hidden =
            visibleCount !== 0;

    }

}


if (categoryFilter) {

    const urlParams =
        new URLSearchParams(window.location.search);

    const category =
        urlParams.get("category");

    if (category) {

        const validCategories = [
            "paintings",
            "landscapes",
            "nature",
            "abstract"
        ];

        if (validCategories.includes(category)) {
            categoryFilter.value = category;
        }

    }


    categoryFilter.addEventListener(
        "change",
        filterShopProducts
    );

}


if (clearShopFilters) {

    clearShopFilters.addEventListener(
        "click",
        function () {

            if (categoryFilter) {
                categoryFilter.value = "all";
            }

            window.history.replaceState(
                {},
                "",
                "shop.html"
            );

            filterShopProducts();

        }
    );

}


filterShopProducts();


/* ==========================================
   FAVORITES
   ========================================== */

const FAVORITES_KEY =
    "savannahArtWorksFavorites";

function getFavorites() {

    try {

        const stored =
            localStorage.getItem(FAVORITES_KEY);

        return stored
            ? JSON.parse(stored)
            : [];

    } catch (error) {

        return [];

    }

}


function saveFavorites(favorites) {

    localStorage.setItem(
        FAVORITES_KEY,
        JSON.stringify(favorites)
    );

}


const favoriteButtons =
    document.querySelectorAll(".favorite-button");

favoriteButtons.forEach(function (button) {

    const productId =
        button.dataset.productId;

    const favorites =
        getFavorites();

    if (favorites.includes(productId)) {

        button.classList.add("favorited");
        button.textContent = "♥";

    }


    button.addEventListener("click", function (event) {

        event.preventDefault();

        const currentFavorites =
            getFavorites();

        const index =
            currentFavorites.indexOf(productId);


        if (index === -1) {

            currentFavorites.push(productId);

            button.classList.add("favorited");
            button.textContent = "♥";

        } else {

            currentFavorites.splice(index, 1);

            button.classList.remove("favorited");
            button.textContent = "♡";

        }

        saveFavorites(currentFavorites);

    });

});


/* ==========================================
   NEWSLETTER
   ========================================== */

const newsletterForm =
    document.getElementById("newsletterForm");

const newsletterMessage =
    document.getElementById("newsletterMessage");


if (newsletterForm) {

    newsletterForm.addEventListener(
        "submit",
        function (event) {

            event.preventDefault();

            if (newsletterMessage) {

                newsletterMessage.textContent =
                    "Thanks! You're on the list.";

            }

            newsletterForm.reset();

        }
    );

}


/* ==========================================
   LOGIN FORM
   ========================================== */

const loginForm =
    document.getElementById("loginForm");

const loginMessage =
    document.getElementById("loginMessage");


if (loginForm) {

    loginForm.addEventListener(
        "submit",
        function (event) {

            event.preventDefault();

            if (loginMessage) {

                loginMessage.textContent =
                    "Account login will be connected when the account system is added.";

            }

        }
    );

}


/* ==========================================
   CONTACT FORM
   ========================================== */

const contactForm =
    document.getElementById("contactForm");

const contactFormMessage =
    document.getElementById("contactFormMessage");


if (contactForm) {

    contactForm.addEventListener(
        "submit",
        function (event) {

            event.preventDefault();

            if (contactFormMessage) {

                contactFormMessage.textContent =
                    "Thank you! Your message has been received.";

            }

            contactForm.reset();

        }
    );

}


/* ==========================================
   TEMPORARY MESSAGE
   ========================================== */

function showTemporaryMessage(message) {

    const existing =
        document.querySelector(".temporary-message");

    if (existing) {
        existing.remove();
    }


    const element =
        document.createElement("div");

    element.className =
        "temporary-message";

    element.textContent =
        message;

    document.body.appendChild(element);


    setTimeout(function () {

        element.classList.add("visible");

    }, 10);


    setTimeout(function () {

        element.classList.remove("visible");

        setTimeout(function () {

            element.remove();

        }, 300);

    }, 2500);

}


/* ==========================================
   HTML ESCAPING
   ========================================== */

function escapeHTML(value) {

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


/* ==========================================
   INITIALIZE CART COUNT
   ========================================== */

updateCartCount();

renderCart();
```

});
