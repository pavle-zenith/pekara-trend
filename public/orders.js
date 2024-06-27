const ordersContainer = document.getElementById('orders');
const historyPopup = document.getElementById('history-popup');
const orderHistoryContainer = document.getElementById('order-history');
const viewHistoryButton = document.getElementById('view-history');
const closeButton = document.querySelector('.close-button');
const socket = new WebSocket('ws://localhost:3000');

document.addEventListener('DOMContentLoaded', () => {
    fetchNewOrders();

    socket.onmessage = (event) => {
        const newOrder = JSON.parse(event.data);
        addOrderToPage(newOrder);
    };

    viewHistoryButton.addEventListener('click', () => {
        historyPopup.style.display = 'flex';
        fetchOrderHistory();
    });

    closeButton.addEventListener('click', () => {
        historyPopup.style.display = 'none';
    });

    window.addEventListener('click', (event) => {
        if (event.target == historyPopup) {
            historyPopup.style.display = 'none';
        }
    });
});

function fetchNewOrders() {
    fetch('/new-orders')
        .then(response => response.json())
        .then(data => {
            displayOrders(data);
        })
        .catch(error => console.error('Error:', error));
}

function displayOrders(orders) {
    ordersContainer.innerHTML = ''; // Clear existing orders

    orders.forEach(order => {
        addOrderToPage(order);
    });
}

function addOrderToPage(order) {
    const orderDiv = document.createElement('div');
    orderDiv.className = 'order';
    orderDiv.innerHTML = `
        <p>Broj Porudžbine: ${order.id}</p>
        <h2>Sadržaj:</h2>
        <ul>${formatOrderItems(order.items)}</ul>
        <button style="margin-top:15px;" onclick="completeOrder(${order.id})">Porudžbina je spremna</button>
    `;
    ordersContainer.appendChild(orderDiv);
}

function completeOrder(orderId) {
    fetch('/complete-order', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ orderId })
    })
    .then(response => response.text())
    .then(data => {
        console.log(data);
        fetchNewOrders(); // Refresh the orders list
    })
    .catch(error => console.error('Error:', error));
}

function fetchOrderHistory() {
    fetch('/order-history')
        .then(response => response.json())
        .then(data => {
            displayOrderHistory(data);
        })
        .catch(error => console.error('Error:', error));
}

function displayOrderHistory(orders) {
    orderHistoryContainer.innerHTML = ''; // Clear existing order history

    orders.forEach(order => {
        if(order.status==='complete') {
            order.status = 'Završeno';
        }
        else if (order.status==='new') {
            order.status = 'Nova porudžbina';
        }
        const orderDiv = document.createElement('div');
        orderDiv.className = 'order-history-item';
        orderDiv.innerHTML = `
            <p>Broj Porudžbine: ${order.id}</p>
            <p>Status: ${order.status}</p>
            <h3>Sadržaj:</h3>
            <ul>${formatOrderItems(order.items)}</ul>
            <p>Datum: ${new Date(order.order_date).toLocaleString()}</p>
        `;
        orderHistoryContainer.appendChild(orderDiv);
    });
}

function formatOrderItems(itemsJson) {
    const items = JSON.parse(itemsJson);
    return items.map(item => `
        <li><strong>${item.name}</strong> - ${item.quantity} x ${item.price.toFixed(2)}KM</li>
    `).join('');
}
