let products = [];
let order = [];

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

    const socket = new WebSocket('ws://3.79.246.219:3000');
    socket.onmessage = (event) => {
        const newOrder = JSON.parse(event.data);
        console.log('New order received:', newOrder);
    };
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
    productsContainer.innerHTML = ''; // Clear existing products
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

    // Send orderData to the server (using fetch, AJAX, etc.)
    fetch('/submit-order', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(orderData)
    })
    .then(response => response.text())
    .then(data => console.log(data))
    .catch(error => console.error('Error:', error));
}
