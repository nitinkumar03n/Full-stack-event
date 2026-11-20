const API_BASE = window.RC_API_BASE ||
    ((location.hostname === 'localhost' || location.hostname === '127.0.0.1')
        ? 'http://127.0.0.1:5001'
        : '');

   document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    const searchHint = document.getElementById('searchHint');

    if (searchInput && searchHint) {
        searchInput.addEventListener('input', () => {
            if (searchInput.value.trim().length > 0) {
                searchHint.style.visibility = 'hidden';
            } else {
                searchHint.style.visibility = 'visible';
            }
        });
    }
});
 document.addEventListener('DOMContentLoaded', () => {
    const countElement = document.getElementById('wishlistCount');
    const wishlistBtn = document.getElementById('wishlistBtn');
    const wishlistModal = document.getElementById('wishlistModal');
    const closeWishlistModal = document.getElementById('closeWishlistModal');
    const wishlistList = document.getElementById('wishlistList');

    function getWishlist() {
        return JSON.parse(localStorage.getItem('rc_wishlist') || '[]');
    }

    function saveWishlist(list) {
        localStorage.setItem('rc_wishlist', JSON.stringify(list));
        countElement.innerText = `(${list.length})`;
    }

    function renderWishlist() {
        const list = getWishlist();
        if (list.length === 0) {
            wishlistList.innerHTML = '<p class="wishlist-empty">Your wishlist is empty.</p>';
            return;
        }
        wishlistList.innerHTML = list.map((item, index) => `
            <div class="wishlist-item">
                <img src="${item.img}" alt="${item.title}">
                <div class="wishlist-item-info">
                    <h4>${item.title}</h4>
                    <p>${item.price}</p>
                </div>
                <button type="button" class="wishlist-remove-btn" data-index="${index}">Remove</button>
            </div>
        `).join('');
    }

    function syncHeartIcons() {
        const list = getWishlist();
        document.querySelectorAll('.item-card').forEach(card => {
            const btn = card.querySelector('.wishlist-toggle');
            const isSaved = list.some(item => item.title === card.dataset.title);
            btn.classList.toggle('active', isSaved);
            btn.innerText = isSaved ? '♥' : '♡';
        });
    }

    document.getElementById('itemsGrid').addEventListener('click', (event) => {
        const btn = event.target.closest('.wishlist-toggle');
        if (!btn) return;
        const card = btn.closest('.item-card');
        const list = getWishlist();
        const index = list.findIndex(item => item.title === card.dataset.title);
        if (index >= 0) {
            list.splice(index, 1);
            btn.classList.remove('active');
            btn.textContent = '♡';
        } else {
            list.push({ title: card.dataset.title, price: card.dataset.price, img: card.dataset.img });
            btn.classList.add('active');
            btn.textContent = '♥';
        }
        saveWishlist(list);
    });

    wishlistList.addEventListener('click', (e) => {
        if (e.target.classList.contains('wishlist-remove-btn')) {
            const index = Number(e.target.dataset.index);
            let list = getWishlist();
            list.splice(index, 1);
            saveWishlist(list);
            renderWishlist();
            syncHeartIcons();
        }
    });

    wishlistBtn.addEventListener('click', () => {
        renderWishlist();
        wishlistModal.classList.add('active');
    });
    closeWishlistModal.addEventListener('click', () => wishlistModal.classList.remove('active'));

    saveWishlist(getWishlist());
    syncHeartIcons();
});
document.addEventListener('DOMContentLoaded', () => {
    const categoryBtns = document.querySelectorAll('.category-btn');

    categoryBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Active button class update
            categoryBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Get selected category name (cars, bikes, cycles)
            const category = btn.textContent.trim().toLowerCase();

            // Filter logic
            document.querySelectorAll('.item-card').forEach(card => {
                if (category.includes('cars') && card.classList.contains('car')) {
                    card.style.display = 'block';
                } else if (category.includes('bikes') && card.classList.contains('bike')) {
                    card.style.display = 'block';
                } else if (category.includes('cycles') && card.classList.contains('cycle')) {
                    card.style.display = 'block';
                } else {
                    card.style.display = 'none'; // Baki items hide ho jayenge
                }
            });
        });
    });
});document.addEventListener('DOMContentLoaded', () => {
    // Modal Open/Close Controls
    const userBtn = document.getElementById('userBtn');
    const authModal = document.getElementById('authModal');
    const closeAuthModal = document.getElementById('closeAuthModal');
    const savedUser = JSON.parse(localStorage.getItem('rc_user') || 'null');
    if (localStorage.getItem('rc_token') && savedUser?.name && userBtn) {
        userBtn.innerText = `👤 ${savedUser.name.split(' ')[0]}`;
    }

    if (userBtn && authModal) {
     userBtn.addEventListener('click', () => {
    if (localStorage.getItem('rc_token')) {
        const confirmLogout = confirm('Kya aap logout karna chahte hain?');

        if (confirmLogout) {
            localStorage.removeItem('rc_token');
            localStorage.removeItem('rc_user');
            userBtn.innerText = 'Login';
            loadVehicles().catch(console.error);
            alert('Aap logout ho gaye hain.');
        }
    } else {
        authModal.classList.add('active');
    }
});
        closeAuthModal.addEventListener('click', () => authModal.classList.remove('active'));
    }

    // Login / Register Tabs Switching Logic
    const loginTabBtn = document.getElementById('loginTabBtn');
    const signupTabBtn = document.getElementById('signupTabBtn');
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');

    loginTabBtn.addEventListener('click', () => {
        loginTabBtn.classList.add('active');
        signupTabBtn.classList.remove('active');
        loginForm.classList.add('active');
        signupForm.classList.remove('active');
    });

    signupTabBtn.addEventListener('click', () => {
        signupTabBtn.classList.add('active');
        loginTabBtn.classList.remove('active');
        signupForm.classList.add('active');
        loginForm.classList.remove('active');
    });
});document.addEventListener('DOMContentLoaded', () => {
        const API = `${API_BASE}/api/auth`;
        document.getElementById('sendSignupOtp').addEventListener('click', async () => { 
        
        
            
            const phone = document.getElementById('signupPhone').value.trim();

        if (!/^[6-9]\d{9}$/.test(phone)) {
            alert('Valid 10-digit mobile number daalo.');
            return;
        
        }
        try {
            const response = await fetch(`${API}/send-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, purpose: 'register' })
            });
            const data = await response.json();

            if (!data.success) {
                alert(data.message);
                return;
            }
if (data.devOtp) {
    document.getElementById('signupOtp').value = data.devOtp;
}
            document.getElementById('signupOtpGroup').classList.remove('hidden');
            alert('OTP request ho gayi. Development mode mein OTP backend terminal par milega.');
        } catch (error) {
            console.error(error);
            alert('Backend se connect nahi ho pa raha.');
        }
    });

    document.getElementById('signupForm').addEventListener('submit', async (event) => {
        event.preventDefault();

        const body = {
            name: document.getElementById('signupName').value.trim(),
            email: document.getElementById('signupEmail').value.trim(),
            phone: document.getElementById('signupPhone').value.trim(),
            password: document.getElementById('signupPassword').value,
            role: document.getElementById('userRole').value,
            otp: document.getElementById('signupOtp').value.trim()
        };

        try {
            const response = await fetch(`${API}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await response.json();

            if (!data.success) {
                alert(data.message);
                return;
            }

            alert('Registration successful!');
            localStorage.setItem('rc_token', data.token);
            localStorage.setItem('rc_user', JSON.stringify(data.user));
            document.getElementById('authModal').classList.remove('active');
            loadVehicles().catch(console.error);
        } catch (error) {
            console.error(error);
            alert('Registration ke waqt backend se connect nahi ho pa raha.');
        }
    });
        // ---------- LOGIN (password + OTP) ----------
    const loginPasswordGroup = document.getElementById('loginPasswordGroup');
    const loginOtpGroup = document.getElementById('loginOtpGroup');
    const sendLoginOtpBtn = document.getElementById('sendLoginOtp');
    const toggleLoginMode = document.getElementById('toggleLoginMode');
    let otpMode = false;

    function saveSession(data) {
    localStorage.setItem('rc_token', data.token);
    localStorage.setItem('rc_user', JSON.stringify(data.user));

    const userBtn = document.getElementById('userBtn');
    if (userBtn && data.user?.name) {
        userBtn.innerText = `👤 ${data.user.name.split(' ')[0]}`;
    }

    document.getElementById('authModal').classList.remove('active');
    loadVehicles().catch(console.error);
}

    toggleLoginMode.addEventListener('click', () => {
        otpMode = !otpMode;
        loginPasswordGroup.classList.toggle('hidden', otpMode);
        loginOtpGroup.classList.toggle('hidden', !otpMode);
        sendLoginOtpBtn.classList.toggle('hidden', !otpMode);
        toggleLoginMode.innerText = otpMode ? 'Login with password instead' : 'Login with OTP instead';
        document.getElementById('loginIdLabel').innerText = otpMode ? 'Phone Number' : 'Email / Phone';
    });

    sendLoginOtpBtn.addEventListener('click', async () => {
        const phone = document.getElementById('loginEmail').value.trim();
        if (!/^[6-9]\d{9}$/.test(phone)) {
            alert('Valid 10-digit mobile number daalo.');
            return;
        }
        try {
            const response = await fetch(`${API}/send-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, purpose: 'login' })
            });
            const data = await response.json();
            alert(data.success ? 'OTP bhej diya gaya. (Dev mein backend terminal dekho)' : data.message);
        } catch (error) {
            console.error(error);
            alert('Backend se connect nahi ho pa raha.');
        }
    });

    document.getElementById('loginForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        const idValue = document.getElementById('loginEmail').value.trim();
        try {
            let response;
            if (otpMode) {
                response = await fetch(`${API}/login-otp`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        phone: idValue,
                        otp: document.getElementById('loginOtp').value.trim()
                    })
                });
            } else {
                response = await fetch(`${API}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        emailOrPhone: idValue,
                        password: document.getElementById('loginPassword').value
                    })
                });
            }
            const data = await response.json();
            if (!data.success) {
                alert(data.message);
                return;
            }
            alert('Login successful!');
            saveSession(data);
        } catch (error) {
            console.error(error);
            alert('Backend se connect nahi ho pa raha.');
        }
    });
});
    // Rent Modal Open/Close Controls
    const rentPostBtn = document.getElementById('rentPostBtn');
    const rentItemModal = document.getElementById('rentItemModal');
    const closeRentModal = document.getElementById('closeRentModal');

    if (rentPostBtn && rentItemModal) {
        rentPostBtn.addEventListener('click', () => rentItemModal.classList.add('active'));
        closeRentModal.addEventListener('click', () => rentItemModal.classList.remove('active'));
    }

    // Dynamic Brand & Model Data
    const carData = {
        "Hyundai": ["Creta", "i20", "Verna", "Venue"],
        "Maruti Suzuki": ["Swift", "Baleno", "Brezza", "Thar"],
        "Tata": ["Nexon", "Harrier", "Punch", "Altroz"],
        "Mahindra": ["Thar", "XUV700", "Scorpio-N"]
    };

    const bikeData = {
        "Royal Enfield": ["Classic 350", "Bullet 350", "Himalayan", "Meteor"],
        "Honda": ["Shine", "Unicorn", "Activa 6G", "CB350"],
        "Yamaha": ["R15 V4", "MT-15", "FZ-S"],
        "Hero": ["Splendor Plus", "Xpulse 200", "HF Deluxe"]
    };

    const vehicleCategory = document.getElementById('vehicleCategory');
    const motorizedFields = document.getElementById('motorizedFields');
    const cycleFields = document.getElementById('cycleFields');
    const brandSelect = document.getElementById('brandSelect');
    const modelSelect = document.getElementById('modelSelect');
    const mileageSelect = document.getElementById('mileageRange');

    function updateMileageOptions(category) {
        const ranges = category === 'bike'
            ? ['10-20', '20-25', '25-35', '35-45', '45-55', '55-65', '65-80']
            : category === 'car'
                ? ['10-20', '20-25', '25-35', '35-45', '45-50']
                : [];
        mileageSelect.replaceChildren(new Option(ranges.length ? 'Select Mileage' : 'Mileage not applicable', ''));
        ranges.forEach(range => mileageSelect.add(new Option(`${range} km/l`, range)));
    }

    // Category Selection Change Listener
    vehicleCategory.addEventListener('change', (e) => {
        const selected = e.target.value;
        updateMileageOptions(selected);
        brandSelect.innerHTML = '<option value="">Select Brand</option>';
        modelSelect.innerHTML = '<option value="">Select Model</option>';

        if (selected === 'car' || selected === 'bike') {
            motorizedFields.classList.remove('hidden');
            cycleFields.classList.add('hidden');

            const dataSource = selected === 'car' ? carData : bikeData;
            Object.keys(dataSource).forEach(brand => {
                const opt = document.createElement('option');
                opt.value = brand;
                opt.textContent = brand;
                brandSelect.appendChild(opt);
            });
        } else if (selected === 'cycle') {
            cycleFields.classList.remove('hidden');
            motorizedFields.classList.add('hidden');
        } else {
            motorizedFields.classList.add('hidden');
            cycleFields.classList.add('hidden');
        }
    });

    // Brand Selection Change Listener (Updates Models)
    brandSelect.addEventListener('change', (e) => {
        const brand = e.target.value;
        const category = vehicleCategory.value;
        const dataSource = category === 'car' ? carData : bikeData;
        
        modelSelect.innerHTML = '<option value="">Select Model</option>';
        if (brand && dataSource[brand]) {
            dataSource[brand].forEach(model => {
                const opt = document.createElement('option');
                opt.value = model;
                opt.textContent = model;
                modelSelect.appendChild(opt);
            });
        }
    });

