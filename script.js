// script.js

const State = {
    // Default Data
    defaultServices: [
        { id: 'c1', name: 'Counter 1', avgTime: 10, prefix: 'A' },
        { id: 'c2', name: 'Counter 2', avgTime: 10, prefix: 'B' },
        { id: 'c3', name: 'Counter 3', avgTime: 10, prefix: 'C' },
        { id: 'c4', name: 'Counter 4', avgTime: 10, prefix: 'D' }
    ],

    defaultPriorities: [
        { id: 'disabled', name: 'Differently Abled', weight: 3, active: true },
        { id: 'senior', name: 'Senior Citizens', weight: 2, active: true },
        { id: 'normal', name: 'Normal', weight: 1, active: true }
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
    priorities: [],
    users: [],
    currentUser: null,
    systemStatus: 'CLOSED', // OPEN or CLOSED
    settings: {
        initialBuffer: 10 // Minutes
    },

    // Initialization
    init() {
        this.load();
        this.patchData(); // Auto-fix data issues
        this.checkAuth();
    },

    load() {
        const storedServices = localStorage.getItem('nq_services');
        this.services = storedServices ? JSON.parse(storedServices) : [...this.defaultServices];

        // Load or Initialize Priorities
        const storedPriorities = localStorage.getItem('nq_priorities');
        this.priorities = storedPriorities ? JSON.parse(storedPriorities) : [...this.defaultPriorities];

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

        // Load System Status
        const storedStatus = localStorage.getItem('nq_system_status');
        this.systemStatus = storedStatus || 'CLOSED';

        // Load Settings
        const storedSettings = localStorage.getItem('nq_settings');
        if (storedSettings) {
            this.settings = JSON.parse(storedSettings);
        }

        // Save defaults if first run
        if (!storedServices) this.save();
    },

    patchData() {
        let changed = false;

        // Fix: Enforce avgTime = 10 for all services
        this.services.forEach(s => {
            if (s.avgTime !== 10) {
                s.avgTime = 10;
                changed = true;
            }
        });

        // Ensure all default services exist and are in order
        this.defaultServices.forEach(defService => {
            if (!this.services.find(s => s.id === defService.id)) {
                this.services.push(defService);
                changed = true;
            }
        });
        // Sort services to ensure sequential flow c1->c2->c3->c4
        this.services.sort((a, b) => a.id.localeCompare(b.id));

        // Ensure Default Staff Users Exist
        const defaultStaff = ['staff', 'staff2', 'staff3', 'staff4'];
        defaultStaff.forEach(username => {
            if (!this.users.find(u => u.username === username)) {
                this.users.push({
                    id: Date.now().toString() + Math.random(),
                    username: username,
                    password: username,
                    role: 'staff',
                    name: `Staff Member (${username})`,
                    active: true,
                    createdAt: Date.now()
                });
                changed = true;
            }
        });

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
        localStorage.setItem('nq_priorities', JSON.stringify(this.priorities));

        if (this.currentUser) {
            localStorage.setItem('nq_user', JSON.stringify(this.currentUser));
        } else {
            localStorage.removeItem('nq_user');
        }
        localStorage.setItem('nq_system_status', this.systemStatus);
        localStorage.setItem('nq_settings', JSON.stringify(this.settings));
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
            active: true, // Default active
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
        if (this.systemStatus === 'CLOSED') {
            return { error: "System is currrently CLOSED. Tokens cannot be generated." };
        }

        const service = this.services.find(s => s.id === serviceId);
        // Count tokens for this service today (simplified: all time for prototype)
        const count = this.tokens.filter(t => t.serviceId === serviceId).length + 1;
        const tokenNumber = `${service.prefix}-${100 + count}`;

        // Expected Time Calculation
        let expectedTime = Date.now();
        const waitingTokens = this.tokens.filter(t => t.serviceId === serviceId && t.status === 'waiting');

        if (waitingTokens.length === 0) {
            // First token: Current Time + Buffer (Configurable)
            expectedTime = Date.now() + (this.settings.initialBuffer * 60 * 1000);
        } else {
            // Subsequent: Last token expected time + Avg Service Time
            // Find the last waiting token (or we should check the absolute last token?)
            // Requirement says "last token expected time".
            // Let's look at the VERY last token generated for this service, regardless of status?
            // "If token is not first: Expected call time = last token expected time + average service time"
            // We should use the last token added to the array for this service.
            const serviceTokens = this.tokens.filter(t => t.serviceId === serviceId);
            const lastToken = serviceTokens[serviceTokens.length - 1]; // Since we push, this is the last one.

            if (lastToken && lastToken.expectedTime) {
                expectedTime = lastToken.expectedTime + (service.avgTime * 60 * 1000);
            } else {
                // Fallback if last token has no expected time (legacy)
                expectedTime = Date.now() + (waitingTokens.length * service.avgTime * 60 * 1000);
            }
        }

        const newToken = {
            id: Date.now().toString(),
            number: tokenNumber,
            serviceId: serviceId,
            priority: priority, // 'normal', 'senior', 'disabled'
            phone: phone,
            status: 'waiting',
            createdAt: Date.now(),
            expectedTime: expectedTime,
            userId: this.currentUser ? this.currentUser.id : null
        };

        this.tokens.push(newToken);
        this.save();
        return newToken;
    },

    calculateWaitTime(serviceId, tokenId = null, priorityToCheck = 'normal') {
        const service = this.services.find(s => s.id === serviceId);
        if (!service) return 0;

        // If specific token, use its expected (scheduled) time
        if (tokenId) {
            const myToken = this.tokens.find(t => t.id === tokenId);
            if (myToken && myToken.expectedTime) {
                const waitMs = myToken.expectedTime - Date.now();
                return Math.max(0, Math.ceil(waitMs / 60000));
            }
        }

        // If estimating for new token
        const waitingTokens = this.tokens.filter(t => t.serviceId === serviceId && t.status === 'waiting');
        if (waitingTokens.length === 0) {
            // If empty, wait is the Initial Buffer
            return this.settings.initialBuffer; // 10 mins
        }

        // Otherwise estimate based strictly on count (fallback logic or "Last Token + Service")
        // But since we want to align with generateToken logic:
        // Estimate = (Last Token Expected - Now) + AvgTime
        const serviceTokens = this.tokens.filter(t => t.serviceId === serviceId);
        const lastToken = serviceTokens[serviceTokens.length - 1];
        if (lastToken && lastToken.expectedTime) {
            const nextTime = lastToken.expectedTime + (service.avgTime * 60 * 1000);
            return Math.max(0, Math.ceil((nextTime - Date.now()) / 60000));
        }

        // Fallback (Legacy)
        let tokensAhead = 0;
        const getWeight = (pid) => {
            const p = this.priorities.find(p => p.id === pid);
            return p ? p.weight : 0;
        };
        const checkId = priorityToCheck || 'normal';
        const myWeight = getWeight(checkId);
        waitingTokens.forEach(t => {
            if (getWeight(t.priority) >= myWeight) tokensAhead++;
        });

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

        if (relevantTokens.length === 0) return null;

        // Dynamic Sort by Priority Weight (Descending) then Creation Time (Ascending)
        relevantTokens.sort((a, b) => {
            const wA = this.priorities.find(p => p.id === a.priority)?.weight || 0;
            const wB = this.priorities.find(p => p.id === b.priority)?.weight || 0;

            if (wA !== wB) return wB - wA; // Higher weight first
            return a.createdAt - b.createdAt; // FIFO
        });

        return relevantTokens[0];
    },

    callToken(counterId, tokenId) {
        const token = this.tokens.find(t => t.id === tokenId);
        const counter = this.counters.find(c => c.id == counterId);

        if (token && counter) {
            token.status = 'called';
            // token.calledAt = Date.now(); // Removed as per request
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
                    // Re-calculate expected time for next service?
                    // Ideally yes, but basic requirement just says for generation. 
                    // We'll leave it simple or reset it? Let's leave it.

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

    skipToken(counterId) {
        const counter = this.counters.find(c => c.id == counterId);
        if (counter && counter.currentToken) {
            const token = this.tokens.find(t => t.id === counter.currentToken.id);
            if (token) {
                token.status = 'skipped';
                counter.currentToken = null;
                this.save();
                return { success: true };
            }
        }
        return { success: false };
    },

    // System Management
    setSystemStatus(status) {
        this.systemStatus = status; // 'OPEN' or 'CLOSED'
        this.save();
    },

    toggleStaffStatus(userId, isActive) {
        const user = this.users.find(u => u.id === userId || u.username === userId);
        if (user) {
            user.active = isActive;
            this.save();
            return true;
        }
        return false;
    },

    getActiveStaff() {
        return this.users.filter(u => u.role === 'staff' && (u.active !== false)); // Default true if undefined
    },

    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        this.save();
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

