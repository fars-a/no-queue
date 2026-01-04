// script.js

const State = {
    // Default Data
    defaultServices: [
        { id: 'c1', name: 'Counter 1', avgTime: 5, prefix: 'A' },
        { id: 'c2', name: 'Counter 2', avgTime: 5, prefix: 'B' },
        { id: 'c3', name: 'Counter 3', avgTime: 5, prefix: 'C' },
        { id: 'c4', name: 'Counter 4', avgTime: 5, prefix: 'D' }
    ],

    defaultCounters: [
        { id: 1, name: 'Counter 1', staffId: 'staff', currentToken: null, serviceIds: ['c1'] },
        { id: 2, name: 'Counter 2', staffId: 'staff2', currentToken: null, serviceIds: ['c2'] },
        { id: 3, name: 'Counter 3', staffId: 'staff3', currentToken: null, serviceIds: ['c3'] },
        { id: 4, name: 'Counter 4', staffId: 'staff4', currentToken: null, serviceIds: ['c4'] }
    ],

    // State Properties
    services: [],
    counters: [],
    tokens: [],
    users: [],
    currentUser: null,

    // Initialization
    init() {
        this.load();
        this.patchData(); // Auto-fix data issues
        this.checkAuth();
    },

    load() {
        // Load or Initialize Services
        const storedServices = localStorage.getItem('nq_services');
        this.services = storedServices ? JSON.parse(storedServices) : [...this.defaultServices];

        // Load or Initialize Counters
        const storedCounters = localStorage.getItem('nq_counters');
        this.counters = storedCounters ? JSON.parse(storedCounters) : [...this.defaultCounters];

        // Load Tokens
        const storedTokens = localStorage.getItem('nq_tokens');
        this.tokens = storedTokens ? JSON.parse(storedTokens) : [];

        // Load Users
        const storedUsers = localStorage.getItem('nq_users');
        this.users = storedUsers ? JSON.parse(storedUsers) : [];

        // Load User Session
        const storedUser = localStorage.getItem('nq_user');
        this.currentUser = storedUser ? JSON.parse(storedUser) : null;

        // Save defaults if first run
        if (!storedServices) this.save();
    },

    patchData() {
        let changed = false;

        // Ensure all default services exist and are in order
        this.defaultServices.forEach(defService => {
            if (!this.services.find(s => s.id === defService.id)) {
                this.services.push(defService);
                changed = true;
            }
        });
        // Sort services to ensure sequential flow c1->c2->c3->c4
        this.services.sort((a, b) => a.id.localeCompare(b.id));

        // Ensure all default counters are correctly configured
        this.defaultCounters.forEach(defCounter => {
            let counter = this.counters.find(c => c.id === defCounter.id);
            if (!counter) {
                this.counters.push(defCounter);
                changed = true;
            } else {
                // Fix Staff ID if mismatch (e.g. staff1 vs staff)
                if (counter.staffId !== defCounter.staffId) {
                    counter.staffId = defCounter.staffId;
                    changed = true;
                }
                // Fix Service IDs if mismatch
                if (JSON.stringify(counter.serviceIds) !== JSON.stringify(defCounter.serviceIds)) {
                    counter.serviceIds = defCounter.serviceIds;
                    changed = true;
                }
            }
        });

        if (changed) {
            console.log("System data patched to match new configuration.");
            this.save();
        }
    },

    save() {
        localStorage.setItem('nq_services', JSON.stringify(this.services));
        localStorage.setItem('nq_counters', JSON.stringify(this.counters));
        localStorage.setItem('nq_tokens', JSON.stringify(this.tokens));
        localStorage.setItem('nq_users', JSON.stringify(this.users));

        if (this.currentUser) {
            localStorage.setItem('nq_user', JSON.stringify(this.currentUser));
        } else {
            localStorage.removeItem('nq_user');
        }
    },

    // Auth
    register(username, password, phone, role = 'user') {
        if (this.users.find(u => u.username === username)) {
            return { success: false, message: 'Username already exists' };
        }

        const newUser = {
            id: Date.now().toString(),
            username,
            password, // In a real app, this should be hashed!
            phone,
            role,
            createdAt: Date.now()
        };

        this.users.push(newUser);
        this.save();
        return { success: true, message: 'Registration successful' };
    },

    login(username, password) {
        // Special case for default admin/staff if not in DB (for prototype convenience)
        if (username === 'admin' && password === 'admin') {
            return this.createSession({ username: 'admin', role: 'admin', name: 'Administrator' });
        }
        if (username === 'staff' && password === 'staff') {
            return this.createSession({ username: 'staff', role: 'staff', name: 'Staff Member' });
        }
        // Allow staff2, staff3, staff4 etc.
        if (username.startsWith('staff') && password === username) {
            return this.createSession({ username: username, role: 'staff', name: 'Staff ' + username.replace('staff', '') });
        }

        const user = this.users.find(u => u.username === username && u.password === password);

        if (user) {
            return this.createSession(user);
        }

        return false;
    },

    createSession(user) {
        this.currentUser = user;
        this.save();
        return true;
    },

    logout() {
        this.currentUser = null;
        this.save();
        window.location.href = 'login.html';
    },

    checkAuth() {
        const path = window.location.pathname;
        const page = path.split('/').pop();

        // Public pages
        if (page === 'login.html' || page === 'register.html' || page === 'index.html' || page === 'display.html') {
            // Allow access to these pages even if logged in (enables user switching)
            return;
        }

        // Protected pages
        if (!this.currentUser) {
            window.location.href = 'login.html';
            return;
        }

        // Role based redirect
        if (page === 'user.html' && this.currentUser.role !== 'user') window.location.href = this.getDashboardByRole();
        if (page === 'staff.html' && this.currentUser.role !== 'staff') window.location.href = this.getDashboardByRole();
        if (page === 'admin.html' && this.currentUser.role !== 'admin') window.location.href = this.getDashboardByRole();

        // Update UI
        const userNameEl = document.getElementById('user-name');
        if (userNameEl) userNameEl.textContent = this.currentUser.username || this.currentUser.name;
    },

    getDashboardByRole() {
        if (!this.currentUser) return 'login.html';
        if (this.currentUser.role === 'user') return 'user.html';
        if (this.currentUser.role === 'staff') return 'staff.html';
        if (this.currentUser.role === 'admin') return 'admin.html';
        return 'login.html';
    },

    // Core Logic
    generateToken(serviceId, priority, phone) {
        const service = this.services.find(s => s.id === serviceId);
        // Count tokens for this service today (simplified: all time for prototype)
        const count = this.tokens.filter(t => t.serviceId === serviceId).length + 1;
        const tokenNumber = `${service.prefix}-${100 + count}`;

        const newToken = {
            id: Date.now().toString(),
            number: tokenNumber,
            serviceId: serviceId,
            priority: priority, // 'normal', 'senior', 'disabled'
            phone: phone,
            status: 'waiting',
            createdAt: Date.now(),
            userId: this.currentUser ? this.currentUser.id : null
        };

        this.tokens.push(newToken);
        this.save();
        return newToken;
    },

    calculateWaitTime(serviceId, tokenId = null) {
        const service = this.services.find(s => s.id === serviceId);
        if (!service) return 0;

        let tokensAhead = 0;
        const waitingTokens = this.tokens.filter(t => t.serviceId === serviceId && t.status === 'waiting');

        if (tokenId) {
            // If we have a specific token, count only those created BEFORE it
            const myToken = this.tokens.find(t => t.id === tokenId);
            if (myToken) {
                tokensAhead = waitingTokens.filter(t => t.createdAt < myToken.createdAt).length;
            }
        } else {
            // If no token (checking before generating), count everyone
            tokensAhead = waitingTokens.length;
        }

        const countersForService = this.counters.filter(c => c.serviceIds.includes(serviceId)).length || 1;
        return Math.ceil((tokensAhead * service.avgTime) / countersForService);
    },

    getPeopleAhead(serviceId) {
        return this.tokens.filter(t => t.serviceId === serviceId && t.status === 'waiting').length;
    },

    getNextTokenForCounter(counterId) {
        const counter = this.counters.find(c => c.id == counterId);
        if (!counter) return null;

        const relevantTokens = this.tokens.filter(t =>
            counter.serviceIds.includes(t.serviceId) && t.status === 'waiting'
        );

        // Priority logic: Disabled > Senior > Normal
        const disabled = relevantTokens.find(t => t.priority === 'disabled');
        if (disabled) return disabled;

        const senior = relevantTokens.find(t => t.priority === 'senior');
        if (senior) return senior;

        return relevantTokens[0] || null;
    },

    callToken(counterId, tokenId) {
        const token = this.tokens.find(t => t.id === tokenId);
        const counter = this.counters.find(c => c.id == counterId);

        if (token && counter) {
            token.status = 'called';
            counter.currentToken = token;
            this.save();
            return true;
        }
        return false;
    },

    completeToken(counterId) {
        const counter = this.counters.find(c => c.id == counterId);
        if (counter && counter.currentToken) {
            const token = this.tokens.find(t => t.id === counter.currentToken.id);
            if (token) {
                // Automatic Sequential Flow: Find next service
                const currentServiceIndex = this.services.findIndex(s => s.id === token.serviceId);

                console.log(`Completing token ${token.number}. Current Service: ${token.serviceId} (Index: ${currentServiceIndex})`);

                // If there is a next service, transfer to it
                if (currentServiceIndex !== -1 && currentServiceIndex < this.services.length - 1) {
                    const nextService = this.services[currentServiceIndex + 1];
                    console.log(`Transferring to next service: ${nextService.name} (${nextService.id})`);

                    token.serviceId = nextService.id;
                    token.status = 'waiting';
                    counter.currentToken = null;
                    this.save();
                    return { success: true, action: 'transferred', target: nextService.name };
                }

                console.log("No next service found. Marking as completed.");
                // If no next service, mark as completed
                token.status = 'completed';
                counter.currentToken = null;
                this.save();
                return { success: true, action: 'completed' };
            }
        }
        return { success: false };
    },

    transferToken(counterId, targetServiceId) {
        const counter = this.counters.find(c => c.id == counterId);
        if (counter && counter.currentToken) {
            const token = this.tokens.find(t => t.id === counter.currentToken.id);
            if (token) {
                token.serviceId = targetServiceId;
                token.status = 'waiting';
                // Reset priority for next step? Keeping it same for now.
                counter.currentToken = null;
                this.save();
                return true;
            }
        }
        return false;
    },

    getCounterForStaff(username) {
        return this.counters.find(c => c.staffId === username);
    },

    // Helpers
    getUserTokens(phone) {
        // Strict filtering: If user has an ID, only show tokens with that ID.
        if (this.currentUser && this.currentUser.id) {
            return this.tokens.slice().reverse().filter(t => t.userId === this.currentUser.id);
        }
        // Fallback for legacy data or guest users (by phone)
        return this.tokens.slice().reverse().filter(t => t.phone === phone);
    }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    State.init();

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            State.logout();
        });
    }
});

