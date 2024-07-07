

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
        .then(response => response.json())
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

    const socket = new WebSocket('ws://18.195.213.62:80');

    socket.addEventListener("message", (event) => {
        const newOrder = JSON.parse(event.data);
        console.log('New order received:', newOrder);
        if(newOrder.notification){
            addNotification(newOrder.id, newOrder.items);
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
        .then(response => response.json())
        .then(data => {
            products = data.map(product => {
                product.price = parseFloat(product.price);
                return product;
            });
            displayProducts();
        })
        .catch(error => console.error('Error:', error));
}

function displayProducts() {
    const productsContainer = document.getElementById('products');
    productsContainer.innerHTML = ''; 
    products.forEach(product => {
        addProductToPage(product);
    });
}

function addProductToPage(product) {
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
        
        </div>
    `;
    productsContainer.appendChild(productDiv);
}

function addToOrder(productId) {
    const product = products.find(p => p.id === productId);
    const existingProduct = order.find(item => item.product_id === productId);
    if (existingProduct) {
        existingProduct.quantity += 1;
    } else {
        order.push({ product_id: productId, name: product.name, price: product.price, quantity: 1 });
    }
    updateOrderSummary();
}

function updateOrderSummary() {
    const orderSummary = document.getElementById('order-summary');
    orderSummary.innerHTML = '';
    let totalPrice = 0;

    order.forEach(item => {
        const listItem = document.createElement('li');
        listItem.textContent = `${item.name} - ${item.price.toFixed(2)}KM x ${item.quantity}`;
        orderSummary.appendChild(listItem);
        totalPrice += item.price * item.quantity;
    });

    document.getElementById('total-price').textContent = totalPrice.toFixed(2);
}

function deleteOrder() {
    order = [];
    updateOrderSummary();
}

function sendOrder() {
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
            .then(response => response.text())
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
                console.error('Error:', error);
                Swal.fire(
                    'Greška!',
                    'Došlo je do greške prilikom slanja porudžbine.',
                    'error'
                );
            });
        }
    });
}

function addNotification(orderId, orderItems) {
    notificationCount++;
    updateNotificationCounter();

    const notification = {
        id: orderId,
        items: JSON.parse(orderItems)
    };
    notifications.push(notification);
    displayNotification(notification);
}

function updateNotificationCounter() {
    notificationCounter.textContent = notificationCount;
}

function displayNotification(notification) {
    const notificationItem = document.createElement('div');
    notificationItem.className = 'notification-item';
    notificationItem.innerHTML = `
        <p>Porudžbina ${notification.id} je spremna</p>
        <ul>${formatOrderItems(JSON.stringify(notification.items))}</ul>
    `;
    notificationsList.appendChild(notificationItem);
}

function formatOrderItems(itemsJson) {
    const items = JSON.parse(itemsJson);
    return items.map(item => `
        <li><strong>${item.name}</strong> - ${item.quantity} x ${item.price.toFixed(2)}KM</li>
    `).join('');
}
