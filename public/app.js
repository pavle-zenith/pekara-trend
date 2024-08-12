let products = [];
let order = [];

const notificationCounter = document.getElementById('notification-counter');
const notificationsList = document.getElementById('notifications-list');
const viewNotificationsButton = document.getElementById('view-notifications');
const notificationsPopup = document.getElementById('notifications-popup');
const closeButtonNotifications = notificationsPopup.querySelector('.close-button');

let notificationCount = 0;
const notifications = [];

document.addEventListener('DOMContentLoaded', () => {
    fetchProducts();

    const popup = document.getElementById('popup');
    const openPopupButton = document.getElementById('open-popup');
    const closePopupButton = document.querySelector('.close-button');
    const productForm = document.getElementById('product-form');

    openPopupButton.addEventListener('click', () => {
        popup.style.display = 'flex';
    });

    closePopupButton.addEventListener('click', () => {
        popup.style.display = 'none';
    });

    window.addEventListener('click', (event) => {
        if (event.target == popup) {
            popup.style.display = 'none';
        }
    });

    productForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const formData = new FormData(productForm);
        fetch('/add-product', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            const newProduct = {
                id: data.id,
                name: data.name,
                image: data.image,
                price: parseFloat(data.price)
            };
            products.push(newProduct);
            addProductToPage(newProduct);
            productForm.reset();
            popup.style.display = 'none';
        })
        .catch(error => console.error('Error:', error));
    });

    const socket = new WebSocket('ws://157.90.253.184:80');

    socket.addEventListener('message', (event) => {
        try {
            const newOrder = JSON.parse(event.data);
            console.log('New order received:', newOrder);
            if(newOrder.notification){
                addNotification(newOrder.id, newOrder.items);
            }
        } catch (error) {
            console.error('Error processing WebSocket message:', error);
        }
    });

    socket.addEventListener('error', (error) => {
        console.error('WebSocket error:', error);
    });

    socket.addEventListener('close', (event) => {
        if (event.wasClean) {
            console.log(`WebSocket connection closed cleanly, code=${event.code}, reason=${event.reason}`);
        } else {
            console.error('WebSocket connection died');
        }
    });

    viewNotificationsButton.addEventListener('click', () => {
        notificationsPopup.style.display = 'flex';
        notificationCount = 0;
        updateNotificationCounter();
    });

    closeButtonNotifications.addEventListener('click', () => {
        notificationsPopup.style.display = 'none';
        notificationsList.innerHTML = ''; 
    });

    window.addEventListener('click', (event) => {
        if (event.target === notificationsPopup) {
            notificationsPopup.style.display = 'none';
            notificationsList.innerHTML = ''; 
        }
    });
});

function fetchProducts() {
    fetch('/products')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            products = data.map(product => {
                product.price = parseFloat(product.price);
                return product;
            });
            displayProducts();
        })
        .catch(error => console.error('Error fetching products:', error));
}

function displayProducts() {
    const productsContainer = document.getElementById('products');
    productsContainer.innerHTML = ''; 
    products.forEach(product => {
        addProductToPage(product);
    });
}

function addProductToPage(product) {
    try {
        const productsContainer = document.getElementById('products');
        const productDiv = document.createElement('div');
        productDiv.className = 'product';
        productDiv.innerHTML = `
            <div class="card" onclick="addToOrder(${product.id})">
                <img src="${product.image}" alt="${product.name}">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <h3>${product.name}</h3>
                    <p>${product.price.toFixed(2)}KM</p>
                </div>
                <button class="btn delete-product" style="width:150px; float:right;" onclick="event.stopPropagation(); deleteProduct(${product.id})">Obriši</button>
            </div>
        `;
        productsContainer.appendChild(productDiv);
    } catch (error) {
        console.error('Error adding product to page:', error);
    }
}

