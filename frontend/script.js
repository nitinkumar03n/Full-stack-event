const API_BASE = window.RC_API_BASE ||
    ((location.hostname === 'localhost' || location.hostname === '127.0.0.1')
        ? 'http://127.0.0.1:5001'
        : '');

function applyVehicleFilters() {
    const grid = document.getElementById('itemsGrid');
    if (!grid) return;

    const query = (document.getElementById('searchInput')?.value || '').trim().toLowerCase();
    const selectedCity = (document.getElementById('userCity')?.value || '').toLowerCase();
    const maxBudgetValue = document.getElementById('budgetFilter')?.value || '';
    const maxBudget = maxBudgetValue ? Number(maxBudgetValue) : Infinity;
    const selectedCategory = document.querySelector('.category-btn.active')?.dataset.category || 'all';
    const cards = Array.from(grid.querySelectorAll('.item-card'));
    let visibleCount = 0;

    for (const card of cards) {
        const searchText = [
            card.dataset.title,
            card.dataset.category,
            card.dataset.ownerName,
            card.dataset.ownerLocation,
            card.dataset.mileage,
            card.dataset.service
        ].join(' ').toLowerCase();
        const price = Number(card.dataset.priceAmount);
        const matches = (!query || searchText.includes(query)) &&
            (!selectedCity || card.dataset.ownerLocation === selectedCity) &&
            (selectedCategory === 'all' || card.dataset.category === selectedCategory) &&
            (price <= maxBudget);

        card.style.display = matches ? '' : 'none';
        if (matches) visibleCount += 1;
    }

    const summary = document.getElementById('resultsSummary');
    if (summary) {
        if (!cards.length) {
            summary.textContent = 'Abhi koi available vehicle listed nahi hai.';
        } else if (!visibleCount) {
            summary.textContent = 'In filters se koi vehicle nahi mila. Filters badal kar dekho.';
        } else {
            summary.textContent = `${visibleCount} rental${visibleCount === 1 ? '' : 's'} available`;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const citySelect = document.getElementById('userCity');
    const budgetFilter = document.getElementById('budgetFilter');
    const clearFiltersBtn = document.getElementById('clearFiltersBtn');
    const categoryBtns = document.querySelectorAll('.category-btn');

    searchInput?.addEventListener('input', applyVehicleFilters);
    searchInput?.addEventListener('keydown', event => {
        if (event.key === 'Enter') applyVehicleFilters();
    });
    searchBtn?.addEventListener('click', applyVehicleFilters);
    citySelect?.addEventListener('change', applyVehicleFilters);
    budgetFilter?.addEventListener('change', applyVehicleFilters);

    categoryBtns.forEach(button => {
        button.addEventListener('click', () => {
            categoryBtns.forEach(item => item.classList.remove('active'));
            button.classList.add('active');
            applyVehicleFilters();
        });
    });

    clearFiltersBtn?.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        if (citySelect) citySelect.value = '';
        if (budgetFilter) budgetFilter.value = '';
        categoryBtns.forEach(button => button.classList.toggle('active', button.dataset.category === 'all'));
        applyVehicleFilters();
        searchInput?.blur();
    });
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
    // Modal Open/Close Controls
    const userBtn = document.getElementById('userBtn');
    const authModal = document.getElementById('authModal');
    const closeAuthModal = document.getElementById('closeAuthModal');
    const savedUser = JSON.parse(localStorage.getItem('rc_user') || 'null');
    if (localStorage.getItem('rc_token') && savedUser?.name && userBtn) {
        userBtn.innerText = `👤 ${savedUser.name.split(' ')[0]}`;
    }
    document.getElementById('myBookingsBtn')?.classList.toggle('hidden', !localStorage.getItem('rc_token'));

    if (userBtn && authModal) {
     userBtn.addEventListener('click', () => {
    if (localStorage.getItem('rc_token')) {
        const confirmLogout = confirm('Kya aap logout karna chahte hain?');

        if (confirmLogout) {
            localStorage.removeItem('rc_token');
            localStorage.removeItem('rc_user');
            userBtn.innerText = 'Login';
            document.getElementById('myBookingsBtn')?.classList.add('hidden');
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

    function saveSession(data) {
        localStorage.setItem('rc_token', data.token);
        localStorage.setItem('rc_user', JSON.stringify(data.user));
        const userBtn = document.getElementById('userBtn');
        if (userBtn && data.user?.name) {
            userBtn.innerText = `👤 ${data.user.name.split(' ')[0]}`;
        }
        document.getElementById('myBookingsBtn')?.classList.remove('hidden');
        document.getElementById('authModal').classList.remove('active');
        loadVehicles().catch(console.error);
    }

    document.getElementById('signupForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        const body = {
            name: document.getElementById('signupName').value.trim(),
            email: document.getElementById('signupEmail').value.trim(),
            phone: document.getElementById('signupPhone').value.trim(),
            password: document.getElementById('signupPassword').value,
            role: document.getElementById('userRole').value
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
            saveSession(data);
        } catch (error) {
            console.error(error);
            alert('Registration ke waqt backend se connect nahi ho pa raha.');
        }
    });

    document.getElementById('loginForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        try {
            const response = await fetch(`${API}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    emailOrPhone: document.getElementById('loginEmail').value.trim(),
                    password: document.getElementById('loginPassword').value
                })
            });
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
        const registrationInput = document.getElementById('vehicleRegistration');
        registrationInput.required = selected === 'bike';
        document.getElementById('registrationGroup').classList.toggle('hidden', selected === 'cycle');
        document.getElementById('registrationHint').textContent = selected === 'bike' ? '(required for bike pass)' : '(optional)';
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
            category: vehicle.category,
            priceAmount: vehicle.price,
            price: `₹${vehicle.price} / month`,
            img: vehicle.img,
            ownerPhone: vehicle.ownerPhone || '',
            ownerLocation: vehicle.ownerLocation || '',
            ownerName: vehicle.ownerName || 'Vehicle owner',
            mileage: vehicle.mileage || 'Not provided',
            service: vehicle.service || 'Not provided',
            isOwner: String(Boolean(vehicle.isOwner)),
            ownerVerified: String(Boolean(vehicle.ownerVerified)),
            averageRating: String(vehicle.averageRating || 0),
            reviewCount: String(vehicle.reviewCount || 0)
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
        const ratingText = vehicle.reviewCount ? ` · ⭐ ${Number(vehicle.averageRating).toFixed(1)} (${vehicle.reviewCount})` : ' · No reviews yet';
        publicInfo.textContent = `${vehicle.ownerVerified ? '✓ Verified owner · ' : ''}City: ${vehicle.ownerLocation || 'Not provided'} · Owner: ${vehicle.ownerName || 'Vehicle owner'}${ratingText} · Mileage: ${vehicle.mileage || 'Not provided'} · Service: ${vehicle.service || 'Not provided'}`;
        const details = document.createElement('button');
        details.type = 'button';
        details.className = 'view-details-btn';
        details.textContent = 'Contact Owner';
        info.append(badge, title, price, publicInfo, details);
        card.append(heart, image, info);
        grid.append(card);
    }
    applyVehicleFilters();
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
    if (!token) return;
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
        if (!token) {
            document.getElementById('authModal').classList.add('active');
            return alert('Vehicle list karne ke liye pehle login ya register karo.');
        }

        const formData = new FormData();
        formData.append('category', vehicleCategory.value);
        formData.append('brand', brandSelect.value);
        formData.append('model', modelSelect.value);
        formData.append('registrationNumber', document.getElementById('vehicleRegistration').value.trim().toUpperCase());
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
        const summary = document.getElementById('resultsSummary');
        if (summary) summary.textContent = 'Vehicle list load nahi hui.';
    });
    setInterval(() => checkOwnerAvailability().catch(console.error), 60 * 1000);

    grid.addEventListener('click', event => {
        const button = event.target.closest('.view-details-btn');
        if (!button) return;
        selectedCard = button.closest('.item-card');
        const category = selectedCard.classList.contains('car') ? 'car' : selectedCard.classList.contains('bike') ? 'bike' : 'cycle';
        document.getElementById('detailsImg').src = selectedCard.dataset.img;
        document.getElementById('detailsTitle').textContent = selectedCard.dataset.title;
        document.getElementById('detailsPrice').textContent = selectedCard.dataset.price;
        const requestForm = document.getElementById('monthlyRentalRequestForm');
        const isOwnerListing = selectedCard.dataset.isOwner === 'true';
        requestForm.classList.toggle('hidden', isOwnerListing || selectedCard.dataset.available === 'false');
        requestForm.reset();
        document.getElementById('monthlyRentalRate').textContent = `Monthly rent: ${selectedCard.dataset.price}`;
        document.getElementById('detailsVerifiedBadge').classList.toggle('hidden', selectedCard.dataset.ownerVerified !== 'true');
        document.getElementById('detailsRating').textContent = selectedCard.dataset.reviewCount === '0' ? 'No reviews yet' : `⭐ ${Number(selectedCard.dataset.averageRating).toFixed(1)} from ${selectedCard.dataset.reviewCount} renter review${selectedCard.dataset.reviewCount === '1' ? '' : 's'}`;
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
        loadVehicleReviews(selectedCard.dataset.id);
    });

    async function loadVehicleReviews(vehicleId) {
        const container = document.getElementById('vehicleReviews');
        container.textContent = 'Loading reviews...';
        try {
            const response = await fetch(`${API_BASE}/api/vehicles/${vehicleId}/reviews`);
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.message || 'Reviews load nahi hue.');
            container.replaceChildren();
            if (!result.reviews.length) {
                container.textContent = 'Abhi koi renter review nahi hai.';
                return;
            }
            result.reviews.forEach(review => {
                const card = document.createElement('article');
                card.className = 'public-review';
                const heading = document.createElement('strong');
                heading.textContent = `${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)} · ${review.renterName}`;
                const comment = document.createElement('p');
                comment.textContent = review.comment || 'No written comment.';
                card.append(heading, comment);
                container.append(card);
            });
        } catch (error) {
            console.error('Vehicle reviews load error:', error);
            container.textContent = error.message || 'Reviews load nahi hue.';
        }
    }

    document.getElementById('monthlyRentalRequestForm').addEventListener('submit', async event => {
        event.preventDefault();
        if (!selectedCard) return;
        if (!token()) {
            modal.classList.remove('active');
            document.getElementById('authModal').classList.add('active');
            return alert('Monthly rent request bhejne ke liye pehle login karo.');
        }
        const button = event.currentTarget.querySelector('button[type="submit"]');
        button.disabled = true;
        try {
            const response = await fetch(`${API_BASE}/api/monthly-rentals`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
                body: JSON.stringify({ vehicleId: selectedCard.dataset.id })
            });
            const result = await response.json();
            if (!response.ok || !result.success) return alert(result.message || 'Request nahi bheji ja saki.');
            alert(result.message);
            modal.classList.remove('active');
        } catch (error) {
            console.error('Monthly rental request error:', error);
            alert('Request nahi bheji ja saki. Backend connection check karo.');
        } finally { button.disabled = false; }
    });

    const bookingsModal = document.getElementById('bookingsModal');
    const bookingsContent = document.getElementById('bookingsContent');
    function escapeHtml(value = '') {
        return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    }
    function monthlyRentalCard(rental, side) {
        const vehicle = rental.vehicle || {};
        const counterpart = side === 'owner' ? rental.renter : rental.owner;
        const counterpartHtml = side === 'owner'
            ? `<p>Requested by: ${escapeHtml(counterpart?.name || 'Renter')} · ${escapeHtml(counterpart?.email || '')} · ${escapeHtml(counterpart?.phone || '')}</p>`
            : `<p>Owner: ${escapeHtml(counterpart?.name || 'Vehicle owner')}</p>`;
        let actions = '';
        if (rental.status === 'pending' && side === 'owner') actions = '<button class="booking-action" data-action="accept">Accept</button><button class="booking-action secondary" data-action="decline">Decline</button>';
        else if (rental.status === 'pending' && side === 'renter') actions = '<button class="booking-action secondary" data-action="cancel">Cancel request</button>';
        else if (rental.status === 'active') actions = '<button class="booking-action secondary" data-action="end">End monthly rental</button>';
        const pass = ['active', 'ended'].includes(rental.status)
            ? `<div class="booking-actions"><a class="booking-action pass-link" href="/rental-pass.html?rentalId=${encodeURIComponent(rental.id)}" target="_blank" rel="noopener">Open / print rental pass</a></div>` : '';
        const canReview = side === 'renter' && rental.status === 'ended' && !rental.reviewSubmitted;
        const review = canReview ? '<form class="booking-review-form"><label>Rating <select name="rating" required><option value="">Choose</option><option value="5">★★★★★</option><option value="4">★★★★</option><option value="3">★★★</option><option value="2">★★</option><option value="1">★</option></select></label><textarea name="comment" maxlength="1000" placeholder="Share your rental experience"></textarea><button type="submit" class="booking-action">Submit review</button></form>' : '';
        const started = rental.startDate ? `Started ${escapeHtml(rental.startDate)}` : 'Waiting for owner approval';
        return `<article class="booking-card" data-rental-id="${escapeHtml(rental.id)}">
            <div class="booking-card-heading"><strong>${escapeHtml(vehicle.title || 'Vehicle')}</strong><span class="booking-status ${escapeHtml(rental.status)}">${escapeHtml(rental.status)}</span></div>
            <p>${escapeHtml(vehicle.category || '')}${vehicle.city ? ` · ${escapeHtml(vehicle.city)}` : ''}</p>
            <p>₹${Number(rental.monthlyPrice).toLocaleString('en-IN')} / month · ${started}</p>
            ${counterpartHtml}<p class="booking-note">Monthly rent is paid directly to the owner.</p><div class="booking-actions">${actions}</div>${pass}${review}
            ${side === 'renter' && rental.reviewSubmitted ? '<p class="review-submitted">✓ Review submitted</p>' : ''}
        </article>`;
    }
    async function renderBookings() {
        const currentToken = token();
        if (!currentToken) return;
        bookingsContent.textContent = 'Loading monthly rentals...';
        try {
            const response = await fetch(`${API_BASE}/api/monthly-rentals`, { headers: { Authorization: `Bearer ${currentToken}` } });
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.message || 'Monthly rentals load nahi hue.');
            const renterItems = result.asRenter || [];
            const ownerItems = result.forMyVehicles || [];
            const verificationResponse = await fetch(`${API_BASE}/api/verification/status`, { headers: { Authorization: `Bearer ${currentToken}` } });
            const verification = await verificationResponse.json();
            if (verificationResponse.ok && verification.success) {
                document.getElementById('verificationStatus').textContent = verification.status;
                document.getElementById('requestVerificationBtn').classList.toggle('hidden', ['pending', 'verified'].includes(verification.status));
            }
            bookingsContent.innerHTML = `<section><h3>Requests for my listings</h3>${ownerItems.length ? ownerItems.map(item => monthlyRentalCard(item, 'owner')).join('') : '<p class="empty-bookings">Abhi koi monthly rental request nahi hai.</p>'}</section><section><h3>My monthly rent requests</h3>${renterItems.length ? renterItems.map(item => monthlyRentalCard(item, 'renter')).join('') : '<p class="empty-bookings">Aapne abhi request nahi bheji.</p>'}</section>`;
        } catch (error) {
            console.error('Monthly rentals load error:', error);
            bookingsContent.textContent = error.message || 'Monthly rentals load nahi hue.';
        }
    }
    document.getElementById('myBookingsBtn').addEventListener('click', async () => {
        if (!token()) { document.getElementById('authModal').classList.add('active'); return; }
        bookingsModal.classList.add('active');
        await renderBookings();
    });
    document.getElementById('closeBookingsModal').addEventListener('click', () => bookingsModal.classList.remove('active'));
    document.getElementById('requestVerificationBtn').addEventListener('click', async event => {
        event.currentTarget.disabled = true;
        try {
            const response = await fetch(`${API_BASE}/api/verification/request`, { method: 'POST', headers: { Authorization: `Bearer ${token()}` } });
            const result = await response.json();
            if (!response.ok || !result.success) return alert(result.message || 'Verification request nahi bheji ja saki.');
            alert(result.message);
            document.getElementById('verificationStatus').textContent = result.status;
            if (result.status === 'pending') event.currentTarget.classList.add('hidden');
        } catch (error) {
            console.error('Verification request error:', error);
            alert('Verification request bheji nahi ja saki.');
        } finally { event.currentTarget.disabled = false; }
    });
    bookingsContent.addEventListener('submit', async event => {
        const form = event.target.closest('.booking-review-form');
        if (!form) return;
        event.preventDefault();
        const card = form.closest('[data-rental-id]');
        const button = form.querySelector('button[type="submit"]');
        button.disabled = true;
        try {
            const response = await fetch(`${API_BASE}/api/monthly-rentals/${card.dataset.rentalId}/review`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
                body: JSON.stringify({ rating: form.elements.rating.value, comment: form.elements.comment.value })
            });
            const result = await response.json();
            if (!response.ok || !result.success) return alert(result.message || 'Review submit nahi hua.');
            alert(result.message); await renderBookings(); await loadVehicles();
        } catch (error) { console.error('Review submit error:', error); alert('Review submit nahi hua.'); }
        finally { button.disabled = false; }
    });
    bookingsContent.addEventListener('click', async event => {
        const button = event.target.closest('[data-action]');
        if (!button) return;
        const card = button.closest('[data-rental-id]');
        button.disabled = true;
        try {
            const response = await fetch(`${API_BASE}/api/monthly-rentals/${card.dataset.rentalId}/respond`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
                body: JSON.stringify({ action: button.dataset.action })
            });
            const result = await response.json();
            if (!response.ok || !result.success) return alert(result.message || 'Monthly rental update nahi hui.');
            await renderBookings();
        } catch (error) { console.error('Monthly rental update error:', error); alert('Monthly rental update nahi hui. Backend connection check karo.'); }
        finally { button.disabled = false; }
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

