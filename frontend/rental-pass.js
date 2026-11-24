(() => {
    const API_BASE = window.RC_API_BASE ||
        ((location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? 'http://127.0.0.1:5001' : '');
    const params = new URLSearchParams(location.search);
    const rentalId = params.get('rentalId');
    const loading = document.getElementById('passLoading');
    const passDocument = document.getElementById('passDocument');
    const passMessage = document.getElementById('passMessage');
    const showError = message => {
        loading.textContent = '';
        passMessage.textContent = message;
    };

    async function loadPass() {
        const token = localStorage.getItem('rc_token');
        if (!token) return showError('Rental pass dekhne ke liye renter ya owner account se login karo. Uske baad monthly rentals dashboard se pass dobara kholo.');
        if (!rentalId) return showError('Rental reference missing hai. Monthly rentals dashboard se pass kholo.');
        try {
            const response = await fetch(`${API_BASE}/api/monthly-rentals/${encodeURIComponent(rentalId)}/pass`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const result = await response.json();
            if (!response.ok || !result.success) return showError(result.message || 'Rental pass load nahi ho saka.');
            const pass = result.pass;
            const passStatus = document.getElementById('passStatus');
            passStatus.textContent = pass.status === 'active' ? 'ACTIVE MONTHLY RENTAL' : 'MONTHLY RENTAL ENDED';
            document.getElementById('passVehicle').textContent = pass.vehicleTitle;
            document.getElementById('passRenter').textContent = pass.renterName;
            document.getElementById('passRegistration').textContent = pass.registrationNumber;
            document.getElementById('passDates').textContent = pass.startDate || 'Not recorded';
            document.getElementById('passMonthlyRent').textContent = `₹${Number(pass.monthlyPrice).toLocaleString('en-IN')} / month`;
            if (pass.endedAt) document.getElementById('passDates').textContent += ` · ended ${pass.endedAt}`;
            document.getElementById('passOwner').textContent = pass.ownerName;
            const phone = document.getElementById('passPhone');
            phone.textContent = pass.ownerPhone || 'Contact owner';
            phone.href = pass.ownerPhone ? `tel:${pass.ownerPhone}` : '#';
            document.getElementById('passLocation').textContent = pass.ownerLocation || 'Not provided';
            document.getElementById('passReference').textContent = pass.rentalId;
            loading.classList.add('hidden');
            passDocument.classList.remove('hidden');
        } catch (error) {
            console.error('Rental pass load error:', error);
            showError('Rental pass load nahi ho saka. Internet connection check karo.');
        }
    }
    document.getElementById('printPassBtn').addEventListener('click', () => window.print());
    loadPass();
})();