async function loadVehicles() {
    const grid = document.getElementById('itemsGrid');
    const token = localStorage.getItem('rc_token');
    const response = await fetch(`${API_BASE}/api/vehicles`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.message || 'Vehicle list load failed');

    grid.replaceChildren();
    for (const vehicle of data.vehicles) {
        const card = document.createElement('div');
        card.className = `item-card ${vehicle.category}`;
        Object.assign(card.dataset, {
            id: vehicle.id,
            title: vehicle.title,
            price: `₹${vehicle.price} / month`,
            img: vehicle.img,
            ownerPhone: vehicle.ownerPhone || '',
            ownerLocation: vehicle.ownerLocation || '',
            ownerName: vehicle.ownerName || 'Vehicle owner',
            mileage: vehicle.mileage || 'Not provided',
            service: vehicle.service || 'Not provided'
        });

        const heart = document.createElement('button');
        heart.type = 'button';
        heart.className = 'wishlist-toggle';
        heart.textContent = '♡';
        const image = document.createElement('img');
        image.src = vehicle.img;
        image.alt = vehicle.title;
        const info = document.createElement('div');
        info.className = 'card-info';
        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.textContent = vehicle.category;
        const title = document.createElement('h3');
        title.textContent = vehicle.title;
        const price = document.createElement('p');
        price.className = 'price';
        price.textContent = `₹${vehicle.price} / month`;
        const publicInfo = document.createElement('p');
        publicInfo.className = 'public-card-details';
        publicInfo.textContent = `Owner: ${vehicle.ownerName || 'Vehicle owner'} · Mileage: ${vehicle.mileage || 'Not provided'} · Service: ${vehicle.service || 'Not provided'}`;
        const details = document.createElement('button');
        details.type = 'button';
        details.className = 'view-details-btn';
        details.textContent = 'Contact Owner';
        info.append(badge, title, price, publicInfo, details);
        card.append(heart, image, info);
        grid.append(card);
    }
    if (!data.vehicles.length) grid.textContent = 'Abhi koi available vehicle listed nahi hai.';
    document.getElementById('userCity')?.dispatchEvent(new Event('change'));
    document.querySelectorAll('.wishlist-toggle').forEach(btn => {
        const saved = JSON.parse(localStorage.getItem('rc_wishlist') || '[]');
        if (saved.some(item => item.title === btn.closest('.item-card').dataset.title)) {
            btn.classList.add('active');
            btn.textContent = '♥';
        }
    });
    await checkOwnerAvailability();
}

