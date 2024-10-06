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

    const editPopup = document.getElementById('edit-popup');
    const closeEditPopupButton = document.querySelector('.edit-close-button');
    const editProductForm = document.getElementById('edit-product-form');

    let currentEditProductId = null; // Čuvamo ID proizvoda koji se edituje

    openPopupButton.addEventListener('click', () => {
        popup.style.display = 'flex';
    });

    closePopupButton.addEventListener('click', () => {
        popup.style.display = 'none';
    });

    closeEditPopupButton.addEventListener('click', () => {
        editPopup.style.display = 'none';
    });

    window.addEventListener('click', (event) => {
        if (event.target == popup) {
            popup.style.display = 'none';
        } else if (event.target == editPopup) {
            editPopup.style.display = 'none';
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

    // Dodaj funkcionalnost za editovanje proizvoda
    editProductForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const formData = new FormData(editProductForm);
        formData.append('product-id', currentEditProductId);

        fetch(`/edit-product/${currentEditProductId}`, {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(updatedProduct => {
            products = products.map(p => p.id === updatedProduct.id ? updatedProduct : p);
            displayProducts();
            editPopup.style.display = 'none';
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
            </div>
            <div class="btn-row" style="display:flex;"> 

                <button class="btn" style="margin-right: 5px;" onclick="openEditPopup(${product.id})">Izmeni</button>
                <button class="btn delete-product" style="background-color:black; float:right;" onclick="event.stopPropagation(); deleteProduct(${product.id})">Obriši</button>

            </div>
            
        `;
        productsContainer.appendChild(productDiv);
    } catch (error) {
        console.error('Error adding product to page:', error);
    }
}

// Funkcija za otvaranje popup-a za izmenu proizvoda
function openEditPopup(productId) {
    const product = products.find(p => p.id === productId);
    if (product) {
        currentEditProductId = product.id;
        document.getElementById('edit-product-name').value = product.name;
        document.getElementById('edit-product-price').value = product.price;
        document.getElementById('edit-popup').style.display = 'flex';
    }
}

// Funkcija za slanje izmenjenih podataka na server i ponovno učitavanje proizvoda
document.getElementById('edit-product-form').addEventListener('submit', function(event) {
    event.preventDefault();

    const formData = new FormData();
    formData.append('edit-product-name', document.getElementById('edit-product-name').value);
    formData.append('edit-product-price', document.getElementById('edit-product-price').value);
    const fileInput = document.getElementById('edit-product-image');
    
    // Proveravamo da li je korisnik dodao novu sliku
    if (fileInput.files.length > 0) {
        formData.append('edit-product-image', fileInput.files[0]);
    }

    fetch(`/edit-product/${currentEditProductId}`, {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(updatedProduct => {
        // Osvežavamo listu proizvoda
        fetchProducts(); // Učitaj proizvode ponovo nakon što je izmena uspešno izvršena
        document.getElementById('edit-popup').style.display = 'none'; // Zatvori popup
    })
    .catch(error => console.error('Error updating product:', error));
});

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

// Dodavanje proizvoda u narudžbinu
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

// Funkcija za ažuriranje narudžbine sa inputom za količinu
function updateOrderSummary() {
    try {
        const orderSummary = document.getElementById('order-summary');
        orderSummary.innerHTML = '';
        let totalPrice = 0;

        order.forEach((item, index) => {
            const listItem = document.createElement('li');
            listItem.innerHTML = `
                <img src="${item.image}" alt="${item.name}" style="width:50px;height:50px;vertical-align:middle;margin-right:10px;">
                ${item.name} - <input type="number" min="1" value="${item.quantity}" onchange="updateQuantity(${index}, this.value)"> x ${item.price.toFixed(2)}KM
                <button onclick="removeFromOrder(${index})" class="btn red" style="margin-top: 20px; padding: 10px 30px;">Obriši</button>
            `;
            orderSummary.appendChild(listItem);
            totalPrice += item.price * item.quantity;
        });

        document.getElementById('total-price').textContent = totalPrice.toFixed(2);
    } catch (error) {
        console.error('Error updating order summary:', error);
    }
}

// Funkcija za ažuriranje količine proizvoda u narudžbini
function updateQuantity(index, newQuantity) {
    order[index].quantity = parseInt(newQuantity);
    updateOrderSummary();
}

// Funkcija za brisanje proizvoda iz narudžbine
function removeFromOrder(index) {
    order.splice(index, 1);
    updateOrderSummary();
}

function deleteOrder() {
    try {
        order = [];
        updateOrderSummary();
    } catch (error) {
        console.error('Error deleting order:', error);
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

function sendOrder() {
    try {
        const orderData = {
            items: JSON.stringify(order)
        };
        console.log('Sending order:', orderData);
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
        
    } catch (error) {
        console.error('Error preparing order data:', error);
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