function deleteProduct(productId) {
    event.stopPropagation();
    Swal.fire({
        title: 'Da li ste sigurni?',
        text: "Ova akcija će obrisati proizvod. Da li želite da nastavite?",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Da, obriši!',
        cancelButtonText: 'Ne, otkaži'
    }).then((result) => {
        if (result.isConfirmed) {
            try {
                fetch(`/delete-product/${productId}`, {
                    method: 'DELETE'
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.text();
                })
                .then(data => {
                    console.log(data);
                    products = products.filter(product => product.id !== productId);
                    displayProducts();
                    Swal.fire({
                        title: 'Proizvod obrisan!',
                        icon: 'success',
                        confirmButtonText: 'U redu'
                    });
                })
                .catch(error => {
                    console.error('Error deleting product:', error);
                    Swal.fire(
                        'Greška!',
                        'Došlo je do greške prilikom brisanja proizvoda.',
                        'error'
                    );
                });
            } catch (error) {
                console.error('Error deleting product:', error);
            }
        }
    });
}

function addToOrder(productId) {
    try {
        const product = products.find(p => p.id === productId);
        const existingProduct = order.find(item => item.product_id === productId);
        if (existingProduct) {
            existingProduct.quantity += 1;
        } else {
            order.push({ product_id: productId, name: product.name, price: product.price, quantity: 1, image: product.image });
        }
        updateOrderSummary();
    } catch (error) {
        console.error('Error adding product to order:', error);
    }
}

function updateOrderSummary() {
    try {
        const orderSummary = document.getElementById('order-summary');
        orderSummary.innerHTML = '';
        let totalPrice = 0;

        order.forEach(item => {
            const listItem = document.createElement('li');
            listItem.innerHTML = `<img src="${item.image}" alt="${item.name}" style="width:50px;height:50px;vertical-align:middle;margin-right:10px;">${item.name} - ${item.price.toFixed(2)}KM x ${item.quantity}`;
            orderSummary.appendChild(listItem);
            totalPrice += item.price * item.quantity;
        });

        document.getElementById('total-price').textContent = totalPrice.toFixed(2);
    } catch (error) {
        console.error('Error updating order summary:', error);
    }
}

function deleteOrder() {
    try {
        order = [];
        updateOrderSummary();
    } catch (error) {
        console.error('Error deleting order:', error);
    }
}

function sendOrder() {
    try {
        const orderData = {
            items: JSON.stringify(order)
        };
        console.log('Sending order:', orderData);

        Swal.fire({
            title: 'Da li ste sigurni?',
            text: "Da li želite da pošaljete porudžbinu?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Da, pošalji!',
            cancelButtonText: 'Ne, otkaži'
        }).then((result) => {
            if (result.isConfirmed) {
                fetch('/submit-order', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(orderData)
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.text();
                })
                .then(data => {
                    console.log(data);
                    Swal.fire(
                        'Porudžbina poslata!',
                        'Vaša porudžbina je uspešno poslata.',
                        'success'
                    );
                    deleteOrder();
                })
                .catch(error => {
                    console.error('Error sending order:', error);
                    Swal.fire(
                        'Greška!',
                        'Došlo je do greške prilikom slanja porudžbine.',
                        'error'
                    );
                });
            }
        });
    } catch (error) {
        console.error('Error preparing order data:', error);
    }
}

function addNotification(orderId, orderItems) {
    try {
        notificationCount++;
        updateNotificationCounter();

        const notification = {
            id: orderId,
            items: JSON.parse(orderItems)
        };
        notifications.push(notification);
        displayNotification(notification);
    } catch (error) {
        console.error('Error adding notification:', error);
    }
}

function updateNotificationCounter() {
    try {
        notificationCounter.textContent = notificationCount;
    } catch (error) {
        console.error('Error updating notification counter:', error);
    }
}

function displayNotification(notification) {
    try {
        const notificationItem = document.createElement('div');
        notificationItem.className = 'notification-item';
        notificationItem.innerHTML = `
            <p>Porudžbina ${notification.id} je spremna</p>
            <ul>${formatOrderItems(JSON.stringify(notification.items))}</ul>
        `;
        notificationsList.appendChild(notificationItem);
    } catch (error) {
        console.error('Error displaying notification:', error);
    }
}

function formatOrderItems(itemsJson) {
    try {
        const items = JSON.parse(itemsJson);
        return items.map(item => `
            <li>
                <img src="${item.image}" alt="${item.name}" style="width:50px;height:50px;vertical-align:middle;margin-right:10px;">
                <strong>${item.name}</strong> - ${item.quantity} x ${item.price.toFixed(2)}KM
            </li>
        `).join('');
    } catch (error) {
        console.error('Error formatting order items:', error);
        return '';
    }
}