async function checkOwnerAvailability() {
    const token = localStorage.getItem('rc_token');
    const user = JSON.parse(localStorage.getItem('rc_user') || 'null');
    if (!token || user?.role !== 'owner') return;
    const response = await fetch(`${API_BASE}/api/owner/availability-checks`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json();
    for (const vehicle of data.vehicles || []) {
        const rented = confirm(`Kya "${vehicle.title}" rent par de diya hai? OK = Yes, Cancel = No`);
        await fetch(`${API_BASE}/api/owner/availability-checks/${vehicle.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ rented })
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const rentVehicleForm = document.getElementById('rentVehicleForm');
    const rentItemModal = document.getElementById('rentItemModal');
    const vehicleCategory = document.getElementById('vehicleCategory');
    const brandSelect = document.getElementById('brandSelect');
    const modelSelect = document.getElementById('modelSelect');
    const rentPrice = document.getElementById('rentPrice');
    const vehicleImage = document.getElementById('vehicleImage');

    rentVehicleForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const token = localStorage.getItem('rc_token');
        if (!token) return alert('Vehicle list karne ke liye pehle owner account se login karo.');

        const formData = new FormData();
        formData.append('category', vehicleCategory.value);
        formData.append('brand', brandSelect.value);
        formData.append('model', modelSelect.value);
        formData.append('cycleBrand', document.getElementById('cycleBrand').value);
        formData.append('cycleModel', document.getElementById('cycleModel').value);
        formData.append('mileage', document.getElementById('mileageRange').value);
        formData.append('service', document.getElementById('serviceHistory').value);
        formData.append('price', rentPrice.value);
        formData.append('city', document.getElementById('ownerCity').value);
        formData.append('phone', document.getElementById('ownerPhone').value);
        if (vehicleImage.files[0]) formData.append('vehicleImage', vehicleImage.files[0]);

        try {
            const response = await fetch(`${API_BASE}/api/vehicles`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData
            });
            const data = await response.json();
            if (!response.ok || !data.success) return alert(data.message || 'Vehicle save nahi hua.');
            rentVehicleForm.reset();
            rentItemModal.classList.remove('active');
            await loadVehicles();
            alert('Vehicle database mein list ho gaya.');
        } catch (error) {
            console.error('Listing error:', error);
            alert('Listing save nahi hui. Backend terminal ka error dekho.');
        }
    });
});

document.addEventListener('DOMContentLoaded', () => {
    const userCitySelect = document.getElementById('userCity');
    const itemsGrid = document.getElementById('itemsGrid');

    // User apni city select kare -> sirf usi city ke products dikhein
    function applyLocationFilter() {
        const selectedCity = userCitySelect.value;
        document.querySelectorAll('.item-card').forEach(card => {
            const cardCity = (card.dataset.ownerLocation || card.dataset.location || '').toLowerCase();
if (!selectedCity || cardCity === selectedCity) {
                card.style.display = '';
            } else {
                card.style.display = 'none';
            }
        });
    }

    userCitySelect.addEventListener('change', applyLocationFilter);

});

document.addEventListener('DOMContentLoaded', () => {
    const detectBtn = document.getElementById('detectLocationBtn');
    const userCitySelect = document.getElementById('userCity');

    detectBtn.addEventListener('click', () => {
        if (!navigator.geolocation) {
            alert('Location detection is not supported in this browser.');
            return;
        }

        detectBtn.disabled = true;
        detectBtn.innerText = '⏳';

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;

                try {
                    const response = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
                    );
                    const data = await response.json();

                    // Detect city string from API
                    const rawCity = (
                        data.address.city ||
                        data.address.town ||
                        data.address.county ||
                        data.address.suburb ||
                        data.address.village ||
                        data.address.state_district ||
                        ''
                    ).toLowerCase().trim();

                    console.log('Detected raw location:', rawCity);

                    // Smart Matching Logic: Dropdown options me se best match search karein
                    let matchedOption = Array.from(userCitySelect.options).find(opt => {
                        if (!opt.value) return false;
                        return rawCity.includes(opt.value.toLowerCase()) || opt.value.toLowerCase().includes(rawCity);
                    });

                    if (matchedOption) {
                        userCitySelect.value = matchedOption.value;
                        userCitySelect.dispatchEvent(new Event('change'));
                        alert(`Location set to: ${matchedOption.text}`);
                    } else {
                        alert(`Your city (${rawCity || 'unknown'}) isn't in our list yet.`);
                    }
                } catch (err) {
                    alert('Could not detect your city. Please select manually.');
                } finally {
                    detectBtn.disabled = false;
                    detectBtn.innerText = '📍';
                }
            },
            (error) => {
                alert('Location permission denied. Please select your city manually.');
                detectBtn.disabled = false;
                detectBtn.innerText = '📍';
            }
        );
    });
});
document.addEventListener('DOMContentLoaded', () => {
    const grid = document.getElementById('itemsGrid');
    const modal = document.getElementById('detailsModal');
    const token = () => localStorage.getItem('rc_token');
    let selectedCard = null;
    const fees = { car: 80, bike: 40, cycle: 20 };

    loadVehicles().catch(error => {
        console.error('Vehicle load error:', error);
        grid.textContent = 'Vehicle load nahi hue. Backend server check karo.';
    });
    setInterval(() => checkOwnerAvailability().catch(console.error), 60 * 1000);

    grid.addEventListener('click', event => {
        const button = event.target.closest('.view-details-btn');
        if (!button) return;
        selectedCard = button.closest('.item-card');
        const category = selectedCard.classList.contains('car') ? 'car' :
            selectedCard.classList.contains('bike') ? 'bike' : 'cycle';
        document.getElementById('detailsImg').src = selectedCard.dataset.img;
        document.getElementById('detailsTitle').textContent = selectedCard.dataset.title;
        document.getElementById('detailsPrice').textContent = selectedCard.dataset.price;
        document.getElementById('detailsOwnerName').textContent = selectedCard.dataset.ownerName || 'Vehicle owner';
        document.getElementById('detailsMileage').textContent = selectedCard.dataset.mileage || 'Not provided';
        document.getElementById('detailsService').textContent = selectedCard.dataset.service || 'Not provided';
        const unlocked = Boolean(selectedCard.dataset.ownerPhone);
        document.getElementById('detailsPhone').textContent = selectedCard.dataset.ownerPhone || 'Hidden until contact unlock';
        document.getElementById('detailsLocation').textContent = selectedCard.dataset.ownerLocation || 'Not available';
        document.getElementById('detailsLocked').classList.toggle('hidden', unlocked);
        document.getElementById('detailsUnlocked').classList.toggle('hidden', !unlocked);
        document.getElementById('unlockBtn').textContent = `Pay ₹${fees[category]} to Unlock Contact`;
        modal.classList.add('active');
    });

    document.getElementById('closeDetailsModal').addEventListener('click', () => modal.classList.remove('active'));
    document.getElementById('unlockBtn').addEventListener('click', async () => {
        if (!selectedCard) return;
        if (!token()) return alert('Contact unlock karne ke liye pehle login karo.');
        try {
            const orderResponse = await fetch(`${API_BASE}/api/payments/create-order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
                body: JSON.stringify({ vehicleId: selectedCard.dataset.id })
            });
            const order = await orderResponse.json();
            if (!orderResponse.ok || !order.success) return alert(order.message || 'Payment order nahi bana.');
            if (order.alreadyUnlocked) {
                selectedCard.dataset.ownerPhone = order.ownerPhone;
                document.getElementById('detailsPhone').textContent = order.ownerPhone;
                document.getElementById('detailsLocation').textContent = order.ownerLocation;
                document.getElementById('detailsLocked').classList.add('hidden');
                document.getElementById('detailsUnlocked').classList.remove('hidden');
                return;
            }

            new Razorpay({
                key: order.keyId,
                amount: order.amount,
                currency: order.currency,
                name: 'Rent Connect India',
                description: `Contact unlock: ${order.vehicleTitle}`,
                order_id: order.orderId,
                prefill: { name: order.userName, email: order.userEmail, contact: order.userPhone },
                handler: async payment => {
                    const verifyResponse = await fetch(`${API_BASE}/api/payments/verify`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
                        body: JSON.stringify({ ...payment, vehicleId: selectedCard.dataset.id })
                    });
                    const result = await verifyResponse.json();
                    if (!verifyResponse.ok || !result.success) return alert(result.message || 'Payment verify nahi hui.');
                    selectedCard.dataset.ownerPhone = result.ownerPhone;
                    document.getElementById('detailsPhone').textContent = result.ownerPhone;
                    document.getElementById('detailsLocation').textContent = result.ownerLocation;
                    document.getElementById('detailsLocked').classList.add('hidden');
                    document.getElementById('detailsUnlocked').classList.remove('hidden');
                    alert('Payment verified. Owner contact unlock ho gaya.');
                }
            }).open();
        } catch (error) {
            console.error('Checkout error:', error);
            alert('Payment start nahi hui. Razorpay keys aur backend terminal check karo.');
        }
    });
});

