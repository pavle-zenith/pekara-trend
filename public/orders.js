const ordersContainer = document.getElementById('orders');
const historyPopup = document.getElementById('history-popup');
const orderHistoryContainer = document.getElementById('order-history');
const viewHistoryButton = document.getElementById('view-history');
const closeButtonHistory = historyPopup.querySelector('.close-button');
const exportHistoryButton = document.getElementById('export-history');
const dailyReportButton = document.getElementById('daily-report'); // Dugme za dnevni izveštaj
const completedOrdersList = document.getElementById('completed-orders-list'); // Lista za zavrsene porudzbine
const resetReportButton = document.getElementById('reset-report'); // Dugme za resetovanje izveštaja

const socket = new WebSocket('ws://157.90.253.184:80');

document.addEventListener('DOMContentLoaded', () => {
    fetchNewOrders();
    fetchCompletedOrders(); // Učitavanje završenih porudžbina

    socket.onmessage = (event) => {
        try {
            const newOrder = JSON.parse(event.data);
            addOrderToPage(newOrder);

            const audio = document.getElementById('new-order-sound');
            // if(document.title == "Proizvodi") {
                audio.play();
            // }
          //  audio.play();
        } catch (error) {
            console.error('Error parsing WebSocket message:', error);
        }
    };

    socket.onerror = (error) => {
        console.error('WebSocket error:', error);
    };

    socket.onclose = (event) => {
        if (event.wasClean) {
            console.log(`WebSocket connection closed cleanly, code=${event.code} reason=${event.reason}`);
        } else {
            console.error('WebSocket connection died');
        }
    };

    viewHistoryButton.addEventListener('click', () => {
        historyPopup.style.display = 'flex';
        fetchOrderHistory();
    });

    closeButtonHistory.addEventListener('click', () => {
        historyPopup.style.display = 'none';
    });

    window.addEventListener('click', (event) => {
        if (event.target === historyPopup) {
            historyPopup.style.display = 'none';
        }
    });

    exportHistoryButton.addEventListener('click', () => {
        fetch('/order-history')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                exportToExcel(data);
            })
            .catch(error => {
                console.error('Error fetching order history:', error);
            });
    });

    dailyReportButton.addEventListener('click', () => {
        generateDailyReport(); // Funkcija za generisanje dnevnog izveštaja
    });

    resetReportButton.addEventListener('click', () => {
        resetDailyReport(); // Funkcija za resetovanje izveštaja
    });
});

function fetchNewOrders() {
    fetch('/new-orders')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            displayOrders(data);
        })
        .catch(error => {
            console.error('Error fetching new orders:', error);
        });
}

function displayOrders(orders) {
    ordersContainer.innerHTML = ''; 

    orders.forEach(order => {
        addOrderToPage(order);
    });
}

function addOrderToPage(order) {
    try {
        const orderDiv = document.createElement('div');
        orderDiv.className = 'order';
        const orderItemsStr = JSON.stringify(order.items);
        orderDiv.innerHTML = `
            <p>Broj Porudžbine: ${order.id}</p>
            <h2>Sadržaj:</h2>
            <ul>${formatOrderItems(order.items)}</ul>
        `;
        orderDiv.style.cursor = 'pointer'; // Da kartica bude klikabilna
        orderDiv.onclick = function() {
            completeOrder(order.id, orderItemsStr);
            orderDiv.style.backgroundColor = '#d4edda'; // Promena boje nakon obeležavanja kao spremna (opciono)
        };
        ordersContainer.appendChild(orderDiv);
    } catch (error) {
        console.error('Error adding order to page:', error);
    }
}

function completeOrder(orderId, orderItems) {
    fetch('/complete-order', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ orderId })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.text();
    })
    .then(data => {
        console.log(data);
        fetchNewOrders(); 
        socket.send(JSON.stringify({ orderId, orderItems }));
        console.log("Poslat order");
        fetchCompletedOrders(); // Osvežavanje liste završenih porudžbina
    })
    .catch(error => {
        console.error('Error completing order:', error);
        Swal.fire(
            'Greška!',
            'Došlo je do greške prilikom potvrđivanja porudžbine.',
            'error'
        );
    });
}

function fetchOrderHistory() {
    fetch('/order-history')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            displayOrderHistory(data);
        })
        .catch(error => {
            console.error('Error fetching order history:', error);
        });
}

function displayOrderHistory(orders) {
    orderHistoryContainer.innerHTML = '';

    orders.forEach(order => {
        if(order.status === 'complete') {
            order.status = 'Završeno';
        } else if (order.status === 'new') {
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

function fetchCompletedOrders() {
    fetch('/completed-orders')
        .then(response => response.json()) // Očekuje da odgovor bude JSON
        .then(data => {
            console.log('Response data:', data); // Proveri da li su podaci validni JSON
            displayCompletedOrders(data);
        })
        .catch(error => {
            console.error('Error fetching completed orders:', error);
        });
}

function displayCompletedOrders(orders) {
    completedOrdersList.innerHTML = '';

    orders.forEach(order => {
        const listItem = document.createElement('li');
        listItem.innerHTML = `
            <strong>Porudžbina #${order.id}</strong><br>
            <small>${new Date(order.order_date).toLocaleString()}</small><br>
            <ul>${formatOrderItems(order.items)}</ul>
        `;
        listItem.className = 'completed-order';
        completedOrdersList.appendChild(listItem);
    });
}

function formatOrderItems(itemsJson) {
    try {
        const items = JSON.parse(itemsJson);
        return items.map(item => `
            <li style="font-size:20px;">
                <img src="${item.image}" alt="${item.name}" style="width:75px;height:75px;vertical-align:middle;margin-right:10px;">
                <strong>${item.name}</strong> - ${item.quantity} x ${item.price.toFixed(2)}KM
            </li>
        `).join('');
    } catch (error) {
        console.error('Error formatting order items:', error);
        return '';
    }
}

function exportToExcel(orders) {
    const worksheet = XLSX.utils.json_to_sheet(orders.map(order => {
        let items = [];
        if (Array.isArray(order.items)) {
            items = order.items;
        } else {
            try {
                items = JSON.parse(order.items);
            } catch (error) {
                console.error('Error parsing order items:', error);
                items = [];
            }
        }

        const formattedItems = items.map(item => `${item.name} - ${item.quantity} x ${item.price.toFixed(2)}KM`).join(', ');

        return {
            'Broj Porudžbine': order.id,
            'Status': order.status === 'complete' ? 'Završeno' : 'Nova porudžbina',
            'Sadržaj': formattedItems,
            'Datum': new Date(order.order_date).toLocaleString()
        };
    }));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Istorija Porudžbina');

    XLSX.writeFile(workbook, 'Istorija_Porudžbina.xlsx');
}

function generateDailyReport() {
    fetch('/daily-orders')
        .then(response => response.json())
        .then(orders => {
            const reportData = {};

            orders.forEach(order => {
                const items = JSON.parse(order.items);
                items.forEach(item => {
                    if (!reportData[item.name]) {
                        reportData[item.name] = { quantity: 0, totalPrice: 0 };
                    }
                    reportData[item.name].quantity += item.quantity;
                    reportData[item.name].totalPrice += item.quantity * item.price;
                });
            });

            const report = Object.keys(reportData).map(productName => ({
                'Proizvod': productName,
                'Ukupno puta naručeno': reportData[productName].quantity,
                'Ukupna cena': reportData[productName].totalPrice.toFixed(2)
            }));

            // Snimanje izveštaja u bazu
            report.forEach(item => {
                fetch('/save-daily-report', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        product_name: item['Proizvod'],
                        quantity: item['Ukupno puta naručeno'],
                        total_price: item['Ukupna cena']
                    })
                });
            });

            const worksheet = XLSX.utils.json_to_sheet(report);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Dnevni Izveštaj');

            XLSX.writeFile(workbook, 'Dnevni_Izveštaj.xlsx');
        })
        .catch(error => {
            console.error('Error generating daily report:', error);
        });
}

function resetDailyReport() {
    fetch('/reset-daily-report', { method: 'POST' })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.text();
        })
        .then(data => {
            console.log('Daily report reset:', data);
            Swal.fire(
                'Izveštaj resetovan!',
                'Dnevni izveštaj je uspešno resetovan.',
                'success'
            );
        })
        .catch(error => {
            console.error('Error resetting daily report:', error);
            Swal.fire(
                'Greška!',
                'Došlo je do greške prilikom resetovanja izveštaja.',
                'error'
            );
        });
}